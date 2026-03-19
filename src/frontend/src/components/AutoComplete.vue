<template>
  <v-row justify="center" class="mb-4" width="100%">
    <v-col cols="12">
      <div
        ref="autocompleteContainer"
        style="position: relative; width: 100%;"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent.stop="moveSelection(-1)"
        @keydown.enter.prevent.stop="selectSuggestion()"
      >
        <v-text-field
          ref="inputField"
          v-model="query"
          @focus="onFocus"
          @input="showSelection = true"
          @blur="onBlur"
          type="text"
          placeholder="Search..."
          style="width: 100%; height: 2.5rem;"
        />

        <Teleport to="body">
          <v-list
            v-show="showSelection && suggestions.length > 0"
            class="autocomplete-dropdown elevation-8"
            :style="dropdownStyle"
          >
            <v-list-item
              v-for="(suggestion, index) in suggestions"
              :key="index"
              :class="['suggestion', { selected: index === selectedIndex }]"
              @mousedown.prevent="selectSuggestion(index); showSelection = false"
            >
              <v-list-item-title v-text="suggestion" />
            </v-list-item>
          </v-list>
        </Teleport>
      </div>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, type CSSProperties } from 'vue'

const showSelection = ref(false)
const inputField = ref<InstanceType<any> | null>(null)
const autocompleteContainer = ref<HTMLDivElement | null>(null)
const dropdownStyle = ref<CSSProperties>({})

const query = defineModel<string>({ default: '' })

const props = defineProps<{
  completions?: string[]
}>()

const suggestions = ref<string[]>([])
const selectedIndex = ref(-1)

function updateDropdownPosition(): void {
  if (!autocompleteContainer.value) return

  const rect = autocompleteContainer.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: '200px',
    overflowY: 'auto',
    zIndex: 9999
  }
}

function onFocus(): void {
  showSelection.value = true
  updateDropdownPosition()
}

function onBlur(): void {
  setTimeout(() => {
    showSelection.value = false
  }, 150)
}

function handleScrollOrResize(): void {
  if (showSelection.value) {
    updateDropdownPosition()
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScrollOrResize, true)
  window.addEventListener('resize', handleScrollOrResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScrollOrResize, true)
  window.removeEventListener('resize', handleScrollOrResize)
})

watch(query, (val) => {
  if (val) {
    fetchSuggestions(val)
  } else {
    suggestions.value = []
    selectedIndex.value = -1
  }
})

watch(showSelection, (val) => {
  if (val) {
    nextTick(() => updateDropdownPosition())
  }
})

function fetchSuggestions(q: string): void {
  const allSuggestions = [q, ...(props.completions ?? [])]
  suggestions.value = allSuggestions.filter(s => s.toLowerCase().includes(q.toLowerCase()))
  selectedIndex.value = 0
}

function moveSelection(direction: number): void {
  if (!suggestions.value.length) return
  selectedIndex.value =
    (selectedIndex.value + direction + suggestions.value.length) % suggestions.value.length
}

function selectSuggestion(index: number = selectedIndex.value): void {
  if (index >= 0 && suggestions.value[index]) {
    query.value = suggestions.value[index]
  }
}
</script>

<style scoped>
input:focus {
  outline: none;
  border-color: #aaa;
}

.suggestion {
  padding: 0.5rem;
  cursor: pointer;
}

.suggestion:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.selected {
  background-color: rgba(0, 0, 0, 0.1);
}

.selected:hover {
  background-color: rgba(0, 0, 0, 0.15);
}
</style>

<style>
.autocomplete-dropdown {
  background: rgb(var(--v-theme-surface)) !important;
  border: 1px solid rgba(var(--v-border-color), 0.12);
  border-radius: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15) !important;
}
</style>