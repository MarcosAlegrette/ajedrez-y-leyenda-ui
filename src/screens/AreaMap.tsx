// Mapa de un área: castillos y torres originales unidos por un camino de puntos.
import { useMemo, useState } from 'react'
import { Btn, Hud, MapView, Screen, Talk, Title } from '../ui/widgets.tsx'
import { useGame, spotLevel, spotOpen } from '../game/store.ts'
import { t, has } from '../game/texts.ts'
import { getArea, type Spot } from '../game/world.ts'
import sprites from '../data/sprites.json' with { type: 'json' }
import { audio } from '../game/audio.ts'

const M = (sprites as unknown as { map: Record<string, { w: number; h: number; ax: number; ay: number }> }).map

export function AreaMap({ area: n, message }: { area: number; message?: string }) {
  const { go, save, markSeen } = useGame()
  const area = getArea(n)
  const [picked, setPicked] = useState<Spot | null>(null)
  const firstVisit = !save.seen.includes(`map:${n}`)
  const [talk, setTalk] = useState<string | null>(message ?? (firstVisit && has(`mapmessage:start:area${n}`) ? t(`mapmessage:start:area${n}`) : null))
  const here = { name: 'area' as const, area: n }
  const nextSpot = area.spots.find((s) => spotOpen(save, s) && spotLevel(save, s) === 0)

  const dots = useMemo(() => {
    const out: { x: number; y: number; on: boolean }[] = []
    for (let i = 0; i < area.spots.length - 1; i++) {
      const a = area.spots[i], b = area.spots[i + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.floor(len / 15)
      for (let k = 2; k < steps - 1; k++) out.push({ x: a.x + ((b.x - a.x) * k) / steps, y: a.y + ((b.y - a.y) * k) / steps, on: spotOpen(save, b) })
    }
    return out
  }, [area, save])

  const open = (s: Spot) => {
    audio.fx('click')
    if (s.type === 'lesson') go({ name: 'lesson', ids: s.levels, back: here, title: s.name, complete: { area: n, spot: s.n } })
    else if (s.levels.length === 1) go({ name: 'play', area: n, spot: s.n, level: 1 })
    else setPicked(s)
  }

  return (
    <Screen className="mapscreen">
      <MapView bg={`map/area${n}`} focusX={(nextSpot ?? area.spots[0]).x}>
        <Title className="map-title">{area.name}</Title>
        {dots.map((d, i) => <i key={i} className={`path-dot ${d.on ? 'on' : ''}`} style={{ left: d.x, top: d.y }} />)}
        {area.spots.map((s) => {
          const isOpen = spotOpen(save, s), won = spotLevel(save, s)
          const name = `${s.sprite}${!isOpen ? '_blocked' : won > 0 ? '_win' : s === nextSpot ? '_playing' : ''}`
          const m = M[name]
          return (
            <button key={s.n} type="button" disabled={!isOpen}
              className={`spot ${isOpen ? 'open' : 'blocked'} ${s === nextSpot ? 'next' : ''}`}
              style={{ left: s.x - m.ax, top: s.y - m.ay, width: m.w, height: m.h, zIndex: Math.round(s.y), backgroundImage: `url(/assets/map/spots/${name}.webp)` }}
              onClick={() => open(s)}>
              {isOpen && s.levels.length > 1 && s.type !== 'lesson' && (
                <span className="spot-stars">{s.levels.map((_, i) => <i key={i} className={i < won ? '' : 'off'} />)}</span>
              )}
              <span className="spot-name">{s.name}</span>
            </button>
          )
        })}
      </MapView>
      <Hud className="map-hud" />
      <div className="map-buttons">
        <button type="button" className="icon-btn" title="Mensaje de Sofía" onClick={() => setTalk(t(`mapmessage:start:area${n}`))} />
        <button type="button" className="icon-btn book" title="Historia" onClick={() => go({ name: 'story', id: `area:${n}:start`, next: here })} />
        <Btn kind="tutorial" className="sm" onClick={() => go({ name: 'shop', back: here })}>{t('button:shop')}</Btn>
        <Btn kind="volver" className="sm" onClick={() => go({ name: 'world' })}>{t('button:back')}</Btn>
      </div>
      {picked && (
        <Talk speaker="none" mood="normal" sound={null} title={picked.name} text={<>{t('map:select:level')}
          <div className="level-pick" style={{ marginTop: 14 }}>
            {picked.levels.map((_, i) => {
              const won = spotLevel(save, picked)
              return (
                <button key={i} type="button" className={i < won ? 'won' : ''} disabled={i > won}
                  onClick={() => { audio.fx('click'); go({ name: 'play', area: n, spot: picked.n, level: i + 1 }) }}>{i + 1}</button>
              )
            })}
          </div></>}>
          {picked.lessons.length > 0 && <Btn kind="tutorial" className="sm" onClick={() => go({ name: 'lesson', ids: picked.lessons, back: here, title: picked.name })}>{t('button:tutorial')}</Btn>}
          <Btn kind="volver" className="sm" onClick={() => setPicked(null)}>{t('button:back')}</Btn>
        </Talk>
      )}
      {talk && !picked && (
        <Talk speaker="princess" mood="good" text={talk}>
          <Btn kind="seguir" onClick={() => { markSeen(`map:${n}`); setTalk(null) }}>{t('button:continue')}</Btn>
        </Talk>
      )}
    </Screen>
  )
}
