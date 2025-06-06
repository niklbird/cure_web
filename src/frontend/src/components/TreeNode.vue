<template>
    <div 
        draggable="true"
        class="tree-node draggable"
        @contextmenu.stop = "openMenu"
        @mouseover.stop="$store.commit('elementHighlighted', node.id)"
        @mouseleave.stop="$store.commit('elementHighlighted', -1)"
        @dragstart.stop="onDragStart"
        @dragend.stop="onDragEnd"
    >
        <div 
            class="node-header"  
            :class="{ 'dragover': $store.getters.isDragOver(node.id, 0) }"
            @click="toggleExpand()"
            @dragover="(event) => onDragOver(event, 0)"
            @dragleave="(event) => onDragLeave(event, 0)"
        >
            <span v-if="hasChildren || isConstructed" class="toggle-icon">{{ isExpanded ? "▼" : "▶" }}</span>
            <span
                v-if="node.tag" 
                class="node-tag tag"
                ref="tag"
            >
                {{ node.tag[1] }}
            </span>
            <span
                v-if="node.label"
                class="node-label label"
                ref="label"
            >
                {{ node.label }}
            </span>
            <span
                v-if="node.length" 
                class="node-length length"
                ref="length"
            >
                {{ node.length[1] }}
            </span>         
            <span
                v-if="node.content && !expandedContent"
                class="node-content content"
                ref="content"
            >
                <span
                    v-if="node.content[1].length > 40"
                    @click="expandedContent = true"
                >
                    {{ node.content[1].slice(0, 20) }}...{{ node.content[1].slice(-20) }}
                </span>
                <span
                    v-else
                >
                    {{ node.content[1] }}
                </span>
            </span>                       
        </div>
        <div
            class="node-header"
            v-if="node.content && expandedContent"
        >
            <span
                class="node-content" 
                ref="content"
                @click="expandedContent = false"
            >
                {{ node.content[1] }}
            </span>            
        </div>
        <div v-if="isExpanded && (hasChildren || isConstructed)" class="children">
            <div
                v-for="(child, index) in node.children" 
                :key="index"
            >
                <TreeNode 
                    :node="$store.getters.getNodeFromId(child)" 
                    @highlight="(id) => $emit('highlight', id)"
                    @rightclick="(x, y, id) => $emit('rightclick', x, y, id)"
                /> 
                <!-- 
                    TODO: This div is currently unused and drag and drop will always enter
                    an element at index 0, goal would be to allow dropping elements at a specific
                    index of a list. When dragging an object over a list, there should be expanding
                    blank spaces allowing to drop the element between children.
                -->
                <div 
                    @dragover="(event) => onDragOver(event, index)"
                    @dragleave="(event) => onDragLeave(event, index)"
                    class="children"
                    style="height: 1px;"
                    :class="{ 'expanded-line': $store.getters.isDragOver(child.id, 0) }"
                ></div>               
            </div>

        </div>
        
    </div>
</template>

<script>
export default {
    props: {
        node: Object
    },
    emits: ["rightclick"],
    data() {
        return {
            expandedContent: false,
        };
    },
    computed: {
        hasChildren() {
            // Check if the node has children
            return this.node.children && this.node.children.length > 0;
        },
        isConstructed() {
            // 48 is the tag for the ASN type SEQUENCE and 49 for SET
            return this.node.tag[0] == 48 || this.node.tag[0] == 49;
        },
        isExpanded() {
            // check if the children are currently shown
            return this.$store.getters.isExpanded(this.node.id);
        },
    },
    mounted: function () {
        // Parents with only one child should be expanded by default
        if (this.node.children.length < 2) {
            this.toggleExpand(true)
        }
    },
    methods: {
        openMenu (event) {
            // Open the context menu defined in the editor view for the clicked node
            // preventDefault prevents the regular browser context menu from showing
            event.preventDefault();
            this.$emit("rightclick", event.clientX, event.clientY, this.node.id);
        },
        onDragStart(event) {
            // Make the dragged element semi-transparent
            event.target.style.opacity = "0.4"; 
        },
        onDragEnd(event) {
            // Reset opacity
            event.target.style.opacity = ""; 

            // Check if the drag ended over another element and not over itself
            if (this.$store.getters.target !== -1 && this.$store.getters.target[0] != this.node.id) {
                // Move element to new location
                this.$store.commit("nodeMoved", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    target: this.$store.getters.target[0],
                    index: this.$store.getters.target[1]
                })
            }
            // Reset drag target so that highlighting stops
            this.$store.commit("dragTargetSet", -1);
        },
        onDragOver(event, index) {
            // Allow dropping, not sure what the browser default here is, 
            // prevent it from happening anyway
            event.preventDefault(); 
            // Set drag target to the node currently dragged over
            this.$store.commit("expandedSet", {
                id: this.node.id,
                expanded: true
            });
            this.$store.commit("dragTargetSet", [this.node.id, index]);
        },
        onDragLeave(event) {
            // See above
            event.preventDefault(); 
            // no longer dragged over, remove drag target so an element dropped anywhere besides on a node
            // jumps back into its old position
            this.$store.commit("dragTargetSet", [-1, -1]);
        },
        toggleExpand(value = null) {
            this.$store.commit("expandedSet", {
                id: this.node.id,
                expanded: value !== null ? value : !this.isExpanded
            });
        }
    },
};
</script>
  
<style scoped>
.tree-node {
    padding-left: 20px; /* Indent children */
}

.expanded-line {
  height: 100px; /* allow full height */
  white-space: normal; /* allow wrapping */
  background-color: rgba(255, 255, 0, 0.1); /* highlight color */
  box-shadow: 0 0 5px rgba(255, 255, 0, 0.1);
}

.node-header {
    cursor: pointer;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.node-header:hover {
    background-color: rgba(255, 255, 0, 0.1); /* Changes background color when hovered over automatically */
}

.dragover {
    background-color: rgba(255, 255, 0, 0.1); /* Change the background color when dragged over */
}

.toggle-icon {
    margin-right: 6px;
    color: lightgray;
    cursor: pointer;
}

.node-tag {
    font-weight: bold;
    color: #61dafb;
    padding: 5px;
}

.node-label {
    padding: 5px;
}

.node-length {
    padding: 5px;
}

.node-content {
    padding: 5px;
}

.children {
    border-left: 2px solid rgba(255, 255, 255, 0.2);
    margin-left: 10px;
    padding-left: 10px;
}

.draggable {
    cursor: move;
    user-select: none;
}
</style>
  