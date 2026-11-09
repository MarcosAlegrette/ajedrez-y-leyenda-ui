// Convierte el arte y el audio ORIGINAL de "Ajedrez y Leyendas" (carpeta ../data)
// en assets web optimizados dentro de public/assets. No se redibuja nada: sólo se
// recortan los rellenos de textura (potencias de 2), se separan los atlas en sprites
// y se recodifica a WebP / MP4 / MP3 (el OGG original se conserva tal cual).
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.resolve(root, '../data/AjedrezYLeyendas')
const A = path.join(SRC, 'assets')
const OUT = path.join(root, 'public/assets')
const META = path.join(root, 'src/data')
const force = process.argv.includes('--force')

const mk = (f) => fs.mkdirSync(path.dirname(f), { recursive: true })
const fresh = (src, dst) => !force && fs.existsSync(dst) && fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs
let made = 0

/** Recorta (opcional) y guarda como WebP. */
async function img(src, dst, crop, opts = {}) {
  src = path.join(A, src)
  dst = path.join(OUT, dst)
  if (fresh(src, dst)) return
  mk(dst)
  let s = sharp(src)
  if (crop) s = s.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] })
  if (opts.trim) s = s.trim()
  await s.webp({ quality: opts.q ?? 84, alphaQuality: 100, effort: 5, lossless: !!opts.lossless }).toFile(dst)
  made++
}

/** Lee un atlas (XML de SpriteData) → [{name, axis:[x,y], rect:[x,y,w,h]}] */
function atlas(xml) {
  const t = fs.readFileSync(path.join(A, xml), 'utf8')
  const out = []
  for (const m of t.matchAll(/keyName="(.*?)".*?axis="(-?\d+),(-?\d+)".*?sourceRect="(\d+),(\d+),(\d+),(\d+)"/g)) {
    out.push({ name: m[1], axis: [+m[2], +m[3]], rect: [+m[4], +m[5], +m[6], +m[7]] })
  }
  return out
}

/** Separa un atlas en sprites individuales. Devuelve metadatos {name:{w,h,ax,ay}}. */
async function sprites(xml, png, dstDir, rename = (n) => n) {
  const meta = {}
  for (const s of atlas(xml)) {
    const name = rename(s.name)
    if (!name || meta[name]) continue
    meta[name] = { w: s.rect[2], h: s.rect[3], ax: s.axis[0], ay: s.axis[1] }
    await img(png, `${dstDir}/${name}.webp`, s.rect, { q: 90 })
  }
  return meta
}

const PT = { peon: 'p', caballo: 'n', alfil: 'b', torre: 'r', reina: 'q', rey: 'k' }

