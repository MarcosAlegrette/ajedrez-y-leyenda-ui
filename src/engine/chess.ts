// Motor de ajedrez propio, pensado para los minijuegos de "Ajedrez y Leyendas":
// soporta posiciones sin reyes, casillas bloqueadas (rocas / paredes), piezas que
// saltan, piezas congeladas, etc. Tablero de 64 casillas: 0 = a8 … 63 = h1.

export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export interface Piece { c: Color; t: PieceType }
export type Board = (Piece | null)[]

export interface Pos {
  board: Board
  turn: Color
  /** Derechos de enroque: K, Q (blancas) k, q (negras) */
  castle: string
  /** Casilla de captura al paso o -1 */
  ep: number
  half: number
  full: number
}

export interface Move {
  from: number
  to: number
  piece: PieceType
  color: Color
  captured?: PieceType
  /** Casilla de la pieza capturada (difiere de `to` al capturar al paso) */
  capSq?: number
  promo?: PieceType
  flag?: 'ep' | 'ck' | 'cq' | 'dbl'
}

/** Reglas especiales de los minijuegos / hechizos. */
export interface Rules {
  /** Casillas que nadie puede pisar ni atravesar (rocas, paredes) */
  blocked?: ReadonlySet<number>
  /** Casillas que un color no puede pisar este turno (hechizo "casilla intocable") */
  forbidden?: { color: Color; squares: ReadonlySet<number> }
  /** Piezas (por casilla) que saltan sobre las demás */
  jumpers?: ReadonlySet<number>
  /** Piezas (por casilla) que no pueden moverse */
  frozen?: ReadonlySet<number>
  /** Piezas (por casilla) que no pueden ser capturadas */
  untouchable?: ReadonlySet<number>
  /** Sin promoción automática: los peones que llegan al final quedan como peones */
  noPromotion?: boolean
  /** Ignora jaques (juegos sin "legalidad" de rey) */
  ignoreCheck?: boolean
  /** Los peones no avanzan dos casillas */
  noDouble?: boolean
}

export const FILES = 'abcdefgh'
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
export const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

export const file = (sq: number) => sq & 7
export const row = (sq: number) => sq >> 3
export const sqName = (sq: number) => FILES[file(sq)] + (8 - row(sq))
export const sqOf = (name: string) => (8 - +name[1]) * 8 + FILES.indexOf(name[0])
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')
export const clone = (p: Pos): Pos => ({ ...p, board: p.board.slice() })

/** Parser de FEN tolerante: los PGN originales traen filas incompletas o de más. */
export function parseFen(fen: string): Pos {
  const [place = '8/8/8/8/8/8/8/8', turn = 'w', castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/)
  const board: Board = new Array(64).fill(null)
  place.split('/').slice(0, 8).forEach((r, y) => {
    let x = 0
    for (const ch of r) {
      if (x > 7) break
      if (ch >= '1' && ch <= '8') x += +ch
      else if ('pnbrqkPNBRQK'.includes(ch)) {
        board[y * 8 + x] = { c: ch === ch.toLowerCase() ? 'b' : 'w', t: ch.toLowerCase() as PieceType }
        x++
      }
    }
  })
  // Sólo se conservan los enroques posibles de verdad
  const is = (sq: number, c: Color, t: PieceType) => board[sq]?.c === c && board[sq]?.t === t
  let cs = ''
  if (castle.includes('K') && is(60, 'w', 'k') && is(63, 'w', 'r')) cs += 'K'
  if (castle.includes('Q') && is(60, 'w', 'k') && is(56, 'w', 'r')) cs += 'Q'
  if (castle.includes('k') && is(4, 'b', 'k') && is(7, 'b', 'r')) cs += 'k'
  if (castle.includes('q') && is(4, 'b', 'k') && is(0, 'b', 'r')) cs += 'q'
  return {
    board, turn: turn === 'b' ? 'b' : 'w', castle: cs,
    ep: /^[a-h][36]$/.test(ep) ? sqOf(ep) : -1,
    half: +half || 0, full: Math.max(1, +full || 1),
  }
}

