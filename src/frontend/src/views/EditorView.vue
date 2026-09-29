<template>
  <v-overlay v-model="loading">
    <v-progress-circular indeterminate color="primary" />
  </v-overlay>

  <v-overlay v-model="load">
    <UploadCard @upload="load = false" @report-loaded="handleReportLoaded" />
  </v-overlay>

  <v-overlay v-model="showElementMenu">
    <ElementMenu :parent="parent" :node="activeNode" @close="showElementMenu = false" />
  </v-overlay>

  <v-overlay v-model="showKeyLoader">
    <KeyLoader :activeNode="activeNode" @close="showKeyLoader = false" />
  </v-overlay>

  <v-overlay v-model="showReports">
    <v-card
      :width="isMobile ? '95vw' : '70vw'"
      :height="isMobile ? '90vh' : '70vh'"
      class="d-flex flex-column"
    >
      <v-card-title class="text-center bg-primary">REPORTS</v-card-title>
      <v-card-text class="flex-grow-1 overflow-y-auto">
        <v-row no-gutters class="h-100">
          <v-col cols="12" md="2">
            <v-tabs
              v-model="reportTab"
              :direction="isMobile ? 'horizontal' : 'vertical'"
              class="h-100"
              show-arrows
            >
              <v-tab
                v-for="(report, idx) in reports"
                :key="`tab-${idx}`"
                :value="idx"
                class="text-capitalize"
              >
                {{ report.name.replace(/_/g, ' ') }}
              </v-tab>
            </v-tabs>
          </v-col>

          <v-col cols="12" md="10">
            <v-window v-model="reportTab" class="h-100">
              <v-window-item
                v-for="(report, idx) in reports"
                :key="`window-${idx}`"
                :value="idx"
                class="pa-4"
              >
                <div
                  v-for="(rp, i) in [...report.report].sort(
                    (a, b) => Number(b.crashed) - Number(a.crashed)
                  )"
                  :key="i"
                >
                  <h3>{{ rp.name }}</h3>
                  <br />
                  <span :class="{ crashed: rp.crashed }">
                    {{ rp.crashed ? 'Crash: True' : 'Crash: False' }}
                  </span>
                  <br />

                  <table
                    v-if="!rp.crashed && !isMobile"
                    class="table-bordered-centered"
                  >
                    <thead>
                      <tr>
                        <th>ASN</th>
                        <th>IP Prefix</th>
                        <th>Max Length</th>
                        <th>Trust Anchor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(vrp, i3) in rp.vrps.content" :key="i3">
                        <td>{{ vrp.asn }}</td>
                        <td>{{ vrp.ip.ip_s }}</td>
                        <td>{{ vrp.ip.max_len }}</td>
                        <td>ta</td>
                      </tr>
                    </tbody>
                  </table>

                  <div v-if="!rp.crashed && isMobile" class="mt-4">
                    <v-card
                      v-for="(vrp, i3) in rp.vrps.content"
                      :key="i3"
                      class="mb-3"
                      variant="outlined"
                    >
                      <v-card-text>
                        <div><strong>ASN:</strong> {{ vrp.asn }}</div>
                        <div><strong>IP Prefix:</strong> {{ vrp.ip.ip_s }}</div>
                        <div><strong>Max Length:</strong> {{ vrp.ip.max_len }}</div>
                        <div><strong>Trust Anchor:</strong> ta</div>
                      </v-card-text>
                    </v-card>
                  </div>

                  <span :class="{ crashed: rp.crashed }">
                    {{ rp.crashed ? 'Errors:' : 'Logs:' }}
                  </span>
                  <br />
                  <pre class="text-pre-wrap" :class="{ 'crashed-thin': rp.crashed }">{{
                    rp.errors
                  }}</pre>
                </div>
              </v-window-item>
            </v-window>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn
          @click="downloadReport(reports[reportTab])"
          color="secondary"
          variant="tonal"
          :size="isMobile ? 'small' : 'default'"
        >
          <v-icon start>mdi-download</v-icon>
          Download Report
        </v-btn>
        <v-btn
          @click="loadTestCase(reports[reportTab].name, reports[reportTab].state)"
          color="primary"
          variant="tonal"
          :size="isMobile ? 'small' : 'default'"
        >
          Load Test Case
        </v-btn>
        <v-btn
          @click="showReports = false"
          color="grey"
          variant="tonal"
          :size="isMobile ? 'small' : 'default'"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-overlay>

  <!-- Share Dialog -->
  <v-dialog v-model="showShareDialog" max-width="600">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon start style="color: #1976D2">mdi-share-variant</v-icon>
        Share Link
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">
          Copy this link to share the current ASN.1 object:
        </p>
        <v-text-field
          v-model="shareUrl"
          readonly
          variant="outlined"
          density="compact"
          hide-details
          @focus="($event.target as HTMLInputElement)?.select()"
        >
          <template #append-inner>
            <v-btn icon="mdi-content-copy" size="small" variant="text" @click="copyShareUrl" />
          </template>
        </v-text-field>
        <v-alert v-if="shareUrlTooLong" type="warning" variant="tonal" density="compact" class="mt-3">
          The object is large, so the URL is quite long. Some browsers may not support URLs of this
          length.
        </v-alert>
        <v-alert v-if="copied" type="success" variant="tonal" density="compact" class="mt-3">
          Link copied to clipboard!
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn style="color: #1976D2" variant="tonal" @click="showShareDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-container fluid>
    <v-row v-if="store.tabs.length > 0">
      <v-col
        cols="12"
        sm="auto"
        v-if="store.tree.length > 0 && reachable && rpkiTypes.includes(objectType)"
      >
        <v-btn color="primary" @click="runTestCase" :block="isMobile">
          RUN TEST CASE WITH CURE
        </v-btn>
      </v-col>
      <v-col v-if="reports.length > 0" cols="12" sm="auto">
        <v-btn color="primary" @click="showReports = true" :block="isMobile">SHOW REPORTS</v-btn>
      </v-col>
      <v-spacer v-if="!isMobile" />
    </v-row>

    <v-row v-if="store.tabs.length > 0" id="tab-content">
      <v-col id="tabs" cols="12" class="pa-0">
        <div class="d-flex align-center">
          <v-btn
            icon
            variant="text"
            class="flex-shrink-0"
            @click="load = true"
          >
            <v-icon color="primary" size="30">mdi-plus</v-icon>
          </v-btn>
          <v-tabs
            v-model="currentTab"
            direction="horizontal"
            show-arrows
            color="primary"
          >        
            <v-tab 
            v-for="tab in store.tabs" 
            :key="tab.id" 
            :value="tab.id"
            :id="`tab-${tab.id}`"
            >
              <div
                style="width: 100%; display: flex; justify-content: space-between; align-items: center;"
              >
                <div class="text-truncate">{{ tab.name }}</div>
                <v-btn
                  elevation="0"
                  icon="mdi-close"
                  size="x-small"
                  @click.stop="store.tabRemoved(tab.id)"
                />
              </div>
            </v-tab>
          </v-tabs>
        </div>
      </v-col>

      <v-col cols="12" md class="center-col">
        <div
          :style="{ position: 'absolute', left: `${menuX}px`, top: `${menuY}px` }"
          ref="activatorRef"
        >
          <MenuComponent :items="contextItems" />
        </div>

        <div class="tree-toolbar">

          <v-btn
            variant="text"
            size="small"
            :disabled="!store.canUndo"
            @click="store.undo()"
          >
            <v-icon color="primary" start size="18">mdi-undo</v-icon>
            Undo
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            :disabled="!store.canRedo"
            @click="store.redo()"
          >
            <v-icon color="primary" start size="18">mdi-redo</v-icon>
            Redo
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            :disabled="store.tree.length === 0"
            @click="showKeyLoader = true"
          >
            <v-icon color="primary" start size="18">mdi-key</v-icon>
            Key Loader
          </v-btn>

          <v-btn
            variant="text"
            size="small"
            :disabled="store.tree.length === 0"
            @click="store.setAll(!store.anyExpanded)"
          >
            <v-icon
              start
              color="primary"
              size="12"
              :style="{ transform: store.anyExpanded ? 'none' : 'rotate(180deg)' }"
            >
              mdi-triangle
            </v-icon>
            {{ store.anyExpanded ? 'Collapse All' : 'Expand All' }}
          </v-btn>

          <v-btn
            v-if="!isMobile"
            variant="text"
            size="small"
            @click="simplify = !simplify"
          >
            <v-icon color="primary" start size="18">{{ simplify ? 'mdi-eye' : 'mdi-eye-outline' }}</v-icon>
            Simplified View
          </v-btn>
        </div>

        <div class="asn-tree-wrapper">
          <div class="asn-tree">
            <TreeNodeComponent
              v-if="store.tree.length > 0"
              :node="findRoot()"
              @rightclick="(x: number, y: number, id: number) => openMenu(x, y, id)"
              :simplify="simplify || isMobile"
            />
            <p v-else class="text-h6 text-center pa-5">
              No ASN.1 data loaded. Please upload a file or select an example.
            </p>
          </div>
        </div>
      </v-col>

      <v-col cols="12" md="4" class="right-col">

        <div class="tree-toolbar">
          <v-menu>
            <template #activator="{ props: menuProps }">
              <v-btn
                variant="text"
                size="small"
                :disabled="store.tree.length === 0"
                v-bind="menuProps"
              >
                <v-icon color="primary" start size="18">mdi-download</v-icon>
                Export
              </v-btn>
            </template>
            <v-list density="compact">
              <v-list-item
                v-for="f in formats"
                :key="f"
                @click="download(f)"
              >
                <v-list-item-title class="text-body-2">{{ f.toUpperCase() }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-btn
            variant="text"
            size="small"
            :disabled="store.tree.length === 0"
            @click="openShareDialog"
          >
            <v-icon color="primary" start size="18">mdi-share-variant</v-icon>
            Share
          </v-btn>
        </div>

        <div class="byte-grid-container" ref="bytesRef">
          <div class="byte-grid" v-if="store.tree.length > 0">
            <span
              v-for="(byte, index) in flatBytes"
              :key="index"
              :class="[
                byte.type,
                highlightedNodeAndDescendants.has(byte.nodeId) ? 'highlighted' : '',
                lockedNodeAndDescendants.has(byte.nodeId) ? 'locked' : '',
                subHighlightedNodeAndDescendants.has(byte.nodeId) ? 'sub-highlighted' : ''
              ]"
              :data-node-id="byte.nodeId"
              @click.stop="toggleLock(byte.nodeId)"
              @mouseover.stop="store.elementHighlighted(byte.nodeId)"
              @mouseleave.stop="store.elementHighlighted(-1)"
            >
              {{ dec2hex(byte.value) }}
            </span>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row v-if="store.tabs.length === 0">
      <UploadCard @report-loaded="handleReportLoaded" />
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, onUpdated, nextTick } from 'vue'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'
import axios from 'axios'