async function images() {
  // Fondos de pantalla (800x600 dentro de texturas 1024x1024)
  const full = [0, 0, 800, 600]
  for (const [s, d] of [
    ['lang/es/images/back01.jpg', 'bg/menu1'],
    ['lang/es/images/back02.jpg', 'bg/menu2'],
    ['lang/es/images/credits.jpg', 'bg/credits'],
    ['lang/es/images/options.jpg', 'bg/options'],
    ['lang/es/images/screen-pausa.jpg', 'bg/pause'],
    ['lang/es/images/transition.jpg', 'bg/transition'],
    ['lang/es/images/loader/loadingBackground.jpg', 'bg/loading'],
    ['images/tienda de poderes/fondo_tienda_de_poderes.jpg', 'bg/shop'],
    ['images/fondo_profesor.jpg', 'bg/profesor'],
  ]) await img(s, `${d}.webp`, full)
  await img('lang/es/images/loader/loadingBar.png', 'bg/loadingBar.webp')
  await img('lang/es/images/adventureMap/logo.png', 'ui/logo.webp', null, { q: 92 })

  // Mapa del mundo y mapas de cada área
  for (let i = 1; i <= 10; i++) {
    await img(`lang/es/images/adventureMap/areaAvailable${i}.jpg`, `map/world${i}.webp`, full)
    await img(`images/adventureMap/area${i}.jpg`, `map/area${i}.webp`)
  }
  const meta = {}
  meta.areaOver = await sprites('lang/es/images/adventureMap/areaOver/areaOver.xml', 'lang/es/images/adventureMap/areaOver/areaOver.png', 'map/over')
  meta.map = await sprites('images/adventureMap/mapAssets/mapAssets.xml', 'images/adventureMap/mapAssets/mapAssets.png', 'map/spots')

  // Posición de cada área en el mapa del mundo: diferencia entre mapas consecutivos
  meta.areaBox = await areaBoxes()

  // Historia: dos celdas de 1024x512 que forman un panorama de 2048x512
  const stories = [['images/story/backgroundOpening.jpg', 'opening'], ['images/story/backgroundEnding.jpg', 'ending']]
  for (let i = 1; i <= 10; i++) stories.push([`lang/es/images/story/backgroundArea${i}.jpg`, `area${i}`])
  for (const [s, d] of stories) {
    const src = path.join(A, s), dst = path.join(OUT, `story/${d}.webp`)
    if (fresh(src, dst)) continue
    mk(dst)
    const top = await sharp(src).extract({ left: 0, top: 0, width: 1024, height: 512 }).toBuffer()
    const bot = await sharp(src).extract({ left: 0, top: 512, width: 1024, height: 512 }).toBuffer()
    await sharp({ create: { width: 2048, height: 512, channels: 3, background: '#000' } })
      .composite([{ input: top, left: 0, top: 0 }, { input: bot, left: 1024, top: 0 }])
      .webp({ quality: 80, effort: 5 }).toFile(dst)
    made++
  }

  // Tableros (marco + 8x8 dentro de 520x600). "b" = blancas abajo, "a" = negras abajo
  for (const f of fs.readdirSync(path.join(A, 'images/boards'))) {
    if (f.endsWith('.jpg')) await img(`images/boards/${f}`, `boards/${f.replace('.jpg', '.webp')}`, [0, 0, 520, 600], { q: 86 })
  }

  // Piezas "de leyenda" (todas las poses) y piezas clásicas
  meta.pieces = await sprites('images/pieces/piezas-bbnm.xml', 'images/pieces/piezas-bbnm.png', 'pieces/leyenda', (n) => {
    const m = n.match(/^(\w+)-(buenas-blancas|malas-negras)-(\d+)$/)
    return m ? `${m[2].startsWith('buenas') ? 'w' : 'b'}${PT[m[1]]}${m[3]}` : null
  })
  for (const c of 'wb') for (const t of 'pnbrqk') await img(`images/pieces/${t}${c}.png`, `pieces/clasicas/${c}${t}.webp`, null, { lossless: true })
  for (const [file, c] of [['blancasCongeladas', 'w'], ['negrasCongeladas', 'b']])
    for (const [i, t] of [...'kqbnrp'].entries()) await img(`images/pieces/${file}.png`, `pieces/hielo/${c}${t}.webp`, [i * 55, 0, 55, 120], { q: 90 })

  // HUD, caras, personajes de los diálogos, hechizos, efectos
  meta.hud = await sprites('images/hud/hud.xml', 'images/hud/hud.png', 'hud')
  meta.caras = await sprites('images/hud/caras.xml', 'images/hud/caras.png', 'caras')
  meta.dialog = await sprites('images/dialogCharacters/dialogCharacters.xml', 'images/dialogCharacters/dialogCharacters.png', 'dialog')
  meta.hudData = await sprites('lang/es/images/hudData/hudData.xml', 'lang/es/images/hudData/hudData.png', 'hud')
  meta.explosion = await sprites('images/explosion/explosion.xml', 'images/explosion/explosion.png', 'fx/explosion')
  meta.portal = await sprites('images/portal/portal.xml', 'images/portal/portal.png', 'fx/portal')
  meta.porton = await sprites('images/porton/porton.xml', 'images/porton/porton.png', 'fx/porton')
  meta.fruits = await sprites('images/minigames/fruits.xml', 'images/minigames/fruits.png', 'fx/fruits')
  meta.coronacion = await sprites('images/coronacion/Coronacion.xml', 'images/coronacion/Coronacion.png', 'ui/coronacion')
  meta.options = await sprites('images/options/options.xml', 'images/options/options.png', 'ui/options')
  meta.menu = await sprites('images/menu.xml', 'images/menu.png', 'ui/menu')
  meta.aparecer = await sprites('images/aparecer/aparecer.xml', 'images/aparecer/aparecer.png', 'fx/aparecer')
  meta.hechizo = await sprites('images/hechizo/hechizo.xml', 'images/hechizo/hechizo.png', 'fx/hechizo')
  for (const f of ['dialog', 'dialog_good', 'dialog_bad']) await img(`images/${f}.png`, `ui/${f}.webp`, null, { q: 92, trim: true })
  await img('images/minigames/redFlag.png', 'fx/redFlag.webp', [0, 0, 70, 110], { q: 90 })
  await img('images/minigames/whiteFlag.png', 'fx/whiteFlag.webp', [0, 0, 70, 110], { q: 90 })
  for (const f of ['slime', 'icons', 'selectedCell', 'colorArrows', 'arrow', 'buttonbase',
    'info-base1', 'info-base2', 'info-base2-1', 'base_hud_grande_lateral', 'hud/buttons'])
    await img(`images/${f}.png`, `ui/${path.basename(f)}.webp`, null, { q: 90 })
  for (const f of ['llave', 'llave2', 'rock', '1_bronce_coin_tile', '2_silver_coin_tile', '3_silver_coin_tile',
    '4_gold_coin_tile', '5_gold_coin_tile', '10_gold_coin_tile'])
    await img(`images/minigames/${f}.png`, `fx/${f}.webp`, null, { q: 90 })
  for (const f of ['textButtons', 'dialogButtons', 'playButton']) await img(`lang/images/buttons/${f}.png`, `ui/${f}.webp`, null, { q: 90 })
  for (const f of ['pgnButtons', 'numberButton', 'piecesButtons']) await img(`images/buttons/${f}.png`, `ui/${f}.webp`, null, { q: 90 })
  for (const f of ['menu-normal', 'menu-over', 'menu-down', 'menu-bloqueado']) await img(`lang/es/images/finalBattleMenu/${f}.png`, `ui/fb-${f}.webp`, null, { q: 90 })
  await img('lang/fonts/titles.png', 'ui/font-titles.webp')

  // Tienda de hechizos: 14 íconos en una grilla de 112px
  const SPELLS = ['addWall', 'jumpingPiece', 'frozenPiece', 'untouchablePiece', 'timeBonus', 'destroyPawn', 'addPawn', 'addBishop',
    'addKnight', 'addQueen', 'addRook', 'move2Times', 'undoMove', 'prohibitedCell']
  for (const [i, n] of SPELLS.entries()) {
    const r = [(i % 5) * 112, Math.floor(i / 5) * 112, 64, 64]
    await img('images/tienda de poderes/poderes.png', `spells/${n}.webp`, r, { q: 92 })
    await img('images/tienda de poderes/poderes_deshabilitados.png', `spells/${n}-off.webp`, r, { q: 92 })
  }
  await img('images/tienda de poderes/item.png', 'spells/item.webp')
  await img('images/tienda de poderes/item_locked.png', 'spells/item_locked.webp')

  mk(path.join(META, 'x'))
  fs.writeFileSync(path.join(META, 'sprites.json'), JSON.stringify(meta))
}

