import { lazy, Suspense, useEffect } from 'react'
import { Stage } from './ui/Stage.tsx'
import { useGame, type Screen as ScreenT } from './game/store.ts'
import { audio, type Track } from './game/audio.ts'
import { MainMenu } from './screens/MainMenu.tsx'
import { WorldMap } from './screens/WorldMap.tsx'
import { AreaMap } from './screens/AreaMap.tsx'
import { Story } from './screens/Story.tsx'
import { Options, Credits, Account, Ranking, Video } from './screens/Simple.tsx'
import { Shop } from './screens/Shop.tsx'

const Play = lazy(() => import('./screens/Play.tsx'))
const Lesson = lazy(() => import('./screens/Lesson.tsx'))
const Profesor = lazy(() => import('./screens/Profesor.tsx'))
const Quick = lazy(() => import('./screens/Quick.tsx'))

const MUSIC: Record<ScreenT['name'], Track | null> = {
  menu: 'menu', world: 'map', area: 'map', story: 'story', play: 'game', lesson: 'map', shop: 'map', quick: 'game',
  profesor: 'menu', options: 'menu', credits: 'end', account: 'menu', ranking: 'menu', video: null,
}

const Loading = () => <div className="loader"><div className="gold-title">Cargando...</div></div>

function Current({ s }: { s: ScreenT }) {
  switch (s.name) {
    case 'menu': return <MainMenu />
    case 'world': return <WorldMap />
    case 'area': return <AreaMap key={s.area} area={s.area} message={s.message} />
    case 'story': return <Story key={s.id} id={s.id} next={s.next} />
    case 'play': return <Play key={`${s.area}:${s.spot}:${s.level}`} area={s.area} spot={s.spot} level={s.level} />
    case 'lesson': return <Lesson key={s.ids.join()} ids={s.ids} back={s.back} title={s.title} complete={s.complete} />
    case 'shop': return <Shop back={s.back} />
    case 'quick': return <Quick />
    case 'profesor': return <Profesor />
    case 'options': return <Options />
    case 'credits': return <Credits />
    case 'account': return <Account />
    case 'ranking': return <Ranking />
    case 'video': return <Video />
  }
}

export function App() {
  const screen = useGame((s) => s.screen)
  const syncDown = useGame((s) => s.syncDown)
  useEffect(() => { audio.music(MUSIC[screen.name]) }, [screen.name])
  useEffect(() => {
    void syncDown()
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [syncDown])
  return (
    <Stage>
      <Suspense fallback={<Loading />}>
        <Current s={screen} />
      </Suspense>
    </Stage>
  )
}