import TreeNodeComponent from '@/components/TreeNode.vue'
import UploadCard from '@/components/UploadCard.vue'
import ElementMenu from '@/components/ElementMenu.vue'
import MenuComponent from '@/components/MenuComponent.vue'
import KeyLoader from '@/components/KeyLoader.vue'

import type { Tab } from '@/stores/tabs'
import type { TreeNode, CureReport, ContextMenuItem } from '@/types/editor'


// ─── Setup ────────────────────────────────────────────────────────────────────

const { mobile: isMobile } = useDisplay()
const store = useTabsStore()

const PUBLIC_BACKEND = 'https://api.asn1.app/'
const LOCAL_BACKEND = 'http://localhost:21999/'

// ─── State ────────────────────────────────────────────────────────────────────

const menuX = ref(0)
const menuY = ref(0)
const parent = ref(0)
const activeNode = ref<TreeNode | null>(null)
const showElementMenu = ref(false)
const bytesTop = ref(0)
const backendUrl = ref(LOCAL_BACKEND)
const reachable = ref(false)
const load = ref(false)
const loading = ref(false)
const reports = ref<CureReport[]>([])
const showReports = ref(false)
const reportTab = ref(0)
const simplify = ref(false)
const showShareDialog = ref(false)
const shareUrl = ref('')
const shareUrlTooLong = ref(false)
const copied = ref(false)
const showKeyLoader = ref(false)
const menuOpen = ref(false)

