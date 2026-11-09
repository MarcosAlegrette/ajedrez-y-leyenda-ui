// Pruebas rápidas del motor: perft clásico + variantes.
import { parseFen, legalMoves, play, START_FEN, fromSan, toSan, status } from '../src/engine/chess.ts'
import { search, vMoves, vResult } from '../src/engine/variants.ts'
import type { Pos } from '../src/engine/chess.ts'

function perft(p: Pos, d: number): number {
  if (d === 0) return 1
  let n = 0
  for (const m of legalMoves(p)) n += perft(play(p, m), d - 1)
  return n
}
let fail = 0
const eq = (name: string, got: unknown, want: unknown) => { const ok = got === want; if (!ok) fail++; console.log(ok ? 'ok ' : 'FALLA', name, ok ? '' : `→ ${got} (esperado ${want})`) }
eq('perft inicial d3', perft(parseFen(START_FEN), 3), 8902)
eq('perft inicial d4', perft(parseFen(START_FEN), 4), 197281)
eq('perft kiwipete d3', perft(parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), 3), 97862)
eq('perft pos3 d4', perft(parseFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 4), 43238)
eq('perft pos5 d3', perft(parseFen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), 3), 62379)
let p = parseFen('6k1/5ppp/8/8/8/8/3PPPPP/4K2R w K - 0 1')
eq('enroque SAN', toSan(p, fromSan(p, 'O-O')!), 'O-O')
p = parseFen('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
eq('mate del pasillo', toSan(p, fromSan(p, 'Ra8')!), 'Ra8#')
eq('estado mate', status(play(p, fromSan(p, 'Ra8')!)), 'checkmate')
const m = search('chess', p, {}, { depth: 2, timeMs: 2000 })
eq('IA encuentra mate en 1', m && toSan(p, m), 'Ra8#')
p = parseFen('8/8/8/1r6/8/2B5/3R4/8 b - - 0 1')
eq('come-come: captura obligatoria', vMoves('comeCome', parseFen('8/8/8/1r6/1B6/8/3R4/8 b - - 0 1')).every((x) => x.captured), true)
eq('guerra de peones: gana quien corona', vResult('pawnRace', parseFen('P7/8/8/8/8/8/7p/8 b - - 0 1')), 'w')
eq('destructor: una sola pieza', vResult('destroy', parseFen('8/8/8/8/8/8/8/RN5r w - - 0 1')), 'w')
const t0 = Date.now(); search('chess', parseFen(START_FEN), {}, { depth: 4, timeMs: 5000 }); console.log('profundidad 4 desde el inicio:', Date.now() - t0, 'ms')
process.exit(fail ? 1 : 0)
