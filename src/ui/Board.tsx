// Tablero con el arte original: fondo de castillo, piezas "de leyenda" (o clásicas),
// marcas de colores y flechas de las lecciones, y fichas de los minijuegos.
import { memo, useMemo, useRef } from 'react'
import type { Board as BoardT, Piece } from '../engine/chess.ts'
import { file, row, sqName } from '../engine/chess.ts'
import sprites from '../data/sprites.json' with { type: 'json' }

const PIECES = (sprites as unknown as { pieces: Record<string, { w: number; h: number; ax: number; ay: number }> }).pieces
const CELL = 55

export interface Token { id: string; sq: number; kind: string }
export interface Arrow { from: number; to: number; color: string }

export interface BoardProps {
  theme: string
  flipped?: boolean
  board: BoardT
  set: 'leyenda' | 'clasicas'
  selected?: number | null
  targets?: number[]
  last?: [number, number] | null
  check?: number | null
  /** Casillas pintadas: R, G, Y, B (como [%csl] de los PGN) */
  marks?: Record<number, string>
  arrows?: Arrow[]
  tokens?: Token[]
  /** Aspecto especial de la pieza de una casilla: key, ghost, frozen, shield, jump, dim */
  skins?: Record<number, string>
  glow?: number[]
  onSquare?: (sq: number) => void
  width: number
}

interface Tracked { id: number; sq: number; piece: Piece; gone?: boolean }
let nextId = 1

/** Mantiene una identidad estable por pieza para poder animar los movimientos. */
function useTracked(board: BoardT): Tracked[] {
  const ref = useRef<Tracked[]>([])
  return useMemo(() => {
    const prev = ref.current.filter((p) => !p.gone)
    const out: Tracked[] = []
    const usedPrev = new Set<Tracked>()
    const pending: number[] = []
    for (let sq = 0; sq < 64; sq++) {
      const pc = board[sq]
      if (!pc) continue
      const same = prev.find((p) => p.sq === sq && p.piece.c === pc.c && p.piece.t === pc.t && !usedPrev.has(p))
      if (same) { usedPrev.add(same); out.push({ id: same.id, sq, piece: pc }) } else pending.push(sq)
    }
    const dist = (a: number, b: number) => Math.abs(file(a) - file(b)) + Math.abs(row(a) - row(b))
    for (const sq of pending) {
      const pc = board[sq]!
      const free = prev.filter((p) => !usedPrev.has(p) && p.piece.c === pc.c && !board[p.sq])
      // Primero la misma pieza que se movió; si no, un peón que coronó
      const cand = free.filter((p) => p.piece.t === pc.t).sort((a, b) => dist(a.sq, sq) - dist(b.sq, sq))[0]
        ?? free.filter((p) => p.piece.t === 'p' && dist(p.sq, sq) <= 2).sort((a, b) => dist(a.sq, sq) - dist(b.sq, sq))[0]
      if (cand) { usedPrev.add(cand); out.push({ id: cand.id, sq, piece: pc }) } else out.push({ id: nextId++, sq, piece: pc })
    }
    // Las capturadas se quedan un instante para la animación de salida
    for (const p of prev) if (!usedPrev.has(p)) out.push({ ...p, gone: true })
    out.sort((a, b) => a.id - b.id)
    ref.current = out
    return out
  }, [board])
}

const COLORS: Record<string, string> = { R: '#e8322a', G: '#3ec23a', Y: '#f5d21f', B: '#2f8cf0' }

function PieceImg({ piece, set, skin }: { piece: Piece; set: 'leyenda' | 'clasicas'; skin?: string }) {
  if (skin === 'key') return <img className="pc pc-token" src="/assets/fx/llave.webp" alt="llave" draggable={false} />
  if (skin === 'ghost') return <span className="pc pc-ghost" />
  if (skin === 'frozen') return <img className="pc pc-frozen" src={`/assets/pieces/hielo/${piece.c}${piece.t}.webp`} alt="" draggable={false} />
  if (set === 'clasicas') return <img className={`pc pc-classic ${skin ?? ''}`} src={`/assets/pieces/clasicas/${piece.c}${piece.t}.webp`} alt="" draggable={false} />
  const name = `${piece.c}${piece.t}1`
  const m = PIECES[name]
  return (
    <img
      className={`pc ${skin ?? ''}`}
      src={`/assets/pieces/leyenda/${name}.webp`}
      alt=""
      draggable={false}
      style={{
        left: `${((27 - m.ax) / CELL) * 100}%`, bottom: `${(12 / CELL) * 100}%`,
        width: `${(m.w / CELL) * 100}%`, height: `${(m.h / CELL) * 100}%`,
      }}
    />
  )
}

