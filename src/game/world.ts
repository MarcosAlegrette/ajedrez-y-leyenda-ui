// La Tierra de Eglerion: 10 áreas y sus castillos. Los nombres salen de texts.xml
// (area:N:spot:M) y cada castillo usa los PGN originales de assets/data/minigames.
import { t } from './texts.ts'

export type MiniType =
  | 'lesson' | 'maze' | 'danger' | 'target' | 'collect' | 'portal' | 'pawnWar' | 'piecesPawns' | 'destroy' | 'battle'
  | 'coins' | 'ghosts' | 'tropillas' | 'check' | 'saveKing' | 'mate' | 'tactics' | 'captures' | 'piecesKing' | 'helpMate'
  | 'series' | 'comeCome' | 'fruits' | 'hunters' | 'hidden' | 'reinforce' | 'attack' | 'challenge'

export interface Spot {
  area: number
  /** Número de spot original (clave de textos y de la tabla de ELO) */
  n: number
  /** Orden dentro del área (0…) */
  index: number
  name: string
  type: MiniType
  /** Un archivo PGN (o nivel sintético) por nivel del castillo */
  levels: string[]
  /** Lecciones de la Princesa asociadas */
  lessons: string[]
  sprite: 'tower' | 'castle' | 'final_castle' | 'king_castle'
  x: number
  y: number
  final: boolean
}

export interface Area {
  n: number
  name: string
  board: string
  spots: Spot[]
  /** Capitán de la Oscuridad que habla en los desafíos */
  boss: string
  face: string
}

/** `r('LT', 1, 3)` → ['LT/LT1', 'LT/LT2', 'LT/LT3'] */
const r = (code: string, from: number, to: number, dir = code) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${dir}/${code}${from + i}`)
const lv = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `#${from + i}`)

type Def = [n: number, type: MiniType, levels: string[], lessons?: string[]]

const L = {
  final: ['evento/batallafinal'],
  maze: ['evento/laberintos'],
  mate: ['evento/jaquemate'],
  pk: ['evento/piezascontraelrey', '2-06/Rey solo Tutorial 1'],
  come: ['evento/comecome'],
  series: ['evento/serieblanca'],
  help: ['evento/mateayudado'],
  ghosts: ['evento/castillodefantasmas'],
}

