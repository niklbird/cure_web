<template>
  <v-card
    :width="isMobile ? '95vw' : '50vw'"
    :max-height="isMobile ? '90vh' : '70vh'"
    class="d-flex flex-column"
  >
    <!-- Date/time picker overlay (unchanged behaviour) -->
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

    <v-card-title class="d-flex align-center justify-center flex-0" style="gap: 12px">
      <span>{{ props.node ? 'Edit Node' : 'Add Node' }}</span>
      <v-chip v-if="tag != null" color="primary" variant="tonal" size="small" label>
        {{ typeLabel }}
      </v-chip>
    </v-card-title>

    <v-divider />

    <v-card-text class="flex-grow-1" style="overflow-y: auto;">
      <v-form @keydown.enter.prevent="props.node ? changeNode() : addNode()">
        <!-- When adding a node the type is the first thing the user has to choose -->
        <v-select
          v-if="!props.node"
          v-model="tag"
          label="ASN.1 TYPE"
          :items="asn1TypesForSelect"
          item-title="title"
          item-value="value"
          density="compact"
        />

        <!-- ───────── CONTENT (primary action) ───────── -->
        <template v-if="hasContent">
          <div class="text-subtitle-2 mb-1">Content</div>

          <!-- BOOLEAN mask -->
          <v-btn-toggle
            v-if="isBoolean"
            v-model="content"
            mandatory
            color="primary"
            variant="outlined"
            density="comfortable"
            class="mb-2"
          >
            <v-btn value="true">TRUE</v-btn>
            <v-btn value="false">FALSE</v-btn>
          </v-btn-toggle>

          <!-- Everything else -->
          <v-row v-else class="align-center" no-gutters>
            <v-col>
              <!-- Large preset list (e.g. OIDs): editable field with suggestions -->
              <AutoComplete
                v-if="hasCompletions"
                v-model="content"
                label="Content"
                :completions="currentCompletions"
              />
              <v-text-field
                v-else-if="isInteger"
                v-model="content"
                label="Content"
                :placeholder="currentType?.example ?? '0'"
                inputmode="numeric"
                variant="outlined"
                density="comfortable"
                autofocus
                hide-details
              />
              <v-text-field
                v-else
                v-model="content"
                label="Content"
                :placeholder="currentType?.example ?? ''"
                variant="outlined"
                density="comfortable"
                autofocus
                hide-details
              />
            </v-col>
            <v-col cols="auto" class="d-flex ml-2">
              <v-btn
                v-if="isTimeType"
                icon="mdi-calendar"
                @click="pick = true"
                variant="text"
                size="small"
              />
              <v-btn
                v-if="isTimeType"
                icon="mdi-clock-outline"
                variant="text"
                size="small"
                title="Use current time"
                @click="setNow"
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

          <!-- Quick presets for short lists -->
          <div v-if="quickPresets.length > 0" class="mt-2 d-flex flex-wrap" style="gap: 6px">
            <v-chip
              v-for="p in quickPresets"
              :key="p"
              size="small"
              variant="outlined"
              color="primary"
              @click="content = p"
            >
              {{ p }}
            </v-chip>
          </div>

          <div v-if="isOid" class="text-caption text-medium-emphasis mt-1">
            Type a dotted OID, or pick a known one from the list
            ({{ oidCompletions.length }} presets).
          </div>
        </template>

        <div v-else-if="tag != null" class="text-body-2 text-medium-emphasis">
          {{ noContentHint }}
        </div>

        <!--advanced node edit options-->
        <v-divider class="my-4" />
        <div class="text-subtitle-2 mb-2">
          Advanced <span class="text-caption text-medium-emphasis">(label<span v-if="props.node">, type, length</span>)</span>
        </div>
          <v-select
            v-if="props.node"
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
            hide-details
          />
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
import { ref, computed, watch, onMounted } from 'vue'
import moment from 'moment'
import { ASN1_TYPES, TIME_TYPES, COMMON_OIDS } from '@/utils/types'
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

// NOTE: the v-select items use the object keys of ASN1_TYPES (strings), so the
// model must be a string too, otherwise "2" !== 2 and the select shows the raw
// number instead of the type name.
const tag = ref<string | null>(props.node ? String(props.node.tag[0]) : null)
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
const commonOids = COMMON_OIDS as Record<string, string>

const numericTag = computed<number | null>(() => (tag.value == null ? null : Number(tag.value)))

