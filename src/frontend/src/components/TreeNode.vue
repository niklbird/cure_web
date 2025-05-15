<template>
    <div 
        draggable="true"
        class="tree-node draggable"
        :class="{ 'dragover': $store.getters.isDragOver(node.id) }"
        @contextmenu.stop = "openMenu"
        @mouseover.stop="$store.commit('elementHighlighted', node.id)"
        @mouseleave.stop="$store.commit('elementHighlighted', -1)"
        @dragstart.stop="onDragStart"
        @dragend.stop="onDragEnd"
        @dragover.stop="onDragOver"
        @dragleave.stop="onDragLeave"
    >
        <div 
            class="node-header" 
            @click="toggleExpand"
        >
            <span v-if="hasChildren || isConstructed" class="toggle-icon">{{ isExpanded ? "▼" : "▶" }}</span>
            <span
                v-if="node.tag" 
                class="node-tag"
                ref="tag"
            >
               {{ node.tag[1] }}
            </span>
            <span
                v-if="node.label"
                class="node-label"
                ref="label"
            >
                {{ node.label }}
            </span>
            <span
                v-if="node.length" 
                class="node-length"
                ref="length"
            >
                {{ node.length[1] }}
            </span>
            <span
                v-if="node.content"
                class="node-content" 
                ref="content"
            >
                <span
                    v-if="node.content[1].length < 40 || expandedContent"
                    @click="expandedContent = false"
                >
                    {{ node.content[1] }}
                </span>
                <span
                    v-else
                    @click="expandedContent = true"
                >
                    {{ node.content[1].slice(0, 20) }}...{{ node.content[1].slice(-20) }}
                </span>
            </span>
        </div>
        <div v-if="isExpanded && (hasChildren || isConstructed)" class="children">
            <TreeNode 
                v-for="(child, index) in node.children" 
                :key="index" 
                :node="$store.getters.getNodeFromId(child)" 
                @highlight="(id) => $emit('highlight', id)"
                @rightclick="(x, y, id) => $emit('rightclick', x, y, id)"
            />
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
            return this.node.children && this.node.children.length > 0;
        },
        isConstructed() {
            return this.node.tag[0] == 48 || this.node.tag[0] == 49;
        },
        isExpanded() {
            return this.$store.getters.isExpanded(this.node.id);
        },
    },
    mounted: function () {
        if (this.node.children.length < 2) {
            this.setExpanded(true)
        } else {
            if (!this.$store.getters.isExpanded(this.node.id)) {
                this.setExpanded(false)
            }
        }
    },
    methods: {
        setExpanded(expanded) {
            this.$store.commit("expandedSet", {
                id: this.node.id,
                expanded: expanded
            });
        },
        openMenu (event) {
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

            if (this.$store.getters.target > -1 && this.$store.getters.target != this.node.id) {
                this.$store.commit("nodeMoved", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    target: this.$store.getters.target,
                    index: null
                })

                this.$store.commit("dragTargetSet", -1);
            }
        },
        onDragOver(event) {
            // Allow dropping
            event.preventDefault(); 
            this.$store.commit("dragTargetSet", this.node.id);
        },
        onDragLeave(event) {
            // Allow dropping
            event.preventDefault(); 
            this.$store.commit("dragTargetSet", -1);
        },
        toggleExpand() {
            if (this.hasChildren || this.isConstructed) {
                this.$store.commit("expandedSet", {
                    id: this.node.id,
                    expanded: !this.isExpanded
                });
            }
        }
    },
};
</script>
  
<style scoped>
.tree-node {
    padding-left: 20px; /* Indent children */
}

.node-header {
    cursor: pointer;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    white-space: nowrap;
}

.node-header:hover {
    background-color: rgba(255, 255, 0, 0.1);
}

.tree-node.dragover {
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
    color: #0da860;
    padding: 5px;
}

.node-length {
    color: #ffa500;
    padding: 5px;
}

.node-content {
    color: #ff79c6;
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
  