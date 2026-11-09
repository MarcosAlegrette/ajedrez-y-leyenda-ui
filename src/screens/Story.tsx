// Historia: panorama original de 2048x512 que se desplaza mientras se lee el texto.
import { useState } from 'react'
import { Screen, Btn } from '../ui/widgets.tsx'
import { useGame, type Screen as ScreenT } from '../game/store.ts'
import { t, has } from '../game/texts.ts'
import { audio } from '../game/audio.ts'

const bgOf = (id: string) => {
  const key = t(`story:${id}:background`, 'backgroundOpening')
  return key === 'backgroundOpening' ? 'opening' : key === 'backgroundEnding' ? 'ending' : key.replace('backgroundArea', 'area')
}

export function Story({ id, next }: { id: string; next: ScreenT }) {
  const { go, markSeen } = useGame()
  const [page, setPage] = useState(1)
  const done = () => { markSeen(`story:${id}`); go(next) }
  const advance = () => {
    audio.fx('click', 0.5)
    if (has(`story:${id}:${page + 1}`)) setPage(page + 1)
    else done()
  }
  return (
    <Screen className="story">
      <div style={{ position: 'absolute', inset: 0 }} onClick={advance}>
        <div className="story-pan" style={{ backgroundImage: `url(/assets/story/${bgOf(id)}.webp)` }} />
        <div className="story-text" key={page}>{t(`story:${id}:${page}`)}</div>
        <div className="story-hint">{t('story:continue')}</div>
      </div>
      <Btn kind="volver" className="sm story-skip" onClick={done}>{t('button:skip')}</Btn>
    </Screen>
  )
}
