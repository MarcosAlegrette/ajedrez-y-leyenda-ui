// Sistema de puntaje ELO del juego original (tablas de assets/data/elo).
import elo from '../data/elo.json' with { type: 'json' }
import type { MiniType } from './world.ts'

const E = elo as { K: number[]; expected: number[]; bonus: number[]; spots: Record<string, number>; C: Record<string, number> }

const C_NAME: Record<MiniType, string> = {
  lesson: 'Tutorial', maze: 'LaberintosVarios', danger: 'LaberintosVarios', target: 'TiroAlBlanco', collect: 'Recolectores',
  portal: 'SalirAlRecreo', pawnWar: 'GuerraDePeones', piecesPawns: 'PiezasContraPeones', destroy: 'Destructor', battle: 'BatallaFinal',
  coins: 'Tragamonedas', ghosts: 'SpaceInvaders', tropillas: 'Tropillas', check: 'Jaque', saveKing: 'SalvarAlRey', mate: 'JaqueMate',
  tactics: 'Tactica', captures: 'Capturas', piecesKing: 'PiezasContraElRey', helpMate: 'MateAyudado', series: 'SerieBlanca',
  comeCome: 'ComeCome', fruits: 'Frutas', hunters: 'Cazadores', hidden: 'PiezaEscondida', reinforce: 'BatallaConRefuerzos',
  attack: 'Desafio', challenge: 'Desafio',
}

export const spotElo = (area: number, spot: number, level: number) => {
  const base = E.spots[`${area}:${spot}`] ?? 1000 + (area - 1) * 130 + spot * 9
  return base ? base + (level - 1) * 12 : 0
}

export interface EloInput {
  playerElo: number; games: number; type: MiniType; area: number; spot: number; level: number
  /** 1 = victoria, 0.5 = empate, 0 = derrota */
  score: number
  /** 0..1 qué tan lejos del óptimo (jugadas de más, tiempo usado). 0 = perfecto */
  excess?: number
  /** El nivel ya estaba ganado: se gana mucho menos */
  repeat?: boolean
}

/** Variación de ELO de una partida. */
export function eloDelta(i: EloInput): number {
  const rival = spotElo(i.area, i.spot, i.level)
  if (!rival) return 0
  const diff = Math.min(E.expected.length - 1, Math.abs(Math.round(rival - i.playerElo)))
  const strongerPct = E.expected[diff] // % esperado del más fuerte
  const expected = (i.playerElo >= rival ? strongerPct : 100 - strongerPct) / 100
  const K = E.K[Math.min(E.K.length - 1, i.games)]
  const C = E.C[C_NAME[i.type]] ?? 1.3
  let score = i.score
  if (score === 1 && i.excess) score *= E.bonus[Math.min(E.bonus.length - 1, Math.round(i.excess * 60))] ?? 1
  let d = K * C * (score - expected)
  if (i.repeat && d > 0) d *= 0.25
  d = Math.round(d)
  if (i.score === 1) return Math.max(1, d)
  if (i.score === 0) return Math.min(-1, d)
  return d
}

/** Monedas de oro por ganar. */
export function goldFor(type: MiniType, area: number, level: number, excess = 0, repeat = false): number {
  const big = type === 'battle' || type === 'destroy' || type === 'reinforce' || type === 'attack' || type === 'challenge'
  const base = (big ? 40 : 12) + area * 4 + level * 3
  const g = Math.round(base * (1 - Math.min(0.5, excess * 0.5)))
  return repeat ? Math.max(2, Math.round(g / 4)) : g
}
