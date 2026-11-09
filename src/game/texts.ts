import texts from '../data/texts.json' with { type: 'json' }

const T = texts as Record<string, string>

/** Texto original del juego por clave (texts.xml). */
export const t = (key: string, fallback?: string) => T[key] ?? fallback ?? key
export const has = (key: string) => key in T
