// Setup of the vuex-store plugin, documentation at: https://vuex.vuejs.org/#what-is-a-state-management-pattern
// The state of the application is managed and modified only through mutations defined here.

// [getters] give access to the state of the application, in views and components they can be accessed like:
// `this.$store.getters.getNodeFromId(id)`
// [mutations] are functions that modify the state of the application, they can be called like:
// `this.$store.commit('nodeAdded', context)`

import { createStore } from 'vuex'
import { State } from "@/rust/cure_web"


function updateCommitHistory(state, count, mutation, push=true) {
    // Add a new mutation to the history of mutations for the current tab.
    const tab = state.tabs.find(tab => tab.id == mutation[1].tab)
    if (push) {
        // If we are adding a new mutation, remove all mutations after the current count
        tab.mutations = tab.mutations.slice(0, count)
        tab.mutations.push(mutation)
    }
    tab.count += 1
}


// The inital state of a new tab:
// [id] is the id of the state used to identify it when switching or deleting tabs
// [name] is the name of the tab, it can be changed later in the UI
// [state] is the State object returned by the rust backen
// [tree] is the list of nodes from the State object
// [positions] stores the position of each byte node to support the auto-scrolling functionality
// [expanded] for each node store whether it is expanded or not
// [highlighted] is the id of the currently highlighted node, -1 if none
// [dragTarget] is the id of the node that is currently being dragged over, -1 if none
// [copiedNode], the UI allows to copy a node which is then stored here
// [mutations] is a list of all mutations modifying the rust State object, 
// this is used to implement the undo/redo functionality
// [count] is the number of mutations, it is used to implement the undo/redo functionality
const defaultTab = {
    id: "",
    name: "",
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


export default createStore({
    state: {
        tabs: [],
        currentTab: null,
        copiedNode: null
    },
    getters: {
        getNodeFromId: (state, getters) => (id) => {
            return getters.currentTabObj.tree.find((node) => node.id == id) || { children: []}
        },
        tabs: (state) => {
            return state.tabs
        },
        currentTab: (state) => {
            return state.currentTab
        },
        currentTabObj: (state) => {
            return state.tabs.find(tab => tab.id == state.currentTab) || defaultTab
        },
        name: (state, getters) => {
            return getters.currentTabObj.name
        },
        state: (state, getters) => {
            return getters.currentTabObj.state
        },
        tree: (state, getters) => {
            return getters.currentTabObj.tree
        },
        positions: (state, getters) => {
            return getters.currentTabObj.positions
        },
        highlighted: (state, getters) => {
            return getters.currentTabObj.highlighted
        },
        isExpanded: (state, getters) => (id) => {
            return getters.currentTabObj.expanded[id] ?? false
        },
        isDragOver: (state, getters) => (id, index) => {
            const dropTarget = getters.target

            // Drop Target is a list with two indices:
            // the first is the id of the node that is being dragged over,
            // if the node is a SEQUENCE or SET, the second is the index of the child being hovered over,
            // so that elements can be dropped at a specific position.
            return (dropTarget[0] == id) && (dropTarget[1] == index)
        },
        target: (state, getters) => {
            return getters.currentTabObj.target
        },
        draggedNodeId: (state, getters) => {
            return getters.currentTabObj.draggedNodeId
        },
        anyExpanded: (state, getters) => {
            return Object.values(getters.currentTabObj.expanded).some((value) => value)
        },
        isDragging: (state, getters) => {
            return getters.currentTabObj.isDragging
        },
        isDescendant: (state, getters) => (ancestorId, potentialDescendantId) => {
            const ancestorNode = getters.getNodeFromId(ancestorId);
            if (!ancestorNode || !ancestorNode.children || ancestorNode.children.length === 0) {
                return false;
            }

            // Using a queue for a breadth-first search is efficient
            const queue = [...ancestorNode.children];
            while (queue.length > 0) {
                const currentId = queue.shift();
                if (currentId === potentialDescendantId) {
                    return true;
                }
                const currentNode = getters.getNodeFromId(currentId);
                if (currentNode && currentNode.children) {
                    queue.push(...currentNode.children);
                }
            }
            return false;
        },
        activeDropContextId: (state, getters) => {
            return getters.currentTabObj.activeDropContextId
        },
        getParentId: (state, getters) => (childId) => {
            const node = getters.getNodeFromId(childId);
            return node ? node.parent : null;
        }
    },
    mutations: {
        emptyState: function (state, id) {
            const tab = state.tabs.find((tab) => tab.id == id)
            tab.state = null
            tab.tree = null
            tab.mutations = []
        },
        tabAdded: function (state, context) {
            state.tabs.push({
                id: context.id,
                name: context.name,
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
        },
        tabRenamed: function (state, name) {
            state.tabs.find((tab) => tab.id == state.currentTab).name = name
        },
        tabRemoved: function (state, id) {
            const index = state.tabs.findIndex(tab => tab.id === id);
            if (index === -1) return; // Tab not found

            state.tabs.splice(index, 1);
            // If the removed tab was the active one, select a new tab
            if (state.currentTab === id) {
                // If tabs still remain, select a new one
                if (state.tabs.length > 0) {
                    // Select the previous tab, or the first tab if the deleted one was the first
                    const newIndex = Math.max(0, index - 1);
                    state.currentTab = state.tabs[newIndex].id;
                } else {
                    state.currentTab = null;
                }
            }
        },
        tabSelected: function (state, id) {
            state.currentTab = id
        },
        copiedCellSet: function (state, context) {
            state.copiedNode = context
        },
        dragTargetSet: function (state, id) {
            state.tabs.find(tab => tab.id == state.currentTab).target = id
        },
        draggedNodeIdSet: function (state, id) {
            state.tabs.find(tab => tab.id == state.currentTab).draggedNodeId = id
        },
        draggingSet: function (state, isDragging) {
            state.tabs.find(tab => tab.id == state.currentTab).isDragging = isDragging
        },
        activeDropContextSet: function (state, id) {
            state.tabs.find(tab => tab.id == state.currentTab).activeDropContextId = id
        },
        elementHighlighted: function (state, id) {
            state.tabs.find(tab => tab.id == state.currentTab).highlighted = id
        },
        mutationsAppended: function (state, context) {
            // Append a mutation to the history of mutations for the current tab.
            // The mutation is an array with the first element being the name of the mutation
            // and the second element being the context data.
            state.tabs.find(tab => tab.id == state.currentTab).mutations.push(...context)
        },
        mutationHistoryCounterSet: function (state, context) {
            state.tabs.find(tab => tab.id == state.currentTab).count = context.count
        },
        stateSet: function (state, context) {
            // For each action that changes the rust State object, we update the commit history.
            // To allow it to be undone
            const tab = state.tabs.find(tab => tab.id == context.tab)
            updateCommitHistory(state, tab.count, ["stateSet", context], context.push ?? true)
            
            // Depending on the type of the context data, create a new State object
            // We can load from json or hex, or load an example.
            if (context.type == "json") {
                tab.state = State.from_stored(context.data)
            } else if (context.type == "example") {
                tab.state = State.load_example(context.data)
            } else {
                // Load from hex string
                tab.state = new State(context.data)
            }
            
            tab.tree = JSON.parse(tab.state.get_nodes())
        },
        nodeAdded: function (state, context) {
            const tab = state.tabs.find(tab => tab.id == context.tab)
            updateCommitHistory(state, tab.count, ["nodeAdded", context], context.push ?? true)
            tab.state.add_node(
                context.tag, context.content, context.parent, context.label, context.index ?? null
            )
            tab.tree = JSON.parse(tab.state.get_nodes())
        },
        positionAdded: function (state, context) {
            state.tabs.find(tab => tab.id == state.currentTab).positions[context.id] = [context.top, context.height]
        },
        expandedSet: function (state, context) {
            state.tabs.find(tab => tab.id == state.currentTab).expanded[context.id] = context.expanded
        },
        nodeMoved: function (state, context) {
            const tab = state.tabs.find(tab => tab.id == context.tab)
            updateCommitHistory(state, tab.count, ["nodeMoved", context], context.push ?? true)

            tab.state.drag_node(context.id, context.target, context.index)
            tab.tree = JSON.parse(tab.state.get_nodes())
        },
        nodeChanged: function (state, context) {
            const tab = state.tabs.find(tab => tab.id == context.tab)
            updateCommitHistory(state, tab.count, ["nodeChanged", context], context.push ?? true)
            tab.state.adapt_node_all(context.id, context.tag, context.length, context.content)
            tab.tree = JSON.parse(tab.state.get_nodes())
        },
        nodeUpdated: function (state, context) {
            const tab = state.tabs.find(tab => tab.id == context.tab)
            updateCommitHistory(state, tab.count, ["nodeUpdated", context], context.push ?? true)

            // Each part of a node can be changed, field is the name of the field that is changed
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
        },
        nodeRemoved: function (state, context) {
            const tab = state.tabs.find(tab => tab.id == context.tab)
            updateCommitHistory(state, tab.count, ["nodeRemoved", context], context.push ?? true)

            tab.state.remove_node(context.id)
            tab.tree = JSON.parse(tab.state.get_nodes())
        },
    },
    actions: {
        addTab: function (context, name) {
            const id = Math.floor(Math.random() * 100000).toString();
            context.commit("tabAdded", {"id": id, "name": name})
            context.commit("tabSelected", id)
        },
        setAll: function (context, expanded) {
            const setExpanded = (node) => {
                context.commit("expandedSet", {id: node.id, expanded: expanded})
            }

            for (let node of context.getters.currentTabObj.tree) {
                setExpanded(node)
            }
        },
        undo: function (context) {
            // Undo is implemented by decreasing the mutation counter by one and then applying
            // all mutations up to the counter to the empty state
            if (context.getters.currentTabObj.count < 2) {
                // Nothing to undo.
                return
            }

            const mutations = context.getters.currentTabObj.mutations
            const new_count = context.getters.currentTabObj.count - 1

            context.commit("emptyState", context.state.currentTab)

            for (let mutation of mutations.slice(0, new_count)) {
                context.commit(mutation[0], mutation[1])
            }

            // Append the undone mutations to the history of mutations so that they can be redone later
            context.commit("mutationsAppended", mutations.slice(new_count))
            context.commit("mutationHistoryCounterSet", {count: new_count})
        },
        redo: function (context) {
            // To redo the last undone action, we take the next action from the array
            if (context.getters.currentTabObj.count >= context.getters.currentTabObj.mutations.length) {
                // Nothing to redo.
                return
            }

            const mutation = context.getters.currentTabObj.mutations[context.getters.currentTabObj.count]
            let context_commit = mutation[1]
            // When redoing, we do not want to add the mutation again to the history
            context_commit.push = false 
            // Applying the mutation will add it back to the mutations array at the given position and increase counter by one
            context.commit(mutation[0], context_commit)
        }
    },
    modules: {}
})
