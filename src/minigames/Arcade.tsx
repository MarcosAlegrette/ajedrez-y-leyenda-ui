// Minijuegos sin PGN: Justa de Caballeros (monedas), Castillo de Fantasmas y Cazadores.
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Board as BoardT, type Pos, type PieceType, parseFen, legalMoves, inCheck, file, row, findKing } from '../engine/chess.ts'
import { vPlay } from '../engine/variants.ts'
import { think } from '../engine/ai.ts'
import type { Token } from '../ui/Board.tsx'
import { Shell, Hearts, useClock, clock, comment, pick, type MiniProps, type InfoRow } from './common.tsx'
import { audio } from '../game/audio.ts'
import { t } from '../game/texts.ts'

const JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
const jumps = (sq: number, block: number[] = []) => {
  const out: number[] = []
  for (const [dx, dy] of JUMPS) {
    const x = file(sq) + dx, y = row(sq) + dy
    if (x >= 0 && x <= 7 && y >= 0 && y <= 7 && !block.includes(y * 8 + x)) out.push(y * 8 + x)
  }
  return out
}
const emptyBoard = (): BoardT => new Array(64).fill(null)
const levelNum = (p: MiniProps) => +(p.spot.levels[p.level - 1] ?? '#1').replace('#', '') || p.level
const sub = (p: MiniProps) => `Nivel ${p.level}`

function useTimers() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }
}

