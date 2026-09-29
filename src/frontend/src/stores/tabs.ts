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
    locked: number
    target: [number, number]
    isDragging: boolean
    activeDropContextId: number | null
    draggedNodeId: number | null
    copiedNode: TreeNode | null
    mutations: [string, any][]
    count: number
}

type MutationName =
    | 'stateSet'
    | 'nodeAdded'
    | 'nodeMoved'
    | 'nodeChanged'
    | 'nodeUpdated'
    | 'nodeRemoved'

type MutationContext =
    | StateSetPayload
    | NodeAddPayload
    | NodeChangePayload
    | NodeUpdatePayload
    | NodeRemovePayload
    | NodeMovePayload

type MutationRecord = [MutationName, MutationContext]

interface MutationOptions {
    /**
     * Whether the mutation should be written to the history.
     */
    recordHistory: boolean

    /**
     * Whether the history cursor should move.
     */
    advanceHistory: boolean

    /**
     * Whether the JS tree should be rebuilt after this mutation.
     */
    refreshTree: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createDefaultTab(id = '', name = ''): Tab {
    return {
        id,
        name,
        state: null,
        tree: [],
        positions: {},
        expanded: {},
        highlighted: -1,
        locked: -1,
        target: [-1, -1],
        isDragging: false,
        activeDropContextId: null,
        draggedNodeId: null,
        copiedNode: null,
        mutations: [],
        count: 0
    }
}

/**
 * Updates the history only when requested.
 */
function updateCommitHistory(
    tab: Tab,
    mutation: [string, any],
    recordHistory: boolean,
    advanceHistory: boolean
): void {
    if (!advanceHistory) return

    if (recordHistory) {
        tab.mutations = tab.mutations.slice(0, tab.count)
        tab.mutations.push(mutation)
    }

    tab.count += 1
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTabsStore = defineStore('tabs', () => {
    // State
    const tabs = ref<Tab[]>([])
    const currentTab = ref<string | null>(null)
    const copiedNode = ref<TreeNode | null>(null)

    // ─── Internal tab helpers ─────────────────────────────────────────────────

    function findTab(id: string | null): Tab | undefined {
        if (id === null) return undefined
        return tabs.value.find(tab => tab.id === id)
    }

    function requireCurrentTab(): Tab | undefined {
        return findTab(currentTab.value)
    }

    /**
     * Rebuilds the JS representation of the Rust state.
     */
    function refreshTree(tab: Tab): void {
        if (!tab.state) {
            tab.tree = []
            return
        }

        tab.tree = JSON.parse(tab.state.get_nodes()) as TreeNode[]
    }

    /**
     * Resets only the actual document state.
     */
    function resetDocumentState(tab: Tab): void {
        tab.state = null
        tab.tree = []
    }

    /**
     * Returns the push flag without requiring every payload type to expose
     * it explicitly in the internal union.
     */
    function shouldRecordContext(context: unknown): boolean {
        if (
            typeof context === 'object' &&
            context !== null &&
            'push' in context
        ) {
            return (context as { push?: boolean }).push ?? true
        }

        return true
    }

    function commitMutation(
        tab: Tab,
        name: MutationName,
        context: MutationContext,
        options: MutationOptions
    ): void {
        updateCommitHistory(
            tab,
            [name, context],
            options.recordHistory && shouldRecordContext(context),
            options.advanceHistory
        )
    }

    function finishMutation(tab: Tab, options: MutationOptions): void {
        if (options.refreshTree) {
            refreshTree(tab)
        }
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    const currentTabObj = computed<Tab>(() => {
        return findTab(currentTab.value) ?? createDefaultTab()
    })

    const name = computed(() => currentTabObj.value.name)
    const state = computed(() => currentTabObj.value.state)
    const tree = computed(() => currentTabObj.value.tree)
    const positions = computed(() => currentTabObj.value.positions)
    const highlighted = computed(() => currentTabObj.value.highlighted)
    const locked = computed(() => currentTabObj.value.locked)
    const target = computed(() => currentTabObj.value.target)
    const draggedNodeId = computed(() => currentTabObj.value.draggedNodeId)
    const isDragging = computed(() => currentTabObj.value.isDragging)
    const activeDropContextId = computed(
        () => currentTabObj.value.activeDropContextId
    )

    const canUndo = computed(() => currentTabObj.value.count >= 2)

    const canRedo = computed(
        () => currentTabObj.value.count < currentTabObj.value.mutations.length
    )

    const anyExpanded = computed(() => {
        for (const expanded of Object.values(currentTabObj.value.expanded)) {
            if (expanded) return true
        }

        return false
    })

    const nodesById = computed(() => {
        const map = new Map<number, TreeNode>()

        for (const node of currentTabObj.value.tree) {
            map.set(node.id, node)
        }

        return map
    })

    // ─── Getter functions ─────────────────────────────────────────────────────

    function getNodeFromId(id: number): TreeNode {
        return nodesById.value.get(id) ?? { ...EMPTY_NODE, children: [] }
    }

    function isExpanded(id: number): boolean {
        return currentTabObj.value.expanded[id] ?? false
    }

    function isDragOver(id: number, index: number): boolean {
        const currentTarget = currentTabObj.value.target

        return (
            currentTarget[0] === id &&
            currentTarget[1] === index
        )
    }

    function isDescendant(
        ancestorId: number,
        potentialDescendantId: number
    ): boolean {
        const ancestorNode = nodesById.value.get(ancestorId)

        if (!ancestorNode?.children?.length) {
            return false
        }

        // Use a stack instead of Array.shift().
        const stack = [...ancestorNode.children]

        while (stack.length > 0) {
            const currentId = stack.pop()!

            if (currentId === potentialDescendantId) {
                return true
            }

            const currentNode = nodesById.value.get(currentId)

            if (currentNode?.children?.length) {
                stack.push(...currentNode.children)
            }
        }

        return false
    }

    function getParentId(childId: number): number | null {
        return nodesById.value.get(childId)?.parent ?? null
    }

    // ─── State / tab mutations ────────────────────────────────────────────────

    function emptyState(id: string): void {
        const tab = findTab(id)

        if (!tab) return

        resetDocumentState(tab)

        tab.mutations = []
        tab.count = 0
    }

    function tabAdded(context: { id: string; name: string }): void {
        tabs.value.unshift(createDefaultTab(context.id, context.name))
    }

    function tabRenamed(newName: string): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.name = newName
        }
    }

    function tabRemoved(id: string): void {
        const index = tabs.value.findIndex(tab => tab.id === id)

        if (index === -1) return

        const wasCurrentTab = currentTab.value === id

        tabs.value.splice(index, 1)

        if (!wasCurrentTab) return

        if (tabs.value.length === 0) {
            currentTab.value = null
            return
        }

        const newIndex = Math.min(
            Math.max(index - 1, 0),
            tabs.value.length - 1
        )

        currentTab.value = tabs.value[newIndex].id
    }

    function tabSelected(id: string): void {
        currentTab.value = id
    }

    function copiedCellSet(context: TreeNode | null): void {
        copiedNode.value = context
    }

    function dragTargetSet(id: [number, number] | number): void {
        const tab = requireCurrentTab()

        if (!tab) return

        tab.target = Array.isArray(id)
            ? id
            : [id, -1]
    }

    function draggedNodeIdSet(id: number | null): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.draggedNodeId = id
        }
    }

