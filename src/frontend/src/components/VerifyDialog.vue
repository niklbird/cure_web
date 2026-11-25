<template>
  <v-card
    :width="isMobile ? '95vw' : '60vw'"
    :max-height="isMobile ? '90vh' : '80vh'"
    class="d-flex flex-column"
  >
    <v-card-title class="text-center flex-0">Verify Object</v-card-title>
    <v-divider />

    <v-card-text class="flex-grow-1" style="overflow-y: auto;">
      <p class="text-body-2 mb-3">
        Checks the structure, content digests and signatures that the object itself contains.
        Optionally add the issuing certificates (and CRLs) to also validate the chain up to a trust anchor.
      </p>

      <v-expansion-panels v-model="chainPanel" variant="accordion" class="mb-3">
        <v-expansion-panel value="chain">
          <v-expansion-panel-title>
            Certificate chain (optional)
            <v-chip v-if="chainCount > 0" size="small" color="primary" class="ml-2">{{ chainCount }}</v-chip>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-file-input
              v-model="chainFiles"
              label="Certificate and CRL files (.cer, .crt, .pem, .der, .crl)"
              accept=".cer,.crt,.pem,.der,.crl,.bin,.txt"
              multiple
              chips
              density="compact"
              prepend-icon="mdi-certificate-outline"
            />
            <v-textarea
              v-model="chainText"
              label="Or paste PEM blocks (several are fine), base64 or hex"
              rows="3"
              auto-grow
              density="compact"
              hide-details
              class="mb-3"
            />
            <template v-if="otherTabs.length">
              <div class="text-caption mb-1">Use objects open in other tabs:</div>
              <v-checkbox
                v-for="t in otherTabs"
                :key="t.id"
                v-model="chainTabs"
                :value="t.id"
                :label="t.name"
                density="compact"
                hide-details
              />
            </template>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-text-field
        v-model="checkTime"
        type="datetime-local"
        label="Check validity at (local time, empty = now)"
        density="compact"
        hide-details
        clearable
        class="mb-3"
      />

      <div v-if="errorMsg" class="text-error mb-3">{{ errorMsg }}</div>

      <template v-if="report">
        <v-alert :type="verdictType" variant="tonal" class="mb-3">
          <div class="font-weight-bold">{{ report.objectType }}: {{ verdictText }}</div>
          <div class="text-body-2">{{ report.summary }}</div>
          <div v-if="report.path.length > 1" class="text-body-2 mt-1">Path: {{ report.path.join(' ← ') }}</div>
        </v-alert>

        <div v-for="group in groups" :key="group.name" class="mb-2">
          <div class="text-subtitle-2 mt-2">{{ group.name }}</div>
          <v-list density="compact" class="py-0">
            <v-list-item
              v-for="(c, i) in group.checks"
              :key="i"
              class="px-1"
              :class="{ 'check-linked': c.node !== undefined }"
              @click="c.node !== undefined && emit('reveal', c.node)"
              @mouseenter="c.node !== undefined && store.elementHighlighted(c.node)"
              @mouseleave="store.elementHighlighted(-1)"
            >
              <template #prepend>
                <v-icon :color="ICONS[c.status].color" size="20">{{ ICONS[c.status].icon }}</v-icon>
              </template>
              <template #append v-if="c.node !== undefined">
                <v-icon size="16" color="primary">mdi-crosshairs-gps</v-icon>
              </template>
              <v-list-item-title class="text-body-2">{{ c.title }}</v-list-item-title>
              <div v-if="c.detail" class="text-caption text-medium-emphasis check-detail">{{ c.detail }}</div>
            </v-list-item>
          </v-list>
        </div>
      </template>
    </v-card-text>

    <v-divider />
    <v-card-actions class="pa-4 flex-0">
      <v-spacer />
      <v-btn color="primary" variant="tonal" :loading="running" :disabled="!store.state" @click="run">
        {{ report ? 'Verify again' : 'Verify' }}
      </v-btn>
      <v-btn variant="tonal" @click="emit('close')">Close</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'
import { verifyState, chainEntryFromBytes } from '@/utils/verify'
import type { VerifyReport, Check, CheckStatus } from '@/utils/verify'

const { mobile: isMobile } = useDisplay()
const store = useTabsStore()
const emit = defineEmits<{ close: []; reveal: [id: number] }>()

const chainPanel = ref<string | undefined>(undefined)
const chainFiles = ref<File[] | File | null>(null)
const chainText = ref('')
const chainTabs = ref<string[]>([])
const checkTime = ref<string | null>(null)
const report = ref<VerifyReport | null>(null)
const running = ref(false)
const errorMsg = ref('')

const ICONS: Record<CheckStatus, { icon: string; color: string }> = {
  pass: { icon: 'mdi-check-circle', color: 'success' },
  fail: { icon: 'mdi-close-circle', color: 'error' },
  warn: { icon: 'mdi-alert', color: 'warning' },
  info: { icon: 'mdi-information-outline', color: 'info' },
  skip: { icon: 'mdi-minus-circle-outline', color: 'grey' }
}

const otherTabs = computed(() => store.tabs.filter(t => t.id !== store.currentTab && t.state))

const fileList = computed<File[]>(() => {
  const f = chainFiles.value
  return !f ? [] : Array.isArray(f) ? f : [f]
})

const chainCount = computed(() =>
  fileList.value.length + chainTabs.value.length + (chainText.value.trim() ? 1 : 0)
)

const verdictType = computed(() =>
  report.value?.verdict === 'valid' ? 'success' : report.value?.verdict === 'invalid' ? 'error' : 'info'
)

const verdictText = computed(() => {
  switch (report.value?.verdict) {
    case 'valid': return 'valid'
    case 'invalid': return 'invalid'
    default: return report.value?.chainProvided ? 'checks passed, trust not anchored' : 'self-contained checks passed'
  }
})

const groups = computed(() => {
  const out: { name: string; checks: Check[] }[] = []
  for (const c of report.value?.checks ?? []) {
    let g = out.find(x => x.name === c.group)
    if (!g) out.push(g = { name: c.group, checks: [] })
    g.checks.push(c)
  }
  return out
})

async function collectChain(): Promise<string[]> {
  const chain: string[] = []
  for (const f of fileList.value) {
    chain.push(chainEntryFromBytes(new Uint8Array(await f.arrayBuffer())))
  }
  if (chainText.value.trim()) chain.push(chainText.value)
  for (const id of chainTabs.value) {
    const tab = store.tabs.find(t => t.id === id)
    if (tab?.state) chain.push(tab.state.export_base64())
  }
  return chain
}

async function run(): Promise<void> {
  errorMsg.value = ''
  if (!store.state) return
  running.value = true
  try {
    const chain = await collectChain()
    const now = checkTime.value ? new Date(checkTime.value) : new Date()
    if (isNaN(now.getTime())) throw new Error('Invalid check time')
    report.value = verifyState(store.state, chain, now)
  } catch (e) {
    errorMsg.value = typeof e === 'string' ? e : (e as Error).message ?? String(e)
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.check-linked {
  cursor: pointer;
}
.check-detail {
  white-space: normal;
  word-break: break-word;
}
</style>
