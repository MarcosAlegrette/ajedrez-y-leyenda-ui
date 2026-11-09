import levels from '../../src/data/levels.json' with { type: 'json' }
import { parseFen, legalMoves, play, inCheck } from '../../src/engine/chess.ts'
const isMate = (p: any) => inCheck(p) && legalMoves(p).length === 0
const T: [RegExp, string][] = [[/pe[oó]n/i, 'p'], [/alfil/i, 'b'], [/caballo/i, 'n'], [/torre/i, 'r'], [/dama|reina/i, 'q']]
for (const k of ['PE/PE1', 'PE/PE2', 'PE/PE3', 'PE/PE4', 'PE/PE5', 'PE/PE6']) {
  let ok = 0, byRes = 0
  for (const g of (levels as any)[k]) {
    const c = g.t.map((x: any) => x[1]).join(' '); const tp = T.find(([re]) => re.test(c)); if (!tp) continue
    const base = parseFen(g.fen)
    const first = g.r === '0-1' ? 'b' : 'w'
    let found = ''
    for (const color of [first, first === 'w' ? 'b' : 'w']) {
      for (let sq = 0; sq < 64 && !found; sq++) {
        if (base.board[sq] || (tp[1] === 'p' && (sq < 8 || sq > 55))) continue
        const b = base.board.slice(); b[sq] = { c: color, t: tp[1] } as any
        const n = { ...base, board: b, turn: 'w' as const, ep: -1 }
        if (inCheck(n, 'b') || inCheck(n, 'w')) continue
        if (legalMoves(n).some((m) => isMate(play(n, m)))) found = color
      }
      if (found) break
    }
    if (found) { ok++; if (found === first) byRes++ }
  }
  console.log(k, 'resolubles', ok, '/', (levels as any)[k].length, ' con el color del resultado:', byRes)
}
