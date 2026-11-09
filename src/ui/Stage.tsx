// "Escenario" de tamaño lógico fijo que se escala a la pantalla, como el juego
// original de 800x600. En pantallas verticales grandes (tablet) usa un escenario de 520x900;
// en celulares en vertical pide girar el dispositivo, porque de costado se ve mucho mejor.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface StageInfo { portrait: boolean; W: number; H: number; scale: number; rotate?: boolean }
const Ctx = createContext<StageInfo>({ portrait: false, W: 800, H: 600, scale: 1 })
export const useStage = () => useContext(Ctx)

function measure(): StageInfo {
  const vw = window.innerWidth, vh = window.visualViewport?.height ?? window.innerHeight
  const portrait = vw / vh < 0.95
  const W = portrait ? 520 : 800, H = portrait ? 900 : 600
  // Celular en vertical: el lado corto de la pantalla es chico
  const rotate = portrait && Math.min(vw, vh) < 600
  return { portrait, W, H, scale: Math.min(vw / W, vh / H), rotate }
}

export function Stage({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState(measure)
  useEffect(() => {
    const on = () => setInfo(measure())
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('orientationchange', on)
      window.visualViewport?.removeEventListener('resize', on)
    }
  }, [])
  return (
    <Ctx.Provider value={info}>
      <div className="viewport">
        {/* El juego sigue montado detrás para no perder la partida al girar */}
        <div className={`stage ${info.portrait ? 'portrait' : 'landscape'}`} aria-hidden={info.rotate}
          style={{ width: info.W, height: info.H, transform: `translate(-50%, -50%) scale(${info.scale})`, visibility: info.rotate ? 'hidden' : undefined }}>
          {children}
        </div>
        {info.rotate && <RotateHint />}
      </div>
    </Ctx.Provider>
  )
}

/** Pantalla que pide poner el celular de costado (con el arte original del juego). */
function RotateHint() {
  const canFull = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
  const goFull = async () => {
    try {
      await document.documentElement.requestFullscreen()
      // Android permite fijar la orientación horizontal una vez en pantalla completa
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('landscape')
    } catch { /* iPhone no permite pantalla completa: alcanza con girar */ }
  }
  return (
    <div className="rotate-hint" role="alert">
      <img className="rotate-logo" src="/assets/ui/logo.webp" alt="Ajedrez y Leyendas" />
      <svg className="rotate-phone" viewBox="0 0 120 120" aria-hidden="true">
        <rect x="38" y="14" width="44" height="80" rx="8" fill="#0b3438" stroke="#f6c544" strokeWidth="4" />
        <rect x="45" y="24" width="30" height="58" rx="2" fill="#2aa7a0" opacity=".55" />
        <circle cx="60" cy="88" r="2.5" fill="#f6c544" />
      </svg>
      <img className="rotate-face" src="/assets/dialog/dialog-princess.webp" alt="" />
      <h1 className="gold-title">¡Gira tu celular!</h1>
      <p>Ajedrez y Leyendas se juega con el celular de costado.</p>
      {canFull && <button type="button" className="rotate-full" onClick={() => void goFull()}>Jugar en pantalla completa</button>}
    </div>
  )
}