const DEFS: Def[][] = [
  // 1 · Bosque de Nomegar
  [
    [1, 'lesson', ['1-01/introduccion al ajedrez']],
    [2, 'maze', r('LT', 1, 3), ['1-02/Torre', ...L.maze]],
    [3, 'maze', r('LA', 1, 3), ['1-03/Alfil']],
    [4, 'target', r('TB', 1, 3), ['TB/TB1']],
    [5, 'portal', r('SR', 1, 3), ['evento/saliralportal', 'SR/SR1']],
    [6, 'collect', r('RE', 1, 3), ['RE/RE']],
    [7, 'maze', r('LP', 1, 3), ['1-05/Peon']],
    [8, 'pawnWar', r('CP', 1, 3), ['1-06/carrera de peones']],
    [9, 'piecesPawns', r('PP', 1, 5), ['1-11/Piezas contra peones']],
    [10, 'destroy', ['DE/DE1'], ['DE/DE1']],
  ],
  // 2 · Bosque de Peonys
  [
    [0, 'lesson', ['2-00/sistema algebraico']],
    [1, 'maze', r('LD', 1, 3), ['2-01/Dama']],
    [2, 'coins', lv(3), ['2-02/tutorialCaballo']],
    [3, 'ghosts', lv(3), L.ghosts],
    [4, 'target', r('TB', 4, 6), ['TB/TB2']],
    [5, 'piecesPawns', r('PP', 6, 10), ['1-11/Piezas contra peones']],
    [6, 'tropillas', r('TP', 1, 3), ['evento/tropillas', 'TP/TP']],
    [7, 'portal', r('SR', 4, 6), ['SR/SR2']],
    [8, 'collect', r('RE', 4, 6), ['RE/RE']],
    [9, 'destroy', ['DE/DE2'], ['DE/DE2']],
  ],
  // 3 · Dominios del Caballero Negro
  [
    [0, 'lesson', ['3-00/enroque']],
    [1, 'ghosts', lv(3, 4), L.ghosts],
    [2, 'target', r('TB', 7, 9), ['TB/TB2']],
    [3, 'maze', r('LR', 1, 3), ['1-04/Rey']],
    [4, 'captures', r('CA', 1, 3), ['3-04/valor de las piezas']],
    [5, 'portal', r('SR', 7, 9), ['SR/SR2']],
    [6, 'check', r('JQ', 1, 3), ['1-07/jaque']],
    [7, 'saveKing', r('SA', 1, 3), ['1-07/jaque']],
    [8, 'mate', r('JM', 1, 5), ['1-09/jaque mate y pasillo', ...L.mate]],
    [9, 'piecesKing', r('PR', 1, 3), L.pk],
    [10, 'battle', ['BF/BF1'], L.final],
  ],
  // 4 · Llanos del Sur
  [
    [0, 'lesson', ['4-00/ahogado']],
    [1, 'captures', r('CA', 4, 6), ['4-01/Piezas indefensas']],
    [2, 'fruits', r('FR', 1, 3), ['AM/AM']],
    [3, 'danger', r('CM', 1, 3), ['evento/laberintospeligrosos', 'CM/CM']],
    [4, 'maze', r('CR', 1, 3), ['CR/CR']],
    [5, 'tactics', r('TT', 1, 3), ['3-08/Doblete']],
    [6, 'piecesPawns', r('PP', 11, 13), ['1-11/Piezas contra peones']],
    [7, 'comeCome', r('CC', 1, 3), L.come],
    [8, 'mate', r('JM', 6, 9), ['2-09/charreteras']],
    [9, 'piecesKing', r('PR', 4, 6), L.pk],
    [10, 'mate', r('AY', 1, 3), ['4-02/mate arabe']],
    [11, 'challenge', r('VM', 1, 3), ['4-04/ventaja material']],
    [12, 'battle', ['BF/BF2'], L.final],
  ],
  // 5 · Tierras de Alphilus
  [
    [0, 'lesson', ['5-00/Capturar al paso']],
    [1, 'captures', r('CA', 7, 9), ['4-01/Piezas indefensas']],
    [2, 'comeCome', r('CC', 4, 6), L.come],
    [3, 'fruits', r('FR', 4, 6), ['AM/AM']],
    [4, 'tactics', r('TT', 4, 8), ['4-03/Clavada']],
    [5, 'saveKing', r('SA', 4, 6), ['6-08/Como protegerse']],
    [6, 'hunters', r('CZ', 1, 3), ['Alfiles/MateTorreAlfil']],
    [7, 'mate', r('JM', 10, 14), ['Alfiles/BesoTraicionero']],
    [8, 'mate', r('AY', 4, 6), ['Alfiles/Mate2Alfiles']],
    [9, 'series', r('SB', 1, 3), L.series],
    [10, 'piecesKing', r('PR', 7, 9), L.pk],
    [11, 'battle', ['BF/BF3'], L.final],
  ],
  // 6 · Torre del Destino
  [
    [0, 'lesson', ['6-00/Tablas']],
    [1, 'comeCome', r('CC', 7, 9), L.come],
    [2, 'fruits', r('FR', 7, 9), ['AM/AM']],
    [3, 'tactics', r('TT', 9, 13), ['4-06/Rayos X']],
    [4, 'mate', r('JM', 15, 19), ['JM/phillidor_mate_dos_caballos']],
    [5, 'mate', ['AY/AY7', 'AY/AY9'], ['3-09/La diagonal fatal']],
    [6, 'helpMate', [...r('MA', 1, 3, '4-08')], L.help],
    [7, 'piecesKing', r('PR', 10, 12), L.pk],
    [8, 'reinforce', r('BR', 1, 2), L.final],
    [9, 'hunters', r('CZ', 4, 6), ['4-09/Creando barreras']],
    [10, 'series', r('SB', 4, 6), L.series],
    [11, 'battle', ['BF/BF4'], L.final],
  ],
  // 7 · Desierto de Bogor
  [
    [0, 'lesson', ['6-01/Tactica']],
    [1, 'mate', r('JM', 20, 24), ['4-10/El punto debil f7']],
    [2, 'hunters', r('CZ', 7, 9), ['4-09/Creando barreras']],
    [3, 'helpMate', r('MA', 4, 6, '5-04'), L.help],
    [4, 'hidden', r('PE', 1, 3), L.mate],
    [5, 'series', r('SB', 7, 9), L.series],
    [6, 'piecesKing', r('PR', 13, 15), L.pk],
    [7, 'mate', r('AY', 10, 12), ['3-07/ataque al rey protegido por peones']],
    [8, 'attack', r('AM', 1, 3), ['3-07/ataque al rey protegido por peones']],
    [9, 'tactics', r('TT', 14, 18), ['5-03/Descubiertos']],
    [10, 'tactics', r('TT', 19, 23), ['evento/desviacion']],
    [11, 'battle', ['BF/BF5'], L.final],
  ],
  // 8 · Reino de la Oscuridad
  [
    [0, 'lesson', ['6-08/Como protegerse']],
    [1, 'comeCome', r('CC', 10, 12), L.come],
    [2, 'danger', r('CM', 4, 6), ['evento/laberintospeligrosos']],
    [3, 'tactics', r('TT', 24, 28), ['evento/atraccion']],
    [4, 'maze', r('CR', 4, 6), ['CR/CR']],
    [5, 'mate', r('JM', 25, 29), ['evento/tacticasdeatraccion']],
    [6, 'helpMate', r('MA', 7, 9, '6-05'), L.help],
    [7, 'challenge', r('VM', 4, 6), ['4-04/ventaja material']],
    [8, 'tactics', r('TT', 29, 33), ['evento/destrucciondeldefensor']],
    [9, 'reinforce', r('BR', 3, 4), L.final],
    [10, 'piecesKing', r('PR', 16, 18), L.pk],
    [11, 'battle', ['BF/BF6'], L.final],
  ],
  // 9 · Tierras Ásperas
  [
    [0, 'lesson', ['5-08/Aprovecha el poder de tus piezas']],
    [1, 'maze', r('LF', 1, 3), L.maze],
    [2, 'maze', r('LM', 1, 3), ['evento/laberintosmultiples']],
    [3, 'ghosts', lv(3, 7), L.ghosts],
    [4, 'saveKing', r('SA', 7, 9), ['6-08/Como protegerse']],
    [5, 'fruits', r('FR', 10, 12), ['AM/AM']],
    [6, 'mate', r('JM', 30, 33), L.mate],
    [7, 'helpMate', r('MA', 4, 6, '5-04'), L.help],
    [8, 'comeCome', r('CC', 13, 17), L.come],
    [9, 'series', r('SB', 10, 14), L.series],
    [10, 'tactics', r('TT', 34, 37), ['5-02/Pieza encerrada']],
    [11, 'piecesKing', r('PR', 19, 23), L.pk],
    [12, 'tactics', r('TT', 38, 39), ['6-01/Tactica']],
    [13, 'battle', ['BF/BF9'], L.final],
  ],
  // 10 · Fortaleza del Rey Brujo
  [
    [0, 'lesson', ['5-09/promocion menor']],
    [1, 'danger', r('CM', 10, 12), ['evento/laberintospeligrosos']],
    [2, 'tropillas', ['TP/TP3', 'TP/TP4'], ['TP/TP']],
    [3, 'portal', r('SR', 10, 14), ['SR/SR2']],
    [4, 'tactics', r('TT', 40, 42), ['6-01/Tactica']],
    [5, 'comeCome', r('CC', 18, 22), L.come],
    [6, 'piecesKing', r('PR', 24, 28), L.pk],
    [7, 'mate', r('JM', 34, 37), L.mate],
    [8, 'series', r('SB', 15, 20), L.series],
    [9, 'hidden', r('PE', 4, 6), L.mate],
    [10, 'helpMate', r('MA', 7, 9, '6-05'), L.help],
    [11, 'mate', r('AY', 13, 17), L.mate],
    [12, 'tactics', r('TT', 30, 34), ['6-01/Tactica']],
    [13, 'battle', ['BF/BF10'], L.final],
  ],
]