// --------------------------------------------------------- Justa de Caballeros
export function CoinsGame(p: MiniProps) {
  const lvl = levelNum(p)
  const init = useMemo(() => {
    const coins = new Map<number, number>()
    const n = 14 + lvl * 3
    while (coins.size < n) {
      const sq = Math.floor(Math.random() * 64)
      if (sq === 57 || sq === 6) continue
      const r = Math.random()
      coins.set(sq, r < 0.34 ? 1 : r < 0.6 ? 2 : r < 0.8 ? 3 : r < 0.93 ? 4 : 5)
    }
    return coins
  }, [lvl])
  const total = 10 + lvl * 2
  const [coins, setCoins] = useState(init)
  const [w, setW] = useState(57)
  const [b, setB] = useState(6)
  const [score, setScore] = useState({ w: 0, b: 0 })
  const [movesLeft, setMovesLeft] = useState(total)
  const [turn, setTurn] = useState<'w' | 'b'>('w')
  const [sel, setSel] = useState(false)
  const over = useRef(false)
  const later = useTimers()

  const end = (sc: { w: number; b: number }, noCoins: boolean) => {
    if (over.current) return
    over.current = true
    const k = noCoins ? 'NoMoreCoins' : 'NoMoreMoves'
    const res = sc.w > sc.b ? 'whiteWin' : sc.w < sc.b ? 'blackWin' : 'draw'
    later(() => p.onEnd({ won: sc.w > sc.b, draw: sc.w === sc.b, message: `message:${k}:${res}`, excess: sc.w > sc.b ? Math.max(0, 1 - (sc.w - sc.b) / 10) : undefined }), 700)
  }
  const { left } = useClock(120 + lvl * 15, !p.paused && !over.current, () => { over.current = true; p.onEnd({ won: false, message: 'message:timeIsUp' }) })

  const take = (who: 'w' | 'b', to: number, cur: Map<number, number>, sc: { w: number; b: number }) => {
    const v = cur.get(to)
    if (!v) { audio.fx('piece_move_1'); return { cur, sc } }
    const nc = new Map(cur); nc.delete(to)
    audio.fx(v >= 4 ? 'coin_diamond' : 'coin', 0.8)
    return { cur: nc, sc: { ...sc, [who]: sc[who] + v } }
  }

  const userMove = (to: number) => {
    const r = take('w', to, coins, score)
    setW(to); setCoins(r.cur); setScore(r.sc); setSel(false); setTurn('b')
    // Caballo negro: junta lo mejor mirando una jugada más adelante
    later(() => {
      if (over.current) return
      const opts = jumps(b, [to])
      if (!opts.length) { setTurn('w'); return }
      const best2 = (from: number, cur: Map<number, number>, block: number[]) => Math.max(0, ...jumps(from, block).map((s) => cur.get(s) ?? 0))
      let bestSq = opts[0], bestV = -Infinity
      for (const s of opts) {
        const rest = new Map(r.cur); rest.delete(s)
        const v = (r.cur.get(s) ?? 0) + 0.5 * best2(s, rest, [to]) - (lvl > 1 ? 0.45 * best2(to, rest, [s]) : 0) + Math.random() * (lvl > 2 ? 0.2 : 1.4)
        if (v > bestV) { bestV = v; bestSq = s }
      }
      const r2 = take('b', bestSq, r.cur, r.sc)
      setB(bestSq); setCoins(r2.cur); setScore(r2.sc); setTurn('w')
      const ml = movesLeft - 1
      setMovesLeft(ml)
      if (r2.cur.size === 0) end(r2.sc, true)
      else if (ml <= 0) end(r2.sc, false)
    }, 650)
  }

  const board = useMemo(() => { const bd = emptyBoard(); bd[w] = { c: 'w', t: 'n' }; bd[b] = { c: 'b', t: 'n' }; return bd }, [w, b])
  const canPlay = turn === 'w' && !over.current && !p.paused
  const targets = sel && canPlay ? jumps(w, [b]) : []
  const tokens: Token[] = [...coins].map(([sq, v]) => ({ id: `c${sq}`, sq, kind: `coin${v}` }))
  const info: InfoRow[] = [
    { label: t('infopanel:time'), value: clock(left), warn: left <= 10 },
    { label: t('infopanel:whiteCoins'), value: score.w },
    { label: t('infopanel:blackCoins'), value: score.b },
    { label: t('infopanel:moves'), value: movesLeft, warn: movesLeft <= 2 },
  ]
  return (
    <Shell title={p.spot.name} sub={sub(p)} face={p.area.face} theme={p.area.board}
      board={{
        board, tokens, selected: sel ? w : null, targets,
        onSquare: (sq) => { audio.unlock(); if (!canPlay) return; if (sq === w) { setSel(!sel); audio.fx('piece_1', 0.6) } else if (targets.includes(sq)) userMove(sq); else setSel(false) },
      }}
      info={info} msg={turn === 'w' ? 'Tu Caballo mueve: ¡junta más monedas!' : t('message:cpuTurn:blackMoves')}
      onLesson={p.onLesson} onExit={p.onExit} />
  )
}

// --------------------------------------------------------- Castillo de Fantasmas
interface Ghost { id: number; sq: number; kind: string }
let ghostId = 1

