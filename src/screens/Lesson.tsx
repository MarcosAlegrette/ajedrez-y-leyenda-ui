// Lecciones de la Princesa Sofía: posiciones, textos, flechas y la narración original.
import { useEffect, useMemo, useState } from 'react'
import tutorials from '../data/tutorials.json' with { type: 'json' }
import tutorialTexts from '../data/tutorialTexts.json' with { type: 'json' }
import { parseFen, fromSan, play, type Pos } from '../engine/chess.ts'
import { parseAnnotations, type Arrow } from '../ui/Board.tsx'
import { Shell, type PgnGame } from '../minigames/common.tsx'
import { Btn } from '../ui/widgets.tsx'
import { useGame, type Screen as ScreenT } from '../game/store.ts'
import { audio } from '../game/audio.ts'
import { getArea, getSpot } from '../game/world.ts'
import { t } from '../game/texts.ts'

const TUT = tutorials as unknown as Record<string, PgnGame[]>
const TXT = tutorialTexts as Record<string, string>

interface Step { pos: Pos; last: [number, number] | null; key: string | null; title: string; text: string; marks: Record<number, string>; arrows: Arrow[] }

export function buildSteps(ids: string[]): Step[] {
  const steps: Step[] = []
  for (const id of ids) for (const g of TUT[id] ?? []) {
    let pos = parseFen(g.fen)
    let last: [number, number] | null = null
    let pendingMove = false
    const push = (raw: string | null) => {
      const key = raw && /^[A-Z0-9_]+$/.test(raw.trim()) ? raw.trim() : null
      const body = key ? TXT[key] ?? '' : raw ?? ''
      const { clean, marks, arrows } = parseAnnotations(body)
      // La primera línea (en mayúsculas) es el título
      const m = clean.match(/^([^\n]*[A-ZÁÉÍÓÚÑ]{3}[^\n]*)\n+([\s\S]*)$/)
      const upper = m && m[1] === m[1].toUpperCase()
      steps.push({ pos, last, key, title: upper ? m![1].trim() : '', text: (upper ? m![2] : clean).replace(/\n{3,}/g, '\n\n').trim(), marks, arrows })
      pendingMove = false
    }
    for (const [kind, val] of g.t) {
      if (kind === 'c') push(val)
      else {
        if (pendingMove) push(null)
        const mv = val === '--' ? null : fromSan(pos, val)
        if (mv) { pos = play(pos, mv); last = [mv.from, mv.to] } else pos = { ...pos, turn: pos.turn === 'w' ? 'b' : 'w' }
        pendingMove = true
      }
    }
    if (pendingMove) push(null)
  }
  return steps
}

export default function Lesson({ ids, back, title, complete }: { ids: string[]; back: ScreenT; title?: string; complete?: { area: number; spot: number } }) {
  const { go, finishGame, save } = useGame()
  const steps = useMemo(() => buildSteps(ids), [ids])
  const [i, setI] = useState(0)
  const step = steps[i]
  const area = getArea(complete?.area ?? (back.name === 'area' ? back.area : Math.min(save.area, 6)))

  useEffect(() => {
    audio.voice(step?.key ?? null)
    return () => audio.voice(null)
  }, [step])

  const finish = () => {
    if (complete) {
      const spot = getSpot(complete.area, complete.spot)
      finishGame(spot, 1, true, 0, 0)
      const key = `mapmessage:area:${complete.area}:spot:${complete.spot}:level:1`
      const msg = t(key, '')
      go(back.name === 'area' ? { ...back, message: msg && msg !== key ? msg : undefined } : back)
    } else go(back)
  }
  if (!step) return <Shell title={title ?? t('tutorial')} face="caraContento" theme={area.board} board={{ board: parseFen('8/8/8/8/8/8/8/8 w - - 0 1').board }} onExit={() => go(back)} />

  return (
    <Shell
      className="lesson"
      title={title ?? t('tutorial')}
      face="caraContento"
      theme={area.board}
      board={{ board: step.pos.board, last: step.last, marks: step.marks, arrows: step.arrows }}
      extra={
        <div className="lesson-text" key={i}>
          {step.title && <h3>{step.title}</h3>}
          {step.text}
        </div>
      }
      actions={<>
        <div className="lesson-count">{t('tutorial')} · {i + 1} / {steps.length}</div>
        <div className="lesson-nav">
          <Btn kind="atras" disabled={i === 0} onClick={() => setI(i - 1)}>{t('button:previous')}</Btn>
          {i < steps.length - 1
            ? <Btn kind="seguir" onClick={() => setI(i + 1)}>{t('button:next')}</Btn>
            : <Btn kind="rojo" onClick={finish}>{complete ? t('button:continue') : t('button:back')}</Btn>}
        </div>
      </>}
      onExit={i < steps.length - 1 ? () => go(back) : undefined}
      exitLabel={t('button:back')}
    />
  )
}
