// Reglas de cada "variante" de enfrentamiento contra la computadora y su IA.
// La interfaz y la IA usan exactamente las mismas funciones (vMoves / vPlay / vResult).
import {
  type Color, type Move, type Pos, type Rules, type PieceType,
  legalMoves, pseudoMoves, play, inCheck, pieces, other, row, file, findKing, clone, VALUE,
} from './chess.ts'

export type Variant =
  | 'chess'      // ajedrez normal (batallas, piezas contra el rey, desafíos)
  | 'destroy'    // "Destructor": gana quien deja al rival con una sola pieza
  | 'pawnRace'   // guerra de peones: gana el primero que corona
  | 'pawns'      // piezas contra peones: las negras ganan si un peón corona
  | 'comeCome'   // come-come: es obligatorio comer y gana quien se queda sin piezas
  | 'tropillas'  // llegar con un caballo al rincón opuesto
  | 'portal'     // sacar todas las piezas por el portal antes que el rival

export interface VParams {
  portal?: number
  goalW?: number
  goalB?: number
  rules?: Rules
  /** El color indicado sólo puede hacer jugadas que den jaque (Salvar al Rey) */
  onlyChecks?: Color
}

export type Outcome = Color | 'draw' | null

const PAWN_RACE: Rules = { ignoreCheck: true, noPromotion: true }
const FREE: Rules = { ignoreCheck: true }

function rulesFor(v: Variant, prm: VParams): Rules | undefined {
  const extra = prm.rules
  if (v === 'pawnRace') return { ...PAWN_RACE, ...extra }
  if (v === 'pawns') return { noPromotion: true, ...extra }
  if (v === 'comeCome' || v === 'tropillas' || v === 'portal' || v === 'destroy') return { ...FREE, ...extra }
  return extra
}

export function vMoves(v: Variant, p: Pos, prm: VParams = {}): Move[] {
  const rules = rulesFor(v, prm)
  switch (v) {
    case 'pawnRace':
      return pseudoMoves(p, p.turn, rules).filter((m) => m.piece === 'p')
    case 'comeCome': {
      const ms = pseudoMoves(p, p.turn, rules)
      const caps = ms.filter((m) => m.captured)
      // Se corona siempre dama: una pieza menos para pensar
      return (caps.length ? caps : ms).filter((m) => !m.promo || m.promo === 'q')
    }
    case 'portal':
      // Los peones son obstáculos fijos y no hay capturas; el portal se puede pisar
      return pseudoMoves(p, p.turn, rules).filter((m) => m.piece !== 'p' && !m.captured)
    case 'tropillas':
    case 'destroy':
      return pseudoMoves(p, p.turn, rules)
    default: {
      let ms = legalMoves(p, rules)
      if (prm.onlyChecks === p.turn) ms = ms.filter((m) => inCheck(play(p, m), other(p.turn), rules))
      return ms
    }
  }
}

export function vPlay(v: Variant, p: Pos, m: Move, prm: VParams = {}): Pos {
  const n = play(p, m)
  if (v === 'portal' && m.to === prm.portal) n.board[m.to] = null
  return n
}

const count = (p: Pos, c: Color, skip?: PieceType) => {
  let n = 0
  for (const x of p.board) if (x && x.c === c && x.t !== skip) n++
  return n
}

