// Piezas compartidas por todos los minijuegos: marco de pantalla (tablero + panel),
// reloj, selección de jugadas con toque/click y utilidades.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Move, PieceType } from '../engine/chess.ts'
import { Board, type BoardProps } from '../ui/Board.tsx'
import { Btn, Title, fmtTime } from '../ui/widgets.tsx'
import { useGame } from '../game/store.ts'
import { audio } from '../game/audio.ts'
import { t } from '../game/texts.ts'
import type { Area, Spot } from '../game/world.ts'

export interface PgnGame { fen: string; t: ['m' | 'c', string][]; w?: string; b?: string; ev?: string; r?: string }

export interface MiniResult {
  won: boolean
  draw?: boolean
  /** 0 = perfecto … 1 = justo */
  excess?: number
  moves?: number
  /** Clave de texts.xml o texto directo */
  message?: string
}

export interface MiniProps {
  area: Area
  spot: Spot
  level: number
  games: PgnGame[]
  onEnd: (r: MiniResult) => void
  onExit: () => void
  onLesson?: () => void
  /** Hay un diálogo encima: se detiene el reloj */
  paused: boolean
}

export const sample = <T,>(arr: T[], n: number): T[] => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a.slice(0, Math.min(n, a.length))
}
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
export const comment = (g: PgnGame) => g.t.filter((x) => x[0] === 'c').map((x) => x[1]).join(' ')
export const line = (g: PgnGame) => g.t.filter((x) => x[0] === 'm').map((x) => x[1])

/** Lee "movimientos optimos: 3 movimientos permitidos: 5", "Optimo 3 Maximo 10", "Movidas restantes: 6"… */
export function limits(text: string): { optimal?: number; allowed?: number } {
  const n = (re: RegExp) => { const m = text.match(re); return m ? +m[1] : undefined }
  const optimal = n(/[oó]ptim[oa]s?:?\s*(\d+)/i)
  let allowed = n(/(?:permitid[oa]s|m[aá]ximo|restantes|l[ií]mite|movimientos):?\s*(\d+)/i) ?? n(/menos de (\d+)/i)
  if (optimal && allowed && allowed < optimal) allowed = optimal + 4
  return { optimal, allowed }
}

/** Cuenta regresiva en segundos. */
export function useClock(total: number, running: boolean, onZero: () => void) {
  const [left, setLeft] = useState(total)
  const cb = useRef(onZero)
  cb.current = onZero
  const fired = useRef(false)
  useEffect(() => {
    if (!running || total <= 0) return
    const id = setInterval(() => setLeft((l) => {
      const n = l - 0.25
      if (n <= 10 && Math.ceil(n) !== Math.ceil(l) && n > 0) audio.fx('time', 0.5)
      return Math.max(0, n)
    }), 250)
    return () => clearInterval(id)
  }, [running, total])
  useEffect(() => {
    if (left <= 0 && total > 0 && !fired.current) { fired.current = true; cb.current() }
  }, [left, total])
  const add = useCallback((s: number) => setLeft((l) => l + s), [])
  const reset = useCallback((s: number) => { fired.current = false; setLeft(s) }, [])
  return { left, add, reset }
}

/** Selección de pieza y destino con toque/click (con elección de coronación). */
export function useMoveInput(moves: Move[], onMove: (m: Move) => void, enabled: boolean, autoQueen = false) {
  const [selected, setSelected] = useState<number | null>(null)
  const [promo, setPromo] = useState<Move[] | null>(null)
  useEffect(() => { if (!enabled) { setSelected(null); setPromo(null) } }, [enabled])
  // Si la pieza seleccionada ya no tiene jugadas (cambió la posición), se deselecciona
  useEffect(() => { if (selected != null && !moves.some((m) => m.from === selected)) setSelected(null) }, [moves, selected])
  const targets = selected == null ? [] : [...new Set(moves.filter((m) => m.from === selected).map((m) => m.to))]
  const onSquare = (sq: number) => {
    audio.unlock()
    if (!enabled) return
    if (selected != null) {
      const cand = moves.filter((m) => m.from === selected && m.to === sq)
      if (cand.length) {
        setSelected(null)
        if (cand.length > 1 && !autoQueen) setPromo(cand)
        else onMove(cand.find((m) => m.promo === 'q') ?? cand[0])
        return
      }
    }
    if (moves.some((m) => m.from === sq)) { setSelected(sq === selected ? null : sq); audio.fx('piece_1', 0.6) }
    else setSelected(null)
  }
  const choose = (tp: PieceType) => {
    const m = promo?.find((x) => x.promo === tp)
    setPromo(null)
    if (m) onMove(m)
  }
  return { selected, targets, onSquare, promo, choose, clear: () => setSelected(null) }
}

const PROMO: [PieceType, string][] = [['q', 'reina'], ['r', 'torre'], ['b', 'alfil'], ['n', 'caballero']]
export const PromoPicker = ({ onPick }: { onPick: (t: PieceType) => void }) => (
  <div className="promo">
    {PROMO.map(([tp, name]) => (
      <button key={tp} type="button" style={{ backgroundImage: `url(/assets/ui/coronacion/coronacion_${name}_normal.webp)` }}
        onClick={() => { audio.fx('crown'); onPick(tp) }} aria-label={name} />
    ))}
  </div>
)

export interface InfoRow { label: string; value: ReactNode; warn?: boolean }

/** Pantalla de juego: tablero a la izquierda y panel lateral del HUD original. */
export function Shell(p: {
  title: string
  sub?: string
  face: string
  theme: string
  board: Omit<BoardProps, 'theme' | 'set' | 'width'>
  info?: InfoRow[]
  msg?: ReactNode
  msgKind?: 'warn' | 'good'
  extra?: ReactNode
  actions?: ReactNode
  onLesson?: () => void
  onExit?: () => void
  exitLabel?: string
  className?: string
  children?: ReactNode
}) {
  const set = useGame((s) => s.settings.pieces)
  return (
    <div className={`game ${p.className ?? ''}`}>
      <Board {...p.board} theme={p.theme} set={set} width={520} />
      <div className="side">
        <div className="side-head">
          <div className="side-face" style={{ backgroundImage: `url(/assets/caras/${p.face}.webp)` }} />
          <Title className="side-title">{p.title}</Title>
          {p.sub && <div className="side-sub">{p.sub}</div>}
        </div>
        {p.info && p.info.length > 0 && (
          <div className="info">
            {p.info.map((r) => (
              <div key={r.label} className={`info-row ${r.warn ? 'warn' : ''}`}><span>{r.label}</span><b>{r.value}</b></div>
            ))}
          </div>
        )}
        <div className={`side-msg ${p.msgKind ?? ''}`}>{p.msg}</div>
        <div className="side-fill">{p.extra}</div>
        <div className="side-actions">
          {p.actions}
          {p.onLesson && <Btn kind="tutorial" onClick={p.onLesson}>{t('button:tutorial')}</Btn>}
          {p.onExit && <Btn kind="volver" onClick={p.onExit}>{p.exitLabel ?? t('button:skiplevel')}</Btn>}
        </div>
      </div>
      {p.children}
    </div>
  )
}

export const Hearts = ({ n, max = 3 }: { n: number; max?: number }) => (
  <span className="hearts">{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? '' : 'off'} />)}</span>
)
export const clock = (s: number) => fmtTime(s)
export const moveSound = (m: Move) => audio.fx(m.captured ? 'eat' : Math.random() < 0.5 ? 'piece_move_1' : 'piece_move_2')
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
