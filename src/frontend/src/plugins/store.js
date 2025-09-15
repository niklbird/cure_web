// Setup of the vuex-store plugin, documentation at: https://vuex.vuejs.org/#what-is-a-state-management-pattern
// The state of the application is managed and modified only through mutations defined here.

// [getters] give access to the state of the application, in views and components they can be accessed like:
// `this.$store.getters.getNodeFromId(id)`
// [mutations] are functions that modify the state of the application, they can be called like:
// `this.$store.commit('nodeAdded', context)`

import { createStore } from 'vuex'
import { State } from "@/rust/cure_web"


function updateCommitHistory(state, count, mutation) {
    // Add a new mutation to the history of mutations for the current tab.
    state.tabs[mutation[1].tab].mutations.splice(count, 0, mutation)
    state.tabs[mutation[1].tab].count += 1
}


export default createStore({
    // Set initial state, we have an object of tabs, and the currently selected tab.
    // -1 means no tab is selected
    state: {
        tabs: {},
        currentTab: -1 
    },
    // Getters as described above.
    getters: {
        getNodeFromId: (state) => (id) => {
            let candidates = state.tabs[state.currentTab].tree.filter((node) => node.id == id)

            if (candidates.length > 0) {
                return candidates[0]
            } else {
                return {
                    children: []
                }
            }  
        },
        positions: (state) => {
            // Check if a tab is selected, if not return an empty object
            return state.currentTab > -1 ? state.tabs[state.currentTab].positions : {}
        },
        tabs: (state) => {
            // Return a list of all tab objects
            return Object.values(state.tabs)
        },
        name: (state) => {
            return state.currentTab > -1 ? state.tabs[state.currentTab].name : null
        },
        state: (state) => {
            return state.currentTab > -1 ? state.tabs[state.currentTab].state : null
        },
        tree: (state) => {
            return state.currentTab > -1 ? state.tabs[state.currentTab].tree : []
        },
        highlighted: (state) => {
            return state.currentTab > -1 ? state.tabs[state.currentTab].highlighted : -1
        },
        isExpanded: (state) => (id) => {
            return state.currentTab > -1 ? state.tabs[state.currentTab].expanded[id] ?? false : false
        },
        isDragOver: (state) => (id, index) => {
            const dropTarget = state.currentTab > -1 ? state.tabs[state.currentTab].dragTarget : [-1, -1]

            // Drop Target is a list with two indices:
            // the first is the id of the node that is being dragged over,
            // if the node is a SEQUENCE or SET, the second is the index of the child being hovered over,
            // so that elements can be dropped at a specific position.
            return (dropTarget[0] == id) && (dropTarget[1] == index)
        },
        target: (state) => {
            return state.currentTab < 0 ? -1 : state.tabs[state.currentTab].dragTarget
        },
        anyExpanded: (state) => {
            if (state.currentTab < 0) {
                return false
            }

            return Object.values(state.tabs[state.currentTab].expanded).some((value) => value)
        }
    },
    mutations: {
        emptyState: function (state, tab) {
            state.tabs[tab].state = null
            state.tabs[tab].tree = null
            state.tabs[tab].mutations = []
        },
        tabAdded: function (state, name) {
            const id = Object.keys(state.tabs).length == 0 ? 0 : Math.random()
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
            state.tabs[id] = {
                id: id,
                name: name,
                state: null,
                tree: null,
                positions: {},
                expanded: {},
                highlighted: -1,
                dragTarget: -1,
                copiedNode: null,
                mutations: [],
                count: 0
            }

            state.currentTab = id
        },
        tabRenamed: function (state, name) {
            state.tabs[state.currentTab].name = name
        },
        tabRemoved: function (state, id) {
            // If the currently selected tab is removed, select another one if possible.
            if ((state.currentTab == id) && state.tabs.length > 1) {
                state.currentTab = Object.keys(state.tabs).filter((key) => key != id)[0]
            } else if (state.currentTab == id) {
                state.currentTab = -1
            }

            delete state.tabs[id]
        },
        tabSelected: function (state, id) {
            state.currentTab = id
        },
        copiedCellSet: function (state, context) {
            state.copiedNode = context
        },
        dragTargetSet: function (state, id) {
            state.tabs[state.currentTab].dragTarget = id
        },
        elementHighlighted: function (state, id) {
            state.tabs[state.currentTab].highlighted = id
        },
        mutationsAppended: function (state, context) {
            // Append a mutation to the history of mutations for the current tab.
            // The mutation is an array with the first element being the name of the mutation
            // and the second element being the context data.
            state.tabs[state.currentTab].mutations.push(...context)
        },
        mutationHistoryCounterSet: function (state, context) {
            state.tabs[state.currentTab].count = context.count
        },
        stateSet: function (state, context) {
            // For each action that changes the rust State object, we update the commit history.
            // To allow it to be undone
            updateCommitHistory(state, state.tabs[context.tab].count, ["stateSet", context])

            // Depending on the type of the context data, create a new State object
            // We can load from json or hex, or load an example.
            if (context.type == "json") {
                state.tabs[context.tab].state = State.from_stored(context.data)
            } else if (context.type == "example") {
                state.tabs[context.tab].state = State.load_example(context.data)
            } else {
                // Load from hex string
                state.tabs[context.tab].state = new State(context.data)
            }
            
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
        nodeAdded: function (state, context) {
            updateCommitHistory(state, state.tabs[context.tab].count, ["nodeAdded", context])

            state.tabs[context.tab].state.add_node(
                context.tag, context.content, context.parent, context.label
            )
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
        positionAdded: function (state, context) {
            state.tabs[state.currentTab].positions[context.id] = [context.top, context.height]
        },
        expandedSet: function (state, context) {
            state.tabs[state.currentTab].expanded[context.id] = context.expanded
        },
        nodeMoved: function (state, context) {
            updateCommitHistory(state, state.tabs[context.tab].count, ["nodeMoved", context])

            state.tabs[context.tab].state.drag_node(context.id, context.target, context.index)
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
        nodeUpdated: function (state, context) {
            updateCommitHistory(state, state.tabs[context.tab].count, ["nodeUpdated", context])

            // Each part of a node can be changed, field is the name of the field that is changed
            switch (context.field) {
                case "content":
                    state.tabs[context.tab].state.adapt_node_content(context.id, context.value)
                    break
                case "length":
                    state.tabs[context.tab].state.adapt_node_length(context.id, context.value)
                    break
                case "tag":
                    state.tabs[context.tab].state.adapt_node_tag(context.id, context.value)
                    break
                case "label":
                    state.tabs[context.tab].state.adapt_node_label(context.id, context.value)
                    break
                default:
                    console.warn("Unknown field to update:", context.field)
            }
            
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
        nodeRemoved: function (state, context) {
            updateCommitHistory(state, state.tabs[context.tab].count, ["nodeRemoved", context])

            state.tabs[context.tab].state.remove_node(context.id)
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
    },
    actions: {
        setAll: function (context, expanded) {
            // Expand all nodes in the current tab
            const setExpanded = (node) => {
                context.commit("expandedSet", {id: node.id, expanded: expanded})
            }

            for (let node of context.state.tabs[context.state.currentTab].tree) {
                setExpanded(node)
            }
        },
        undo: function (context) {
            // Undo is implemented by decreasing the mutation counter by one and then applying
            // all mutations up to the counter to the empty state
            const mutations = context.state.tabs[context.state.currentTab].mutations
            const new_count = context.state.tabs[context.state.currentTab].count - 1

            context.commit("emptyState", context.state.currentTab)

            for (let mutation of mutations.slice(0, new_count)) {
                context.commit(mutation[0], mutation[1])
            }

            // Append the undone mutations to the history of mutations so that they can be redone later
            context.commit("mutationsAppended", mutations.slice(new_count))
        },
        redo: function (context) {
            // To redo the last undone action, we take the next action from the array
            const mutation = context.state.tabs[context.state.currentTab].mutations.splice(context.state.tabs[context.state.currentTab].count, 1)

            // Applying the mutation will add it back to the mutations array at the given position and increase counter by one
            context.commit(mutation[0], mutation[1])
        }
    },
    modules: {}
})
