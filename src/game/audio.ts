// Música, efectos y voces originales. Se usa el OGG original cuando el navegador
// lo soporta (Chrome, Firefox, Safari nuevo) y el MP3 de respaldo en el resto.
const probe = typeof Audio !== 'undefined' ? new Audio() : null
const EXT = probe && probe.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'
const url = (dir: string, name: string) => `/assets/audio/${dir}/${name}.${EXT}`

export type Track = 'menu' | 'map' | 'game' | 'story' | 'win' | 'lose' | 'end'
export type Fx =
  | 'add' | 'arrow' | 'boss_popup' | 'break' | 'buy' | 'check' | 'click' | 'coin_diamond' | 'coin' | 'create_piece' | 'creeper_plant'
  | 'crown' | 'eat' | 'fairy_princess_popup' | 'freeze' | 'invulnerable' | 'jump' | 'king_sword' | 'monigote' | 'piece_1' | 'piece_2'
  | 'piece_move_1' | 'piece_move_2' | 'portal' | 'queen_attack' | 'sword_hit' | 'time' | 'two_moves' | 'undo' | 'wall' | 'wrong'

const vol = { music: 0.55, sfx: 0.8, voice: 1 }
let unlocked = false
let music: HTMLAudioElement | null = null
let wanted: Track | null = null
let current: Track | null = null
let voice: HTMLAudioElement | null = null
let ctx: AudioContext | null = null
const buffers = new Map<string, Promise<AudioBuffer | null>>()
const ONE_SHOT: Track[] = ['win', 'lose']

function startMusic() {
  if (!unlocked || !wanted || wanted === current) return
  const old = music
  if (old) fade(old, 0, 350, () => old.pause())
  current = wanted
  const a = new Audio(url('music', `ajedrez_${wanted}`))
  a.loop = !ONE_SHOT.includes(wanted)
  a.volume = 0
  music = a
  a.play().then(() => fade(a, vol.music, 500)).catch(() => { current = null })
}

function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = a.volume, t0 = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms)
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k))
    if (k < 1) requestAnimationFrame(step)
    else done?.()
  }
  step()
}

function load(name: string) {
  let p = buffers.get(name)
  if (!p) {
    p = fetch(url('fx', name)).then((r) => r.arrayBuffer()).then((b) => ctx!.decodeAudioData(b)).catch(() => null)
    buffers.set(name, p)
  }
  return p
}

export const audio = {
  /** Los navegadores sólo dejan sonar audio después del primer toque. */
  unlock() {
    if (unlocked) return
    unlocked = true
    try {
      ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      for (const f of ['click', 'piece_move_1', 'piece_move_2', 'eat', 'wrong', 'check']) void load(f)
    } catch { ctx = null }
    startMusic()
  },
  music(track: Track | null) {
    wanted = track
    if (!track) { if (music) { const m = music; fade(m, 0, 300, () => m.pause()) } current = null; music = null; return }
    startMusic()
  },
  fx(name: Fx, gain = 1) {
    if (!unlocked || !ctx || vol.sfx <= 0) return
    if (ctx.state === 'suspended') void ctx.resume()
    void load(name).then((buf) => {
      if (!buf || !ctx) return
      const src = ctx.createBufferSource(), g = ctx.createGain()
      src.buffer = buf
      g.gain.value = vol.sfx * gain
      src.connect(g).connect(ctx.destination)
      src.start()
    })
  },
  /** Narración de las lecciones (audio/tutorials/CLAVE.ogg). Devuelve una función para saber cuándo termina. */
  voice(key: string | null, onEnd?: () => void) {
    if (voice) { voice.pause(); voice = null }
    if (music) fade(music, vol.music, 300)
    if (!key || !unlocked || vol.voice <= 0) return
    const a = new Audio(url('tutorials', key))
    a.volume = vol.voice
    voice = a
    if (music) fade(music, vol.music * 0.35, 300)
    a.onended = () => { if (voice === a) { voice = null; if (music) fade(music, vol.music, 500) } onEnd?.() }
    a.play().catch(() => { if (voice === a) voice = null })
  },
  setVolumes(v: { music: number; sfx: number; voice: number }) {
    Object.assign(vol, v)
    if (music) music.volume = voice ? vol.music * 0.35 : vol.music
    if (voice) voice.volume = vol.voice
  },
  get unlocked() { return unlocked },
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!music) return
    if (document.hidden) music.pause()
    else if (unlocked) void music.play().catch(() => {})
  })
}
