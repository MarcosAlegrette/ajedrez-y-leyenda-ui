// Desafíos de "encontrar la jugada": jaque mate, táctica, capturas, mate ayudado,
// tiro al blanco y pieza escondida. Usan las líneas de solución de los PGN originales.
import { useEffect, useMemo, useRef, useState } from 'react'
import { type Color, type Move, type Pos, type PieceType, other, parseFen, play, legalMoves, pseudoMoves, fromSan, sameMove, inCheck, findKing } from '../engine/chess.ts'
import type { Token } from '../ui/Board.tsx'
import { Shell, Hearts, PromoPicker, useClock, useMoveInput, clock, comment, line, sample, moveSound, type MiniProps, type PgnGame, type InfoRow } from './common.tsx'
import { audio } from '../game/audio.ts'
import { t } from '../game/texts.ts'

export type PuzzleMode = 'mate' | 'tactics' | 'captures' | 'helpMate' | 'target' | 'hidden'

const ROUNDS: Record<PuzzleMode, number> = { mate: 6, tactics: 6, captures: 6, helpMate: 6, target: 10, hidden: 4 }
const SECONDS: Record<PuzzleMode, number> = { mate: 45, tactics: 60, captures: 45, helpMate: 60, target: 9, hidden: 60 }

const isMate = (p: Pos) => inCheck(p) && legalMoves(p).length === 0
const HIDDEN: [RegExp, PieceType, string][] = [[/pe[oó]n/i, 'p', 'Peón'], [/alfil/i, 'b', 'Alfil'], [/caballo/i, 'n', 'Caballo'], [/torre/i, 'r', 'Torre'], [/dama|reina/i, 'q', 'Dama']]
const hiddenPiece = (g: PgnGame) => HIDDEN.find(([re]) => re.test(comment(g)))

/** Pieza escondida: se coloca la pieza indicada y después las blancas dan mate en una. */
function hiddenSolutions(g: PgnGame): { color: Color; squares: number[] } {
  const hp = hiddenPiece(g)
  if (!hp) return { color: 'w', squares: [] }
  const base = parseFen(g.fen)
  const first: Color = g.r === '0-1' ? 'b' : 'w'
  for (const color of [first, other(first)]) {
    const squares: number[] = []
    for (let sq = 0; sq < 64; sq++) {
      if (base.board[sq] || (hp[1] === 'p' && (sq < 8 || sq > 55))) continue
      const b = base.board.slice()
      b[sq] = { c: color, t: hp[1] }
      const n: Pos = { ...base, board: b, turn: 'w', ep: -1 }
      // Posición legal (nadie en jaque antes de mover) y con mate en una
      if (inCheck(n, 'b') || inCheck(n, 'w')) continue
      if (legalMoves(n).some((m) => isMate(play(n, m)))) squares.push(sq)
    }
    if (squares.length) return { color, squares }
  }
  return { color: first, squares: [] }
}

/** ¿El PGN sirve para este modo? */
function usable(g: PgnGame, mode: PuzzleMode): boolean {
  const p = parseFen(g.fen)
  if (mode === 'hidden') return hiddenSolutions(g).squares.length > 0
  if (mode === 'target') return pseudoMoves({ ...p, turn: 'w' }, 'w', { ignoreCheck: true }).some((m) => m.captured)
  const ln = line(g)
  if (mode === 'helpMate') return p.turn === 'b' && ln.length >= 2
  return ln.length >= (p.turn === 'b' ? 2 : 1)
}