/** Resultado de la posición (antes de que mueva `p.turn`). */
export function vResult(v: Variant, p: Pos, prm: VParams = {}): Outcome {
  const me = p.turn, opp = other(me)
  switch (v) {
    case 'destroy':
      if (count(p, 'b') <= 1) return 'w'
      if (count(p, 'w') <= 1) return 'b'
      return vMoves(v, p, prm).length ? null : opp
    case 'pawnRace':
      for (let x = 0; x < 8; x++) {
        if (p.board[x]?.t === 'p' && p.board[x]!.c === 'w') return 'w'
        if (p.board[56 + x]?.t === 'p' && p.board[56 + x]!.c === 'b') return 'b'
      }
      return vMoves(v, p, prm).length ? null : opp
    case 'pawns': {
      for (let x = 0; x < 8; x++) if (p.board[56 + x]?.t === 'p' && p.board[56 + x]!.c === 'b') return 'b'
      if (count(p, 'b') - (findKing(p, 'b') >= 0 ? 1 : 0) === 0) return 'w'
      if (count(p, 'w') - (findKing(p, 'w') >= 0 ? 1 : 0) === 0) return 'b'
      if (vMoves(v, p, prm).length) return null
      if (inCheck(p, me, prm.rules)) return opp
      return me === 'b' ? 'w' : 'b' // peones bloqueados: pierde el que no puede mover
    }
    case 'comeCome':
      if (count(p, 'w') === 0) return 'w'
      if (count(p, 'b') === 0) return 'b'
      return vMoves(v, p, prm).length ? null : me
    case 'tropillas':
      if (prm.goalW !== undefined && p.board[prm.goalW]?.c === 'w') return 'w'
      if (prm.goalB !== undefined && p.board[prm.goalB]?.c === 'b') return 'b'
      if (count(p, 'w') === 0) return 'b'
      if (count(p, 'b') === 0) return 'w'
      return vMoves(v, p, prm).length ? null : opp
    case 'portal':
      if (count(p, 'w', 'p') === 0) return 'w'
      if (count(p, 'b', 'p') === 0) return 'b'
      return vMoves(v, p, prm).length ? null : opp
    default: {
      if (vMoves(v, p, prm).length === 0) {
        if (prm.onlyChecks === me) return opp // se quedó sin jaques
        return inCheck(p, me, prm.rules) ? opp : 'draw'
      }
      if (p.half >= 100) return 'draw'
      const rest = pieces(p).filter((x) => x.piece.t !== 'k')
      if (rest.length === 0 || (rest.length === 1 && 'nb'.includes(rest[0].piece.t))) return 'draw'
      return null
    }
  }
}

// ---------------------------------------------------------------- evaluación

const CP: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const center = (sq: number) => 3.5 - Math.max(Math.abs(file(sq) - 3.5), Math.abs(row(sq) - 3.5))

/** Distancia en saltos de caballo a una casilla (BFS, sin obstáculos). */
const knightDist = new Map<number, Int8Array>()
function kDist(goal: number): Int8Array {
  let d = knightDist.get(goal)
  if (d) return d
  d = new Int8Array(64).fill(-1)
  d[goal] = 0
  const q = [goal]
  const J = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
  while (q.length) {
    const s = q.shift()!
    for (const [dx, dy] of J) {
      const x = file(s) + dx, y = row(s) + dy
      if (x < 0 || x > 7 || y < 0 || y > 7) continue
      const t = y * 8 + x
      if (d[t] < 0) { d[t] = d[s] + 1; q.push(t) }
    }
  }
  knightDist.set(goal, d)
  return d
}

/** Jugadas que necesita cada pieza de `c` para llegar al portal (suma). */
function portalCost(p: Pos, c: Color, prm: VParams): number {
  let total = 0
  const rules = rulesFor('portal', prm)
  for (const { sq } of pieces(p, c)) {
    if (p.board[sq]!.t === 'p') continue
    // BFS de hasta 4 jugadas con la pieza sola moviéndose
    let frontier = [sq], seen = new Set([sq]), d = 0, found = false
    const work = clone(p)
    work.turn = c
    const piece = work.board[sq]!
    work.board[sq] = null
    while (frontier.length && d < 4 && !found) {
      d++
      const next: number[] = []
      for (const s of frontier) {
        work.board[s] = piece
        for (const m of pseudoMoves(work, c, rules, s)) {
          if (m.captured || seen.has(m.to)) continue
          if (m.to === prm.portal) { found = true; break }
          seen.add(m.to); next.push(m.to)
        }
        work.board[s] = null
        if (found) break
      }
      frontier = next
    }
    total += found ? d : 6
  }
  return total
}