const activatorRef = ref<HTMLDivElement | null>(null)
const bytesRef = ref<HTMLDivElement | null>(null)

const formats = ['binary', 'base64', 'json', 'repository'] as const
type ExportFormat = (typeof formats)[number]

const rpkiTypes = ['roa', 'mft', 'crl', 'cer', 'asa', 'gbr']

// ─── Context menu ─────────────────────────────────────────────────────────────

const contextItems = computed<ContextMenuItem[]>(() => [
  {
    title: 'COPY ...',
    action: () => {},
    children: [
      { title: 'NODE', action: () => copy('node') },
      { title: 'CONTENT', action: () => copy('content') },
      { title: 'AS BASE64', action: () => copy('base64') },
      { title: 'AS HEX', action: () => copy('hex') }
    ]
  },
  { title: 'DUPLICATE NODE', action: () => duplicateNode(activeNode.value) },
  { title: 'DELETE NODE', action: () => deleteNode() },
  { title: 'EDIT NODE', action: () => { showElementMenu.value = true } },
  {
    title: 'ADD CHILD',
    action: () => {
      parent.value = activeNode.value?.id ?? 0
      activeNode.value = null
      showElementMenu.value = true
    }
  }
])

// ─── Computed ─────────────────────────────────────────────────────────────────

