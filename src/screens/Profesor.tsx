// "Profesor": todas las lecciones del juego para repasar cuando quieras.
import tutorials from '../data/tutorials.json' with { type: 'json' }
import { Btn, Screen, Title } from '../ui/widgets.tsx'
import { useGame } from '../game/store.ts'
import { t } from '../game/texts.ts'

const GROUPS: [string, RegExp][] = [
  ['Las piezas y las reglas', /^(1-0[1-7]|2-0[0-2]|3-00|4-00|5-00|5-09|6-00)\//],
  ['Jaque Mate', /^(1-09|1-10|2-06|2-09|3-09|4-02|4-10|Alfiles|JM)\//],
  ['Táctica y estrategia', /^(1-1[12]|2-10|3-0[478]|4-0[13469]|5-0[238]|6-0[18]|TTI|TP|SR|TB|RE|DE|AM|CR|CM)\//],
  ['Los desafíos', /^evento\//],
]
const nice = (id: string) => { const s = id.split('/')[1].replace(/_/g, ' '); return s[0].toUpperCase() + s.slice(1) }

export default function Profesor() {
  const go = useGame((s) => s.go)
  const ids = Object.keys(tutorials)
  return (
    <Screen bg="bg/profesor">
      <div className="center-col">
        <Title size={34}>{t('menu:professor')}</Title>
        <div className="frame card" style={{ width: '86%' }}>
          <div className="scroll list">
            {GROUPS.map(([name, re]) => (
              <div key={name} className="list">
                <h4>{name}</h4>
                {ids.filter((id) => re.test(id)).map((id) => (
                  <button key={id} type="button" onClick={() => go({ name: 'lesson', ids: [id], back: { name: 'profesor' }, title: t('tutorial') })}>{nice(id)}</button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <Btn onClick={() => go({ name: 'menu' })}>{t('menu:back')}</Btn>
      </div>
    </Screen>
  )
}
