// Desafíos donde sólo mueven las blancas: laberintos, laberintos peligrosos,
// recolectores, serie blanca, jaques y ataques múltiples.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type Move, type Pos, type PieceType, type Rules, parseFen, play, legalMoves, pseudoMoves, attackers, inCheck, pieces, VALUE, findKing,
} from '../engine/chess.ts'
import type { Token } from '../ui/Board.tsx'
import { Shell, Hearts, useClock, useMoveInput, clock, comment, limits, sample, moveSound, type MiniProps, type PgnGame, type InfoRow } from './common.tsx'
import { audio } from '../game/audio.ts'
import { t } from '../game/texts.ts'

export type SoloMode = 'maze' | 'danger' | 'collect' | 'series' | 'check' | 'fruits'

const FREE: Rules = { ignoreCheck: true }
const ROUNDS: Record<SoloMode, number> = { maze: 3, danger: 2, collect: 2, series: 3, check: 3, fruits: 1 }
const SECONDS: Record<SoloMode, number> = { maze: 80, danger: 110, collect: 70, series: 120, check: 70, fruits: 150 }

const asWhite = (p: Pos): Pos => ({ ...p, turn: 'w', ep: -1 })
const rulesOf = (mode: SoloMode, p: Pos): Rules | undefined =>
  mode === 'maze' ? (findKing(p, 'w') >= 0 ? undefined : FREE) : mode === 'series' || mode === 'check' ? undefined : FREE

/** Mejor puntaje posible capturando en `n` jugadas (para fijar el objetivo de Recolectores). */
function bestCapture(p: Pos, n: number): number {
  if (n === 0) return 0
  let best = 0
  for (const m of pseudoMoves(p, 'w', FREE)) {
    if (!m.captured) continue
    best = Math.max(best, VALUE[m.captured] + bestCapture(asWhite(play(p, m)), n - 1))
  }
  return best
}

const checksOf = (p: Pos) => legalMoves(p).filter((m) => inCheck(play(p, m), 'b'))
const key = (m: Move) => `${m.from}-${m.to}`
const targetsLeft = (p: Pos, mode: SoloMode) => {
  const black = pieces(p, 'b')
  if (mode === 'danger') return black.filter((x) => x.piece.t === 'k').length
  const noKings = black.filter((x) => x.piece.t !== 'k')
  return noKings.length || black.length
}

interface Round { pos: Pos; allowed: number; optimal: number; target: number }

function setup(g: PgnGame, mode: SoloMode, level: number): Round {
  const pos = asWhite(parseFen(g.fen))
  const c = comment(g)
  const lim = limits(c)
  const nums = (c.match(/\d+/g) ?? []).map(Number)
  const tg = targetsLeft(pos, mode)
  let optimal = lim.optimal ?? (lim.allowed ? Math.max(1, lim.allowed - 2) : nums.length ? nums.reduce((a, b) => a + b, 0) : tg)
  let allowed = lim.allowed ?? Math.ceil(optimal * 1.4) + 1
  let target = 0
  if (mode === 'collect') { allowed = 4; optimal = 4; target = Math.max(3, Math.ceil(bestCapture(pos, 4) * 0.7)) }
  if (mode === 'check') { target = checksOf(pos).length; allowed = target; optimal = target }
  if (mode === 'fruits') { allowed = 10; optimal = 5; target = 8 + level * 2 }
  if (allowed < optimal) allowed = optimal + 3
  return { pos, allowed, optimal, target }
}