const BOSS_FACE = ['caraPeon', 'caraPeon', 'caraCaballo', 'caraAlfil', 'caraAlfil', 'caraTorre', 'caraDama', 'caraDama', 'caraBrujo', 'caraBrujo']

/** Camino serpenteante sobre el pergamino (coordenadas del mapa de 800x600). */
function layout(count: number, area: number): [number, number][] {
  const cols = count > 12 ? 5 : 4
  const rows = Math.ceil(count / cols)
  const x0 = 150, x1 = 640, y0 = 168, y1 = 452
  const out: [number, number][] = []
  for (let i = 0; i < count; i++) {
    const rw = Math.floor(i / cols), k = i % cols
    const inRow = rw === rows - 1 ? count - rw * cols : cols
    const fx = inRow === 1 ? 0.5 : k / (inRow - 1)
    const dir = rw % 2 === 0 ? fx : 1 - fx
    // Pequeño desorden determinista para que no parezca una grilla
    const j = Math.sin((i + 1) * 12.9898 + area * 78.233) * 43758.5453
    const jx = ((j - Math.floor(j)) - 0.5) * 34
    const jy = Math.sin(i * 1.7 + area) * 16
    out.push([Math.round(x0 + (x1 - x0) * dir + jx), Math.round(y0 + (rows === 1 ? 0.5 : rw / (rows - 1)) * (y1 - y0) + jy)])
  }
  return out
}

