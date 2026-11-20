import type { useTabsStore } from '@/stores/tabs'
import type { TreeNode } from '@/types/editor'

type Store = ReturnType<typeof useTabsStore>

const OID_CN = '2.5.4.3'

/** CN of the subject (first attribute value as fallback), or null if no cert subject exists. */
function subjectName(store: Store): string | null {
  const subject = store.tree.find(n => n.label?.startsWith('certSubject.'))
  if (!subject) return null

  const values: { oid: string; text: string }[] = []
  const walk = (node: TreeNode) => {
    const kids = node.children.map(id => store.getNodeFromId(id))
    // An AttributeTypeAndValue is a SEQUENCE of [OID, value]
    if (kids.length === 2 && kids[0].tag[0] === 6 && kids[1].children.length === 0) {
      values.push({ oid: kids[0].content[2], text: kids[1].content[1] })
      return
    }
    kids.forEach(walk)
  }
  walk(subject)

  const cn = values.find(v => v.oid === OID_CN) ?? values[0]
  return cn?.text?.trim() || null
}

async function shortHash(bytes: Uint8Array): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
    return Array.from(new Uint8Array(digest).slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // crypto.subtle is unavailable in insecure contexts: simple FNV-1a fallback
    let h = 0x811c9dc5
    for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0
    return h.toString(16).padStart(8, '0')
  }
}

/** Derive a display name for the current tab's loaded object. */
export async function deriveTabName(store: Store): Promise<string | null> {
  if (!store.state) return null
  const cn = subjectName(store)
  if (cn) return cn

  const type = store.state.infer_object_type() || 'asn1'
  const hash = await shortHash(store.state.export_bin())
  return `${type}_${hash}`
}