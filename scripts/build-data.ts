// Convierte los datos ORIGINALES del juego (PGN, XML de textos, CSV de ELO) a JSON.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFen, fromSan, play, toFen } from '../src/engine/chess.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = path.resolve(root, '../data/AjedrezYLeyendas/assets')
const OUT = path.join(root, 'src/data')
fs.mkdirSync(OUT, { recursive: true })

type Tok = ['m', string] | ['c', string]
interface Game { fen: string; w?: string; b?: string; ev?: string; r?: string; t: Tok[] }

function parsePgn(text: string): Game[] {
  const games: Game[] = []
  // Cada partida empieza con un bloque de cabeceras
  const chunks = text.replace(/\r/g, '').split(/\n(?=\[(?:Event|Site) ")/)
  for (const chunk of chunks) {
    const h: Record<string, string> = {}
    let body = chunk.replace(/^\s*\[(\w+)\s+"(.*?)"\]\s*$/gm, (_, k, v) => { h[k] = v; return '' })
    if (!h.FEN && !/\d\./.test(body)) { if (!h.FEN) continue }
    const t: Tok[] = []
    body = body.replace(/\{([^}]*)\}/g, (_, c) => ` \u0001${Buffer.from(c).toString('base64')}\u0001 `)
    body = body.replace(/\([^)]*\)/g, ' ').replace(/\[\w+\s+"[^"]*"\]/g, ' ')
    for (const w of body.split(/\s+/)) {
      if (!w) continue
      if (w[0] === '\u0001') {
        const c = Buffer.from(w.slice(1, -1), 'base64').toString().replace(/\[%emt[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
        if (c && !/^\d+MB,/.test(c)) t.push(['c', c])
        continue
      }
      if (/^(\*|1-0|0-1|1\/2-1\/2)$/.test(w) || /^\$\d+$/.test(w)) continue
      const san = w.replace(/^\d+\.(\.\.)?/, '').replace(/^\.+/, '')
      if (san) t.push(['m', san])
    }
    const g: Game = { fen: h.FEN ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', t }
    if (h.White && !/^(\?|New game|Nueva partida)$/.test(h.White)) g.w = h.White
    if (h.Black && h.Black !== '?') g.b = h.Black
    if (h.Event && !/^(\?|None)$/.test(h.Event)) g.ev = h.Event
    const res = body.match(/(?:^|\s)(1-0|0-1)\s*$/)
    if (res) g.r = res[1]
    games.push(g)
  }
  return games
}

const read = (f: string) => {
  const buf = fs.readFileSync(f)
  const utf = buf.toString('utf8')
  return utf.includes('�') ? buf.toString('latin1') : utf
}

// ---------- Minijuegos ----------
const levels: Record<string, Game[]> = {}
const mgDir = path.join(A, 'data/minigames')
let bad = 0, total = 0
for (const dir of fs.readdirSync(mgDir).sort()) {
  const d = path.join(mgDir, dir)
  if (!fs.statSync(d).isDirectory()) continue
  for (const f of fs.readdirSync(d).sort()) {
    if (!f.endsWith('.pgn') || /_old|_bad/.test(f)) continue
    const games = parsePgn(read(path.join(d, f))).filter((g) => {
      total++
      // Verifica que la línea de solución sea jugable con nuestro motor
      let p = parseFen(g.fen)
      for (const tok of g.t) {
        if (tok[0] !== 'm') continue
        if (tok[1] === '--') { p = { ...p, turn: p.turn === 'w' ? 'b' : 'w', ep: -1 }; continue }
        const m = fromSan(p, tok[1])
        if (!m) { bad++; if (process.argv.includes('-v')) console.log('  línea inválida', dir, f, g.fen, tok[1]); return false }
        p = play(p, m)
      }
      g.fen = toFen(parseFen(g.fen))
      return true
    })
    if (games.length) levels[`${dir}/${f.slice(0, -4)}`] = games
  }
}
fs.writeFileSync(path.join(OUT, 'levels.json'), JSON.stringify(levels))

// ---------- Lecciones ----------
const tutorials: Record<string, Game[]> = {}
const tDir = path.join(A, 'data/tutorials')
for (const dir of fs.readdirSync(tDir).sort()) {
  const d = path.join(tDir, dir)
  if (!fs.statSync(d).isDirectory()) continue
  for (const f of fs.readdirSync(d).sort()) {
    if (f.endsWith('.pgn')) tutorials[`${dir}/${f.slice(0, -4)}`] = parsePgn(read(path.join(d, f)))
  }
}
fs.writeFileSync(path.join(OUT, 'tutorials.json'), JSON.stringify(tutorials))

// ---------- Textos ----------
const unesc = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\r\n?/g, '\n').replace(/\\n/g, '\n').replace(/[ \t]{2,}/g, ' ')
function nodes(file: string) {
  const xml = read(file).replace(/<!--[\s\S]*?-->/g, '')
  const out: Record<string, string> = {}
  for (const m of xml.matchAll(/<node\s+key="(.*?)"\s+text="([\s\S]*?)"\s*\/>/g)) out[m[1]] = unesc(m[2])
  return out
}
const texts = nodes(path.join(A, 'lang/es/data/texts.xml'))
for (const k of Object.keys(texts)) if (/^(INS_|INC_|REGIST|[AEIOUaeiou]cute|MDEO|CAN$|MAL$|RIO$|CER$|TYT$|ROC$|DUR$|FLS$|FDA$|ART$|STO$|PDU$|SOR$|COL$|TAC$|LAV$|RIV$|SAN$|sample$|_)/.test(k)) delete texts[k]
fs.writeFileSync(path.join(OUT, 'texts.json'), JSON.stringify(texts))
const tt = nodes(path.join(A, 'lang/es/data/tutorialTexts.xml'))
fs.writeFileSync(path.join(OUT, 'tutorialTexts.json'), JSON.stringify(tt))

// ---------- Tablas de ELO ----------
const csv = (f: string) => read(path.join(A, 'data/elo', f)).trim().split(/\r?\n/).map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '')))
const elo = {
  K: csv('coefK.csv').slice(1).map((r) => +r[1]),
  expected: csv('puntEsp.csv').slice(1).map((r) => +r[1]),
  bonus: csv('coefEloBonus.csv').map((r) => +r[1]),
  spots: Object.fromEntries(csv('eloJuegos.csv').slice(1).map((r) => [r[0].replace(/area_(\d+)_spot_0?(\d+)/, '$1:$2'), +r[3]])),
  C: Object.fromEntries(csv('coefC.csv').slice(1).map((r) => [r[0], +r[2]])),
}
fs.writeFileSync(path.join(OUT, 'elo.json'), JSON.stringify(elo))

// ---------- Libro de aperturas (para la partida rápida) ----------
const book = read(path.join(A, 'data/book.txt')).trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
fs.writeFileSync(path.join(OUT, 'book.json'), JSON.stringify(book))

const kb = (f: string) => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + 'KB'
console.log(`datos listos: ${Object.keys(levels).length} niveles (${total - bad}/${total} posiciones válidas), ${Object.keys(tutorials).length} lecciones, ` +
  `${Object.keys(texts).length} textos, ${Object.keys(tt).length} textos de lección, ${book.length} líneas de apertura`)
console.log(`levels ${kb('levels.json')} · tutorials ${kb('tutorials.json')} · texts ${kb('texts.json')} · tutorialTexts ${kb('tutorialTexts.json')}`)
