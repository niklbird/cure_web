<template>
  <v-card
    :width="isMobile ? '95vw' : '50vw'"
    :max-height="isMobile ? '90vh' : '70vh'"
    class="d-flex flex-column"
  >
    <v-overlay v-model="pick" class="d-flex justify-center align-center" persistent>
      <v-card :width="isMobile ? '90vw' : 'auto'">
        <v-card-text>
          <v-row>
            <v-col cols="12" md="auto">
              <v-date-picker v-model="date" />
            </v-col>
            <v-col cols="12" md="auto">
              <v-time-picker v-model="time" :use-seconds="true" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmTime" color="primary" variant="tonal">Confirm</v-btn>
          <v-btn @click="pick = false" variant="tonal">Cancel</v-btn>
        </v-card-actions>
      </v-card>
    </v-overlay>

    <v-card-title class="text-center flex-0">
      {{ props.node ? 'Edit Node' : 'Add Node' }}
    </v-card-title>

    <v-divider />

    <v-card-text class="flex-grow-1" style="overflow-y: auto;">
      <v-form @keydown.enter.prevent="props.node ? changeNode() : addNode()">
        <v-select
          v-model="tag"
          label="ASN.1 TYPE"
          :items="asn1TypesForSelect"
          item-title="title"
          item-value="value"
          density="compact"
        />

        <v-text-field
          v-model="label"
          label="Label"
          placeholder="Label"
          density="compact"
        />

        <v-text-field
          v-if="props.node != null"
          v-model="length"
          label="Length"
          placeholder="Length"
          density="compact"
        />

        <v-row v-if="tag != null && tag != 48 && tag != 49" class="align-center">
          <v-col>
            <v-text-field
              v-if="!hasCompletions"
              v-model="content"
              label="Content"
              :placeholder="currentType?.example ?? ''"
              density="compact"
              hide-details
            />
            <AutoComplete
              v-else
              v-model="content"
              label="Content"
              :completions="currentCompletions"
            />
          </v-col>
          <v-col cols="auto" class="d-flex">
            <v-btn
              v-if="isTimeType"
              icon="mdi-calendar"
              @click="pick = true"
              variant="text"
              size="small"
            />

            <v-btn icon variant="text" size="small">
              <v-icon>mdi-help-circle</v-icon>
              <v-tooltip activator="parent" location="bottom">
                <span
                  v-for="(chunk, index) in (currentType?.description ?? '').split('\n')"
                  :key="index"
                >
                  {{ chunk }}<br />
                </span>
              </v-tooltip>
            </v-btn>
          </v-col>
        </v-row>
      </v-form>
    </v-card-text>

    <v-divider />

    <v-card-actions class="pa-4 flex-0">
      <v-spacer />
      <v-btn v-if="!props.node" @click="addNode()" color="primary" variant="tonal">Add</v-btn>
      <v-btn v-else @click="changeNode()" color="primary" variant="tonal">Apply Changes</v-btn>
      <v-btn @click="emit('close')" variant="tonal">Close</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import moment from 'moment'
import { ASN1_TYPES, TIME_TYPES } from '@/utils/types'
import AutoComplete from '@/components/AutoComplete.vue'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'
import type { TreeNode } from '@/types/editor'

const { mobile: isMobile } = useDisplay()
const store = useTabsStore()

const props = defineProps<{
  node?: TreeNode | null
  parent?: number
}>()