export const AREAS: Area[] = DEFS.map((defs, ai) => {
  const n = ai + 1
  const pos = layout(defs.length, n)
  return {
    n,
    name: t(`area:${n}`),
    board: `castillo-${(ai % 6) + 1}`,
    boss: `dialog-boos-area${n}`,
    face: BOSS_FACE[ai],
    spots: defs.map(([sn, type, levels, lessons], index): Spot => {
      const final = index === defs.length - 1
      return {
        area: n, n: sn, index, type, levels, final,
        name: t(`area:${n}:spot:${sn}`),
        lessons: type === 'lesson' ? levels : lessons ?? [],
        sprite: final ? (n === 10 ? 'king_castle' : 'final_castle') : type === 'lesson' ? 'castle' : 'tower',
        x: pos[index][0], y: pos[index][1],
      }
    }),
  }
})

export const spotKey = (s: { area: number; n: number }) => `${s.area}:${s.n}`
export const getArea = (n: number) => AREAS[n - 1]
export const getSpot = (area: number, n: number) => AREAS[area - 1].spots.find((s) => s.n === n)!

/** Mensaje de desafío del Rey Brujo (clave de texts.xml) y texto propio para los que no lo tienen. */
export const INTRO: Record<MiniType, string> = {
  lesson: '', maze: 'message:labyrinth:intro', danger: 'message:labyrinth:capturas:intro', target: 'message:darts:intro',
  collect: 'message:collectors:intro', portal: 'message:portal:intro', pawnWar: 'message:pawnsWar:intro',
  piecesPawns: 'message:pawnsVsPieces:intro', battle: 'message:finalBattle:intro', coins: 'message:coins:intro',
  ghosts: 'message:space:intro', check: 'message:check:intro', saveKing: 'message:helpReynaldo:intro', mate: 'message:mateIn1:intro',
  tactics: 'message:tactics:intro', captures: 'message:captures:intro', piecesKing: 'message:piecsVsKing:intro',
  helpMate: 'message:helpedMate:intro', series: 'message:whiteSeries:intro', challenge: 'message:challenge:intro',
  attack: 'message:challenge:intro', reinforce: 'message:finalBattle:intro',
  destroy: '¡Ja ja ja! Mis tropas te esperan...\n\nPara vencerme tendrás que dejar a mi ejército con una sola pieza. ¡Pero cuidado, que yo intentaré lo mismo!',
  tropillas: '¿Tus Caballos son veloces?\n\n¡Te desafío a que llegues con uno de ellos hasta mi bandera antes que los míos lleguen a la tuya!',
  comeCome: '¡Ja ja ja! En este desafío todo es al revés...\n\n¡Gana quien se queda sin piezas! Y recuerda: es obligatorio comer.',
  fruits: 'A ver esa puntería...\n\n¡Ataca al mismo tiempo a dos personajes iguales para hacerlos explotar! Tienes pocas jugadas...',
  hunters: '¡Jamás atraparán a mi Rey!\n\nColoca tus cazadores de a uno en el tablero y encierra a mi Rey con un Jaque Mate.',
  hidden: 'Hay una pieza escondida...\n\n¡Colócala en la casilla exacta para darle Jaque Mate a mi Rey!',
}
