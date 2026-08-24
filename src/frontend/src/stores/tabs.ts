// Pinia store for tab management — TypeScript version
// Documentation: https://pinia.vuejs.org/

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { State } from '@/rust/cure_web'
import type {
    TreeNode,
    NodeAddPayload,
    NodeChangePayload,
    NodeUpdatePayload,
    NodeRemovePayload,
    NodeMovePayload,
    StateSetPayload
} from '@/types/editor'

// ─── Internal types ───────────────────────────────────────────────────────────

export interface Tab {
    id: string
    name: string
    state: State | null
    tree: TreeNode[]
    positions: Record<number, [number, number]>
    expanded: Record<number, boolean>
    highlighted: number
    target: [number, number]
    isDragging: boolean
    activeDropContextId: number | null
    draggedNodeId: number | null
    copiedNode: TreeNode | null
    mutations: [string, any][]
    count: number
}

type MutationName = 'stateSet' | 'nodeAdded' | 'nodeMoved' | 'nodeChanged' | 'nodeUpdated' | 'nodeRemoved'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function updateCommitHistory(tab: Tab, count: number, mutation: [string, any], push = true): void {
    if (push) {
        tab.mutations = tab.mutations.slice(0, count)
        tab.mutations.push(mutation)
    }
    tab.count += 1
}

function createDefaultTab(id = '', name = ''): Tab {
    return {
        id,
        name,
        state: null,
        tree: [],
        positions: {},
        expanded: {},
        highlighted: -1,
        target: [-1, -1],
        isDragging: false,
        activeDropContextId: null,
        draggedNodeId: null,
        copiedNode: null,
        mutations: [],
        count: 0
    }
}