const emit = defineEmits<{
  close: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const tag = ref<number | string | null>(props.node ? props.node.tag[0] : null)
const label = ref<string | null>(props.node ? props.node.label : null)
const length = ref<any>(props.node ? props.node.length[0] : null)
const content = ref<string | null>(props.node ? props.node.content[2] : null)
const pick = ref(false)
const date = ref(new Date())
const time = ref(new Date().toLocaleTimeString('en-GB'))
const oidCompletions = ref<string[]>([])

// ─── Computed ─────────────────────────────────────────────────────────────────

const types = ASN1_TYPES as Record<number | string, any>
const timeTypes = TIME_TYPES as string[]

const asn1TypesForSelect = computed(() => {
  return Object.entries(types).map(([key, value]) => ({
    title: value.name as string,
    value: key
  }))
})

const currentType = computed(() => {
  if (tag.value == null) return null
  return types[tag.value as number] ?? null
})

const hasCompletions = computed(() => {
  if (tag.value == null) return false
  if (Number(tag.value) === 6) return oidCompletions.value.length > 0
  return (currentType.value?.completions?.length ?? 0) > 0
})

const currentCompletions = computed<string[]>(() => {
  if (tag.value == null) return []
  if (Number(tag.value) === 6) return oidCompletions.value
  return currentType.value?.completions ?? []
})

const isTimeType = computed(() => {
  if (!currentType.value) return false
  return timeTypes.includes(currentType.value.name)
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadOidCompletions()
})

// ─── Methods ──────────────────────────────────────────────────────────────────

function loadOidCompletions(): void {
  try {
    if (store.state) {
      const oidsJson = store.state.get_all_oids()
      const oids = JSON.parse(oidsJson)
      if (Array.isArray(oids)) {
        oidCompletions.value = oids.map((oid: any) => {
          if (typeof oid === 'string') return oid
          if (typeof oid === 'object' && oid !== null) {
            if (oid.name && oid.oid) return `${oid.oid} - ${oid.name}`
            return oid.oid ?? String(oid)
          }
          return String(oid)
        })
      }
    }
  } catch (e) {
    console.warn('Could not load OID completions:', e)
    oidCompletions.value = []
  }
}

function translate(value: unknown): string {
  let bytes: Uint8Array
  if (typeof value === 'string') {
    bytes = new TextEncoder().encode(value)
  } else if (typeof value === 'number') {
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setUint32(0, value, false)
    bytes = new Uint8Array(buffer)
  } else if (typeof value === 'object' && value !== null) {
    const jsonStr = JSON.stringify(value)
    bytes = new TextEncoder().encode(jsonStr)
  } else {
    throw new TypeError('Unsupported type for hex conversion')
  }
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return '0x' + hex
}

function confirmTime(): void {
  const d = new Date(date.value)
  const parts = time.value.split(':').map(Number)
  d.setHours(parts[0], parts[1], parts[2] ?? 0)
  const m = moment(d)
  const typeName = currentType.value?.name ?? ''

  if (typeName === 'TIME-OF-DAY') {
    content.value = m.format('HH:mm:ss')
  } else if (typeName === 'TIME') {
    content.value = m.format('YYYY-MM-DDTHH:mm:ss')
  } else if (typeName === 'DATE') {
    content.value = m.format('YYYY-MM-DD')
  } else if (typeName === 'DATE-TIME') {
    content.value = m.format('YYYY-MM-DDTHH:mm:ss')
  } else if (typeName === 'GeneralizedTime') {
    content.value = m.format('YYYYMMDDHHmmss')
  } else if (typeName === 'UTCTime') {
    content.value = m.format('YYMMDDHHmmssZ')
  } else if (typeName === 'DURATION') {
    const years = m.years()
    const months = m.months()
    const days = m.days()
    const hours = m.hours()
    const minutes = m.minutes()
    const seconds = m.seconds()

    let result = 'P'
    if (years) result += `${years}Y`
    if (months) result += `${months}M`
    if (days) result += `${days}D`
    if (hours || minutes || seconds) {
      result += 'T'
      if (hours) result += `${hours}H`
      if (minutes) result += `${minutes}M`
      if (seconds) result += `${seconds}S`
    }
    if (result === 'P') result = 'PT0S'

    content.value = result
  }
  pick.value = false
}

function verifyContent(): boolean {
  if (content.value === '' || content.value === null) return true
  if (tag.value === null) return false

  // For OIDs, extract just the OID part if user selected a formatted completion
  if (Number(tag.value) === 6 && content.value?.includes(' - ')) {
    content.value = content.value.split(' - ')[0].trim()
  }

  const typeEntry = types[tag.value as number]
  if (!typeEntry) return false

  if (typeEntry.rules(content.value)) return true

  if (typeEntry.transform) {
    const regex = typeEntry.transform.regex as RegExp
    if (regex.test(content.value!)) {
      content.value = typeEntry.transform.converter(content.value)
      return true
    }
  }

  if (!confirm('The content is not valid for the selected type. Do you still want to continue?')) {
    return false
  }

  content.value = translate(content.value)
  return true
}

function addNode(): void {
  if (!verifyContent()) return
  store.nodeAdded({
    tab: store.currentTab,
    parent: props.parent ?? 0,
    tag: tag.value,
    label: label.value,
    content: content.value ?? ''
  })
  emit('close')
}

function changeNode(): void {
  if (!verifyContent()) return
  if (!props.node) return

  store.nodeChanged({
    tab: store.currentTab,
    id: props.node.id,
    tag: tag.value,
    length: length.value !== props.node.length[0] ? length.value : null,
    content: content.value
  })

  if (props.node.label !== label.value) {
    store.nodeUpdated({
      tab: store.currentTab,
      id: props.node.id,
      value: label.value,
      field: 'label'
    })
  }
  emit('close')
}
</script>