export function toFen(p: Pos): string {
  let s = ''
  for (let y = 0; y < 8; y++) {
    let empty = 0
    for (let x = 0; x < 8; x++) {
      const pc = p.board[y * 8 + x]
      if (!pc) { empty++; continue }
      if (empty) { s += empty; empty = 0 }
      s += pc.c === 'w' ? pc.t.toUpperCase() : pc.t
    }
    if (empty) s += empty
    if (y < 7) s += '/'
  }
  return `${s} ${p.turn} ${p.castle || '-'} ${p.ep >= 0 ? sqName(p.ep) : '-'} ${p.half} ${p.full}`
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]]

export const findKing = (p: Pos, c: Color) => p.board.findIndex((x) => x?.c === c && x.t === 'k')
export const pieces = (p: Pos, c?: Color) => {
  const out: { sq: number; piece: Piece }[] = []
  p.board.forEach((piece, sq) => { if (piece && (!c || piece.c === c)) out.push({ sq, piece }) })
  return out
}

/** ¿La casilla `sq` está atacada por alguna pieza del color `by`? */
export function attacked(p: Pos, sq: number, by: Color, rules?: Rules): boolean {
  return attackers(p, sq, by, rules, true).length > 0
}

/** Casillas de las piezas de `by` que atacan `sq`. */
export function attackers(p: Pos, sq: number, by: Color, rules?: Rules, first = false): number[] {
  const out: number[] = []
  const b = p.board, x = file(sq), y = row(sq)
  const blocked = rules?.blocked, frozen = rules?.frozen
  const add = (s: number) => { if (!frozen?.has(s)) out.push(s) }
  // Peones
  const dy = by === 'w' ? 1 : -1
  for (const dx of [-1, 1]) {
    const px = x + dx, py = y + dy
    if (px < 0 || px > 7 || py < 0 || py > 7) continue
    const pc = b[py * 8 + px]
    if (pc?.c === by && pc.t === 'p') add(py * 8 + px)
  }
  if (first && out.length) return out
  for (const [dx, dy2] of KNIGHT) {
    const px = x + dx, py = y + dy2
    if (px < 0 || px > 7 || py < 0 || py > 7) continue
    const pc = b[py * 8 + px]
    if (pc?.c === by && pc.t === 'n') add(py * 8 + px)
  }
  for (const [dx, dy2] of KING) {
    const px = x + dx, py = y + dy2
    if (px < 0 || px > 7 || py < 0 || py > 7) continue
    const pc = b[py * 8 + px]
    if (pc?.c === by && pc.t === 'k') add(py * 8 + px)
  }
  if (first && out.length) return out
  const slide = (dirs: number[][], a: PieceType, q: PieceType) => {
    for (const [dx, dy2] of dirs) {
      let px = x + dx, py = y + dy2, hit = false
      while (px >= 0 && px <= 7 && py >= 0 && py <= 7) {
        const s = py * 8 + px
        const pc = b[s]
        if (pc) {
          if (pc.c === by && (pc.t === a || pc.t === q) && (!hit || rules?.jumpers?.has(s))) add(s)
          if (!rules?.jumpers?.size) break
          hit = true
        } else if (blocked?.has(s)) {
          if (!rules?.jumpers?.size) break
          hit = true
        }
        px += dx; py += dy2
      }
    }
  }
  slide(DIAG, 'b', 'q')
  slide(ORTHO, 'r', 'q')
  return out
}

export const inCheck = (p: Pos, c: Color = p.turn, rules?: Rules) => {
  const k = findKing(p, c)
  return k >= 0 && attacked(p, k, other(c), rules)
}