export const Board = memo(function Board(p: BoardProps) {
  const tracked = useTracked(p.board)
  const flip = !!p.flipped
  const col = (sq: number) => (flip ? 7 - file(sq) : file(sq))
  const rw = (sq: number) => (flip ? 7 - row(sq) : row(sq))
  const at = (sq: number) => ({ left: `${col(sq) * 12.5}%`, top: `${rw(sq) * 12.5}%` })
  const targets = new Set(p.targets)
  const glow = new Set(p.glow)
  const h = (p.width * 600) / 520

  return (
    <div className="board" style={{ width: p.width, height: h, backgroundImage: `url(/assets/boards/${p.theme}${flip ? 'a' : 'b'}.webp)` }}>
      <div className="board-grid">
        {/* marcas bajo las piezas */}
        {p.last && p.last.map((sq, i) => <i key={`l${i}`} className="sq sq-last" style={at(sq)} />)}
        {p.selected != null && <i className="sq sq-sel" style={at(p.selected)} />}
        {p.check != null && <i className="sq sq-check" style={at(p.check)} />}
        {p.marks && Object.entries(p.marks).map(([sq, c]) => (
          <i key={`m${sq}`} className="sq sq-mark" style={{ ...at(+sq), background: COLORS[c] ?? c }} />
        ))}
        {p.glow?.map((sq) => <i key={`g${sq}`} className="sq sq-glow" style={at(sq)} />)}

        {p.tokens?.map((tk) => (
          <span key={tk.id} className={`tok tok-${tk.kind}`} style={{ ...at(tk.sq), zIndex: 10 + rw(tk.sq) }} />
        ))}

        {tracked.map((tp) => (
          <span key={tp.id} className={`cell ${tp.gone ? 'cell-gone' : ''}`} style={{ ...at(tp.sq), zIndex: 20 + rw(tp.sq) * 2 + (tp.gone ? -1 : 0) }}>
            <PieceImg piece={tp.piece} set={p.set} skin={tp.gone ? undefined : p.skins?.[tp.sq]} />
          </span>
        ))}

        {[...targets].map((sq) => <i key={`t${sq}`} className={`sq sq-target ${p.board[sq] ? 'cap' : ''}`} style={at(sq)} />)}

        {p.arrows && p.arrows.length > 0 && (
          <svg className="board-arrows" viewBox="0 0 8 8">
            <defs>
              {Object.entries(COLORS).map(([k, c]) => (
                <marker key={k} id={`ah${k}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
                  <path d="M0,1 L9,5 L0,9 z" fill={c} />
                </marker>
              ))}
            </defs>
            {p.arrows.map((a, i) => {
              const x1 = col(a.from) + 0.5, y1 = rw(a.from) + 0.5, x2 = col(a.to) + 0.5, y2 = rw(a.to) + 0.5
              const len = Math.hypot(x2 - x1, y2 - y1) || 1
              const k = (len - 0.32) / len
              return (
                <line key={i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * k} y2={y1 + (y2 - y1) * k}
                  stroke={COLORS[a.color] ?? a.color} strokeWidth="0.16" strokeLinecap="round" opacity="0.9" markerEnd={`url(#ah${a.color})`} />
              )
            })}
          </svg>
        )}

        {p.onSquare && Array.from({ length: 64 }, (_, sq) => (
          <button key={sq} type="button" className={`hit ${targets.has(sq) || glow.has(sq) ? 'hit-on' : ''}`} style={at(sq)}
            aria-label={sqName(sq)} onClick={() => p.onSquare!(sq)} />
        ))}
      </div>
    </div>
  )
})

/** Convierte "[%csl Ye1,Rg8][%cal Ya1a8]" en marcas y flechas. */
export function parseAnnotations(text: string): { clean: string; marks: Record<number, string>; arrows: Arrow[] } {
  const marks: Record<number, string> = {}
  const arrows: Arrow[] = []
  const clean = text.replace(/\[%(csl|cal)\s+([^\]]*)\]/g, (_, kind: string, body: string) => {
    for (const raw of body.split(',')) {
      const s = raw.replace(/[^A-Za-z0-9]/g, '')
      if (kind === 'csl' && /^[RGYB][a-h][1-8]$/.test(s)) marks[(8 - +s[2]) * 8 + 'abcdefgh'.indexOf(s[1])] = s[0]
      if (kind === 'cal' && /^[RGYB][a-h][1-8][a-h][1-8]$/.test(s)) {
        arrows.push({ color: s[0], from: (8 - +s[2]) * 8 + 'abcdefgh'.indexOf(s[1]), to: (8 - +s[4]) * 8 + 'abcdefgh'.indexOf(s[3]) })
      }
    }
    return ''
  }).trim()
  return { clean, marks, arrows }
}
