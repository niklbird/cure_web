<template>
  <v-card
    :width="isMobile ? '95vw' : '50vw'"
    :max-height="isMobile ? '90vh' : '70vh'"
    class="d-flex flex-column"
  >
    <v-card-title class="text-center flex-0">Add Extension</v-card-title>
    <v-divider />

    <v-card-text class="flex-grow-1" style="overflow-y: auto;">
      <v-select
        v-model="selectedId"
        :items="EXTENSIONS"
        item-title="name"
        item-value="id"
        label="Extension"
        density="compact"
      />
      <v-switch v-model="critical" label="Critical" color="primary" density="compact" hide-details />

      <template v-if="def">
        <div v-for="f in def.fields" :key="f.key" class="mt-3">
          <v-switch
            v-if="f.type === 'bool'"
            v-model="values[f.key]"
            :label="f.label"
            color="primary"
            density="compact"
            hide-details
          />
          <v-textarea
            v-else-if="f.type === 'list'"
            v-model="values[f.key]"
            :label="`${f.label} (one per line)`"
            :placeholder="f.placeholder"
            rows="3"
            auto-grow
            density="compact"
            hide-details
          />
          <v-text-field
            v-else
            v-model="values[f.key]"
            :label="f.label"
            :placeholder="f.placeholder"
            density="compact"
            hide-details
          />
        </div>
      </template>

      <div v-if="errorMsg" class="text-error mt-3">{{ errorMsg }}</div>
    </v-card-text>

    <v-divider />
    <v-card-actions class="pa-4 flex-0">
      <v-spacer />
      <v-btn color="primary" variant="tonal" :disabled="!def" @click="addExtension">Add</v-btn>
      <v-btn variant="tonal" @click="emit('close')">Close</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'
import { EXTENSIONS, wrapExtension } from '@/utils/extensions'

const { mobile: isMobile } = useDisplay()
const store = useTabsStore()
const emit = defineEmits<{ close: [] }>()

const selectedId = ref<string | null>(null)
const critical = ref(false)
const values = ref<Record<string, any>>({})
const errorMsg = ref('')

const def = computed(() => EXTENSIONS.find(e => e.id === selectedId.value) ?? null)

watch(def, (d) => {
  values.value = {}
  critical.value = d?.critical ?? false
  errorMsg.value = ''
})

function normalizeLabel(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ↓↓↓ This is the "Add handler" from step 4 ↓↓↓
function addExtension(): void {
  errorMsg.value = ''
  if (!def.value) return

  // Convert textarea strings of 'list' fields into string arrays
  const v: Record<string, any> = { ...values.value }
  for (const f of def.value.fields) {
    if (f.type === 'list') {
      v[f.key] = String(v[f.key] ?? '').split('\n').map(s => s.trim()).filter(Boolean)
    }
  }

  let der: number[]
  try {
    der = wrapExtension(def.value, critical.value, def.value.encode(v))
  } catch (e) {
    errorMsg.value = 'Invalid input: ' + String(e)
    return
  }

  // Find the extensions SEQUENCE (label match, same idea as KeyLoader)
  let ext = store.tree.find(n => normalizeLabel(n.label).includes('extensions'))
  if (ext && ext.tag[0] === 0xA3 && ext.children.length) {
    ext = store.getNodeFromId(ext.children[0])   // unwrap the [3] EXPLICIT wrapper
  }
  if (!ext) {
    errorMsg.value = 'No extensions node found in this object.'
    return
  }

  try {
    store.nodeAddedDer({ tab: store.currentTab, parent: ext.id, der })
    emit('close')
  } catch (e) {
    errorMsg.value = String(e)
  }
}
</script>