const objectType = computed(() => store.state?.infer_object_type() ?? '')

const currentTab = computed({
  get: () => store.currentTab,
  set: (value: string | null) => {
    if (value) store.tabSelected(value)
  }
})

interface FlatByte {
  value: number
  type: 'tag' | 'length' | 'content'
  nodeId: number
}

const flatBytes = computed<FlatByte[]>(() => {
  const bytes: FlatByte[] = []
  const root = findRoot()
  if (!root || root.id === -1) return bytes

  const traverse = (node: TreeNode) => {
    if (node.tag?.[2]) {
      for (const b of node.tag[2]) bytes.push({ value: b, type: 'tag', nodeId: node.id })
    }
    if (node.length?.[2]) {
      for (const b of node.length[2]) bytes.push({ value: b, type: 'length', nodeId: node.id })
    }
    if (node.content?.[3]) {
      for (const b of node.content[3]) bytes.push({ value: b, type: 'content', nodeId: node.id })
    }
    if (node.children) {
      for (const childId of node.children) {
        const childNode = store.getNodeFromId(childId)
        if (childNode) traverse(childNode)
      }
    }
  }

  traverse(root)
  return bytes
})

function collectSubtree(rootId: number): Set<number> {
  const set = new Set<number>()
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    if (set.has(id)) continue
    set.add(id)
    const node = store.getNodeFromId(id)
    if (node?.children) queue.push(...node.children)
  }
  return set
}

const highlightedNodeAndDescendants = computed<Set<number>>(() => {
  const id = store.highlighted
  if (id === null || id === undefined || id === -1) return new Set()
  return collectSubtree(id)
})

const lockedNodeAndDescendants = computed<Set<number>>(() => {
  return store.locked !== -1 ? collectSubtree(store.locked) : new Set()
})

const subHighlightedNodeAndDescendants = computed<Set<number>>(() => {
  if (store.locked === -1) return new Set()
  const id = store.highlighted
  if (id === -1 || id === store.locked) return new Set()
  if (!store.isDescendant(store.locked, id)) return new Set()
  return collectSubtree(id)
})