const EMPTY_NODE: TreeNode = {
    id: -1,
    label: '',
    tag: [0, '', []],
    length: [0, '', []],
    content: ['', '', '', []],
    children: [],
    parent: -1,
    edited: false
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTabsStore = defineStore('tabs', () => {
    // State
    const tabs = ref<Tab[]>([])
    const currentTab = ref<string | null>(null)
    const copiedNode = ref<TreeNode | null>(null)

    // Getters
    const currentTabObj = computed<Tab>(() => {
        return tabs.value.find(t => t.id === currentTab.value) ?? createDefaultTab()
    })

    const name = computed(() => currentTabObj.value.name)
    const state = computed(() => currentTabObj.value.state)
    const tree = computed(() => currentTabObj.value.tree)
    const positions = computed(() => currentTabObj.value.positions)
    const highlighted = computed(() => currentTabObj.value.highlighted)
    const target = computed(() => currentTabObj.value.target)
    const draggedNodeId = computed(() => currentTabObj.value.draggedNodeId)
    const isDragging = computed(() => currentTabObj.value.isDragging)
    const activeDropContextId = computed(() => currentTabObj.value.activeDropContextId)

    const anyExpanded = computed(() => {
        return Object.values(currentTabObj.value.expanded).some(v => v)
    })

    // Getter functions
    function getNodeFromId(id: number): TreeNode {
        return currentTabObj.value.tree.find(n => n.id === id) ?? { ...EMPTY_NODE, children: [] }
    }

    function isExpanded(id: number): boolean {
        return currentTabObj.value.expanded[id] ?? false
    }

    function isDragOver(id: number, index: number): boolean {
        const t = target.value
        return t[0] === id && t[1] === index
    }

    function isDescendant(ancestorId: number, potentialDescendantId: number): boolean {
        const ancestorNode = getNodeFromId(ancestorId)
        if (!ancestorNode?.children?.length) return false

        const queue = [...ancestorNode.children]
        while (queue.length > 0) {
            const currentId = queue.shift()!
            if (currentId === potentialDescendantId) return true
            const currentNode = getNodeFromId(currentId)
            if (currentNode?.children) queue.push(...currentNode.children)
        }
        return false
    }

    function getParentId(childId: number): number | null {
        const node = getNodeFromId(childId)
        return node ? node.parent : null
    }

    // ─── Mutations ────────────────────────────────────────────────────────

    function emptyState(id: string): void {
        const tab = tabs.value.find(t => t.id === id)
        if (tab) {
            tab.state = null
            tab.tree = []
            tab.mutations = []
        }
    }

    function tabAdded(context: { id: string; name: string }): void {
        tabs.value.unshift(createDefaultTab(context.id, context.name))
    }

    function tabRenamed(newName: string): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.name = newName
    }

    function tabRemoved(id: string): void {
        const index = tabs.value.findIndex(t => t.id === id)
        if (index === -1) return

        tabs.value.splice(index, 1)

        if (currentTab.value === id) {
            if (tabs.value.length > 0) {
                const newIndex = Math.max(0, index - 1)
                currentTab.value = tabs.value[newIndex].id
            } else {
                currentTab.value = null
            }
        }
    }

    function tabSelected(id: string): void {
        currentTab.value = id
    }

    function copiedCellSet(context: TreeNode | null): void {
        copiedNode.value = context
    }

    function dragTargetSet(id: [number, number] | number): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (!tab) return
        if (Array.isArray(id)) {
            tab.target = id
        } else {
            tab.target = [id, -1]
        }
    }

    function draggedNodeIdSet(id: number | null): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.draggedNodeId = id
    }

    function draggingSet(value: boolean): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.isDragging = value
    }

    function activeDropContextSet(id: number | null): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.activeDropContextId = id
    }

    function elementHighlighted(id: number): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.highlighted = id
    }

    function mutationsAppended(context: [string, any][]): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.mutations.push(...context)
    }

    function mutationHistoryCounterSet(context: { count: number }): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.count = context.count
    }

    function stateSet(context: StateSetPayload): void {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ['stateSet', context], context.push ?? true)

        if (context.type === 'json') {
            tab.state = State.from_stored(context.data)
        } else if (context.type === 'example') {
            tab.state = State.load_example(context.data)
        } else {
            tab.state = new State(context.data)
        }

        tab.tree = JSON.parse(tab.state.get_nodes())
    }

    function nodeAdded(context: NodeAddPayload): void {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ['nodeAdded', context], context.push ?? true)
        tab.state!.add_node(
            Number(context.tag),
            context.content,
            context.parent,
            context.label ?? '',
            context.index ?? null
        )
        tab.tree = JSON.parse(tab.state!.get_nodes())
    }

    function positionAdded(context: { id: number; top: number; height: number }): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.positions[context.id] = [context.top, context.height]
    }

    function expandedSet(context: { id: number; expanded: boolean }): void {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) tab.expanded[context.id] = context.expanded
    }

    function nodeMoved(context: NodeMovePayload): void {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ['nodeMoved', context], context.push ?? true)
        tab.state!.drag_node(context.id, context.target, context.index)
        tab.tree = JSON.parse(tab.state!.get_nodes())
    }

    function nodeChanged(context: NodeChangePayload): void {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ['nodeChanged', context], context.push ?? true)
        tab.state!.adapt_node_all(
            context.id,
            Number(context.tag),
            context.length ?? undefined,
            context.content ?? ''
        )
        tab.tree = JSON.parse(tab.state!.get_nodes())
    }

    function nodeUpdated(context: NodeUpdatePayload): void {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ['nodeUpdated', context], context.push ?? true)

        switch (context.field) {
            case 'content':
                tab.state!.adapt_node_content(context.id, context.value)
                break
            case 'length':
                tab.state!.adapt_node_length(context.id, context.value)
                break
            case 'tag':
                tab.state!.adapt_node_tag(context.id, context.value)
                break
            case 'label':
                tab.state!.adapt_node_label(context.id, context.value)
                break
            default:
                console.warn('Unknown field to update:', context.field)
        }

        tab.tree = JSON.parse(tab.state!.get_nodes())
    }

    function nodeRemoved(context: NodeRemovePayload): void {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ['nodeRemoved', context], context.push ?? true)
        tab.state!.remove_node(context.id)
        tab.tree = JSON.parse(tab.state!.get_nodes())
    }

    // ─── Actions ──────────────────────────────────────────────────────────

    function addTab(tabName: string): void {
        const id = Math.floor(Math.random() * 100000).toString()
        tabAdded({ id, name: tabName })
        tabSelected(id)
    }

    function setAll(expanded: boolean): void {
        for (const node of currentTabObj.value.tree) {
            expandedSet({ id: node.id, expanded })
        }
    }

    // Internal method to apply a mutation by name
    function applyMutation(mutationName: string, context: any): void {
        const mutations: Record<string, Function> = {
            stateSet,
            nodeAdded,
            nodeMoved,
            nodeChanged,
            nodeUpdated,
            nodeRemoved
        }
        mutations[mutationName]?.(context)
    }

    function undo(): void {
        if (currentTabObj.value.count < 2) return

        const mutations = currentTabObj.value.mutations
        const newCount = currentTabObj.value.count - 1

        emptyState(currentTab.value!)

        for (const mutation of mutations.slice(0, newCount)) {
            applyMutation(mutation[0], mutation[1])
        }

        mutationsAppended(mutations.slice(newCount))
        mutationHistoryCounterSet({ count: newCount })
    }

    function redo(): void {
        if (currentTabObj.value.count >= currentTabObj.value.mutations.length) return

        const mutation = currentTabObj.value.mutations[currentTabObj.value.count]
        const contextCommit = { ...mutation[1], push: false }
        applyMutation(mutation[0], contextCommit)
    }

    return {
        // State
        tabs,
        currentTab,
        copiedNode,

        // Getters
        currentTabObj,
        name,
        state,
        tree,
        positions,
        highlighted,
        target,
        draggedNodeId,
        isDragging,
        activeDropContextId,
        anyExpanded,

        // Getter functions
        getNodeFromId,
        isExpanded,
        isDragOver,
        isDescendant,
        getParentId,

        // Mutations/Actions
        emptyState,
        tabAdded,
        tabRenamed,
        tabRemoved,
        tabSelected,
        copiedCellSet,
        dragTargetSet,
        draggedNodeIdSet,
        draggingSet,
        activeDropContextSet,
        elementHighlighted,
        mutationsAppended,
        mutationHistoryCounterSet,
        stateSet,
        nodeAdded,
        positionAdded,
        expandedSet,
        nodeMoved,
        nodeChanged,
        nodeUpdated,
        nodeRemoved,

        // Actions
        addTab,
        setAll,
        undo,
        redo
    }
})