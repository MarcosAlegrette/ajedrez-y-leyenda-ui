// Piezas de interfaz hechas con el HUD original (botones dorados, paneles, diálogos).
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useStage } from './Stage.tsx'
import { audio, type Fx } from '../game/audio.ts'
import { useGame } from '../game/store.ts'

type BtnKind = 'volver' | 'play' | 'tutorial' | 'seguir' | 'atras' | 'rojo'

export function Btn(p: { kind?: BtnKind; onClick?: () => void; disabled?: boolean; children?: ReactNode; className?: string; style?: CSSProperties; sound?: Fx; title?: string }) {
  return (
    <button
      type="button"
      title={p.title}
      className={`btn btn-${p.kind ?? 'volver'} ${p.className ?? ''}`}
      style={p.style}
      disabled={p.disabled}
      onClick={() => { audio.unlock(); audio.fx(p.sound ?? 'click'); p.onClick?.() }}
    >
      <span>{p.children}</span>
    </button>
  )
}

/** Título dorado con borde oscuro, como los del juego. */
export const Title = (p: { children: ReactNode; size?: number; className?: string; style?: CSSProperties }) => (
  <h2 className={`gold-title ${p.className ?? ''}`} style={{ fontSize: p.size, ...p.style }}>{p.children}</h2>
)

/** Barras de ELO y ORO del HUD original. */
export function Hud({ className }: { className?: string }) {
  const save = useGame((s) => s.save)
  return (
    <div className={`hud ${className ?? ''}`}>
      <div className="hud-bar hud-elo" title="Puntaje ELO"><b>{save.elo}</b></div>
      <div className="hud-bar hud-oro" title="Monedas de oro"><b>{save.gold}</b></div>
    </div>
  )
}

export type Speaker = 'princess' | 'boss' | 'none'

/** Diálogo con personaje: Sofía (verde/azul) o un Capitán de la Oscuridad (rojo). */
export function Talk(p: {
  speaker: Speaker
  /** Sprite del capitán (dialog-boos-areaN) */
  boss?: string
  mood?: 'normal' | 'good' | 'bad'
  title?: string
  text: ReactNode
  children?: ReactNode
  sound?: Fx | null
}) {
  useEffect(() => {
    if (p.sound === null) return
    audio.fx(p.sound ?? (p.speaker === 'boss' ? 'boss_popup' : 'fairy_princess_popup'))
  }, [p.sound, p.speaker])
  const mood = p.mood ?? (p.speaker === 'boss' ? 'bad' : 'normal')
  const face = p.speaker === 'boss' ? p.boss ?? 'dialog-rey' : 'dialog-princess'
  return (
    <div className="overlay">
      <div className={`talk talk-${mood}`}>
        {p.speaker !== 'none' && <img className="talk-face" src={`/assets/dialog/${face}.webp`} alt="" draggable={false} />}
        {p.title && <div className="talk-title gold-title">{p.title}</div>}
        <div className={`talk-text ${p.speaker === 'none' ? 'no-face' : ''}`}>{p.text}</div>
        <div className="talk-actions">{p.children}</div>
      </div>
    </div>
  )
}

/** Marco de pantalla completa con una imagen de fondo original. */
export function Screen(p: { bg?: string; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`screen ${p.className ?? ''}`} style={{ ...(p.bg ? { backgroundImage: `url(/assets/${p.bg}.webp)` } : {}), ...p.style }}>
      {p.children}
    </div>
  )
}

export const fmtTime = (s: number) => { const n = Math.ceil(Math.max(0, s)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` }

/** Mapa de 800x600. En vertical (celular) se agranda y se desliza con el dedo. */
export function MapView(p: { bg: string; focusX?: number; children: ReactNode }) {
  const { portrait } = useStage()
  const ref = useRef<HTMLDivElement>(null)
  const k = 640 / 600
  useEffect(() => {
    if (portrait && ref.current) ref.current.scrollLeft = Math.max(0, (p.focusX ?? 400) * k - 260)
  }, [portrait, p.focusX, k])
  const map = <div className="map" style={{ backgroundImage: `url(/assets/${p.bg}.webp)` }}>{p.children}</div>
  if (!portrait) return map
  return (
    <div className="map-scroll" ref={ref}>
      <div style={{ width: 800 * k, height: 640 }}>{map}</div>
    </div>
  )
}
