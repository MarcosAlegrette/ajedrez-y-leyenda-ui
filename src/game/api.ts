// Cliente de la API (FastAPI + MySQL). El juego funciona sin conexión: la nube
// sólo agrega cuenta de jugador, guardado entre dispositivos y ranking.
// En producción la API se activa sólo si se define VITE_API_URL al compilar (por ejemplo en las
// variables de entorno de Amplify). Sin ella el juego funciona igual y oculta cuenta y ranking.
// En desarrollo, por defecto se usa la API local en el puerto 8000.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
  || (import.meta.env.DEV ? `${location.protocol}//${location.hostname}:8000` : '')

/** ¿Hay una API configurada para cuentas, guardado en la nube y ranking? */
export const apiEnabled = BASE !== ''

export interface AuthOut { access_token: string; refresh_token?: string; token_type: string; user: { id: string; username: string } }
export interface CloudSave { data: unknown; elo: number; gold: number; max_area: number; spots_won: number; games_played: number; updated_at: string | null }
export interface RankRow { rank: number; username: string; elo: number; gold: number; max_area: number; spots_won: number }
export interface ResultIn { area: number; spot: number; level: number; minigame_type: string; won: boolean; elo_delta: number; gold_delta: number; moves?: number; duration_seconds?: number }

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.status = status; this.code = code }
}

async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servidor del juego.', 0, 'OFFLINE')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const d = json?.detail
    const msg = typeof d === 'string' ? d : d?.errors?.[0]?.message?.replace(/^Value error, /, '') ?? d?.message ?? 'Ocurrió un error.'
    throw new ApiError(msg, res.status, json?.code ?? d?.code)
  }
  return json as T
}

export const api = {
  register: (username: string, password: string) => call<AuthOut>('POST', '/auth/register', { username, password }),
  login: (username: string, password: string) => call<AuthOut>('POST', '/auth/login', { username, password }),
  me: (token: string) => call<{ id: string; username: string }>('GET', '/auth/me', undefined, token),
  getSave: (token: string) => call<CloudSave>('GET', '/game/save', undefined, token),
  putSave: (token: string, save: Omit<CloudSave, 'updated_at'>) => call<CloudSave>('PUT', '/game/save', save, token),
  postResult: (token: string, r: ResultIn) => call<unknown>('POST', '/game/results', r, token),
  leaderboard: (limit = 20) => call<RankRow[]>('GET', `/game/leaderboard?limit=${limit}`),
}