/** Movimientos pseudo-legales del color `c` (no verifica jaque). */
export function pseudoMoves(p: Pos, c: Color = p.turn, rules?: Rules, onlyFrom?: number): Move[] {
  const out: Move[] = []
  const b = p.board
  const blocked = rules?.blocked
  const forb = rules?.forbidden?.color === c ? rules.forbidden.squares : undefined
  const canLand = (s: number) => !blocked?.has(s) && !forb?.has(s)
  const push = (from: number, to: number, piece: PieceType, extra?: Partial<Move>) => {
    const target = b[to]
    if (target && rules?.untouchable?.has(to)) return
    out.push({ from, to, piece, color: c, ...(target ? { captured: target.t, capSq: to } : {}), ...extra })
  }
  for (let from = 0; from < 64; from++) {
    if (onlyFrom !== undefined && from !== onlyFrom) continue
    const pc = b[from]
    if (!pc || pc.c !== c || rules?.frozen?.has(from)) continue
    const x = file(from), y = row(from)
    const jump = !!rules?.jumpers?.has(from)
    if (pc.t === 'p') {
      const dy = c === 'w' ? -1 : 1, startRow = c === 'w' ? 6 : 1, lastRow = c === 'w' ? 0 : 7
      const addPawn = (to: number, extra?: Partial<Move>) => {
        if (row(to) === lastRow && !rules?.noPromotion) for (const promo of ['q', 'r', 'b', 'n'] as PieceType[]) push(from, to, 'p', { ...extra, promo })
        else push(from, to, 'p', extra)
      }
      const ny = y + dy
      if (ny >= 0 && ny <= 7) {
        const one = ny * 8 + x
        if (!b[one] && canLand(one)) {
          addPawn(one)
          const two = (y + 2 * dy) * 8 + x
          if (y === startRow && !rules?.noDouble && !b[two] && canLand(two)) push(from, two, 'p', { flag: 'dbl' })
        }
        for (const dx of [-1, 1]) {
          const nx = x + dx
          if (nx < 0 || nx > 7) continue
          const to = ny * 8 + nx
          if (!canLand(to)) continue
          if (b[to] && b[to]!.c !== c) addPawn(to)
          else if (to === p.ep && !b[to]) {
            const capSq = y * 8 + nx
            if (b[capSq]?.t === 'p' && b[capSq]!.c !== c && !rules?.untouchable?.has(capSq)) out.push({ from, to, piece: 'p', color: c, captured: 'p', capSq, flag: 'ep' })
          }
        }
      }
      continue
    }
    const step = (dirs: number[][]) => {
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx > 7 || ny < 0 || ny > 7) continue
        const to = ny * 8 + nx
        if (!canLand(to) || b[to]?.c === c) continue
        push(from, to, pc.t)
      }
    }
    const slide = (dirs: number[][]) => {
      for (const [dx, dy] of dirs) {
        let nx = x + dx, ny = y + dy
        while (nx >= 0 && nx <= 7 && ny >= 0 && ny <= 7) {
          const to = ny * 8 + nx
          const occ = b[to]
          if (blocked?.has(to)) { if (!jump) break }
          else if (occ) {
            if (occ.c !== c && !forb?.has(to)) push(from, to, pc.t)
            if (!jump) break
          } else if (!forb?.has(to)) push(from, to, pc.t)
          nx += dx; ny += dy
        }
      }
    }
    if (pc.t === 'n') step(KNIGHT)
    else if (pc.t === 'k') {
      step(KING)
      // Enroque
      const home = c === 'w' ? 60 : 4
      if (from === home && !rules?.ignoreCheck) {
        const enemy = other(c)
        const [ks, qs] = c === 'w' ? ['K', 'Q'] : ['k', 'q']
        if (p.castle.includes(ks) && !b[home + 1] && !b[home + 2] && !blocked?.has(home + 1) && !blocked?.has(home + 2) &&
          !attacked(p, home, enemy, rules) && !attacked(p, home + 1, enemy, rules)) out.push({ from, to: home + 2, piece: 'k', color: c, flag: 'ck' })
        if (p.castle.includes(qs) && !b[home - 1] && !b[home - 2] && !b[home - 3] && !blocked?.has(home - 1) && !blocked?.has(home - 2) &&
          !attacked(p, home, enemy, rules) && !attacked(p, home - 1, enemy, rules)) out.push({ from, to: home - 2, piece: 'k', color: c, flag: 'cq' })
      }
    } else {
      if (pc.t === 'b' || pc.t === 'q') slide(DIAG)
      if (pc.t === 'r' || pc.t === 'q') slide(ORTHO)
    }
  }
  return out
}