export default function PuzzleGame(p: MiniProps & { mode: PuzzleMode }) {
  const { mode } = p
  const rounds = useMemo(() => sample(p.games.filter((g) => usable(g, mode)), ROUNDS[mode]), [p.games, mode])
  const [ri, setRi] = useState(0)
  const game = rounds[ri]
  const [pos, setPos] = useState<Pos>(() => parseFen(rounds[0]?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1'))
  const [step, setStep] = useState(0) // índice en la línea de solución
  const [lives, setLives] = useState(3)
  const [last, setLast] = useState<[number, number] | null>(null)
  const [fx, setFx] = useState<Token[]>([])
  const [busy, setBusy] = useState(true)
  const [msg, setMsg] = useState<{ text: string; kind?: 'warn' | 'good' }>({ text: '' })
  const [solved, setSolved] = useState(0)
  const over = useRef(false)
  const errors = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const end = (won: boolean, message?: string) => {
    if (over.current) return
    over.current = true
    setBusy(true)
    later(() => p.onEnd({ won, message, excess: Math.min(1, errors.current / 3) }), 800)
  }
  const { left } = useClock(SECONDS[mode] * Math.max(1, rounds.length), !p.paused && !over.current, () => end(false, 'message:timeIsUp'))
  const sol = useMemo(() => (game ? line(game) : []), [game])
  const hidden = useMemo(() => (mode === 'hidden' && game ? hiddenSolutions(game) : { color: 'w' as Color, squares: [] }), [mode, game])
  const [placedPos, setPlacedPos] = useState<Pos | null>(null)

  // Arranque de cada ronda: en los problemas mueven primero las negras
  useEffect(() => {
    if (!game) { p.onEnd({ won: true }); return }
    let start = parseFen(game.fen)
    setLast(null); setStep(0); setMsg({ text: '' }); setPlacedPos(null)
    if (mode === 'target' || mode === 'hidden') { start = { ...start, turn: 'w', ep: -1 }; setPos(start); setBusy(false); return }
    setPos(start)
    if (start.turn === 'b' && mode !== 'helpMate') {
      setBusy(true)
      later(() => {
        const m = fromSan(start, sol[0])
        if (m) { moveSound(m); setPos(play(start, m)); setLast([m.from, m.to]); setStep(1) }
        setBusy(false)
      }, 700)
    } else setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ri])

  const boom = (sqs: number[], kind = 'boom') => {
    const toks = sqs.map((sq) => ({ id: `${kind}${sq}-${Date.now()}`, sq, kind }))
    setFx((f) => [...f, ...toks])
    later(() => setFx((f) => f.filter((x) => !toks.includes(x))), 600)
  }

  const next = () => {
    audio.fx('add')
    setMsg({ text: t('message:correct'), kind: 'good' })
    setSolved((s) => s + 1)
    if (ri + 1 >= rounds.length) return end(true)
    setBusy(true)
    later(() => setRi(ri + 1), 900)
  }
  const wrong = (text = t('message:incorrect'), restore?: Pos) => {
    audio.fx('wrong')
    errors.current++
    setMsg({ text, kind: 'warn' })
    if (lives - 1 <= 0) { setLives(0); return end(false, 'message:minigameNoMoreLives') }
    setLives(lives - 1)
    if (restore) { setBusy(true); later(() => { setPos(restore); setLast(null); setBusy(false) }, 650) }
  }

  const rules = mode === 'target' ? { ignoreCheck: true } : undefined
  const moves = useMemo(() => (busy || (mode === 'hidden' && !placedPos) ? [] : legalMoves(pos, rules)), [pos, busy, mode, placedPos]) // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (m: Move) => {
    if (over.current) return
    const n = play(pos, m)

    if (mode === 'hidden') {
      moveSound(m); setPos(n); setLast([m.from, m.to])
      if (isMate(n)) { audio.fx('check'); return next() }
      return wrong(t('message:incorrect'), pos)
    }

    if (mode === 'target') {
      if (!m.captured) { setPos(n); setLast([m.from, m.to]); return wrong(t('message:incorrect'), pos) }
      audio.fx('monigote'); boom([m.to])
      setPos({ ...n, turn: 'w' }); setLast([m.from, m.to])
      return next()
    }

    if (mode === 'helpMate') {
      if (pos.turn === 'b') {
        // Jugada de las negras: vale si después las blancas tienen mate en una
        const helps = legalMoves(n).some((w) => isMate(play(n, w)))
        moveSound(m); setPos(n); setLast([m.from, m.to])
        if (!helps) return wrong('Con esa jugada las blancas no pueden dar Jaque Mate...', pos)
        setMsg({ text: '¡Ahora da Jaque Mate con las blancas!', kind: 'good' })
        return
      }
      moveSound(m); setPos(n); setLast([m.from, m.to])
      if (isMate(n)) { audio.fx('check'); return next() }
      return wrong(t('message:incorrect'), pos)
    }

    // Línea de solución del PGN
    const expected = fromSan(pos, sol[step])
    // Vale la jugada del PGN o cualquier otra que también sea jaque mate
    const ok = (expected && sameMove(expected, m)) || isMate(n)
    moveSound(m); setPos(n); setLast([m.from, m.to])
    if (!ok) return wrong(t('message:incorrect'), pos)
    if (inCheck(n)) audio.fx('check')
    if (step + 1 >= sol.length || isMate(n)) return next()
    // Responden las negras y sigue la combinación
    setBusy(true)
    later(() => {
      const reply = fromSan(n, sol[step + 1])
      if (!reply) return next()
      const n2 = play(n, reply)
      moveSound(reply); setPos(n2); setLast([reply.from, reply.to])
      if (step + 2 >= sol.length) return next()
      setStep(step + 2); setBusy(false)
    }, 600)
  }

  const input = useMoveInput(moves, onMove, !busy && !p.paused && !over.current)

  const onSquare = (sq: number) => {
    if (mode !== 'hidden' || placedPos) return input.onSquare(sq)
    if (busy || over.current || pos.board[sq] || !game) return
    const b = pos.board.slice()
    b[sq] = { c: hidden.color, t: hiddenPiece(game)![1] }
    const n = { ...pos, board: b }
    audio.fx('create_piece')
    setPos(n); setLast([sq, sq])
    if (hidden.squares.includes(sq)) { setPlacedPos(n); setMsg({ text: '¡Muy bien! Ahora da Jaque Mate con las blancas.', kind: 'good' }); return }
    wrong('Desde ahí no se puede dar Jaque Mate...', pos)
  }

  const hint = !game ? '' : mode === 'hidden' ? (placedPos ? 'Da Jaque Mate con las blancas' : `Coloca la pieza escondida: ${hiddenPiece(game)![2]} ${hidden.color === 'w' ? 'blanco' : 'negro'}`.replace('Dama blanco', 'Dama blanca').replace('Dama negro', 'Dama negra').replace('Torre blanco', 'Torre blanca').replace('Torre negro', 'Torre negra'))
    : mode === 'target' ? '¡Atrapa de un solo tiro al monigote!'
      : mode === 'helpMate' ? (pos.turn === 'b' ? 'Mueve una pieza negra para ayudar a las blancas...' : 'Da Jaque Mate con las blancas')
        : busy && !over.current && step === 0 ? t('message:cpuTurn:blackMoves') : mode === 'mate' ? '¡Da Jaque Mate!' : 'Encuentra la mejor jugada'

  const info: InfoRow[] = [
    { label: t('infopanel:time'), value: clock(left), warn: left <= 10 },
    { label: t('infopanel:challenges'), value: `${Math.min(solved + 1, rounds.length)} / ${rounds.length}` },
    { label: t('infopanel:lives'), value: <Hearts n={lives} /> },
  ]
  const king = inCheck(pos) ? findKing(pos, pos.turn) : null

  return (
    <Shell
      title={p.spot.name} sub={`${t('map:level:sufix').replace(', ', '')} ${p.level}`} face={p.area.face} theme={p.area.board}
      board={{ board: pos.board, selected: input.selected, targets: input.targets, last, tokens: fx, check: king, onSquare }}
      info={info} msg={msg.text || hint} msgKind={msg.text ? msg.kind : undefined}
      onLesson={p.onLesson} onExit={p.onExit}
    >
      {input.promo && <PromoPicker onPick={input.choose} />}
    </Shell>
  )
}
