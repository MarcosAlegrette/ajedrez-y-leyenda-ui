import { useState } from 'react'
import { Btn, Screen, Talk } from '../ui/widgets.tsx'
import { useGame } from '../game/store.ts'
import { t } from '../game/texts.ts'
import { audio } from '../game/audio.ts'
import { apiEnabled } from '../game/api.ts'

export function MainMenu() {
  const { go, hasSave, save, resetAdventure, session, cloud } = useGame()
  const [started, setStarted] = useState(audio.unlocked)
  const [confirm, setConfirm] = useState(false)

  const begin = () => {
    resetAdventure()
    go({ name: 'story', id: 'general', next: { name: 'story', id: 'area:1:start', next: { name: 'area', area: 1 } } })
  }
  const adventureStarted = hasSave && (save.games > 0 || Object.keys(save.spots).length > 0)

  if (!started) {
    return (
      <Screen bg="bg/menu1" className="menu" style={{ cursor: 'pointer' }}>
        <div style={{ position: 'absolute', inset: 0 }} onClick={() => { audio.unlock(); audio.fx('click'); setStarted(true) }}>
          <div className="start-hint gold-title">Toca para comenzar</div>
        </div>
      </Screen>
    )
  }

  return (
    <Screen bg="bg/menu1" className="menu">
      <div className="menu-buttons">
        {adventureStarted && <Btn kind="play" onClick={() => go({ name: 'world' })}>{t('menu:continue')}</Btn>}
        <Btn kind={adventureStarted ? 'volver' : 'play'} onClick={() => (adventureStarted ? setConfirm(true) : begin())}>{t('menu:newgame')}</Btn>
        <Btn onClick={() => go({ name: 'quick' })}>{t('menu:single')}</Btn>
        <Btn onClick={() => go({ name: 'profesor' })}>{t('menu:professor')}</Btn>
        <Btn onClick={() => go({ name: 'options' })}>{t('menu:options')}</Btn>
        <Btn onClick={() => go({ name: 'video' })}>{t('menu:video')}</Btn>
        <Btn onClick={() => go({ name: 'credits' })}>{t('menu:credits')}</Btn>
      </div>
      {apiEnabled && <div className="menu-top">
        <Btn kind="tutorial" className="sm" onClick={() => go({ name: 'account' })}>{session ? `Jugador: ${session.username}` : 'Entrar / Crear jugador'}</Btn>
        <Btn kind="volver" className="sm" onClick={() => go({ name: 'ranking' })}>Ranking de ELO</Btn>
      </div>}
      <div className="menu-foot">
        {session ? (cloud === 'offline' ? 'Sin conexión: la aventura se guarda en este dispositivo' : 'Aventura guardada en tu cuenta') : 'La aventura se guarda en este dispositivo'}
      </div>
      {confirm && (
        <Talk speaker="princess" text={t('menu:newgame:confirm')}>
          <Btn kind="rojo" onClick={begin}>{t('button:si')}</Btn>
          <Btn kind="atras" onClick={() => setConfirm(false)}>{t('button:no')}</Btn>
        </Talk>
      )}
    </Screen>
  )
}
