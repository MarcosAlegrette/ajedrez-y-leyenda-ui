// Pantallas sencillas: opciones, créditos, cuenta de jugador, ranking y video.
import { useEffect, useState } from 'react'
import { Btn, Screen, Talk, Title } from '../ui/widgets.tsx'
import { useGame } from '../game/store.ts'
import { t } from '../game/texts.ts'
import { api, ApiError, type RankRow } from '../game/api.ts'
import { audio } from '../game/audio.ts'

export function Options() {
  const { go, settings, setSettings, resetAdventure, unlockAll } = useGame()
  const [confirm, setConfirm] = useState(false)
  const slider = (label: string, key: 'music' | 'sfx' | 'voice') => (
    <div className="row">
      <label>{label}</label>
      <input type="range" min={0} max={1} step={0.05} value={settings[key]}
        onChange={(e) => { setSettings({ [key]: +e.target.value }); if (key === 'sfx') audio.fx('click') }} />
    </div>
  )
  return (
    <Screen bg="bg/options">
      <div className="center-col">
        <Title size={34}>{t('menu:options')}</Title>
        <div className="frame card">
          {slider('Música', 'music')}
          {slider('Sonidos', 'sfx')}
          {slider('Voz de Sofía', 'voice')}
          <div className="row">
            <label>{t('menu:pieces')}</label>
            <div className="seg">
              {(['leyenda', 'clasicas'] as const).map((p) => (
                <button key={p} type="button" className={settings.pieces === p ? 'on' : ''} onClick={() => { audio.fx('click'); setSettings({ pieces: p }) }}>
                  <img src={p === 'leyenda' ? '/assets/pieces/leyenda/wn1.webp' : '/assets/pieces/clasicas/wn.webp'} alt="" />
                  {p === 'leyenda' ? 'De leyenda' : 'Clásicas'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Btn kind="volver" className="sm" onClick={() => setConfirm(true)}>{t('menu:reset')}</Btn>
            <Btn kind="volver" className="sm" onClick={() => { unlockAll(); audio.fx('crown') }}>{t('menu:enableAllLevels')}</Btn>
          </div>
        </div>
        <Btn onClick={() => go({ name: 'menu' })}>{t('menu:back')}</Btn>
      </div>
      {confirm && (
        <Talk speaker="princess" text={t('menu:newgame:confirm')}>
          <Btn kind="rojo" onClick={() => { resetAdventure(); setConfirm(false) }}>{t('button:si')}</Btn>
          <Btn kind="atras" onClick={() => setConfirm(false)}>{t('button:no')}</Btn>
        </Talk>
      )}
    </Screen>
  )
}

export function Credits() {
  const go = useGame((s) => s.go)
  return (
    <Screen bg="bg/credits" style={{ backgroundSize: '100% 100%' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div className="note" style={{ textShadow: '0 1px 3px #000' }}>Versión web hecha con cariño a partir del juego original de la XO (Plan Ceibal).</div>
        <Btn onClick={() => go({ name: 'menu' })}>{t('menu:back')}</Btn>
      </div>
    </Screen>
  )
}

export function Account() {
  const { go, session, login, logout, cloud } = useGame()
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (register: boolean) => {
    setErr(''); setBusy(true)
    try { await login(name.trim(), pass, register); audio.fx('crown') }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Ocurrió un error.'); audio.fx('wrong') }
    finally { setBusy(false) }
  }
  return (
    <Screen bg="bg/menu2">
      <div className="center-col">
        <Title size={32}>Jugador</Title>
        <div className="frame card">
          {session ? (<>
            <div style={{ fontSize: 22 }}>¡Hola, <b style={{ color: 'var(--gold-hi)' }}>{session.username}</b>!</div>
            <div className="note">{cloud === 'offline' ? 'No hay conexión con el servidor: tu aventura queda guardada en este dispositivo y se subirá cuando vuelva.' : 'Tu aventura se guarda en tu cuenta. Puedes continuarla desde cualquier dispositivo.'}</div>
            <Btn kind="volver" className="sm" onClick={logout}>Cambiar de jugador</Btn>
          </>) : (<>
            <div className="note">Crea tu jugador para guardar la aventura en la nube y aparecer en el ranking. También puedes jugar sin cuenta.</div>
            <div className="row"><label>Nombre</label><input type="text" maxLength={24} value={name} autoCapitalize="off" autoComplete="username" onChange={(e) => setName(e.target.value)} /></div>
            <div className="row"><label>Contraseña</label><input type="password" maxLength={64} value={pass} autoComplete="current-password" onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit(false)} /></div>
            <div className="err">{err}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn kind="play" className="sm" disabled={busy || name.trim().length < 3 || pass.length < 4} onClick={() => void submit(false)}>Entrar</Btn>
              <Btn kind="tutorial" className="sm" disabled={busy || name.trim().length < 3 || pass.length < 4} onClick={() => void submit(true)}>Crear jugador</Btn>
            </div>
          </>)}
        </div>
        <Btn onClick={() => go({ name: 'menu' })}>{t('menu:back')}</Btn>
      </div>
    </Screen>
  )
}

export function Ranking() {
  const { go, session } = useGame()
  const [rows, setRows] = useState<RankRow[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api.leaderboard(30).then(setRows).catch((e) => setErr(e instanceof ApiError ? e.message : 'Error')) }, [])
  return (
    <Screen bg="bg/menu2">
      <div className="center-col">
        <Title size={32}>Ranking de ELO</Title>
        <div className="frame card">
          {err ? <div className="err">{err}</div> : !rows ? <div className="note">Cargando...</div> : rows.length === 0 ? <div className="note">Todavía no hay jugadores. ¡Sé el primero!</div> : (
            <div className="scroll">
              <table className="rank">
                <thead><tr><th>#</th><th>Jugador</th><th>ELO</th><th>Castillos</th><th>Área</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rank} className={r.username === session?.username ? 'me' : ''}>
                      <td>{r.rank}</td><td>{r.username}</td><td>{r.elo}</td><td>{r.spots_won}</td><td>{t(`area:${r.max_area}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Btn onClick={() => go({ name: 'menu' })}>{t('menu:back')}</Btn>
      </div>
    </Screen>
  )
}

export function Video() {
  const go = useGame((s) => s.go)
  return (
    <div className="video">
      <video src="/assets/video/intro.mp4" autoPlay controls playsInline onEnded={() => go({ name: 'menu' })} />
      <Btn className="sm" onClick={() => go({ name: 'menu' })}>{t('menu:back')}</Btn>
    </div>
  )
}
