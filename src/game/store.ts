// Estado global: navegación entre pantallas, partida guardada y cuenta de jugador.
import { create } from 'zustand'
import { AREAS, getArea, spotKey, type Spot } from './world.ts'
import { api, apiEnabled, ApiError, type ResultIn } from './api.ts'
import { audio } from './audio.ts'

export type SpellId =
  | 'undoMove' | 'timeBonus' | 'addPawn' | 'destroyPawn' | 'frozenPiece' | 'untouchablePiece' | 'jumpingPiece' | 'prohibitedCell'
  | 'addWall' | 'addKnight' | 'addBishop' | 'addRook' | 'move2Times' | 'addQueen'

export const SPELLS: { id: SpellId; price: number }[] = [
  { id: 'undoMove', price: 20 }, { id: 'timeBonus', price: 15 }, { id: 'prohibitedCell', price: 25 }, { id: 'addWall', price: 25 },
  { id: 'addPawn', price: 30 }, { id: 'frozenPiece', price: 40 }, { id: 'untouchablePiece', price: 40 }, { id: 'destroyPawn', price: 45 },
  { id: 'jumpingPiece', price: 50 }, { id: 'addKnight', price: 80 }, { id: 'addBishop', price: 80 }, { id: 'move2Times', price: 100 },
  { id: 'addRook', price: 120 }, { id: 'addQueen', price: 200 },
]

export interface Save {
  v: 1
  elo: number
  gold: number
  games: number
  /** Mayor área habilitada (1–10) */
  area: number
  /** Niveles ganados por castillo: "area:spot" → nivel máximo superado */
  spots: Record<string, number>
  spells: Partial<Record<SpellId, number>>
  /** Historias y mensajes del mapa ya vistos */
  seen: string[]
  finished: boolean
  stamp: number
}

export interface Settings { music: number; sfx: number; voice: number; pieces: 'leyenda' | 'clasicas' }

export type Screen =
  | { name: 'menu' }
  | { name: 'world' }
  | { name: 'area'; area: number; message?: string }
  | { name: 'story'; id: string; next: Screen }
  | { name: 'play'; area: number; spot: number; level: number }
  | { name: 'lesson'; ids: string[]; back: Screen; title?: string; complete?: { area: number; spot: number } }
  | { name: 'shop'; back: Screen }
  | { name: 'quick' }
  | { name: 'profesor' }
  | { name: 'options' }
  | { name: 'credits' }
  | { name: 'account' }
  | { name: 'ranking' }
  | { name: 'video' }

const newSave = (): Save => ({ v: 1, elo: 1000, gold: 0, games: 0, area: 1, spots: {}, spells: {}, seen: [], finished: false, stamp: Date.now() })
const KEY = 'ayl.save', SET = 'ayl.settings', TOK = 'ayl.session'

function read<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? { ...fallback, ...JSON.parse(s) } : fallback } catch { return fallback }
}
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* modo privado */ } }

export interface Session { token: string; username: string }

interface State {
  screen: Screen
  save: Save
  hasSave: boolean
  settings: Settings
  session: Session | null
  cloud: 'idle' | 'saving' | 'saved' | 'offline'
  go: (s: Screen) => void
  setSettings: (p: Partial<Settings>) => void
  resetAdventure: () => void
  /** Registra el final de una partida y devuelve lo ganado. */
  finishGame: (spot: Spot, level: number, won: boolean, eloDelta: number, gold: number, extra?: Partial<ResultIn>) => { firstWin: boolean; areaDone: boolean }
  markSeen: (id: string) => void
  buySpell: (id: SpellId) => boolean
  useSpell: (id: SpellId) => void
  unlockAll: () => void
  login: (username: string, password: string, register: boolean) => Promise<void>
  logout: () => void
  syncDown: () => Promise<void>
}

let pushTimer: ReturnType<typeof setTimeout> | undefined

export const spotsWon = (s: Save) => Object.values(s.spots).filter((x) => x > 0).length

