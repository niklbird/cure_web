import { createStore } from 'vuex'
import { State } from "@/rust/cure_web"


export default createStore({
    state: {
        tabs: {},
        mutations: {},
        currentTab: 0,
    },
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
            if (Object.keys(state.tabs).length == 0) {
                return {}
            }
            return state.tabs[state.currentTab].positions
        },
        tabs: (state) => {
            return Object.values(state.tabs)
        },
        name: (state) => {
            if (Object.keys(state.tabs).length == 0) {
                return null
            }
            return state.tabs[state.currentTab].name
        },
        state: (state) => {
            if (Object.keys(state.tabs).length == 0) {
                return null
            }
            return state.tabs[state.currentTab].state
        },
        tree: (state) => {
            if (Object.keys(state.tabs).length == 0) {
                return []
            }
            return state.tabs[state.currentTab].tree
        },
        highlighted: (state) => {
            if (Object.keys(state.tabs).length == 0) {
                return -1
            }
            return state.tabs[state.currentTab].highlighted
        },
        isExpanded: (state) => (id) => {
            if (Object.keys(state.tabs).length == 0) {
                return false
            }

            return state.tabs[state.currentTab].expanded[id]
        },
        isDragOver: (state) => (id) => {
            if (Object.keys(state.tabs).length == 0) {
                return false
            }
            return state.tabs[state.currentTab].dragTarget == id
        },
        target: (state) => {
            if (Object.keys(state.tabs).length == 0) {
                return -1
            }
            return state.tabs[state.currentTab].dragTarget
        }
    },
    mutations: {
        emptyState: function (state, tab) {
            state.tabs[tab].state = null
            state.tabs[tab].tree = null
        },
        tabAdded: function (state, name) {
            const id = Object.keys(state.tabs).length == 0 ? 0 : Math.random()
            state.tabs[id] = {
                id: id,
                name: name,
                state: null,
                tree: null,
                positions: {},
                expanded: {},
                highlighted: -1,
                dragTarget: -1,
                copiedCell: null,
                mutations: [],
                count: 0
            }

            state.currentTab = id
        },
        tabRenamed: function (state, name) {
            state.tabs[state.currentTab].name = name
        },
        tabRemoved: function (state, id) {
            if ((state.currentTab == id) && (Object.keys(state.tabs).filter((key) => key !== id).length > 1)) {
                state.currentTab = Object.keys(state.tabs)[0]
            }

            delete state.tabs[id]
        },
        tabSelected: function (state, id) {
            state.currentTab = id
        },
        copiedCellSet: function (state, context) {
            state.copiedCell = context
        },
        dragTargetSet: function (state, id) {
            state.tabs[state.currentTab].dragTarget = id
        },
        elementHighlighted: function (state, id) {
            state.tabs[state.currentTab].highlighted = id
        },
        mutationHistoryCounterSet: function (state, context) {
            state.tabs[state.currentTab].count = context.count
        },
        stateSet: function (state, context) {
            state.tabs[context.tab].mutations.splice(state.tabs[context.tab]["count"], 0, ["stateSet", context])
            state.tabs[context.tab].count += 1

            let app_state = null;
            if (context.type == "json") {
                app_state = State.from_stored(context.data)
            } else {
                app_state = new State(context.data)
            }
            
            const tree = JSON.parse(app_state.get_nodes())

            state.tabs[context.tab].state = app_state
            state.tabs[context.tab].tree = tree
        },
        nodeAdded: function (state, context) {
            state.tabs[context.tab].mutations.splice(state.tabs[context.tab]["count"], 0, ["nodeAdded", context])
            state.tabs[context.tab].count += 1

            state.tabs[context.tab].state.add_node(
                context.typ, context.content, context.parent, context.label
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
            state.tabs[context.tab].mutations.splice(state.tabs[context.tab]["count"], 0, ["nodeMoved", context])
            state.tabs[context.tab].count += 1

            state.tabs[context.tab].state.drag_node(context.id, context.target, context.index)
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
        nodeUpdated: function (state, context) {
            state.tabs[context.tab].mutations.splice(state.tabs[context.tab]["count"], 0, ["nodeUpdated", context])
            state.tabs[context.tab].count += 1

            if (context.field == "content") {
                state.tabs[context.tab].state.adapt_node_content(context.id, context.value)
            }
            if (context.field == "length") {
                state.tabs[context.tab].state.adapt_node_length(context.id, context.value)
            }
            if (context.field == "tag") {
                state.tabs[context.tab].state.adapt_node_tag(context.id, context.value)
            }
            if (context.field == "label") {
                state.tabs[context.tab].state.adapt_node_label(context.id, context.value)
            }
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
        nodeRemoved: function (state, context) {
            state.tabs[context.tab].mutations.splice(state.tabs[context.tab]["count"], 0, ["nodeRemoved", context])
            state.tabs[context.tab].count += 1

            state.tabs[context.tab].state.remove_node(context.id)
            state.tabs[context.tab].tree = JSON.parse(state.tabs[context.tab].state.get_nodes())
        },
    },
    actions: {
        undo: function (context) {
            const mutations = context.state.tabs[context.state.currentTab].mutations
            const new_count = context.state.tabs[context.state.currentTab].count - 1

            context.commit("emptyState", context.state.currentTab)

            for (let mutation of mutations.slice(0, new_count)) {
                context.commit(mutation[0], mutation[1])
            }
            context.commit("mutationHistoryCounterSet", {
                id: context.state.tabs[context.state.currentTab].id,
                count: new_count
            })
        },
        redo: function (context) {
            const new_count = context.state.tabs[context.state.currentTab].count + 1
            const mutation = context.state.tabs[context.state.currentTab].mutations[new_count - 1]
            context.commit(mutation[0], mutation[1])
        }
    },
    modules: {}
})