export default function SoloGame(p: MiniProps & { mode: SoloMode }) {
  const { mode } = p
  const rounds = useMemo(() => {
    let gs = p.games
    if (mode === 'check') gs = gs.filter((g) => checksOf(asWhite(parseFen(g.fen))).length >= 2)
    return sample(gs, ROUNDS[mode]).map((g) => setup(g, mode, p.level))
  }, [p.games, mode, p.level])
  const [ri, setRi] = useState(0)
  const round = rounds[ri]
  const [pos, setPos] = useState<Pos>(round.pos)
  const [used, setUsed] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [found, setFound] = useState<string[]>([])
  const [last, setLast] = useState<[number, number] | null>(null)
  const [fx, setFx] = useState<Token[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; kind?: 'warn' | 'good' }>({ text: '' })
  const over = useRef(false)
  const excess = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const end = (won: boolean, message?: string) => {
    if (over.current) return
    over.current = true
    setBusy(true)
    later(() => p.onEnd({ won, message, excess: won ? Math.min(1, excess.current / rounds.length) : undefined, moves: used }), won ? 700 : 900)
  }
  const { left } = useClock(SECONDS[mode] * rounds.length, !p.paused && !over.current, () => end(false, 'message:timeIsUp'))

  const rules = rulesOf(mode, pos)
  const moves = useMemo(() => {
    if (busy) return []
    const ms = legalMoves(pos, rules)
    return mode === 'fruits' ? ms.filter((m) => !m.captured) : ms
  }, [pos, busy, mode, rules])

  const boom = (sqs: number[], kind = 'boom') => {
    const toks = sqs.map((sq) => ({ id: `${kind}${sq}-${Date.now()}`, sq, kind }))
    setFx((f) => [...f, ...toks])
    later(() => setFx((f) => f.filter((x) => !toks.includes(x))), 600)
  }

  const roundWon = (usedNow: number) => {
    excess.current += round.allowed > round.optimal ? Math.max(0, usedNow - round.optimal) / (round.allowed - round.optimal) : 0
    audio.fx('add')
    setMsg({ text: t('message:correct'), kind: 'good' })
    if (ri + 1 >= rounds.length) return end(true)
    setBusy(true)
    later(() => {
      const nx = rounds[ri + 1]
      setRi(ri + 1); setPos(nx.pos); setUsed(0); setScore(0); setFound([]); setLast(null); setBusy(false); setMsg({ text: '' })
    }, 900)
  }

  /** Falla la ronda: pierde una vida y vuelve a empezar la posición. */
  const fail = (text: string) => {
    audio.fx('wrong')
    setMsg({ text, kind: 'warn' })
    if (lives - 1 <= 0) { setLives(0); return end(false, 'message:minigameNoMoreLives') }
    setLives(lives - 1)
    setBusy(true)
    later(() => { setPos(round.pos); setUsed(0); setLast(null); setBusy(false) }, 800)
  }

  const onMove = (m: Move) => {
    if (over.current) return
    moveSound(m)
    const n = asWhite(play(pos, m))
    const usedNow = used + 1
    setLast([m.from, m.to])
    setUsed(usedNow)
    setMsg({ text: '' })

    if (mode === 'maze') {
      setPos(n)
      if (m.captured) boom([m.to])
      if (targetsLeft(n, mode) === 0 || (m.captured === 'k' && pieces(n, 'b').length === 0)) return roundWon(usedNow)
      if (pieces(n, 'b').every((x) => x.piece.t === 'k') && pieces(round.pos, 'b').some((x) => x.piece.t !== 'k')) return roundWon(usedNow)
      if (usedNow >= round.allowed) return end(false, 'message:NoMoreMoves')
      return
    }

    if (mode === 'danger') {
      setPos(n)
      const guards = attackers(n, m.to, 'b', FREE).filter((sq) => n.board[sq]!.t !== 'k')
      if (guards.length) {
        // La pieza dormida despierta y captura
        setBusy(true)
        later(() => {
          const b = n.board.slice()
          b[m.to] = b[guards[0]]; b[guards[0]] = null
          setPos({ ...n, board: b }); setLast([guards[0], m.to]); audio.fx('sword_hit'); boom([m.to])
          end(false, 'message:PlayerCaptured')
        }, 450)
        return
      }
      if (m.captured === 'k') { audio.fx('coin_diamond'); boom([m.to], 'ok') }
      if (targetsLeft(n, mode) === 0) return roundWon(usedNow)
      if (usedNow >= round.allowed) return end(false, 'message:NoMoreMoves')
      return
    }

    if (mode === 'collect') {
      setPos(n)
      const sc = score + (m.captured ? VALUE[m.captured] || 1 : 0)
      setScore(sc)
      if (m.captured) { boom([m.to]); audio.fx('coin', 0.7) }
      if (sc >= round.target) return roundWon(usedNow)
      if (usedNow >= round.allowed) return end(false, 'message:endGame:noEnoughPoints')
      return
    }

    if (mode === 'series') {
      setPos(n)
      if (inCheck(n, 'b')) {
        if (legalMoves({ ...n, turn: 'b' }).length === 0) { audio.fx('check'); return roundWon(usedNow) }
        return fail('¡Has dado jaque antes de tiempo! El jaque sólo puede darse en la jugada final.')
      }
      if (usedNow >= round.allowed) return fail(t('message:NoMoreMoves').split('\n')[0])
      return
    }

    if (mode === 'check') {
      setPos(n)
      setBusy(true)
      const good = inCheck(n, 'b') && !found.includes(key(m))
      if (good) {
        audio.fx('check'); boom([m.to], 'ok')
        const f = [...found, key(m)]
        setFound(f)
        setMsg({ text: t('message:correct'), kind: 'good' })
        if (f.length >= round.target) { later(() => { setBusy(false); roundWon(round.optimal) }, 500); return }
        later(() => { setPos(round.pos); setLast(null); setBusy(false) }, 800)
      } else {
        audio.fx('wrong')
        setMsg({ text: inCheck(n, 'b') ? 'Ese jaque ya lo encontraste...' : t('message:incorrect'), kind: 'warn' })
        if (lives - 1 <= 0) { setLives(0); return end(false, 'message:minigameNoMoreLives') }
        setLives(lives - 1)
        later(() => { setPos(round.pos); setLast(null); setBusy(false) }, 800)
      }
      return
    }

    // Ataques múltiples: explotan los personajes iguales atacados a la vez
    const hit = pseudoMoves(n, 'w', FREE, m.to).filter((x) => x.captured)
    const byType = new Map<PieceType, number[]>()
    for (const h of hit) byType.set(h.captured!, [...(byType.get(h.captured!) ?? []), h.to])
    const blown = [...byType.values()].filter((sqs) => sqs.length >= 2).flat()
    if (!blown.length) {
      setPos(n)
      if (usedNow >= round.allowed) return end(false, 'message:endGame:fruits:lose')
      return
    }
    audio.fx('break'); boom(blown)
    const b = n.board.slice()
    const types = blown.map((sq) => b[sq]!.t)
    for (const sq of blown) b[sq] = null
    const sc = score + blown.length
    setScore(sc)
    setPos({ ...n, board: b })
    if (sc >= round.target) return end(true, 'message:endGame:fruits:win')
    if (usedNow >= round.allowed) return end(false, 'message:endGame:fruits:lose')
    setBusy(true)
    later(() => {
      // Reaparecen en casillas nuevas, junto con un personaje más
      const nb = b.slice()
      const empty = () => { const e = nb.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0); return e[Math.floor(Math.random() * e.length)] }
      const extra = (['n', 'b', 'r'] as PieceType[])[Math.floor(Math.random() * 3)]
      for (const tp of [...types, extra]) { const sq = empty(); if (sq !== undefined) nb[sq] = { c: 'b', t: tp } }
      audio.fx('create_piece', 0.6)
      setPos((cur) => ({ ...cur, board: nb })); setBusy(false)
    }, 650)
  }

  const input = useMoveInput(moves, onMove, !busy && !p.paused && !over.current, true)
  const skins = useMemo(() => {
    // En los laberintos las piezas negras son las llaves que hay que juntar
    if (mode !== 'danger' && mode !== 'maze') return undefined
    const s: Record<number, string> = {}
    const onlyKings = pos.board.every((pc) => !pc || pc.c === 'w' || pc.t === 'k')
    pos.board.forEach((pc, sq) => { if (pc?.c === 'b' && (mode === 'maze' ? pc.t !== 'k' || onlyKings : pc.t === 'k')) s[sq] = 'key' })
    return s
  }, [pos, mode])

  const info: InfoRow[] = [{ label: t('infopanel:time'), value: clock(left), warn: left <= 10 }]
  if (mode === 'collect' || mode === 'fruits') info.push({ label: t('infopanel:points'), value: score }, { label: t('infopanel:pointsToGo'), value: round.target })
  if (mode === 'check') info.push({ label: t('infopanel:checksleft'), value: round.target - found.length })
  else info.push({ label: t('infopanel:moves'), value: Math.max(0, round.allowed - used), warn: round.allowed - used <= 1 })
  if (rounds.length > 1) info.push({ label: t('infopanel:challenges'), value: `${ri + 1} / ${rounds.length}` })
  if (mode === 'series' || mode === 'check') info.push({ label: t('infopanel:lives'), value: <Hearts n={lives} /> })

  return (
    <Shell
      title={p.spot.name} sub={`${t('map:level:sufix').replace(', ', '')} ${p.level}`} face={p.area.face} theme={p.area.board}
      board={{ board: pos.board, selected: input.selected, targets: input.targets, last, tokens: fx, skins, onSquare: input.onSquare }}
      info={info} msg={msg.text} msgKind={msg.kind}
      onLesson={p.onLesson} onExit={p.onExit}
    />
  )
}
