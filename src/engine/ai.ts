import type { Move, Pos } from './chess.ts'
import { type Variant, type VParams, type SearchOpts, rulesToJson } from './variants.ts'

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, (m: Move | null) => void>()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; move: Move | null }>) => {
      waiting.get(e.data.id)?.(e.data.move)
      waiting.delete(e.data.id)
    }
  }
  return worker
}

/** Pide a la computadora su mejor jugada. `minMs` da tiempo a "pensar" para que se vea natural. */
export async function think(variant: Variant, pos: Pos, prm: VParams, opts: SearchOpts, minMs = 550): Promise<Move | null> {
  const id = ++seq
  const t0 = performance.now()
  const move = await new Promise<Move | null>((resolve) => {
    waiting.set(id, resolve)
    getWorker().postMessage({ id, variant, pos, prm: { ...prm, rules: rulesToJson(prm.rules) }, opts })
  })
  const wait = minMs - (performance.now() - t0)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  return move
}

/** Fuerza del rival según el área de la aventura (1–10). */
export function strength(area: number, level = 1): SearchOpts {
  const n = Math.min(10, area + (level - 1) * 0.5)
  if (n < 2) return { depth: 1, noise: 260, timeMs: 400 }
  if (n < 3) return { depth: 2, noise: 220, timeMs: 600 }
  if (n < 4) return { depth: 2, noise: 140, timeMs: 700 }
  if (n < 5) return { depth: 2, noise: 70, timeMs: 800 }
  if (n < 6) return { depth: 3, noise: 90, timeMs: 1000 }
  if (n < 7) return { depth: 3, noise: 40, timeMs: 1200 }
  if (n < 8) return { depth: 3, noise: 10, timeMs: 1400 }
  if (n < 9) return { depth: 4, noise: 30, timeMs: 1600 }
  return { depth: 4, noise: 0, timeMs: 2000 }
}
