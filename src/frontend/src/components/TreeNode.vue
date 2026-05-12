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
      :class="{ dragover: isDragOverSelf(node.children.length), modified: node.edited }"
      @click="toggleExpand()"
      @dragover.prevent="(event: DragEvent) => onDragOver(event, node.children.length)"
      @dragleave="onDragLeave"
    >
      <span v-if="hasChildren || isConstructed" class="toggle-icon">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span v-if="node.tag && !simplify" class="node-tag tag" ref="tagRef">{{ node.tag[1] }}</span>
      <span v-if="node.label" class="node-label label" ref="labelRef">{{ node.label }}</span>
      <span v-if="node.length && !simplify" class="node-length length" ref="lengthRef">{{ node.length[1] }}</span>
      <span v-if="node.content && !expandedContent" class="node-content content" ref="contentRef">
        <span v-if="node.content[1].length > 40" @click.stop="expandedContent = true">
          {{ node.content[1].slice(0, 20) }}...{{ node.content[1].slice(-20) }}
        </span>
        <span v-else>{{ node.content[1] }}</span>
      </span>
    </div>
    <div class="node-header" v-if="node.content && expandedContent">
      <span class="node-content" ref="contentRef" @click.stop="expandedContent = false">
        {{ node.content[1] }}
      </span>
    </div>

    <div v-if="isExpanded && (hasChildren || isConstructed)" class="children">
      <div
        v-if="showDropZones"
        class="drop-zone"
        :class="{ 'dragover-active': isDragOverSelf(0) }"
        @dragover.prevent="(event: DragEvent) => onDragOver(event, 0)"
        @dragleave="onDragLeave"
      />

      <div v-for="(child, index) in node.children" :key="child">
        <TreeNodeComponent
          :node="store.getNodeFromId(child)"
          :simplify="simplify"
          @rightclick="(x: number, y: number, id: number) => emit('rightclick', x, y, id)"
        />
        <div
          v-if="showDropZones && (index < node.children.length - 1 || isDragOverSelf(node.children.length))"
          class="drop-zone"
          :class="{ 'dragover-active': isDragOverSelf(index + 1) }"
          @dragover.prevent="(event: DragEvent) => onDragOver(event, index + 1, true)"
          @dragleave="onDragLeave"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * TreeNodeComponent — recursive ASN.1 tree node.
 *
 * We use `defineOptions({ name: 'TreeNodeComponent' })` so the recursive
 * `<TreeNodeComponent>` reference in the template resolves correctly.
 */
import { ref, computed, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'
import type { TreeNode as TreeNodeType } from '@/types/editor'

defineOptions({ name: 'TreeNodeComponent' })

const { mobile: isMobile } = useDisplay()
const store = useTabsStore()

const props = defineProps<{
  node: TreeNodeType
  simplify?: boolean
}>()

const emit = defineEmits<{
  rightclick: [x: number, y: number, id: number]
}>()

const expandedContent = ref(false)

// Refs for DOM elements (kept for potential future use)
const tagRef = ref<HTMLElement | null>(null)
const labelRef = ref<HTMLElement | null>(null)
const lengthRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const showDropZones = computed(() => store.isDragging)

const hasChildren = computed(() => {
  return props.node.children && props.node.children.length > 0
})

const isConstructed = computed(() => {
  return props.node.tag[0] === 48 || props.node.tag[0] === 49
})

const isExpanded = computed(() => store.isExpanded(props.node.id))

onMounted(() => {
  if (props.node.children.length < 2) {
    toggleExpand(true)
  }
})

function openMenu(event: MouseEvent | TouchEvent): void {
  event.preventDefault()
  const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
  const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
  emit('rightclick', clientX, clientY, props.node.id)
}

function handleTouchStart(_event: TouchEvent): void {
  // placeholder for long-press context menu on mobile
}

function handleTouchEnd(_event: TouchEvent): void {
  // placeholder
}

function onDragStart(event: DragEvent): void {
  event.dataTransfer!.effectAllowed = 'move'
  ;(event.target as HTMLElement).style.opacity = '0.4'
  store.draggingSet(true)
  store.draggedNodeIdSet(props.node.id)
}

function onDragEnd(event: DragEvent): void {
  ;(event.target as HTMLElement).style.opacity = ''
  const t = store.target
  const draggedId = store.draggedNodeId

  if (
    t[0] !== -1 &&
    t[0] !== props.node.id &&
    !store.isDescendant(draggedId!, t[0])
  ) {
    store.nodeMoved({
      tab: store.currentTab,
      id: props.node.id,
      target: t[0],
      index: t[1]
    })
  }

  store.dragTargetSet([-1, -1])
  store.draggingSet(false)
  store.draggedNodeIdSet(null)
  store.activeDropContextSet(null)
}

function onDragOver(_event: DragEvent, index: number, isDropZone = false): void {
  const parentId = props.node.parent
  store.activeDropContextSet(isDropZone ? props.node.id : parentId ?? props.node.id)
  store.dragTargetSet([props.node.id, index])
}

function onDragLeave(): void {
  store.dragTargetSet([-1, -1])
}

function isDragOverSelf(index: number): boolean {
  const t = store.target
  return t[0] === props.node.id && t[1] === index
}

function toggleExpand(value: boolean | null = null): void {
  store.expandedSet({
    id: props.node.id,
    expanded: value !== null ? value : !isExpanded.value
  })
}
</script>

<style scoped>
.tree-node {
  padding-left: 5px;
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
  padding: 0;
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

.node-tag,
.node-label,
.node-length,
.node-content {
  padding-right: 8px;
}

.node-tag {
  font-weight: bold;
  color: #7ebdc2;
}

.children {
  border-left: 2px solid rgba(100, 100, 100, 0.2);
  margin-left: 3px;
  padding-left: 8px;
  /* adds spacing after deeply nested items */
  padding-bottom: 2px;
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
    margin-left: 0px !important;
    margin-left: 5px;
    padding-left: 8px;
  }
  .node-tag,
  .node-label,
  .node-length,
  .node-content {
    padding: 3px;
  }
  .toggle-icon {
    margin-right: 4px;
  }
}
</style>