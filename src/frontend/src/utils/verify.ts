// Wrapper around State.verify (wasm/src/verify.rs).
// All checks run in Rust on the editor's tree.

import type { State } from '@/rust/cure_web'

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'info' | 'skip'

export interface Check {
  group: string
  title: string
  status: CheckStatus
  detail?: string
  /** Id of the tree node this check is about. */
  node?: number
}

export interface VerifyReport {
  objectType: string
  verdict: 'valid' | 'invalid' | 'unanchored'
  summary: string
  checks: Check[]
  chainProvided: boolean
  /** Labels of the certificates in the validated path, object first. */
  path: string[]
}

/**
 * @param chain certificates and CRLs, each entry PEM (several blocks allowed), base64 or hex
 * @param now   reference time for validity checks
 */
export function verifyState(state: State, chain: string[], now: Date = new Date()): VerifyReport {
  return JSON.parse(state.verify(chain, now.getTime())) as VerifyReport
}

/** Binary file contents → base64, text (PEM, base64, hex) as is. */
export function chainEntryFromBytes(bytes: Uint8Array): string {
  if (bytes.length > 0 && bytes[0] === 0x30) {
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    }
    return btoa(bin)
  }
  return new TextDecoder().decode(bytes)
}