/** Evaluación desde el punto de vista de las blancas (centipeones). */
export function vEval(v: Variant, p: Pos, prm: VParams = {}): number {
  let s = 0
  const b = p.board
  switch (v) {
    case 'comeCome':
      for (const x of b) if (x) s += (x.c === 'w' ? -1 : 1) * (100 + CP[x.t] / 10)
      return s
    case 'pawnRace':
      for (let i = 0; i < 64; i++) {
        const x = b[i]
        if (x?.t !== 'p') continue
        const adv = x.c === 'w' ? 6 - row(i) : row(i) - 1
        // Peón pasado: nadie delante en su columna ni en las vecinas
        let passed = true
        for (let y = row(i) + (x.c === 'w' ? -1 : 1); y >= 0 && y <= 7; y += x.c === 'w' ? -1 : 1)
          for (const dx of [-1, 0, 1]) {
            const fx = file(i) + dx
            if (fx < 0 || fx > 7) continue
            const o = b[y * 8 + fx]
            if (o?.t === 'p' && o.c !== x.c) passed = false
          }
        s += (x.c === 'w' ? 1 : -1) * (100 + adv * adv * 6 + (passed ? 40 + adv * 30 : 0))
      }
      return s
    case 'pawns':
      for (let i = 0; i < 64; i++) {
        const x = b[i]
        if (!x) continue
        if (x.c === 'w') s += CP[x.t] + center(i) * 4
        else if (x.t === 'p') { const adv = row(i) - 1; s -= 140 + adv * adv * 14 }
        else s -= CP[x.t]
      }
      return s
    case 'tropillas': {
      let bw = 9, bb = 9
      const dw = prm.goalW !== undefined ? kDist(prm.goalW) : null
      const db = prm.goalB !== undefined ? kDist(prm.goalB) : null
      for (let i = 0; i < 64; i++) {
        const x = b[i]
        if (!x) continue
        s += (x.c === 'w' ? 1 : -1) * 100
        if (x.c === 'w' && dw) { bw = Math.min(bw, dw[i]); s -= dw[i] * 4 }
        if (x.c === 'b' && db) { bb = Math.min(bb, db[i]); s += db[i] * 4 }
      }
      return s + (bb - bw) * 60
    }
    case 'portal':
      return (portalCost(p, 'b', prm) - portalCost(p, 'w', prm)) * 100
    default: {
      for (let i = 0; i < 64; i++) {
        const x = b[i]
        if (!x) continue
        let val = CP[x.t]
        if (x.t === 'p') val += (x.c === 'w' ? 6 - row(i) : row(i) - 1) * 6 + (file(i) > 1 && file(i) < 6 ? center(i) * 4 : 0)
        else if (x.t === 'n' || x.t === 'b') val += center(i) * 8
        else if (x.t === 'q') val += center(i) * 2
        s += x.c === 'w' ? val : -val
      }
      // Arrinconar al rey solo (finales de "piezas contra el rey")
      const wk = findKing(p, 'w'), bk = findKing(p, 'b')
      if (wk >= 0 && bk >= 0) {
        const lone = (c: Color) => count(p, c) === 1
        const dist = Math.max(Math.abs(file(wk) - file(bk)), Math.abs(row(wk) - row(bk)))
        if (lone('b')) s += (3.5 - center(bk)) * 22 + (8 - dist) * 6
        if (lone('w')) s -= (3.5 - center(wk)) * 22 + (8 - dist) * 6
      }
      return s
    }
  }
}

// ------------------------------------------------------------------ búsqueda

const MATE = 100000
export interface SearchOpts {
  /** Profundidad máxima en medias jugadas */
  depth: number
  /** Tiempo máximo de reflexión */
  timeMs?: number
  /** Ruido aleatorio (centipeones) para que el rival se equivoque a veces */
  noise?: number
}

