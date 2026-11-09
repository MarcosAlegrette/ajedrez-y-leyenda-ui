// Enfrentamientos contra la computadora: batallas finales (con hechizos), guerra de
// peones, piezas contra peones / contra el rey, salvar al rey, come-come, tropillas,
// salir al portal, destructor… y la partida rápida.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type Color, type Move, type Pos, type PieceType, type Rules, parseFen, inCheck, findKing, other, row, sqName, pieces, START_FEN,
} from '../engine/chess.ts'
import { type Variant, type VParams, vMoves, vPlay, vResult, type Outcome, type SearchOpts } from '../engine/variants.ts'
import { think, strength } from '../engine/ai.ts'
import type { Token } from '../ui/Board.tsx'
import { Shell, PromoPicker, useClock, useMoveInput, clock, comment, limits, pick, moveSound, type MiniProps, type InfoRow } from './common.tsx'
import { Btn } from '../ui/widgets.tsx'
import { audio } from '../game/audio.ts'
import { t } from '../game/texts.ts'
import { useGame, SPELLS, type SpellId } from '../game/store.ts'
import book from '../data/book.json' with { type: 'json' }

export type VsMode =
  | 'pawnWar' | 'piecesPawns' | 'destroy' | 'battle' | 'reinforce' | 'attack' | 'challenge' | 'piecesKing' | 'saveKing' | 'comeCome'
  | 'tropillas' | 'portal' | 'quick'

export interface QuickConfig { color: Color; twoPlayers: boolean; cpu: SearchOpts }

const VARIANT: Record<VsMode, Variant> = {
  pawnWar: 'pawnRace', piecesPawns: 'pawns', destroy: 'destroy', battle: 'chess', reinforce: 'chess', attack: 'chess', challenge: 'chess',
  piecesKing: 'chess', saveKing: 'chess', comeCome: 'comeCome', tropillas: 'tropillas', portal: 'portal', quick: 'chess',
}
const MINUTES: Record<VsMode, number> = {
  pawnWar: 4, piecesPawns: 5, destroy: 12, battle: 15, reinforce: 15, attack: 10, challenge: 10, piecesKing: 5, saveKing: 3, comeCome: 5,
  tropillas: 6, portal: 5, quick: 0,
}
const WIN: Partial<Record<VsMode, string>> = {
  piecesPawns: 'message:endGame:allBlackCaptured', battle: 'message:endGame:finalBattle:win', reinforce: 'message:endGame:finalBattle:win',
  saveKing: 'message:endGame:reynaldoIsSafe', comeCome: 'message:endGame:eatEat:win', portal: 'message:endGame:portal:win',
}
const LOSE: Partial<Record<VsMode, string>> = {
  piecesPawns: 'message:endGame:enemyPawnFinished', destroy: 'message:endGame:allWhiteCaptured', battle: 'message:endGame:finalBattle:lose',
  reinforce: 'message:endGame:finalBattle:lose', attack: 'message:endGame:challenge:lose', challenge: 'message:endGame:challenge:lose',
  piecesKing: 'message:endGame:draw', saveKing: 'message:endGame:reynaldoCaptured', comeCome: 'message:endGame:eatEat:lose',
  portal: 'message:endGame:portal:lose', tropillas: '¡Ja ja ja! ¡Mi Caballo llegó primero a tu bandera! Inténtalo nuevamente.',
}
const HAS_SPELLS: VsMode[] = ['battle', 'reinforce', 'destroy']
const ADD: Partial<Record<SpellId, PieceType>> = { addPawn: 'p', addKnight: 'n', addBishop: 'b', addRook: 'r', addQueen: 'q' }
const INSTANT: SpellId[] = ['undoMove', 'timeBonus', 'move2Times']
const CAST_HINT: Partial<Record<SpellId, string>> = {
  frozenPiece: 'Toca la pieza enemiga que quieres congelar', untouchablePiece: 'Toca la pieza que quieres proteger',
  jumpingPiece: 'Toca la pieza que podrá saltar', destroyPawn: 'Toca el Peón enemigo que quieres destruir',
  prohibitedCell: 'Toca la casilla que el enemigo no podrá pisar', addWall: 'Toca una casilla vacía para levantar la pared',
}
const REINF: Record<string, PieceType> = { Q: 'q', R: 'r', B: 'b', N: 'n', P: 'p' }

