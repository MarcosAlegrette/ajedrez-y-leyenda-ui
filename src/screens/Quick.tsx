// Partida Rápida: ajedrez completo contra la computadora o entre dos jugadores.
import { useState } from 'react'
import { Btn, Screen, Talk, Title } from '../ui/widgets.tsx'
import { useGame } from '../game/store.ts'
import { t } from '../game/texts.ts'
import { audio } from '../game/audio.ts'
import VersusGame, { type QuickConfig } from '../minigames/VersusGame.tsx'
import type { MiniResult } from '../minigames/common.tsx'
import type { Area, Spot } from '../game/world.ts'
import type { SearchOpts } from '../engine/variants.ts'

const LEVELS: [string, SearchOpts][] = [
  ['Aprendiz', { depth: 1, noise: 250, timeMs: 400 }], ['Escudero', { depth: 2, noise: 150, timeMs: 700 }],
  ['Caballero', { depth: 3, noise: 60, timeMs: 1000 }], ['Capitán', { depth: 3, noise: 0, timeMs: 1500 }], ['Rey Brujo', { depth: 4, noise: 0, timeMs: 2500 }],
]
const AREA = { n: 5, name: '', board: 'tablero-2', boss: 'dialog-rey', face: 'caraDesafiante', spots: [] } as Area
const SPOT = { area: 5, n: 0, index: 0, name: t('menu:single'), type: 'battle', levels: ['q'], lessons: [], sprite: 'tower', x: 0, y: 0, final: false } as Spot

export default function Quick() {
  const go = useGame((s) => s.go)
  const [lvl, setLvl] = useState(1)
  const [cfg, setCfg] = useState<QuickConfig | null>(null)
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<MiniResult | null>(null)
  const [quit, setQuit] = useState(false)
  const start = (color: 'w' | 'b', twoPlayers = false) => { audio.music('game'); setResult(null); setCfg({ color, twoPlayers, cpu: LEVELS[lvl][1] }); setRound(round + 1) }

  if (!cfg) {
    return (
      <Screen bg="bg/menu2">
        <div className="center-col">
          <Title size={34}>{t('menu:single')}</Title>
          <div className="frame card">
            <div className="note" style={{ fontSize: 16 }}>{t('message:quickGame:intro')}</div>
            <div className="seg" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {LEVELS.map(([name], i) => <button key={name} type="button" className={i === lvl ? 'on' : ''} onClick={() => { audio.fx('click'); setLvl(i) }}>{name}</button>)}
            </div>
            <Btn kind="play" onClick={() => start('w')}>{t('button:playWhite')}</Btn>
            <Btn kind="tutorial" onClick={() => start('b')}>{t('button:playBlack')}</Btn>
            <Btn kind="volver" onClick={() => start('w', true)}>{t('button:playTwoPlayers')}</Btn>
          </div>
          <Btn onClick={() => go({ name: 'menu' })}>{t('menu:back')}</Btn>
        </div>
      </Screen>
    )
  }
  return (
    <>
      <VersusGame key={round} mode="quick" quick={cfg} area={AREA} spot={{ ...SPOT, name: cfg.twoPlayers ? t('button:playTwoPlayers') : LEVELS[lvl][0] }} level={1} games={[]}
        paused={!!result || quit} onExit={() => setQuit(true)}
        onEnd={(r) => { audio.music(r.draw ? 'lose' : (r.message?.startsWith('1-0') ? cfg.color === 'w' : cfg.color === 'b') || cfg.twoPlayers ? 'win' : 'lose'); setResult(r) }} />
      {quit && (
        <Talk speaker="princess" text={t('pause_exit_confirm_quick')}>
          <Btn kind="rojo" onClick={() => { setQuit(false); setCfg(null); audio.music('menu') }}>{t('button:si')}</Btn>
          <Btn kind="atras" onClick={() => setQuit(false)}>{t('button:no')}</Btn>
        </Talk>
      )}
      {result && (
        <Talk speaker="none" sound={null} title={t('classicmatch:2')} text={t(result.message ?? '1/2-1/2 [Stalemate]')}>
          <Btn kind="rojo" style={{ width: 190 }} onClick={() => start(cfg.color, cfg.twoPlayers)}>{t('button:newboard')}</Btn>
          <Btn kind="atras" onClick={() => { setCfg(null); setResult(null); audio.music('menu') }}>{t('button:back')}</Btn>
        </Talk>
      )}
    </>
  )
}
