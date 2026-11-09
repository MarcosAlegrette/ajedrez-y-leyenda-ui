// Un castillo: desafío del Capitán de la Oscuridad → minijuego → resultado (ELO y oro).
import { useState, type ReactNode } from 'react'
import levels from '../data/levels.json' with { type: 'json' }
import { Btn, Talk } from '../ui/widgets.tsx'
import { useGame, spotLevel, type Screen as ScreenT } from '../game/store.ts'
import { getArea, getSpot, INTRO, type MiniType } from '../game/world.ts'
import { t, has } from '../game/texts.ts'
import { eloDelta, goldFor } from '../game/elo.ts'
import { audio } from '../game/audio.ts'
import type { MiniProps, MiniResult, PgnGame } from '../minigames/common.tsx'
import SoloGame, { type SoloMode } from '../minigames/SoloGame.tsx'
import PuzzleGame, { type PuzzleMode } from '../minigames/PuzzleGame.tsx'
import VersusGame, { type VsMode } from '../minigames/VersusGame.tsx'
import { CoinsGame, GhostsGame, HuntersGame } from '../minigames/Arcade.tsx'

const LEVELS = levels as unknown as Record<string, PgnGame[]>
const SOLO: Partial<Record<MiniType, SoloMode>> = { maze: 'maze', danger: 'danger', collect: 'collect', series: 'series', check: 'check', fruits: 'fruits' }
const PUZZLE: Partial<Record<MiniType, PuzzleMode>> = { mate: 'mate', tactics: 'tactics', captures: 'captures', helpMate: 'helpMate', target: 'target', hidden: 'hidden' }
const VERSUS: Partial<Record<MiniType, VsMode>> = {
  pawnWar: 'pawnWar', piecesPawns: 'piecesPawns', destroy: 'destroy', battle: 'battle', reinforce: 'reinforce', attack: 'attack',
  challenge: 'challenge', piecesKing: 'piecesKing', saveKing: 'saveKing', comeCome: 'comeCome', tropillas: 'tropillas', portal: 'portal',
}

function Mini(p: MiniProps): ReactNode {
  const type = p.spot.type
  if (SOLO[type]) return <SoloGame {...p} mode={SOLO[type]!} />
  if (PUZZLE[type]) return <PuzzleGame {...p} mode={PUZZLE[type]!} />
  if (VERSUS[type]) return <VersusGame {...p} mode={VERSUS[type]!} />
  if (type === 'coins') return <CoinsGame {...p} />
  if (type === 'ghosts') return <GhostsGame {...p} />
  return <HuntersGame {...p} />
}

const say = (key: string | undefined, fallback: string) => (key ? (has(key) ? t(key) : key) : t(fallback))
const plural = (n: number, key: string) => t(`stats::${key}:${Math.abs(n) === 1 ? 'singular' : 'plural'}`)