export const useGame = create<State>((set, get) => {
  const persist = (save: Save) => {
    save.stamp = Date.now()
    write(KEY, save)
    const { session } = get()
    if (!session) return
    clearTimeout(pushTimer)
    set({ cloud: 'saving' })
    pushTimer = setTimeout(() => {
      api.putSave(session.token, { data: save, elo: save.elo, gold: save.gold, max_area: save.area, spots_won: spotsWon(save), games_played: save.games })
        .then(() => set({ cloud: 'saved' }))
        .catch((e) => { if (e instanceof ApiError && e.status === 401) get().logout(); else set({ cloud: 'offline' }) })
    }, 900)
  }

  const settings = read<Settings>(SET, { music: 0.55, sfx: 0.8, voice: 1, pieces: 'leyenda' })
  audio.setVolumes(settings)
  let stored: Save | null = null
  try { const s = localStorage.getItem(KEY); stored = s ? { ...newSave(), ...JSON.parse(s) } : null } catch { stored = null }
  let session: Session | null = null
  try { const s = apiEnabled ? localStorage.getItem(TOK) : null; session = s ? JSON.parse(s) : null } catch { session = null }

  return {
    screen: { name: 'menu' },
    save: stored ?? newSave(),
    hasSave: !!stored,
    settings,
    session,
    cloud: 'idle',

    go: (screen) => set({ screen }),

    setSettings: (p) => {
      const settings = { ...get().settings, ...p }
      write(SET, settings)
      audio.setVolumes(settings)
      set({ settings })
    },

    resetAdventure: () => { const save = newSave(); set({ save, hasSave: true }); persist(save) },

    finishGame: (spot, level, won, eloDelta, gold, extra) => {
      const prev = get().save
      const key = spotKey(spot)
      const had = prev.spots[key] ?? 0
      const save: Save = { ...prev, spots: { ...prev.spots }, games: prev.games + (spot.type === 'lesson' ? 0 : 1) }
      save.elo = Math.max(100, Math.min(3000, prev.elo + eloDelta))
      save.gold = Math.max(0, prev.gold + gold)
      let areaDone = false
      if (won) {
        save.spots[key] = Math.max(had, level)
        if (spot.final && had === 0) {
          areaDone = true
          if (spot.area < 10) save.area = Math.max(save.area, spot.area + 1)
          else save.finished = true
        }
      }
      set({ save, hasSave: true })
      persist(save)
      const { session } = get()
      if (session && spot.type !== 'lesson') {
        void api.postResult(session.token, {
          area: spot.area, spot: spot.n, level, minigame_type: spot.type, won, elo_delta: eloDelta, gold_delta: gold, ...extra,
        }).catch(() => {})
      }
      return { firstWin: won && had === 0, areaDone }
    },

    markSeen: (id) => {
      const prev = get().save
      if (prev.seen.includes(id)) return
      const save = { ...prev, seen: [...prev.seen, id] }
      set({ save, hasSave: true })
      persist(save)
    },

    buySpell: (id) => {
      const prev = get().save
      const price = SPELLS.find((s) => s.id === id)!.price
      if (prev.gold < price) return false
      const save = { ...prev, gold: prev.gold - price, spells: { ...prev.spells, [id]: (prev.spells[id] ?? 0) + 1 } }
      set({ save })
      persist(save)
      return true
    },

    useSpell: (id) => {
      const prev = get().save
      const save = { ...prev, spells: { ...prev.spells, [id]: Math.max(0, (prev.spells[id] ?? 0) - 1) } }
      set({ save })
      persist(save)
    },

    unlockAll: () => {
      const prev = get().save
      const spots = { ...prev.spots }
      for (const a of AREAS) for (const s of a.spots) spots[spotKey(s)] = Math.max(spots[spotKey(s)] ?? 0, 1)
      const save = { ...prev, spots, area: 10 }
      set({ save, hasSave: true })
      persist(save)
    },

    login: async (username, password, register) => {
      const out = register ? await api.register(username, password) : await api.login(username, password)
      const session = { token: out.access_token, username: out.user.username }
      write(TOK, session)
      set({ session })
      await get().syncDown()
    },

    logout: () => {
      try { localStorage.removeItem(TOK) } catch { /* nada */ }
      set({ session: null, cloud: 'idle' })
    },

    // Al entrar: gana la partida con más progreso (la de la nube o la de este dispositivo)
    syncDown: async () => {
      const { session, save, hasSave } = get()
      if (!session) return
      try {
        const cloud = await api.getSave(session.token)
        const remote = cloud.data as Save | null
        const score = (s: Save) => spotsWon(s) * 1000 + s.games
        if (remote && remote.v === 1 && (!hasSave || score(remote) >= score(save))) {
          const merged = { ...newSave(), ...remote }
          write(KEY, merged)
          set({ save: merged, hasSave: true, cloud: 'saved' })
        } else if (hasSave) persist(save)
        else set({ cloud: 'saved' })
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) get().logout()
        else set({ cloud: 'offline' })
      }
    },
  }
})

/** ¿El castillo está habilitado? (el anterior del camino ya fue conquistado) */
export function spotOpen(save: Save, spot: Spot): boolean {
  if (spot.area > save.area) return false
  if (spot.index === 0) return true
  const prev = getArea(spot.area).spots[spot.index - 1]
  return (save.spots[spotKey(prev)] ?? 0) > 0
}
export const spotLevel = (save: Save, spot: Spot) => save.spots[spotKey(spot)] ?? 0

// Sólo en desarrollo: acceso al estado desde la consola (window.__game.getState())
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame
