import { AREAS } from '../../src/game/world.ts'
import levels from '../../src/data/levels.json' with { type: 'json' }
import tut from '../../src/data/tutorials.json' with { type: 'json' }
let bad = 0, n = 0
for (const a of AREAS) for (const s of a.spots) {
  n++
  if (s.name.startsWith('area:')) { bad++; console.log('sin nombre', a.n, s.n) }
  if (s.type !== 'lesson') for (const l of s.levels) if (!l.startsWith('#') && !(l in levels)) { bad++; console.log('nivel faltante', a.n, s.n, l) }
  for (const l of s.lessons) if (!(l in tut)) { bad++; console.log('lección faltante', a.n, s.n, l) }
}
console.log(n, 'castillos;', bad, 'problemas')
