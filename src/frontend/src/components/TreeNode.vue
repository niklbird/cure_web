<template>
    <div 
        :draggable="!isMobile"
        class="tree-node draggable"
        @contextmenu.stop="openMenu"
        @touchstart.stop="handleTouchStart"
        @touchend.stop="handleTouchEnd"
        @mouseover.stop="store.elementHighlighted(node.id)"
        @mouseleave.stop="store.elementHighlighted(-1)"
        @dragstart.stop="onDragStart"
        @dragend.stop="onDragEnd"
    >
        <div 
            class="node-header"  
            :class="{ 'dragover': isDragOver(node.children.length), 'modified': node.edited }"
            @click="toggleExpand()"
            @dragover.prevent="(event) => onDragOver(event, node.children.length)"
            @dragleave="onDragLeave"
        >
            <span v-if="hasChildren || isConstructed" class="toggle-icon">{{ isExpanded ? "▼" : "▶" }}</span>
            <span v-if="node.tag && !simplify" class="node-tag tag" ref="tag">{{ node.tag[1] }}</span>
            <span v-if="node.label" class="node-label label" ref="label">{{ node.label }}</span>
            <span v-if="node.length && !simplify" class="node-length length" ref="length">{{ node.length[1] }}</span>
            <span v-if="node.content && !expandedContent" class="node-content content" ref="content">
                <span v-if="node.content[1].length > 40" @click.stop="expandedContent = true">
                    {{ node.content[1].slice(0, 20) }}...{{ node.content[1].slice(-20) }}
                </span>
                <span v-else>{{ node.content[1] }}</span>
            </span>
        </div>
        <div class="node-header" v-if="node.content && expandedContent">
            <span class="node-content" ref="content" @click.stop="expandedContent = false">{{ node.content[1] }}</span>
        </div>
        
        <div v-if="isExpanded && (hasChildren || isConstructed)" class="children">
            <div 
                v-if="showDropZones"
                class="drop-zone"
                :class="{ 'dragover-active': isDragOver(0) }"
                @dragover.prevent="(event) => onDragOver(event, 0)"
                @dragleave="onDragLeave"
            ></div>

            <div v-for="(child, index) in node.children" :key="child.id || index">
                <TreeNode 
                    :node="store.getNodeFromId(child)" 
                    @highlight="(id) => $emit('highlight', id)"
                    @rightclick="(x, y, id) => $emit('rightclick', x, y, id)"
                    :simplify="simplify"
                /> 
                <div 
                    v-if="showDropZones && (index < node.children.length - 1 || isDragOver(node.children.length))"
                    class="drop-zone"
                    :class="{ 'dragover-active': isDragOver(index + 1) }"
                    @dragover.prevent="(event) => onDragOver(event, index + 1, true)"
                    @dragleave="onDragLeave"
                ></div>
            </div>
        </div>
    </div>
</template>

<script>
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'

export default {
    setup() {
        const { mobile } = useDisplay()
        const store = useTabsStore()

        return { isMobile: mobile, store }
    },
    props: {
        node: Object,
        simplify: Boolean
    },
    emits: ["rightclick"],
    data() {
        return {
            expandedContent: false
        }
    },
    computed: {
        showDropZones() {
            return this.store.isDragging
        },
        hasChildren() {
            return this.node.children && this.node.children.length > 0
        },
        isConstructed() {
            return this.node.tag[0] == 48 || this.node.tag[0] == 49
        },
        isExpanded() {
            return this.store.isExpanded(this.node.id)
        }
    },
    mounted() {
        if (this.node.children.length < 2) {
            this.toggleExpand(true)
        }
    },
    methods: {
        openMenu(event) {
            event.preventDefault()
            const clientX = event.touches ? event.touches[0].clientX : event.clientX
            const clientY = event.touches ? event.touches[0].clientY : event.clientY
            this.$emit("rightclick", clientX, clientY, this.node.id)
        },
        onDragStart(event) {
            event.dataTransfer.effectAllowed = 'move'
            event.target.style.opacity = "0.4"
            this.store.draggingSet(true)
            this.store.draggedNodeIdSet(this.node.id)
        },
        onDragEnd(event) {
            event.target.style.opacity = ""
            const target = this.store.target
            const draggedId = this.store.draggedNodeId
            
            if ((target[0] !== -1) && (target[0] != this.node.id) && !this.store.isDescendant(draggedId, target[0])) {
                this.store.nodeMoved({
                    tab: this.store.currentTab,
                    id: this.node.id,
                    target: target[0],
                    index: target[1]
                })
            }
            
            this.store.dragTargetSet(-1)
            this.store.draggingSet(false)
            this.store.draggedNodeIdSet(null)
            this.store.activeDropContextSet(null)
        },
        onDragOver(event, index, isDropZone = false) {
            const parentId = this.node.parent
            this.store.activeDropContextSet(isDropZone ? this.node.id : parentId || this.node.id)
            this.store.dragTargetSet([this.node.id, index])
        },
        onDragLeave() {
            this.store.dragTargetSet([-1, -1])
        },
        isDragOver(index) {
            const target = this.store.target
            return target && target[0] === this.node.id && target[1] === index
        },
        toggleExpand(value = null) {
            this.store.expandedSet({
                id: this.node.id,
                expanded: value !== null ? value : !this.isExpanded
            })
        }
    }
}
</script>

<style scoped>
.tree-node {
    padding-left: 20px;
}

.drop-zone {
    height: 5px;
    border: 1px dashed rgba(0, 0, 0, 0.5);
}

.drop-zone.dragover-active {
    height: 20px;
    background-color: rgba(255, 255, 0, 0.2);
    border-radius: 4px;
    margin: 2px 0;
}

.node-header {
    cursor: pointer;
    padding: 4px 6px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    border-radius: 4px;
}

.modified {
    background-color: rgb(var(--v-theme-modified));
}

.node-header:hover {
    background-color: rgba(255, 255, 0, 0.1);
}

.node-header.dragover {
    background-color: rgba(255, 255, 0, 0.2);
}

.toggle-icon {
    margin-right: 6px;
    color: lightgray;
    cursor: pointer;
}

.node-tag, .node-label, .node-length, .node-content {
    padding: 5px;
}

.node-tag {
    font-weight: bold;
    color: #7EBDC2;
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

@media (max-width: 768px) {
    .tree-node {
        padding-left: 10px;
        font-size: 0.9rem;
    }

    .children {
        margin-left: 5px;
        padding-left: 8px;
    }

    .node-tag, .node-label, .node-length, .node-content {
        padding: 3px;
    }

    .toggle-icon {
        margin-right: 4px;
    }
}
</style>