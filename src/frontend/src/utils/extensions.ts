export interface ExtField {
  key: string
  label: string
  type: 'text' | 'list' | 'bool' | 'int' | 'bits'
  placeholder?: string
  options?: string[]          // for 'bits' / selects
}

export interface ExtensionDef {
  id: string
  name: string
  oid: string
  critical: boolean
  fields: ExtField[]
  encode: (v: Record<string, any>) => number[]   // DER of the extnValue
}

export const intBytes = (n: number): number[] => {
  if (n === 0) return [0]
  const b: number[] = []
  for (let x = n; x > 0; x = Math.floor(x / 256)) b.unshift(x & 0xff)
  if (b[0] & 0x80) b.unshift(0)   // keep it positive
  return b
}

export const ipBytes = (s: string): number[] => {
  if (s.includes('.')) return s.split('.').map(Number)
  // IPv6, with '::' expansion
  const [head, tail] = s.split('::')
  const h = head ? head.split(':') : []
  const t = tail ? tail.split(':') : []
  const groups = [...h, ...Array(8 - h.length - t.length).fill('0'), ...t]
  return groups.flatMap(g => { const v = parseInt(g || '0', 16); return [v >> 8, v & 0xff] })
}

const lenBytes = (n: number): number[] => {
  if (n < 128) return [n]
  const b: number[] = []
  for (let x = n; x > 0; x = Math.floor(x / 256)) b.unshift(x & 0xff)
  return [0x80 | b.length, ...b]
}

export const tlv = (tag: number, content: number[]): number[] =>
  [tag, ...lenBytes(content.length), ...content]

export const seq = (items: number[][]): number[] => tlv(0x30, items.flat())

export const utf8 = (s: string): number[] => Array.from(new TextEncoder().encode(s))

export const oidBytes = (oid: string): number[] => {
  const p = oid.split('.').map(Number)
  const out = [p[0] * 40 + p[1]]
  for (const x of p.slice(2)) {
    const chunk = [x & 0x7f]
    for (let n = Math.floor(x / 128); n > 0; n = Math.floor(n / 128)) chunk.unshift((n & 0x7f) | 0x80)
    out.push(...chunk)
  }
  return out
}

export const wrapExtension = (def: ExtensionDef, critical: boolean, value: number[]): number[] =>
  seq([
    tlv(0x06, oidBytes(def.oid)),
    ...(critical ? [tlv(0x01, [0xff])] : []),
    tlv(0x04, value)
  ])

export const EXTENSIONS: ExtensionDef[] = [
  {
    id: 'san',
    name: 'Subject Alternative Name',
    oid: '2.5.29.17',
    critical: false,
    fields: [
      { key: 'dns',   label: 'DNS names',   type: 'list', placeholder: 'example.com' },
      { key: 'ip',    label: 'IP addresses', type: 'list', placeholder: '192.0.2.1' },
      { key: 'email', label: 'E-mail',       type: 'list' }
    ],
    encode: v => seq([
      ...(v.dns   ?? []).map((s: string) => tlv(0x82, utf8(s))),
      ...(v.email ?? []).map((s: string) => tlv(0x81, utf8(s))),
      ...(v.ip    ?? []).map((s: string) => tlv(0x87, ipBytes(s)))
    ])
  },
  {
    id: 'bc',
    name: 'Basic Constraints',
    oid: '2.5.29.19',
    critical: true,
    fields: [
      { key: 'ca',      label: 'Is CA',           type: 'bool' },
      { key: 'pathLen', label: 'Path length',     type: 'int'  }
    ],
    encode: v => seq([
      ...(v.ca ? [tlv(0x01, [0xff])] : []),
      ...(v.pathLen != null && v.pathLen !== '' ? [tlv(0x02, intBytes(+v.pathLen))] : [])
    ])
  }
  // KeyUsage, ExtendedKeyUsage, SKI, AKI, CRL DP, AIA ... same pattern
]