    function draggingSet(value: boolean): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.isDragging = value
        }
    }

    function activeDropContextSet(id: number | null): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.activeDropContextId = id
        }
    }

    function elementHighlighted(id: number): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.highlighted = id
        }
    }

    function elementLocked(id: number): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.locked = id
        }
    }

    function mutationsAppended(context: [string, any][]): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.mutations.push(...context)
        }
    }

    function mutationHistoryCounterSet(context: { count: number }): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.count = context.count
        }
    }

    // ─── Document mutations ───────────────────────────────────────────────────

    function stateSet(
        context: StateSetPayload,
        options: MutationOptions = {
            recordHistory: true,
            advanceHistory: true,
            refreshTree: true
        }
    ): void {
        const tab = findTab(context.tab)

        if (!tab) return

        commitMutation(tab, 'stateSet', context, options)

        if (context.type === 'json') {
            tab.state = State.from_stored(context.data)
        } else if (context.type === 'example') {
            tab.state = State.load_example(context.data)
        } else {
            tab.state = new State(context.data)
        }

        finishMutation(tab, options)
    }

    function nodeAdded(
        context: NodeAddPayload,
        options: MutationOptions = {
            recordHistory: true,
            advanceHistory: true,
            refreshTree: true
        }
    ): void {
        const tab = findTab(context.tab)

        if (!tab?.state) return

        commitMutation(tab, 'nodeAdded', context, options)

        tab.state.add_node(
            Number(context.tag),
            context.content,
            context.parent,
            context.label ?? '',
            context.index ?? null
        )

        finishMutation(tab, options)
    }

    function positionAdded(context: {
        id: number
        top: number
        height: number
    }): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.positions[context.id] = [
                context.top,
                context.height
            ]
        }
    }

    function expandedSet(context: {
        id: number
        expanded: boolean
    }): void {
        const tab = requireCurrentTab()

        if (tab) {
            tab.expanded[context.id] = context.expanded
        }
    }

    function nodeMoved(
        context: NodeMovePayload,
        options: MutationOptions = {
            recordHistory: true,
            advanceHistory: true,
            refreshTree: true
        }
    ): void {
        const tab = findTab(context.tab)

        if (!tab?.state) return

        commitMutation(tab, 'nodeMoved', context, options)

        tab.state.drag_node(
            context.id,
            context.target,
            context.index
        )

        finishMutation(tab, options)
    }

    function nodeChanged(
        context: NodeChangePayload,
        options: MutationOptions = {
            recordHistory: true,
            advanceHistory: true,
            refreshTree: true
        }
    ): void {
        const tab = findTab(context.tab)

        if (!tab?.state) return

        commitMutation(tab, 'nodeChanged', context, options)

        tab.state.adapt_node_all(
            context.id,
            Number(context.tag),
            context.length ?? undefined,
            context.content ?? ''
        )

        finishMutation(tab, options)
    }

    function nodeUpdated(
        context: NodeUpdatePayload,
        options: MutationOptions = {
            recordHistory: true,
            advanceHistory: true,
            refreshTree: true
        }
    ): void {
        const tab = findTab(context.tab)

        if (!tab?.state) return

        commitMutation(tab, 'nodeUpdated', context, options)

        switch (context.field) {
            case 'content':
                tab.state.adapt_node_content(
                    context.id,
                    context.value
                )
                break

            case 'length':
                tab.state.adapt_node_length(
                    context.id,
                    context.value
                )
                break

            case 'tag':
                tab.state.adapt_node_tag(
                    context.id,
                    context.value
                )
                break

            case 'label':
                tab.state.adapt_node_label(
                    context.id,
                    context.value
                )
                break

            default:
                console.warn(
                    'Unknown field to update:',
                    context.field
                )
        }

        finishMutation(tab, options)
    }

    function nodeRemoved(
        context: NodeRemovePayload,
        options: MutationOptions = {
            recordHistory: true,
            advanceHistory: true,
            refreshTree: true
        }
    ): void {
        const tab = findTab(context.tab)

        if (!tab?.state) return

        commitMutation(tab, 'nodeRemoved', context, options)

        tab.state.remove_node(context.id)

        finishMutation(tab, options)
    }

    // ─── Actions ──────────────────────────────────────────────────────────────

    function addTab(tabName: string): void {
        const id = crypto.randomUUID()

        tabAdded({
            id,
            name: tabName
        })

        tabSelected(id)
    }

    function setAll(expanded: boolean): void {
        const tab = requireCurrentTab()

        if (!tab) return

        // Update the object directly instead of calling expandedSet()
        // once per node and repeatedly looking up the current tab.
        for (const node of tab.tree) {
            tab.expanded[node.id] = expanded
        }
    }

    // ─── Mutation replay ──────────────────────────────────────────────────────

    function applyMutation(
        mutationName: string,
        context: any,
        options: MutationOptions
    ): void {
        switch (mutationName as MutationName) {
            case 'stateSet':
                stateSet(context as StateSetPayload, options)
                break

            case 'nodeAdded':
                nodeAdded(context as NodeAddPayload, options)
                break

            case 'nodeMoved':
                nodeMoved(context as NodeMovePayload, options)
                break

            case 'nodeChanged':
                nodeChanged(context as NodeChangePayload, options)
                break

            case 'nodeUpdated':
                nodeUpdated(context as NodeUpdatePayload, options)
                break

            case 'nodeRemoved':
                nodeRemoved(context as NodeRemovePayload, options)
                break

            default:
                console.warn(
                    'Unknown mutation:',
                    mutationName
                )
        }
    }

    function undo(): void {
        const tab = requireCurrentTab()

        if (!tab || tab.count < 2) {
            return
        }

        const newCount = tab.count - 1
        const history = tab.mutations

        resetDocumentState(tab)

        /*
         * Replay only the mutations that should still be active
         */
        for (let i = 0; i < newCount; i++) {
            const [mutationName, context] = history[i]

            applyMutation(
                mutationName,
                context,
                {
                    recordHistory: false,
                    advanceHistory: false,
                    refreshTree: false
                }
            )
        }

        tab.count = newCount

        refreshTree(tab)
    }

    function redo(): void {
        const tab = requireCurrentTab()

        if (!tab || tab.count >= tab.mutations.length) {
            return
        }

        const mutation = tab.mutations[tab.count]

        if (!mutation) return

        const [mutationName, context] = mutation

        /*
         * Redo advances the history cursor without append
         * another history entry.
         */
        applyMutation(
            mutationName,
            context,
            {
                recordHistory: false,
                advanceHistory: true,
                refreshTree: true
            }
        )
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
        locked,
        target,
        draggedNodeId,
        isDragging,
        activeDropContextId,
        anyExpanded,
        canUndo,
        canRedo,

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
        elementLocked,
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