function toggleLock(id: number): void {
  store.elementLocked(store.locked === id ? -1 : id)
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(
  () => store.highlighted,
  (id) => {
    if (id === null || id === undefined || id === -1) return

    activeNode.value = store.getNodeFromId(id)

    if (!bytesRef.value) return
    const byteContainer = bytesRef.value
    const elements = byteContainer.querySelectorAll(
      `span[data-node-id="${id}"]`
    ) as NodeListOf<HTMLElement>

    if (elements.length === 0) return

    const firstElement = elements[0]
    const lastElement = elements[elements.length - 1]

    const containerRect = byteContainer.getBoundingClientRect()
    const firstRect = firstElement.getBoundingClientRect()
    const lastRect = lastElement.getBoundingClientRect()

    const isFullyVisible =
      firstRect.top >= containerRect.top &&
      lastRect.bottom <= containerRect.bottom

    if (isFullyVisible) return

    const containerHeight = byteContainer.clientHeight
    const rangeTop = firstElement.offsetTop
    const rangeBottom = lastElement.offsetTop + lastElement.clientHeight
    const rangeCenter = (rangeTop + rangeBottom) / 2

    const scrollTop = rangeCenter - containerHeight / 2

    byteContainer.scrollTo({ top: scrollTop, behavior: 'smooth' })
  }
)

// ─── Methods ──────────────────────────────────────────────────────────────────

function uint8ToBase64(uint8Array: Uint8Array | number[]): string {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''

  for (let i = 0; i < uint8Array.length; i += 3) {
    const byte1 = uint8Array[i]
    const byte2 = i + 1 < uint8Array.length ? uint8Array[i + 1] : 0
    const byte3 = i + 2 < uint8Array.length ? uint8Array[i + 2] : 0
    const triplet = (byte1 << 16) | (byte2 << 8) | byte3

    result += base64Chars[(triplet >> 18) & 0x3f]
    result += base64Chars[(triplet >> 12) & 0x3f]
    result += i + 1 < uint8Array.length ? base64Chars[(triplet >> 6) & 0x3f] : '='
    result += i + 2 < uint8Array.length ? base64Chars[triplet & 0x3f] : '='
  }

  return result
}

function generateShareUrl(): string {
  if (!store.state) return ''
  try {
    const base64Data = store.state.export_base64()
    const urlSafeBase64 = base64Data
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const baseUrl = window.location.origin + window.location.pathname
    const name = encodeURIComponent(store.name || 'Shared')
    return `${baseUrl}?data=${urlSafeBase64}&name=${name}`
  } catch (e) {
    console.error('Error generating share URL:', e)
    return ''
  }
}

function openShareDialog(): void {
  shareUrl.value = generateShareUrl()
  shareUrlTooLong.value = shareUrl.value.length > 2000
  copied.value = false
  showShareDialog.value = true
}

async function copyShareUrl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 3000)
  } catch (e) {
    console.error('Failed to copy URL:', e)
  }
}

function loadFromUrl(): boolean {
  const urlParams = new URLSearchParams(window.location.search)
  const data = urlParams.get('data')
  const name = urlParams.get('name')

  if (data) {
    try {
      let base64Data = data.replace(/-/g, '+').replace(/_/g, '/')
      const padding = base64Data.length % 4
      if (padding) base64Data += '='.repeat(4 - padding)

      const tabName = name ? decodeURIComponent(name) : 'Shared Object'
      store.addTab(tabName)

      store.stateSet({
        tab: store.currentTab,
        data: base64Data,
        type: 'base64'
      })

      window.history.replaceState({}, document.title, window.location.pathname)
      return true
    } catch (e: any) {
      console.error('Error loading data from URL:', e)
      alert('Failed to load the shared object: ' + (e.message ?? 'Unknown error'))
    }
  }
  return false
}