/** Aplica el movimiento y devuelve una posición nueva. */
export function play(p: Pos, m: Move, rules?: Rules): Pos {
  const n = clone(p)
  const b = n.board
  const pc = b[m.from]!
  if (m.flag === 'ep' && m.capSq !== undefined) b[m.capSq] = null
  b[m.to] = m.promo ? { c: pc.c, t: m.promo } : pc
  b[m.from] = null
  if (m.flag === 'ck') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = null }
  if (m.flag === 'cq') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = null }
  if (n.castle) {
    let cs = n.castle
    const drop = (ch: string) => { cs = cs.replace(ch, '') }
    if (pc.t === 'k') { if (pc.c === 'w') { drop('K'); drop('Q') } else { drop('k'); drop('q') } }
    for (const s of [m.from, m.to]) {
      if (s === 63) drop('K'); if (s === 56) drop('Q'); if (s === 7) drop('k'); if (s === 0) drop('q')
    }
    n.castle = cs
  }
  n.ep = m.flag === 'dbl' ? (m.from + m.to) >> 1 : -1
  n.half = pc.t === 'p' || m.captured ? 0 : p.half + 1
  if (p.turn === 'b') n.full = p.full + 1
  n.turn = other(p.turn)
  void rules
  return n
}

/** Movimientos legales (si el bando tiene rey, no puede quedar en jaque). */
export function legalMoves(p: Pos, rules?: Rules, onlyFrom?: number, c: Color = p.turn): Move[] {
  const ms = pseudoMoves(p, c, rules, onlyFrom)
  if (rules?.ignoreCheck || findKing(p, c) < 0) return ms
  return ms.filter((m) => {
    const n = play(p, m)
    return !inCheck(n, c, rules)
  })
}

export type Status = 'playing' | 'checkmate' | 'stalemate' | 'draw'
export function status(p: Pos, rules?: Rules): Status {
  if (legalMoves(p, rules).length === 0) return inCheck(p, p.turn, rules) ? 'checkmate' : 'stalemate'
  if (p.half >= 100) return 'draw'
  // Material insuficiente (sólo con ambos reyes)
  const all = pieces(p)
  if (findKing(p, 'w') >= 0 && findKing(p, 'b') >= 0) {
    const rest = all.filter((x) => x.piece.t !== 'k')
    if (rest.length === 0 || (rest.length === 1 && (rest[0].piece.t === 'n' || rest[0].piece.t === 'b'))) return 'draw'
  }
  return 'playing'
}

/** Notación algebraica (SAN) de un movimiento. */
export function toSan(p: Pos, m: Move, rules?: Rules): string {
  let s: string
  if (m.flag === 'ck') s = 'O-O'
  else if (m.flag === 'cq') s = 'O-O-O'
  else {
    s = ''
    if (m.piece !== 'p') {
      s = m.piece.toUpperCase()
      const twins = legalMoves(p, rules).filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from)
      if (twins.length) {
        if (!twins.some((o) => file(o.from) === file(m.from))) s += FILES[file(m.from)]
        else if (!twins.some((o) => row(o.from) === row(m.from))) s += 8 - row(m.from)
        else s += sqName(m.from)
      }
    }
    if (m.captured) s += (m.piece === 'p' ? FILES[file(m.from)] : '') + 'x'
    s += sqName(m.to)
    if (m.promo) s += '=' + m.promo.toUpperCase()
  }
  const n = play(p, m)
  if (inCheck(n, n.turn, rules)) s += legalMoves(n, rules).length ? '+' : '#'
  return s
}

const clean = (san: string) => san.replace(/[+#!?]/g, '').replace(/=/g, '').replace(/0/g, 'O')

/** Busca el movimiento legal que corresponde a un SAN ("Nf3", "exd5", "O-O", "--"). */
export function fromSan(p: Pos, san: string, rules?: Rules): Move | null {
  const want = clean(san)
  if (!want || want === '--') return null
  const ms = legalMoves(p, rules)
  for (const m of ms) if (clean(toSan(p, m, rules)) === want) return m
  // Notación larga o desambiguación redundante (Rae1 cuando sólo una torre llega)
  const mm = want.match(/^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])([NBRQ])?$/)
  if (!mm) return null
  const [, pcs, f, r, dst, promo] = mm
  const to = sqOf(dst)
  const cand = ms.filter((m) => m.to === to && m.piece === (pcs ? pcs.toLowerCase() : 'p') &&
    (!f || FILES[file(m.from)] === f) && (!r || 8 - row(m.from) === +r) && (!promo || m.promo === promo.toLowerCase()))
  return cand.length ? cand[0] : null
}

export const sameMove = (a: Move, b: Move) => a.from === b.from && a.to === b.to && (a.promo ?? '') === (b.promo ?? '')

/** Suma del valor del material de un color. */
export const material = (p: Pos, c: Color) => pieces(p, c).reduce((s, x) => s + VALUE[x.piece.t], 0)
