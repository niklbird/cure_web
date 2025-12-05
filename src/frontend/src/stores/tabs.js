// Pinia store for tab management - migrated from Vuex
// Documentation: https://pinia.vuejs.org/

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { State } from "@/rust/cure_web"

// Helper function to update commit history
function updateCommitHistory(tab, count, mutation, push = true) {
    if (push) {
        // If we are adding a new mutation, remove all mutations after the current count
        tab.mutations = tab.mutations.slice(0, count)
        tab.mutations.push(mutation)
    }
    tab.count += 1
}

// Default tab structure
const createDefaultTab = (id = "", name = "") => ({
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
})

export const useTabsStore = defineStore('tabs', () => {
    // State
    const tabs = ref([])
    const currentTab = ref(null)
    const copiedNode = ref(null)

    // Getters
    const currentTabObj = computed(() => {
        return tabs.value.find(tab => tab.id === currentTab.value) || createDefaultTab()
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
        return Object.values(currentTabObj.value.expanded).some(value => value)
    })

    // Getter functions
    function getNodeFromId(id) {
        return currentTabObj.value.tree.find(node => node.id === id) || { children: [] }
    }

    function isExpanded(id) {
        return currentTabObj.value.expanded[id] ?? false
    }

    function isDragOver(id, index) {
        const dropTarget = target.value
        return dropTarget[0] === id && dropTarget[1] === index
    }

    function isDescendant(ancestorId, potentialDescendantId) {
        const ancestorNode = getNodeFromId(ancestorId)
        if (!ancestorNode || !ancestorNode.children || ancestorNode.children.length === 0) {
            return false
        }

        const queue = [...ancestorNode.children]
        while (queue.length > 0) {
            const currentId = queue.shift()
            if (currentId === potentialDescendantId) {
                return true
            }
            const currentNode = getNodeFromId(currentId)
            if (currentNode && currentNode.children) {
                queue.push(...currentNode.children)
            }
        }
        return false
    }

    function getParentId(childId) {
        const node = getNodeFromId(childId)
        return node ? node.parent : null
    }

    // Mutations (now actions in Pinia)
    function emptyState(id) {
        const tab = tabs.value.find(t => t.id === id)
        if (tab) {
            tab.state = null
            tab.tree = null
            tab.mutations = []
        }
    }

    function tabAdded(context) {
        tabs.value.push(createDefaultTab(context.id, context.name))
    }

    function tabRenamed(newName) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.name = newName
        }
    }

    function tabRemoved(id) {
        const index = tabs.value.findIndex(tab => tab.id === id)
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

    function tabSelected(id) {
        currentTab.value = id
    }

    function copiedCellSet(context) {
        copiedNode.value = context
    }

    function dragTargetSet(id) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.target = id
        }
    }

    function draggedNodeIdSet(id) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.draggedNodeId = id
        }
    }

    function draggingSet(value) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.isDragging = value
        }
    }

    function activeDropContextSet(id) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.activeDropContextId = id
        }
    }

    function elementHighlighted(id) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.highlighted = id
        }
    }

    function mutationsAppended(context) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.mutations.push(...context)
        }
    }

    function mutationHistoryCounterSet(context) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.count = context.count
        }
    }

    function stateSet(context) {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ["stateSet", context], context.push ?? true)

        if (context.type === "json") {
            tab.state = State.from_stored(context.data)
        } else if (context.type === "example") {
            tab.state = State.load_example(context.data)
        } else {
            tab.state = new State(context.data)
        }

        tab.tree = JSON.parse(tab.state.get_nodes())
    }

    function nodeAdded(context) {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ["nodeAdded", context], context.push ?? true)
        tab.state.add_node(
            context.tag, context.content, context.parent, context.label, context.index ?? null
        )
        tab.tree = JSON.parse(tab.state.get_nodes())
    }

    function positionAdded(context) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.positions[context.id] = [context.top, context.height]
        }
    }

    function expandedSet(context) {
        const tab = tabs.value.find(t => t.id === currentTab.value)
        if (tab) {
            tab.expanded[context.id] = context.expanded
        }
    }

    function nodeMoved(context) {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ["nodeMoved", context], context.push ?? true)
        tab.state.drag_node(context.id, context.target, context.index)
        tab.tree = JSON.parse(tab.state.get_nodes())
    }

    function nodeChanged(context) {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ["nodeChanged", context], context.push ?? true)
        tab.state.adapt_node_all(context.id, context.tag, context.length, context.content)
        tab.tree = JSON.parse(tab.state.get_nodes())
    }

    function nodeUpdated(context) {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ["nodeUpdated", context], context.push ?? true)

        switch (context.field) {
            case "content":
                tab.state.adapt_node_content(context.id, context.value)
                break
            case "length":
                tab.state.adapt_node_length(context.id, context.value)
                break
            case "tag":
                tab.state.adapt_node_tag(context.id, context.value)
                break
            case "label":
                tab.state.adapt_node_label(context.id, context.value)
                break
            default:
                console.warn("Unknown field to update:", context.field)
        }

        tab.tree = JSON.parse(tab.state.get_nodes())
    }

    function nodeRemoved(context) {
        const tab = tabs.value.find(t => t.id === context.tab)
        if (!tab) return

        updateCommitHistory(tab, tab.count, ["nodeRemoved", context], context.push ?? true)
        tab.state.remove_node(context.id)
        tab.tree = JSON.parse(tab.state.get_nodes())
    }

    // Actions
    function addTab(tabName) {
        const id = Math.floor(Math.random() * 100000).toString()
        tabAdded({ id, name: tabName })
        tabSelected(id)
    }

    function setAll(expanded) {
        for (const node of currentTabObj.value.tree) {
            expandedSet({ id: node.id, expanded })
        }
    }

    // Internal method to apply a mutation by name
    function applyMutation(mutationName, context) {
        const mutations = {
            stateSet,
            nodeAdded,
            nodeMoved,
            nodeChanged,
            nodeUpdated,
            nodeRemoved
        }
        if (mutations[mutationName]) {
            mutations[mutationName](context)
        }
    }

    function undo() {
        if (currentTabObj.value.count < 2) {
            return
        }

        const mutations = currentTabObj.value.mutations
        const newCount = currentTabObj.value.count - 1

        emptyState(currentTab.value)

        for (const mutation of mutations.slice(0, newCount)) {
            applyMutation(mutation[0], mutation[1])
        }

        mutationsAppended(mutations.slice(newCount))
        mutationHistoryCounterSet({ count: newCount })
    }

    function redo() {
        if (currentTabObj.value.count >= currentTabObj.value.mutations.length) {
            return
        }

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