async function runTestCase(): Promise<void> {
  const z = store.state!.repositorify()
  const serialized = uint8ToBase64(z)

  try {
    const response = await axios.post(backendUrl.value + 'execute', serialized, {
      headers: { 'Content-Type': 'text/plain' }
    })
    showReports.value = true

    const report: CureReport = {
      name: store.name,
      state: store.state!.encode_store(),
      report: response.data.map(JSON.parse)
    }
    reports.value.push(report)
    reportTab.value = reports.value.length - 1
  } catch (error) {
    console.error('Error during test case execution:', error)
    alert('Error during test case execution. Please check the console for details.')
  }
}

function openMenu(x: number, y: number, id: number): void {
  menuX.value = x
  menuY.value = y
  activatorRef.value?.click()
  store.elementHighlighted(id)
  activeNode.value = store.getNodeFromId(id)
}

function dec2hex(i: number): string {
  return (i + 0x10000).toString(16).substr(-2).toUpperCase()
}

function copy(type: 'node' | 'content' | 'base64' | 'hex'): void {
  if (!activeNode.value) return

  if (type === 'node') {
    store.copiedCellSet(activeNode.value)
  } else if (type === 'hex') {
    const array = [
      ...activeNode.value.tag[2],
      ...activeNode.value.length[2],
      ...activeNode.value.content[3]
    ]
    navigator.clipboard.writeText(array.map(dec2hex).join(' '))
  } else if (type === 'base64') {
    const array = [
      ...activeNode.value.tag[2],
      ...activeNode.value.length[2],
      ...activeNode.value.content[3]
    ]
    navigator.clipboard.writeText(uint8ToBase64(array))
  } else if (type === 'content') {
    navigator.clipboard.writeText(activeNode.value.content[1])
  }
}

function duplicateNode(node: TreeNode | null): void {
  if (!node) return

  store.nodeAdded({
    tab: store.currentTab,
    tag: node.tag[0],
    content: node.content[2],
    parent: node.parent,
    label: node.label,
    index: store.getNodeFromId(node.parent).children.indexOf(node.id) + 1
  })
}

function deleteNode(): void {
  if (!activeNode.value) return
  if (confirm('Are you sure you want to delete this node?')) {
    store.nodeRemoved({
      id: activeNode.value.id,
      tab: store.currentTab
    })
  }
}

function findRoot(): TreeNode {
  const candidates = store.tree.filter(node => node.id === node.parent)
  return candidates.length > 0 ? candidates[0] : ({ children: [], id: -1 } as any)
}

