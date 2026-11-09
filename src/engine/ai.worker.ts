// La IA piensa en un Web Worker para no trabar las animaciones.
import { type Pos } from './chess.ts'
import { type Variant, type VParams, type RulesJson, type SearchOpts, search, rulesFromJson } from './variants.ts'

export interface AiJob { id: number; variant: Variant; pos: Pos; prm: Omit<VParams, 'rules'> & { rules?: RulesJson }; opts: SearchOpts }

self.onmessage = (e: MessageEvent<AiJob>) => {
  const { id, variant, pos, prm, opts } = e.data
  const move = search(variant, pos, { ...prm, rules: rulesFromJson(prm.rules) }, opts)
  ;(self as unknown as Worker).postMessage({ id, move })
}
