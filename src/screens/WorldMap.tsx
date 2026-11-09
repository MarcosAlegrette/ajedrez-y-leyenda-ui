// Mapa de la Tierra de Eglerion (arte original: areaAvailableN + sprites de resaltado).
import { Btn, Hud, MapView, Screen } from '../ui/widgets.tsx'
import { useGame } from '../game/store.ts'
import { t } from '../game/texts.ts'
import { AREAS } from '../game/world.ts'
import sprites from '../data/sprites.json' with { type: 'json' }
import { audio } from '../game/audio.ts'

const S = sprites as unknown as { areaBox: Record<string, number[] | null>; areaOver: Record<string, { w: number; h: number }> }
// El área 1 no tiene mapa "anterior" para calcular su caja: va a mano.
const box = (n: number) => { const b = S.areaBox[n]; const o = S.areaOver[`area${n}over`]; return b ? [b[0] - 1, b[1] - 1, o.w, o.h] : [59, 93, o.w, o.h] }

export function WorldMap() {
  const { go, save } = useGame()
  const enter = (n: number) => {
    audio.fx('click')
    const dest = { name: 'area' as const, area: n }
    go(save.seen.includes(`story:area:${n}:start`) ? dest : { name: 'story', id: `area:${n}:start`, next: dest })
  }
  return (
    <Screen className="mapscreen">
      <MapView bg={`map/world${save.area}`} focusX={box(save.area)[0] + box(save.area)[2] / 2}>
        {AREAS.map((a) => {
          const [x, y, w, h] = box(a.n)
          const open = a.n <= save.area
          return (
            <button key={a.n} type="button" disabled={!open} title={a.name}
              className={`map-area ${open ? '' : 'locked'} ${a.n === save.area && !save.finished ? 'current' : ''}`}
              style={{ left: x, top: y, width: w, height: h, backgroundImage: `url(/assets/map/over/area${a.n}over.webp)` }}
              onClick={() => enter(a.n)} />
          )
        })}
      </MapView>
      <div className="map-msg">{save.finished ? t('story:area:10:end:2') : t('map:select:spot').replace('Castillo', 'territorio')}</div>
      <Hud className="map-hud" />
      <div className="map-buttons">
        <Btn kind="tutorial" className="sm" onClick={() => go({ name: 'shop', back: { name: 'world' } })}>{t('button:shop')}</Btn>
        <Btn kind="volver" className="sm" onClick={() => go({ name: 'menu' })}>{t('button:menu')}</Btn>
      </div>
    </Screen>
  )
}