function download(format: ExportFormat): void {
  let content: Uint8Array | string | null = null
  let fileName = store.name
  let type = ''

  loading.value = true
  switch (format) {
    case 'binary':
      content = store.state!.export_bin()
      fileName += '.bin'
      type = 'application/octet-stream'
      break
    case 'base64':
      content = store.state!.export_base64()
      fileName += '.txt'
      type = 'text/plain'
      break
    case 'json':
      content = store.state!.encode_store()
      fileName += '.json'
      type = 'application/json'
      break
    case 'repository':
      content = store.state!.repositorify()
      fileName += '.tar.gz'
      type = 'application/x-gzip'
      break
  }

  const blob = new Blob([content as any], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName

  document.body.appendChild(link)
  link.click()

  loading.value = false
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function downloadReport(report: CureReport): void {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    name: report.name,
    state: report.state,
    report: report.report
  }

  const content = JSON.stringify(exportData, null, 2)
  const fileName = `${report.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_report.json`
  const blob = new Blob([content], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function loadTestCase(name: string, storeData: string): void {
  store.addTab(name)
  store.stateSet({
    tab: store.currentTab,
    data: storeData,
    type: 'json'
  })
}

function handleReportLoaded(reportData: { name: string; state: string; report: any[] }): void {
  reports.value.push({
    name: reportData.name,
    state: reportData.state,
    report: reportData.report
  })
  reportTab.value = reports.value.length - 1
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.ctrlKey && event.key === 'z') store.undo()
  if (event.ctrlKey && event.key === 'y') store.redo()
  if (event.key === 'Escape') store.elementLocked(-1)
}

async function copyDER(): Promise<void> {
  if (flatBytes.value.length === 0) return
  const hex = flatBytes.value.map(b => dec2hex(b.value)).join(' ')
  await navigator.clipboard.writeText(hex)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

// Check backend reachability before mount
async function probeBackend(): Promise<void> {
  try {
    await axios.get(LOCAL_BACKEND + 'probe')
    reachable.value = true
  } catch {
    console.log('No local backend detected at', LOCAL_BACKEND)
    try {
      await axios.get(PUBLIC_BACKEND + 'probe')
      backendUrl.value = PUBLIC_BACKEND
      reachable.value = true
    } catch {
      console.error('Backend not reachable at', backendUrl.value)
      reachable.value = false
    }
  }
}

onMounted(() => {
  document.title = 'Live ASN.1 Editor & Parser | DERP'
  window.addEventListener('keydown', handleKeydown)
  probeBackend()

  nextTick(() => {
    const tryLoad = (attempts = 0) => {
      try {
        loadFromUrl()
      } catch (e) {
        if (attempts < 5) {
          console.log('WASM may not be ready, retrying...', attempts + 1)
          setTimeout(() => tryLoad(attempts + 1), 200)
        } else {
          console.error('Failed to load from URL after retries:', e)
        }
      }
    }
    setTimeout(() => tryLoad(), 100)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})

onUpdated(() => {
  if (bytesRef.value) {
    const containerRect = bytesRef.value.getBoundingClientRect()
    bytesTop.value = containerRect.top
  }
})
</script>

<style>
.tag {
  color: #7ebdc2;
}

.label {
  color: #e63946;
  font-weight: bold;
}

.length {
  color: #60a561;
}

.content {
  color: rgb(var(--v-theme-content));
  font-weight: bold;
}

.table-bordered-centered {
  border-collapse: collapse;
  width: 100%;
}

.table-bordered-centered th,
.table-bordered-centered td {
  border: 1px solid #000;
  text-align: center;
  vertical-align: middle;
  padding: 8px;
}

.crashed {
  color: red;
  font-weight: bold;
}

.crashed-thin {
  color: red;
}

/* column spacing */

/* have center col take up all remaining space */
.center-col {
  overflow: scroll;
}

/* prevent right col with byte-grid from taking too little space on medium
  screens and too much space on wide screens */
@media (min-width: 960px) {
  .right-col {
    min-width: 26em;
    max-width: 32em;
  }
}

.byte-grid-container {
  height: 84vh;
  font-family: monospace;
  font-size: 1rem;
  padding: 6px;
  overflow: scroll;
  position: sticky;
  border: 1px solid #ccc;
  box-sizing: border-box;
}

.byte-grid {
  display: grid;
  grid-template-columns: repeat(16, minmax(min-content, 1fr));
}

.byte-grid > span {
  display: inline-block;
  text-align: center;
  padding: 0.01em;
  cursor: pointer;
  white-space: nowrap;
}

.byte-grid > span:nth-child(16n + 9) {
  padding-left: 0.65em;
}

.byte-grid-container:hover .copy-btn {  /* for copy button */
  opacity: 1;
  pointer-events: auto;
}

.highlighted {
  background-color:#fffbbc;
  font-weight: bold;
}

.locked {
  background-color: #ffee00;
  font-weight: bold;
}

.sub-highlighted {
  background-color: #ffc400;
  font-weight: bold;
}

@media (max-width: 960px) {
  .asn-tree,
  .byte-grid-container {
    height: 50vh;
  }
}

.asn-tree {
  font-family: monospace;
  overflow: scroll;
  width: 100%;
  height: 84vh;
  border: 1px solid #ccc;
}

.v-overlay {
  align-items: center;
  justify-content: center;
}

@media (max-width: 960px) {
  .asn-tree,
  .bytes {
    height: 50vh;
  }
}

.asn-tree-wrapper {
  position: relative;
}

.expand-toggle-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
}

.tree-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  padding: 1px 8px 1px;
  border-top: 1px solid #ccc;
  margin-bottom: 1px;
}

.tree-toolbar .v-btn {
  text-transform: none;
}
</style>
