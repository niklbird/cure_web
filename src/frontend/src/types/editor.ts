/** Represents a single ASN.1 node in the tree */
export interface TreeNode {
    id: number
    label: string
    tag: [number, string, number[]]         // [tagValue, displayString, rawBytes]
    length: [number, string, number[]]      // [lengthValue, displayString, rawBytes]
    content: [string, string, string, number[]] // [rawStr, displayStr, editableStr, rawBytes]
    children: number[]
    parent: number
    edited: boolean
}

/** Payload sent when adding a node */
export interface NodeAddPayload {
    tab: string | null
    parent: number
    tag: number | string | null
    label: string | null
    content: string
    index?: number | null
    push?: boolean
}

/** Payload sent when changing a node (tag, length, content) */
export interface NodeChangePayload {
    tab: string | null
    id: number
    tag: number | string | null
    length: number | null
    content: string | null
    push?: boolean
}

/** Payload sent when updating a single field on a node */
export interface NodeUpdatePayload {
    tab: string | null
    id: number
    value: any
    field: 'content' | 'length' | 'tag' | 'label'
    push?: boolean
}

/** Payload sent when removing a node */
export interface NodeRemovePayload {
    tab: string | null
    id: number
    push?: boolean
}

/** Payload sent when moving a node via drag-and-drop */
export interface NodeMovePayload {
    tab: string | null
    id: number
    target: number
    index: number
    push?: boolean
}

/** Payload for setting state from file/example/json */
export interface StateSetPayload {
    tab: string | null
    data: any
    type: 'state' | 'hex' | 'json' | 'example' | 'base64'
    push?: boolean
}

/** Context menu item */
export interface ContextMenuItem {
    title: string
    action: () => void
    children?: ContextMenuItem[]
}

/** Report from CURE test execution */
export interface CureVrpIp {
    ip_s: string
    max_len: number
}

export interface CureVrp {
    asn: string | number
    ip: CureVrpIp
}

export interface CureRpResult {
    name: string
    crashed: boolean
    vrps: { content: CureVrp[] }
    errors: string
}

export interface CureReport {
    name: string
    state: string
    report: CureRpResult[]
}