const asn1TypesForSelect = computed(() => {
  return Object.entries(types).map(([key, value]) => ({
    title: `${value.name as string} (0x${Number(key).toString(16).padStart(2, '0').toUpperCase()})`,
    value: key
  }))
})

const currentType = computed(() => {
  if (tag.value == null) return null
  return types[tag.value] ?? null
})

/** Human readable type name, e.g. "INTEGER (0x02)". Falls back to the node's own display string. */
const typeLabel = computed(() => {
  if (numericTag.value == null) return ''
  const hex = '0x' + numericTag.value.toString(16).padStart(2, '0').toUpperCase()
  const name = currentType.value?.name
  if (name) return `${name} (${hex})`
  if (props.node && Number(props.node.tag[0]) === numericTag.value && props.node.tag[1]) {
    return `${props.node.tag[1]} (${hex})`
  }
  return `Unknown (${hex})`
})

const isBoolean = computed(() => numericTag.value === 1)
const isInteger = computed(() => numericTag.value === 2 || numericTag.value === 10)
const isOid = computed(() => numericTag.value === 6)

/** Constructed types (SEQUENCE / SET), NULL and context tags carry no direct content. */
const hasContent = computed(() => {
  const t = numericTag.value
  if (t == null) return false
  if (t === 48 || t === 49 || t === 5) return false
  if (t >= 0xa0 && t <= 0xa6) return false
  return true
})

const noContentHint = computed(() => {
  const t = numericTag.value
  if (t === 5) return 'NULL has no content.'
  return 'This is a container type. Edit its children, or use "Add child" from the context menu.'
})

const hasCompletions = computed(() => {
  if (tag.value == null) return false
  if (isOid.value) return oidCompletions.value.length > 0
  const c = currentType.value?.completions ?? []
  return c.length > 8
})

const currentCompletions = computed<string[]>(() => {
  if (tag.value == null) return []
  if (isOid.value) return oidCompletions.value
  return currentType.value?.completions ?? []
})

/** Short preset lists are shown as clickable chips instead of an autocomplete. */
const quickPresets = computed<string[]>(() => {
  if (isOid.value || isBoolean.value) return []
  const c: string[] = currentType.value?.completions ?? []
  return c.length > 0 && c.length <= 8 ? c : []
})

const isTimeType = computed(() => {
  if (!currentType.value) return false
  return timeTypes.includes(currentType.value.name)
})

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(tag, () => {
  // Make sure a BOOLEAN always has a valid value selected
  if (isBoolean.value && content.value !== 'true' && content.value !== 'false') {
    content.value = 'true'
  }
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadOidCompletions()
  if (isBoolean.value && content.value !== 'true' && content.value !== 'false') {
    content.value = 'true'
  }
})

// ─── Methods ──────────────────────────────────────────────────────────────────

/**
 * Builds the OID preset list: all OIDs known to the Rust backend plus the named
 * ones from COMMON_OIDS, formatted as "oid - name" where a name is known.
 */
function loadOidCompletions(): void {
  const all = new Set<string>(Object.keys(commonOids))

  try {
    if (store.state) {
      const oids = JSON.parse(store.state.get_all_oids())
      if (Array.isArray(oids)) {
        for (const oid of oids) {
          if (typeof oid === 'string') all.add(oid)
          else if (oid && typeof oid === 'object' && oid.oid) all.add(String(oid.oid))
        }
      }
    }
  } catch (e) {
    console.warn('Could not load OID completions from backend:', e)
  }

  oidCompletions.value = Array.from(all)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(oid => (commonOids[oid] ? `${oid} - ${commonOids[oid]}` : oid))
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

function setNow(): void {
  date.value = new Date()
  time.value = new Date().toLocaleTimeString('en-GB')
  confirmTime()
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

  // Types without direct content never need validation
  if (!hasContent.value) return true

  // Boolean toggle can only produce valid values
  if (isBoolean.value) return true

  // For OIDs, extract just the OID part if user selected a formatted completion
  if (isOid.value && content.value?.includes(' - ')) {
    content.value = content.value.split(' - ')[0].trim()
  }

  const typeEntry = types[tag.value]
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
    tag: numericTag.value,
    label: label.value,
    content: hasContent.value ? (content.value ?? '') : ''
  })
  emit('close')
}

function changeNode(): void {
  if (!verifyContent()) return
  if (!props.node) return

  store.nodeChanged({
    tab: store.currentTab,
    id: props.node.id,
    tag: numericTag.value,
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