export function GhostsGame(p: MiniProps) {
  const lvl = levelNum(p)
  const goal = 8 + lvl * 2
  const spawnN = lvl >= 7 ? 3 : 2
  const spawn = (list: Ghost[], n: number, knight: number, rows = 1): Ghost[] => {
    const out = list.slice()
    for (let i = 0; i < n; i++) {
      const free = Array.from({ length: 8 * rows }, (_, s) => s).filter((s) => s !== knight && !out.some((g) => g.sq === s))
      if (!free.length) break
      out.push({ id: ghostId++, sq: pick(free), kind: Math.random() < 0.5 ? 'ghost' : 'ghost2' })
    }
    return out
  }
  const [knight, setKnight] = useState(60)
  const [ghosts, setGhosts] = useState<Ghost[]>(() => spawn([], 3 + Math.min(3, Math.ceil(lvl / 3)), 60, 3))
  const [caught, setCaught] = useState(0)
  const [lives, setLives] = useState(3)
  const [hops, setHops] = useState(3)
  const [sel, setSel] = useState(true)
  const [busy, setBusy] = useState(false)
  const [fx, setFx] = useState<Token[]>([])
  const over = useRef(false)
  const later = useTimers()
  const { left } = useClock(150 + lvl * 10, !p.paused && !over.current, () => { over.current = true; p.onEnd({ won: false, message: 'message:timeIsUp' }) })

  const boom = (sq: number) => {
    const tok = { id: `b${sq}-${Date.now()}`, sq, kind: 'boom' }
    setFx((f) => [...f, tok])
    later(() => setFx((f) => f.filter((x) => x !== tok)), 500)
  }
  const win = (c: number) => { over.current = true; later(() => p.onEnd({ won: true, message: 'message:minigameComplete', excess: (3 - lives) / 3 + (c > goal ? 0 : 0) }), 600) }

  const hop = (to: number) => {
    let gs = ghosts, c = caught
    const hit = gs.find((g) => g.sq === to)
    if (hit) { gs = gs.filter((g) => g !== hit); c++; audio.fx('eat'); boom(to) } else audio.fx('piece_move_2')
    setKnight(to); setGhosts(gs); setCaught(c)
    if (c >= goal) return win(c)
    if (hops > 1) { setHops(hops - 1); return }
    // Tras los tres saltos avanzan todos los fantasmas y aparecen nuevos
    setBusy(true); setSel(false)
    later(() => {
      let lv = lives, c2 = c
      const moved: Ghost[] = []
      for (const g of gs) {
        const nsq = g.sq + 8
        if (nsq === to) { c2++; boom(nsq); audio.fx('eat'); continue }
        if (nsq > 55) { lv--; boom(nsq); audio.fx('wrong'); continue }
        moved.push({ ...g, sq: nsq })
      }
      const next = spawn(moved, spawnN, to)
      setGhosts(next); setLives(lv); setCaught(c2); setHops(3); setBusy(false); setSel(true)
      audio.fx('creeper_plant', 0.4)
      if (lv <= 0) { over.current = true; later(() => p.onEnd({ won: false, message: 'message:minigameNoMoreLives' }), 600) }
      else if (c2 >= goal) win(c2)
    }, 500)
  }

  const board = useMemo(() => { const bd = emptyBoard(); bd[knight] = { c: 'w', t: 'n' }; return bd }, [knight])
  const canPlay = !busy && !over.current && !p.paused
  const targets = sel && canPlay ? jumps(knight) : []
  const tokens: Token[] = [...ghosts.map((g) => ({ id: `g${g.id}`, sq: g.sq, kind: g.kind })), ...fx]
  const info: InfoRow[] = [
    { label: t('infopanel:time'), value: clock(left), warn: left <= 10 },
    { label: t('infopanel:invaders'), value: Math.max(0, goal - caught) },
    { label: t('infopanel:moves'), value: hops },
    { label: t('infopanel:lives'), value: <Hearts n={lives} /> },
  ]
  return (
    <Shell title={p.spot.name} sub={sub(p)} face={p.area.face} theme={p.area.board}
      board={{
        board, tokens, selected: sel ? knight : null, targets,
        onSquare: (sq) => { audio.unlock(); if (!canPlay) return; if (targets.includes(sq)) hop(sq); else if (sq === knight) setSel(!sel) },
      }}
      info={info} msg={busy ? '¡Los fantasmas avanzan!' : 'Tu Caballo salta tres veces por turno'}
      onLesson={p.onLesson} onExit={p.onExit} />
  )
}

// --------------------------------------------------------- Cazadores del Rey
const NAMES: [RegExp, PieceType][] = [[/dama|reina/i, 'q'], [/torre/i, 'r'], [/alfil/i, 'b'], [/caballo/i, 'n'], [/pe[oó]n/i, 'p']]
function inventory(text: string): PieceType[] {
  const out: PieceType[] = []
  for (const m of text.matchAll(/(\d+)\s*([A-Za-zñóÓ]+)/g)) {
    const tp = NAMES.find(([re]) => re.test(m[2]))
    if (tp) for (let i = 0; i < +m[1]; i++) out.push(tp[1])
  }
  return out.length ? out : ['q', 'r', 'r']
}