/** Caja de cada área en el mapa del mundo (lo que cambia entre world(n-1) y world(n)). */
async function areaBoxes() {
  const cache = path.join(META, 'areaBox.json')
  if (!force && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'))
  const load = (i) => sharp(path.join(A, `lang/es/images/adventureMap/areaAvailable${i}.jpg`))
    .extract({ left: 0, top: 0, width: 800, height: 600 }).raw().toBuffer()
  const sat = (b, o) => Math.max(b[o], b[o + 1], b[o + 2]) - Math.min(b[o], b[o + 1], b[o + 2])
  const boxes = {}
  // Un área "disponible" está en color (saturada); bloqueada está en gris.
  const last = await load(10)
  for (let n = 1; n <= 10; n++) {
    const cur = await load(n), prev = n > 1 ? await load(n - 1) : null
    let x0 = 800, y0 = 600, x1 = 0, y1 = 0, cnt = 0
    for (let y = 60; y < 520; y++) for (let x = 20; x < 780; x++) {
      const o = (y * 800 + x) * 3
      const changed = prev ? sat(cur, o) - sat(prev, o) > 22 : false
      if (changed) { cnt++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    }
    boxes[n] = cnt > 200 ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null
  }
  void last
  fs.writeFileSync(cache, JSON.stringify(boxes))
  return boxes
}

/** Corre ffmpeg en paralelo. */
function ffmpegAll(jobs) {
  return new Promise((resolve) => {
    let i = 0, running = 0, failed = 0
    const next = () => {
      if (i >= jobs.length && running === 0) return resolve(failed)
      while (running < Math.max(2, os.cpus().length - 1) && i < jobs.length) {
        const args = jobs[i++]
        running++
        const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'ignore' })
        p.on('close', (c) => { if (c) failed++; running--; made++; next() })
      }
    }
    next()
  })
}

async function audio() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }) } catch {
    console.warn('! ffmpeg no encontrado: se copia sólo el OGG original (sin MP3 de respaldo ni video)')
  }
  const jobs = []
  for (const [dir, bitrate] of [['music', '128k'], ['fx', '96k'], ['tutorials', '64k']]) {
    const srcDir = path.join(SRC, 'audio', dir), dstDir = path.join(OUT, 'audio', dir)
    fs.mkdirSync(dstDir, { recursive: true })
    for (const f of fs.readdirSync(srcDir)) {
      if (!f.endsWith('.ogg')) continue
      const src = path.join(srcDir, f), ogg = path.join(dstDir, f), mp3 = ogg.replace(/\.ogg$/, '.mp3')
      if (!fresh(src, ogg)) { fs.copyFileSync(src, ogg); made++ }
      if (!fresh(src, mp3)) jobs.push(['-i', src, '-codec:a', 'libmp3lame', '-b:a', bitrate, mp3])
    }
  }
  // Video de introducción: ya es H.264 + AAC, sólo se reempaqueta a MP4 (sin recodificar)
  const mov = path.join(A, 'video/video.es.mov'), mp4 = path.join(OUT, 'video/intro.mp4')
  mk(mp4)
  if (!fresh(mov, mp4)) jobs.push(['-i', mov, '-c', 'copy', '-movflags', '+faststart', mp4])
  const failed = await ffmpegAll(jobs)
  if (failed) console.warn(`! ${failed} conversiones de ffmpeg fallaron`)
}

const t0 = Date.now()
await images()
await audio()
const size = execFileSync('du', ['-sh', OUT]).toString().split('\t')[0]
console.log(`assets listos: ${made} archivos generados en ${((Date.now() - t0) / 1000).toFixed(1)}s — public/assets pesa ${size}`)
