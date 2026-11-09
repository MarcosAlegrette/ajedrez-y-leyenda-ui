// Tienda de Hechizos (arte original): se compran con el oro ganado en los castillos.
import { useState } from 'react'
import { Btn, Hud, Screen, Title } from '../ui/widgets.tsx'
import { SPELLS, useGame, type Screen as ScreenT, type SpellId } from '../game/store.ts'
import { t } from '../game/texts.ts'
import { audio } from '../game/audio.ts'

export function Shop({ back }: { back: ScreenT }) {
  const { go, save, buySpell } = useGame()
  const [sel, setSel] = useState<SpellId>('undoMove')
  const buy = (id: SpellId) => {
    setSel(id)
    if (buySpell(id)) audio.fx('buy')
    else audio.fx('wrong')
  }
  return (
    <Screen bg="bg/shop">
      <div className="center-col" style={{ justifyContent: 'flex-start', paddingTop: 16 }}>
        <Title size={32}>{t('shop:title')}</Title>
        <div className="note" style={{ fontSize: 16 }}>{t('shop:subtitle')}</div>
        <div className="shop-grid">
          {SPELLS.map((s) => (
            <button key={s.id} type="button" className="shop-item" onClick={() => buy(s.id)} onPointerEnter={() => setSel(s.id)}>
              {(save.spells[s.id] ?? 0) > 0 && <span className="have">{save.spells[s.id]}</span>}
              <img src={`/assets/spells/${s.id}.webp`} alt="" style={{ opacity: save.gold >= s.price ? 1 : 0.5 }} />
              <span className="n">{t(`powerup:name:${s.id}`)}</span>
              <span className="p">{s.price} oro</span>
            </button>
          ))}
        </div>
        <div className="shop-desc"><b>{t(`powerup:name:${sel}`)}:</b> {t(`powerup:desc:${sel}`)}<br /><span className="note">Los hechizos se usan en las Batallas Finales.</span></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Hud />
          <Btn className="sm" onClick={() => go(back)}>{t('button:back')}</Btn>
        </div>
      </div>
    </Screen>
  )
}