export function HuntersGame(p: MiniProps) {
  const start = useMemo(() => {
    const g = pick(p.games)
    return { pos: { ...parseFen(g.fen), turn: 'b' as const }, inv: inventory(comment(g)) }
  }, [p.games])
  const [pos, setPos] = useState<Pos>(start.pos)
  const [inv, setInv] = useState<PieceType[]>(start.inv)
  const [choice, setChoice] = useState<PieceType>(start.inv[0])
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<[number, number] | null>(null)
  const [placed, setPlaced] = useState(0)
  const over = useRef(false)
  const alive = useRef(true)
  const later = useTimers()
  useEffect(() => () => { alive.current = false }, [])
  const end = (won: boolean, message: string) => { if (over.current) return; over.current = true; later(() => p.onEnd({ won, message, excess: won ? placed / start.inv.length : undefined }), 800) }
  const { left } = useClock(240, !p.paused && !over.current, () => end(false, 'message:timeIsUp'))

  const types = [...new Set(inv)]
  const place = async (sq: number) => {
    if (busy || over.current || pos.board[sq] || !inv.includes(choice)) return
    if (choice === 'p' && (row(sq) === 0 || row(sq) === 7)) return audio.fx('wrong')
    const b = pos.board.slice()
    b[sq] = { c: 'w', t: choice }
    const n: Pos = { ...pos, board: b, turn: 'b', ep: -1 }
    const rest = inv.slice()
    rest.splice(rest.indexOf(choice), 1)
    audio.fx('create_piece')
    setPos(n); setInv(rest); setLast([sq, sq]); setPlaced(placed + 1)
    if (!rest.includes(choice) && rest.length) setChoice(rest[0])
    const replies = legalMoves(n)
    if (!replies.length) {
      if (inCheck(n, 'b')) { audio.fx('check'); return end(true, 'message:gameCompleted') }
      return end(false, 'message:endGame:draw')
    }
    setBusy(true)
    const m = await think('chess', n, {}, { depth: 2, timeMs: 800, noise: p.area.n < 7 ? 30 : 0 })
    if (!alive.current || over.current) return
    if (m) {
      const n2 = { ...vPlay('chess', n, m), turn: 'b' as const }
      audio.fx(m.captured ? 'eat' : 'piece_move_1')
      setPos(n2); setLast([m.from, m.to])
      if (!rest.length) { setBusy(false); return end(false, 'message:NoMoreMoves') }
    }
    setBusy(false)
  }

  const king = inCheck(pos, 'b') ? findKing(pos, 'b') : null
  const info: InfoRow[] = [
    { label: t('infopanel:time'), value: clock(left), warn: left <= 15 },
    { label: 'Cazadores', value: inv.length },
  ]
  return (
    <Shell title={p.spot.name} sub={sub(p)} face={p.area.face} theme={p.area.board}
      board={{ board: pos.board, last, check: king, onSquare: (sq) => { audio.unlock(); void place(sq) } }}
      info={info} msg={busy ? t('message:cpuTurn:blackMoves') : 'Elige un cazador y toca la casilla donde colocarlo'}
      extra={
        <div className="spells">
          {types.map((tp) => (
            <button key={tp} type="button" className={`spell ${choice === tp ? 'on' : ''}`} disabled={busy}
              style={{ backgroundImage: `url(/assets/pieces/leyenda/w${tp}1.webp)`, backgroundSize: 'contain' }}
              onClick={() => { audio.fx('click'); setChoice(tp) }}>
              <em>{inv.filter((x) => x === tp).length}</em>
            </button>
          ))}
        </div>
      }
      onLesson={p.onLesson} onExit={p.onExit} />
  )
}