interface Magic { frozen: number[]; untouchable: number[]; blocked: number[]; forbidden: number[]; jumpers: number[] }
const NO_MAGIC: Magic = { frozen: [], untouchable: [], blocked: [], forbidden: [], jumpers: [] }
interface Snap { pos: Pos; plies: number; magic: Magic }

const uci = (m: Move) => sqName(m.from) + sqName(m.to) + (m.promo ?? '')

export default function VersusGame(p: MiniProps & { mode: VsMode; quick?: QuickConfig }) {
  const { mode } = p
  const variant = VARIANT[mode]
  const user: Color = p.quick?.color ?? 'w'
  const two = !!p.quick?.twoPlayers
  const save = useGame((s) => s.save)
  const useSpell = useGame((s) => s.useSpell)

  const start = useMemo(() => {
    const g = p.games.length ? pick(p.games) : { fen: START_FEN, t: [] }
    const pos = parseFen(g.fen)
    const text = comment(g)
    const base: VParams = {}
    let limit = 0
    const reinforcements: PieceType[] = []
    if (mode === 'portal') {
      const kings = pieces(pos, 'b').filter((x) => x.piece.t === 'k')
      const k = kings.find((x) => row(x.sq) >= 2 && row(x.sq) <= 5) ?? kings[0]
      base.portal = k ? k.sq : 27
      if (k) pos.board[k.sq] = null
      pos.turn = 'w'
    }
    if (mode === 'tropillas') { base.goalW = 0; base.goalB = 63 }
    if (mode === 'saveKing') { base.onlyChecks = 'b'; limit = limits(text).allowed ?? 6 }
    if (mode === 'piecesKing') limit = limits(text).allowed ?? 25
    if (mode === 'reinforce') {
      for (const m of text.replace(/.*REFUERZOS:/i, '').matchAll(/(\d*)\s*([QRBNP])/g)) for (let i = 0; i < (+m[1] || 1); i++) reinforcements.push(REINF[m[2]])
    }
    return { pos, base, limit, reinforcements }
  }, [p.games, mode])

  const [pos, setPos] = useState<Pos>(start.pos)
  const [last, setLast] = useState<[number, number] | null>(null)
  const [plies, setPlies] = useState(0)
  const [magic, setMagic] = useState<Magic>(NO_MAGIC)
  const [casting, setCasting] = useState<SpellId | 'reinforce' | null>(null)
  const [reinf, setReinf] = useState<PieceType[]>(start.reinforcements)
  const [extraMove, setExtraMove] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [note, setNote] = useState('')
  const [fx, setFx] = useState<Token[]>([])
  const history = useRef<Snap[]>([])
  const moveLog = useRef<string[]>([])
  const over = useRef(false)
  const gen = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { gen.current++; timers.current.forEach(clearTimeout) }, [])

  const rules: Rules | undefined = useMemo(() => {
    const m = magic
    if (!m.frozen.length && !m.untouchable.length && !m.blocked.length && !m.forbidden.length && !m.jumpers.length) return undefined
    return {
      frozen: new Set(m.frozen), untouchable: new Set(m.untouchable), blocked: new Set(m.blocked), jumpers: new Set(m.jumpers),
      forbidden: m.forbidden.length ? { color: other(user), squares: new Set(m.forbidden) } : undefined,
    }
  }, [magic, user])
  const prm: VParams = useMemo(() => ({ ...start.base, rules }), [start, rules])

  const finish = (res: Outcome | 'time' | 'limit', at: Pos) => {
    if (over.current) return
    over.current = true
    gen.current++
    const won = res === user
    let message: string | undefined
    if (mode === 'pawnWar') {
      const crowned = at.board.slice(0, 8).some((x) => x?.t === 'p' && x.c === 'w') || at.board.slice(56).some((x) => x?.t === 'p' && x.c === 'b')
      message = won ? (crowned ? 'message:endGame:yourPawnFinished' : 'message:endGame:blackNoMoves') : crowned ? 'message:endGame:enemyPawnFinished' : 'message:endGame:whiteNoMoves'
    } else if (res === 'time') message = 'message:timeIsUp'
    else if (res === 'limit') message = mode === 'saveKing' ? 'message:endGame:reynaldoIsSafe' : 'message:NoMoreMoves'
    else if (res === 'draw') message = mode === 'piecesKing' ? 'message:endGame:draw' : 'message:endGame:challenge:draw'
    else if (won) message = mode === 'saveKing' && !inCheck(at, 'w') ? 'message:endGame:whiteNoJaqueMoves' : WIN[mode]
    else message = LOSE[mode] ?? (mode === 'quick' ? undefined : 'message:endGame:LoseOnCheckMate')
    if (mode === 'quick') message = res === 'draw' ? '1/2-1/2 [Stalemate]' : res === 'w' ? '1-0 [White mates]' : '0-1 [Black mates]'
    const survived = mode === 'saveKing' && res === 'limit'
    const ok = won || survived
    const usedPlies = Math.ceil(plies / 2)
    timers.current.push(setTimeout(() => p.onEnd({
      won: ok, draw: res === 'draw', message, moves: usedPlies,
      excess: ok ? Math.min(1, start.limit ? usedPlies / start.limit : usedPlies / 60) : undefined,
    }), 900))
  }

  const { left, add } = useClock(MINUTES[mode] * 60, !p.paused && !over.current && MINUTES[mode] > 0, () => finish('time', pos))

  const flash = (sqs: number[], kind = 'boom') => {
    const toks = sqs.map((sq) => ({ id: `${kind}${sq}-${Date.now()}`, sq, kind }))
    setFx((f) => [...f, ...toks])
    timers.current.push(setTimeout(() => setFx((f) => f.filter((x) => !toks.includes(x))), 600))
  }

  /** Aplica una jugada (del jugador o de la computadora). */
  const apply = (m: Move, from: Pos, byUser: boolean) => {
    let n = vPlay(variant, from, m, prm)
    moveSound(m)
    if (m.captured) flash([m.capSq ?? m.to])
    if (m.promo) audio.fx('crown')
    if (mode === 'portal' && m.to === start.base.portal) audio.fx('portal')
    moveLog.current.push(uci(m))
    const np = plies + 1
    setPlies(np)
    setLast([m.from, m.to])
    setNote('')
    // Los hechizos duran un turno: los del jugador se apagan cuando mueve el rival
    let nm = magic
    if (byUser) {
      nm = { ...magic, jumpers: [], untouchable: magic.untouchable.map((s) => (s === m.from ? m.to : s)) }
      if (extraMove) { n = { ...n, turn: user, ep: -1 }; setExtraMove(false); audio.fx('two_moves') }
    } else nm = NO_MAGIC
    setMagic(nm)
    setPos(n)
    if (inCheck(n, n.turn) && variant === 'chess') audio.fx('check')
    // Un rey capturado (posible con "mover dos veces") termina la partida
    if (variant === 'chess' && findKing(from, other(m.color)) >= 0 && findKing(n, other(m.color)) < 0) return finish(m.color, n)
    if (start.limit && !byUser && mode === 'saveKing' && Math.ceil(np / 2) >= start.limit && vResult(variant, n, { ...start.base }) === null) return finish('limit', n)
    if (start.limit && byUser && mode === 'piecesKing' && Math.ceil(np / 2) >= start.limit && vResult(variant, n, { ...start.base }) === null) return finish('limit', n)
  }

  // Turnos: resultado de la posición o jugada de la computadora
  useEffect(() => {
    if (over.current || p.paused) return
    const res = vResult(variant, pos, prm)
    if (res) { finish(res, pos); return }
    if (two || pos.turn === user) return
    const my = ++gen.current
    setThinking(true)
    let cancelled = false
    void (async () => {
      // Libro de aperturas original (book.txt) para la partida rápida
      let move: Move | null = null
      if (mode === 'quick') {
        const played = moveLog.current.join(' ')
        const lines = (book as string[]).filter((l) => l.startsWith(played) && l.length > played.length)
        if (lines.length && moveLog.current.length < 12) {
          const nextUci = pick(lines).slice(played.length).trim().split(' ')[0]
          move = vMoves(variant, pos, prm).find((m) => uci(m) === nextUci) ?? null
          if (move) await new Promise((r) => setTimeout(r, 500))
        }
      }
      const opts: SearchOpts = p.quick?.cpu ?? (mode === 'piecesKing' || mode === 'saveKing'
        ? { depth: 3, timeMs: 1200, noise: 0 }
        : mode === 'portal' ? { depth: Math.min(2, strength(p.area.n, p.level).depth), timeMs: 1500, noise: p.area.n < 4 ? 120 : 20 } : strength(p.area.n, p.level))
      if (!move) move = await think(variant, pos, prm, opts)
      if (cancelled || my !== gen.current || over.current) return
      setThinking(false)
      if (move) apply(move, pos, false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, p.paused])

  const myTurn = !over.current && !p.paused && (two || pos.turn === user) && !thinking
  const moves = useMemo(() => (myTurn && !casting ? vMoves(variant, pos, prm) : []), [myTurn, casting, variant, pos, prm])
  const onMove = (m: Move) => {
    history.current.push({ pos, plies, magic })
    apply(m, pos, true)
  }
  const input = useMoveInput(moves, onMove, myTurn && !casting)

  // ------------------------------------------------------------- hechizos
  const spend = (id: SpellId | 'reinforce', sound: Parameters<typeof audio.fx>[0] = 'invulnerable') => {
    audio.fx(sound)
    if (id !== 'reinforce') useSpell(id)
    setCasting(null)
    setNote('')
  }
  const cast = (id: SpellId) => {
    if (!myTurn || (save.spells[id] ?? 0) <= 0) return
    input.clear()
    if (INSTANT.includes(id)) {
      if (id === 'undoMove') {
        const snap = history.current.pop()
        if (!snap) return setNote('Todavía no hay jugadas para deshacer.')
        gen.current++
        moveLog.current.splice(snap.plies)
        setPos(snap.pos); setPlies(snap.plies); setMagic(snap.magic); setLast(null)
        return spend(id, 'undo')
      }
      if (id === 'timeBonus') { add(120); return spend(id, 'time') }
      if (extraMove) return
      setExtraMove(true)
      setNote('¡Después de esta jugada volverás a mover!')
      audio.fx('two_moves'); useSpell(id)
      return
    }
    setCasting(casting === id ? null : id)
    setNote(CAST_HINT[id] ?? 'Toca una casilla vacía de tu lado del tablero')
  }
  const castAt = (sq: number) => {
    const id = casting!
    const pc = pos.board[sq]
    const enemy = other(user)
    const mine = (r: number) => (user === 'w' ? r >= 4 : r <= 3)
    const addType: PieceType | undefined = id === 'reinforce' ? reinf[0] : ADD[id]
    if (addType) {
      const pawnBad = addType === 'p' && (row(sq) === 0 || row(sq) === 7)
      if (pc || !mine(row(sq)) || pawnBad || magic.blocked.includes(sq)) return audio.fx('wrong')
      const b = pos.board.slice()
      b[sq] = { c: user, t: addType }
      // No se puede colocar una pieza que deje al propio rey en jaque sin resolver
      setPos({ ...pos, board: b })
      flash([sq], 'ok')
      if (id === 'reinforce') setReinf(reinf.slice(1))
      return spend(id, 'create_piece')
    }
    if (id === 'destroyPawn') {
      if (pc?.c !== enemy || pc.t !== 'p') return audio.fx('wrong')
      const b = pos.board.slice()
      b[sq] = null
      history.current.push({ pos, plies, magic })
      flash([sq])
      // Destruir un peón cuesta el turno
      setPos({ ...pos, board: b, turn: enemy, ep: -1 }); setPlies(plies + 1); setLast(null)
      return spend(id, 'break')
    }
    if (id === 'frozenPiece') {
      if (pc?.c !== enemy || pc.t === 'k') return audio.fx('wrong')
      setMagic({ ...magic, frozen: [...magic.frozen, sq] })
      return spend(id, 'freeze')
    }
    if (id === 'untouchablePiece') {
      if (pc?.c !== user) return audio.fx('wrong')
      setMagic({ ...magic, untouchable: [...magic.untouchable, sq] })
      return spend(id, 'invulnerable')
    }
    if (id === 'jumpingPiece') {
      if (pc?.c !== user || !'brq'.includes(pc.t)) return audio.fx('wrong')
      setMagic({ ...magic, jumpers: [...magic.jumpers, sq] })
      return spend(id, 'jump')
    }
    if (pc) return audio.fx('wrong')
    if (id === 'prohibitedCell') { setMagic({ ...magic, forbidden: [...magic.forbidden, sq] }); return spend(id, 'creeper_plant') }
    if (id === 'addWall') { setMagic({ ...magic, blocked: [...magic.blocked, sq] }); return spend(id, 'wall') }
  }

  // ------------------------------------------------------------- dibujo
  const tokens: Token[] = [...fx]
  if (start.base.portal !== undefined) tokens.push({ id: 'portal', sq: start.base.portal, kind: 'portal' })
  if (mode === 'tropillas') tokens.push({ id: 'fb', sq: 0, kind: 'flagB' }, { id: 'fw', sq: 63, kind: 'flagW' })
  for (const sq of magic.blocked) tokens.push({ id: `w${sq}`, sq, kind: 'wall' })
  for (const sq of magic.forbidden) tokens.push({ id: `f${sq}`, sq, kind: 'thorns' })
  const skins: Record<number, string> = {}
  for (const sq of magic.frozen) skins[sq] = 'frozen'
  for (const sq of magic.untouchable) skins[sq] = 'shield'
  for (const sq of magic.jumpers) skins[sq] = 'jump'

  const info: InfoRow[] = []
  if (MINUTES[mode] > 0) info.push({ label: t('infopanel:time'), value: clock(left), warn: left <= 20 })
  if (start.limit) info.push({ label: t('infopanel:moves'), value: Math.max(0, start.limit - Math.ceil(plies / 2)), warn: start.limit - Math.ceil(plies / 2) <= 2 })
  if (mode === 'comeCome' || mode === 'destroy' || mode === 'portal') {
    const cnt = (c: Color) => pos.board.filter((x) => x?.c === c && (mode !== 'portal' || x.t !== 'p')).length
    info.push({ label: t('infopanel:whitePieces'), value: cnt('w') }, { label: t('infopanel:blackPieces'), value: cnt('b') })
  }

  const owned = HAS_SPELLS.includes(mode) ? SPELLS.filter((s) => (save.spells[s.id] ?? 0) > 0) : []
  const turnMsg = over.current ? '' : note || (thinking
    ? t('message:cpuTurn:blackMoves').replace('negras', user === 'w' ? 'negras' : 'blancas')
    : <><i className="turn-dot" style={{ background: pos.turn === 'w' ? '#fff' : '#222' }} />{t(`currentTurn:${pos.turn === 'w' ? 'white' : 'black'}`)}{inCheck(pos) && variant === 'chess' ? ' — ¡Jaque!' : ''}</>)
  const king = variant === 'chess' && inCheck(pos) ? findKing(pos, pos.turn) : null

  return (
    <Shell
      title={p.spot.name} sub={mode === 'quick' ? t('classicmatch:2') : p.spot.levels.length > 1 ? `Nivel ${p.level}` : p.area.name}
      face={p.area.face} theme={p.area.board}
      board={{
        board: pos.board, flipped: user === 'b', selected: input.selected, targets: input.targets, last, tokens, skins, check: king,
        onSquare: (sq) => (casting ? castAt(sq) : input.onSquare(sq)),
      }}
      info={info} msg={turnMsg} msgKind={note ? 'good' : undefined}
      extra={(owned.length > 0 || reinf.length > 0) && (
        <div className="spells">
          {reinf.length > 0 && (
            <button type="button" className={`spell ${casting === 'reinforce' ? 'on' : ''}`} disabled={!myTurn} title="Refuerzos"
              style={{ backgroundImage: `url(/assets/pieces/leyenda/${user}${reinf[0]}1.webp)`, backgroundSize: 'contain' }}
              onClick={() => { setCasting(casting === 'reinforce' ? null : 'reinforce'); setNote('Toca una casilla vacía de tu lado para colocar el refuerzo') }}>
              <em>{reinf.length}</em>
            </button>
          )}
          {owned.map((s) => (
            <button key={s.id} type="button" className={`spell ${casting === s.id || (s.id === 'move2Times' && extraMove) ? 'on' : ''}`} disabled={!myTurn}
              title={`${t(`powerup:name:${s.id}`)}: ${t(`powerup:desc:${s.id}`)}`} style={{ backgroundImage: `url(/assets/spells/${s.id}.webp)` }} onClick={() => cast(s.id)}>
              <em>{save.spells[s.id]}</em>
            </button>
          ))}
        </div>
      )}
      actions={mode === 'quick' && history.current.length > 0 && !over.current ? (
        <Btn kind="tutorial" disabled={!myTurn} onClick={() => {
          const snap = history.current.pop()
          if (!snap) return
          gen.current++
          moveLog.current.splice(snap.plies)
          setPos(snap.pos); setPlies(snap.plies); setLast(null); audio.fx('undo')
        }}>{t('button:undo')}</Btn>
      ) : undefined}
      onLesson={p.onLesson} onExit={p.onExit} exitLabel={mode === 'quick' ? t('button:menu') : undefined}
    >
      {input.promo && <PromoPicker onPick={input.choose} />}
    </Shell>
  )
}