export default function Play({ area: an, spot: sn, level }: { area: number; spot: number; level: number }) {
  const { go, save, finishGame } = useGame()
  const area = getArea(an), spot = getSpot(an, sn)
  const file = spot.levels[level - 1]
  // En la serie "Jaque" se usan las posiciones del formato "descubre los jaques"
  const games = spot.type === 'check' ? [...(LEVELS['1-07/JQ1'] ?? []), ...(LEVELS['1-07/JQ2'] ?? [])] : LEVELS[file] ?? []
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result' | 'quit'>('intro')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ r: MiniResult; elo: number; gold: number; firstWin: boolean; areaDone: boolean } | null>(null)
  const here: ScreenT = { name: 'play', area: an, spot: sn, level }
  const map: ScreenT = { name: 'area', area: an }
  const final = spot.final

  const onEnd = (r: MiniResult) => {
    const repeat = spotLevel(save, spot) >= level
    const elo = eloDelta({ playerElo: save.elo, games: save.games, type: spot.type, area: an, spot: sn, level, score: r.won ? 1 : r.draw ? 0.5 : 0, excess: r.excess, repeat })
    const gold = r.won ? goldFor(spot.type, an, level, r.excess, repeat) : 0
    const out = finishGame(spot, level, r.won, elo, gold, { moves: r.moves })
    audio.music(r.won ? 'win' : 'lose')
    setResult({ r, elo, gold, ...out })
    setPhase('result')
  }

  const leave = () => {
    if (!result?.r.won) return go(map)
    if (result.areaDone) {
      const after: ScreenT = an < 10
        ? { name: 'story', id: `area:${an + 1}:start`, next: { name: 'area', area: an + 1 } }
        : { name: 'credits' }
      return go({ name: 'story', id: `area:${an}:end`, next: after })
    }
    const key = `mapmessage:area:${an}:spot:${sn}:level:1`
    go({ ...map, message: result.firstWin && has(key) && t(key) ? t(key) : undefined })
  }
  const again = (lvl: number) => {
    audio.music('game')
    if (lvl === level) { setResult(null); setAttempt(attempt + 1); setPhase('playing') } else go({ name: 'play', area: an, spot: sn, level: lvl })
  }

  return (
    <>
      <Mini key={attempt} area={area} spot={spot} level={level} games={games} paused={phase !== 'playing'} onEnd={onEnd}
        onExit={() => setPhase('quit')}
        onLesson={spot.lessons.length ? () => go({ name: 'lesson', ids: spot.lessons, back: here, title: spot.name }) : undefined} />

      {phase === 'intro' && (
        <Talk speaker="boss" boss={area.boss} title={spot.name} text={say(INTRO[spot.type], 'message:challenge:intro')}>
          <Btn kind="rojo" style={{ width: 190 }} onClick={() => setPhase('playing')}>{final ? t('button:battle') : t('button:playGame')}</Btn>
          {spot.lessons.length > 0 && <Btn kind="seguir" onClick={() => go({ name: 'lesson', ids: spot.lessons, back: here, title: spot.name })}>{t('tutorial')}</Btn>}
          {final && <Btn kind="seguir" onClick={() => go({ name: 'shop', back: here })}>{t('button:shop')}</Btn>}
          <Btn kind="atras" onClick={() => go(map)}>{t('button:back')}</Btn>
        </Talk>
      )}

      {phase === 'quit' && (
        <Talk speaker="princess" text={t('pause_exit_confirm_quick')} title={t('pause_exit')}>
          <Btn kind="rojo" onClick={() => go(map)}>{t('button:si')}</Btn>
          <Btn kind="atras" onClick={() => setPhase('playing')}>{t('button:no')}</Btn>
        </Talk>
      )}

      {phase === 'result' && result && (
        <Talk speaker={result.r.won ? 'princess' : 'boss'} boss={area.boss} mood={result.r.won ? 'good' : 'bad'} sound={null}
          text={<>
            {say(result.r.message, result.r.won ? 'message:minigameComplete' : 'message:endGame:challenge:lose')}
            <div className="talk-stats">
              {result.elo !== 0 && <>{t(result.elo > 0 ? 'stats::preElo:positive' : 'stats::preElo:negative')}<b>{Math.abs(result.elo)}</b>
                {result.gold > 0 ? plural(result.elo, 'middleEloGold') : plural(result.elo, 'postElo')}</>}
              {result.gold > 0 && <><b>{result.gold}</b>{plural(result.gold, 'postGold')}</>}
            </div>
          </>}>
          {result.r.won
            ? <>
              <Btn kind="rojo" onClick={leave}>{t('button:continue')}</Btn>
              {level < spot.levels.length && <Btn kind="seguir" style={{ width: 170 }} onClick={() => again(level + 1)}>Nivel {level + 1}</Btn>}
            </>
            : <>
              <Btn kind="rojo" style={{ width: 160 }} onClick={() => again(level)}>Reintentar</Btn>
              <Btn kind="atras" onClick={leave}>{t('button:back')}</Btn>
            </>}
        </Talk>
      )}
    </>
  )
}