export function search(v: Variant, pos: Pos, prm: VParams, opts: SearchOpts): Move | null {
  const deadline = Date.now() + (opts.timeMs ?? 1200)
  let nodes = 0, stop = false
  const quiet = v === 'chess' || v === 'pawns' || v === 'destroy'
  const sign = (c: Color) => (c === 'w' ? 1 : -1)
  const order = (ms: Move[]) => ms.sort((a, b) =>
    (b.captured ? VALUE[b.captured] * 10 - VALUE[b.piece] : 0) + (b.promo ? 8 : 0) -
    ((a.captured ? VALUE[a.captured] * 10 - VALUE[a.piece] : 0) + (a.promo ? 8 : 0)))

  function qs(p: Pos, alpha: number, beta: number, ply: number): number {
    const stand = sign(p.turn) * vEval(v, p, prm)
    if (!quiet || ply > 4) return stand
    if (stand >= beta) return beta
    if (stand > alpha) alpha = stand
    for (const m of order(vMoves(v, p, prm).filter((m) => m.captured || m.promo))) {
      const sc = -qs(vPlay(v, p, m, prm), -beta, -alpha, ply + 1)
      if (sc >= beta) return beta
      if (sc > alpha) alpha = sc
    }
    return alpha
  }

  function nega(p: Pos, depth: number, alpha: number, beta: number, ply: number): number {
    if ((++nodes & 511) === 0 && Date.now() > deadline) stop = true
    if (stop) return 0
    const res = vResult(v, p, prm)
    if (res) return res === 'draw' ? 0 : res === p.turn ? MATE - ply : -MATE + ply
    if (depth <= 0) return qs(p, alpha, beta, 0)
    let best = -Infinity
    for (const m of order(vMoves(v, p, prm))) {
      const sc = -nega(vPlay(v, p, m, prm), depth - 1, -beta, -alpha, ply + 1)
      if (stop) return 0
      if (sc > best) best = sc
      if (sc > alpha) alpha = sc
      if (alpha >= beta) break
    }
    return best
  }

  const root = order(vMoves(v, pos, prm))
  if (!root.length) return null
  let bestMove = root[Math.floor(Math.random() * root.length)]
  for (let d = 1; d <= opts.depth; d++) {
    let best = -Infinity, pick = bestMove
    const scored: { m: Move; sc: number }[] = []
    for (const m of root) {
      let sc = -nega(vPlay(v, pos, m, prm), d - 1, -Infinity, Infinity, 1)
      if (stop) break
      // El ruido nunca tapa un mate ni una pieza colgada entera
      if (opts.noise && Math.abs(sc) < MATE / 2) sc += (Math.random() - 0.5) * opts.noise
      scored.push({ m, sc })
      if (sc > best) { best = sc; pick = m }
    }
    if (stop) break
    bestMove = pick
    // Mejores primero en la próxima iteración
    scored.sort((a, b) => b.sc - a.sc)
    root.splice(0, root.length, ...scored.map((x) => x.m))
    if (best > MATE / 2) break
  }
  return bestMove
}

// ------------------------------------------------- serialización (web worker)

export interface RulesJson {
  blocked?: number[]; forbidden?: { color: Color; squares: number[] }; jumpers?: number[]; frozen?: number[]; untouchable?: number[]
  noPromotion?: boolean; ignoreCheck?: boolean; noDouble?: boolean
}
export const rulesToJson = (r?: Rules): RulesJson | undefined => r && {
  ...r, blocked: r.blocked && [...r.blocked], jumpers: r.jumpers && [...r.jumpers], frozen: r.frozen && [...r.frozen],
  untouchable: r.untouchable && [...r.untouchable], forbidden: r.forbidden && { color: r.forbidden.color, squares: [...r.forbidden.squares] },
}
export const rulesFromJson = (r?: RulesJson): Rules | undefined => r && {
  ...r, blocked: r.blocked && new Set(r.blocked), jumpers: r.jumpers && new Set(r.jumpers), frozen: r.frozen && new Set(r.frozen),
  untouchable: r.untouchable && new Set(r.untouchable), forbidden: r.forbidden && { color: r.forbidden.color, squares: new Set(r.forbidden.squares) },
}
