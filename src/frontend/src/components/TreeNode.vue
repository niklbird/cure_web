<template>
    <div 
        draggable="true"
        class="tree-node draggable"
        @contextmenu.stop="openMenu"
        @touchstart.stop="handleTouchStart"
        @touchend.stop="handleTouchEnd"
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
                v-if="node.label && !simplify"
                class="node-label label"
                ref="label"
            >
                {{ node.label }}
            </span>
            <span
                v-if="node.length && !simplify" 
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
                    @click.stop="expandedContent = true"
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
                @click.stop="expandedContent = false"
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
                    :simplify="simplify"
                /> 
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
        node: Object,
        simplify: Boolean
    },
    emits: ["rightclick"],
    data() {
        return {
            expandedContent: false,
            touchTimer: null, // Timer for long press detection
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
            this.toggleExpand(true)
        }
    },
    methods: {
        // --- START: New methods for touch handling ---
        handleTouchStart(event) {
            // Clear any previous timer
            clearTimeout(this.touchTimer);
            // Start a new timer for 500ms. If the user holds, this will fire.
            this.touchTimer = setTimeout(() => {
                this.openMenu(event);
            }, 500);
        },
        handleTouchEnd() {
            // If the user lifts their finger before the timer finishes, cancel it.
            clearTimeout(this.touchTimer);
        },
        // --- END: New methods for touch handling ---
        openMenu (event) {
            event.preventDefault();
            
            // Use touch coordinates if they exist, otherwise use mouse coordinates
            const clientX = event.touches ? event.touches[0].clientX : event.clientX;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;

            this.$emit("rightclick", clientX, clientY, this.node.id);
        },
        onDragStart(event) {
            event.target.style.opacity = "0.4"; 
        },
        onDragEnd(event) {
            event.target.style.opacity = ""; 
            if (this.$store.getters.target !== -1 && this.$store.getters.target[0] != this.node.id) {
                this.$store.commit("nodeMoved", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    target: this.$store.getters.target[0],
                    index: this.$store.getters.target[1]
                })
            }
            this.$store.commit("dragTargetSet", -1);
        },
        onDragOver(event, index) {
            event.preventDefault(); 
            this.$store.commit("expandedSet", {
                id: this.node.id,
                expanded: true
            });
            this.$store.commit("dragTargetSet", [this.node.id, index]);
        },
        onDragLeave(event) {
            event.preventDefault(); 
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
    padding-left: 20px; /* Default indent for desktop */
}

.expanded-line {
  height: 100px;
  white-space: normal;
  background-color: rgba(255, 255, 0, 0.1);
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
    background-color: rgba(255, 255, 0, 0.1);
}

.dragover {
    background-color: rgba(255, 255, 0, 0.1);
}

.toggle-icon {
    margin-right: 6px;
    color: lightgray;
    cursor: pointer;
}

.node-tag, .node-label, .node-length, .node-content {
    padding: 5px; /* Default padding for desktop */
}

.node-tag {
    font-weight: bold;
    color: #7EBDC2;
}

.children {
    border-left: 2px solid rgba(255, 255, 255, 0.2);
    margin-left: 10px;  /* Default child indent for desktop */
    padding-left: 10px; /* Default child indent for desktop */
}

.draggable {
    cursor: move;
    user-select: none;
}

/* --- START: New Responsive Styles for Mobile --- */
@media (max-width: 768px) {
    .tree-node {
        padding-left: 10px; /* Reduced indentation */
        font-size: 0.9rem;   /* Slightly smaller font */
    }

    .children {
        margin-left: 5px;   /* Tighter margin for child nodes */
        padding-left: 8px;  /* Tighter padding for child nodes */
    }

    .node-tag, .node-label, .node-length, .node-content {
        padding: 3px;       /* Reduced padding within the node header */
    }

    .toggle-icon {
        margin-right: 4px;  /* Less space for the toggle icon */
    }
}
/* --- END: New Responsive Styles for Mobile --- */
</style>