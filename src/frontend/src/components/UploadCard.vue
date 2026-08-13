<template>
  <v-container fluid class="upload-container">
    <!-- Dialog: open in new tab or current tab -->
    <v-dialog v-model="dialog" max-width="400">
      <v-card class="confirm-dialog">
        <v-card-title class="text-h6">Open in new tab?</v-card-title>
        <v-card-text class="text-body-1">
          Do you want to open the file in a new tab?
        </v-card-text>
        <v-card-actions class="justify-end pa-4">
          <v-btn variant="tonal" @click="dialog = false">Cancel</v-btn>
          <v-btn variant="tonal" @click="open(false)">This tab</v-btn>
          <v-btn variant="flat" color="primary" @click="open(true)">New tab</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: report file detected -->
    <v-dialog v-model="reportDialog" max-width="500">
      <v-card class="report-dialog">
        <v-card-title class="text-h6">
          <v-icon start>mdi-file-document-outline</v-icon>
          Report File Detected
        </v-card-title>
        <v-card-text class="text-body-1">
          <p>This file contains a saved report with an ASN.1 object.</p>
          <v-divider class="my-3" />
          <div class="report-info">
            <div><strong>Name:</strong> {{ reportInfo.name }}</div>
            <div><strong>Exported:</strong> {{ reportInfo.exportedAt }}</div>
            <div><strong>Test Results:</strong> {{ reportInfo.resultCount }} RP(s) tested</div>
          </div>
        </v-card-text>
        <v-card-actions class="justify-end pa-4">
          <v-btn variant="tonal" @click="reportDialog = false">Cancel</v-btn>
          <v-btn variant="flat" color="primary" @click="loadReportObject(true)">
            <v-icon start>mdi-plus</v-icon>
            Load in New Tab
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-card class="upload-card" elevation="0">
      <!-- Tab Navigation -->
      <v-tabs v-model="activeTab" color="primary" class="upload-tabs">
        <v-tab value="file" class="tab-item">
          <v-icon start>mdi-file-upload-outline</v-icon>
          File
        </v-tab>
        <v-tab value="paste" class="tab-item">
          <v-icon start>mdi-content-paste</v-icon>
          Paste
        </v-tab>
        <v-tab value="example" class="tab-item">
          <v-icon start>mdi-file-document-outline</v-icon>
          Examples
        </v-tab>
      </v-tabs>

      <v-divider />

      <v-window v-model="activeTab" class="tab-content">
        <!-- File Upload Tab -->
        <v-window-item value="file">
          <div
            class="drop-zone"
            :class="{ 'drop-zone--active': dragOver, 'drop-zone--has-file': file }"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <input
              type="file"
              ref="fileInputRef"
              style="display: none"
              @change="handleFileSelect"
              multiple
            />

            <div class="drop-zone__content">
              <v-icon
                :icon="file ? 'mdi-file-check-outline' : 'mdi-cloud-upload-outline'"
                :color="file ? 'success' : 'primary'"
                size="48"
                class="drop-zone__icon"
              />
              <div v-if="!file" class="drop-zone__text">
                <span class="drop-zone__title">Drop files here</span>
                <span class="drop-zone__subtitle">or click to browse</span>
              </div>
              <div v-else class="drop-zone__file">
                <span class="drop-zone__filename">{{ file.name }}</span>
                <v-btn
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  @click.stop="clearFile"
                  class="drop-zone__clear"
                />
              </div>
            </div>

            <div class="drop-zone__hint">
              Supports DER, PEM, Base64, JSON, and Report files
            </div>
          </div>
        </v-window-item>

        <!-- Paste Tab -->
        <v-window-item value="paste">
          <div class="paste-zone">
            <v-textarea
              v-model="pastedContent"
              variant="outlined"
              label="Paste Base64, Hex, or PEM content"
              placeholder="Paste your encoded content here..."
              rows="6"
              auto-grow
              hide-details
              class="paste-textarea"
            />
            <v-btn
              color="primary"
              variant="flat"
              :disabled="!pastedContent"
              @click="handlePastedContent"
              class="mt-4"
              block
            >
              <v-icon start>mdi-check</v-icon>
              Load Content
            </v-btn>
          </div>
        </v-window-item>

        <!-- Examples Tab -->
        <v-window-item value="example">
          <div class="examples-grid">
            <v-btn
              v-for="example in examples"
              :key="example.type"
              variant="tonal"
              color="primary"
              @click="loadExample(example.type)"
              class="example-btn"
            >
              <v-icon start>{{ example.icon }}</v-icon>
              {{ example.label }}
            </v-btn>
          </div>
          <p class="examples-hint">Load a sample RPKI object to explore the editor</p>
        </v-window-item>
      </v-window>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { State } from '@/rust/cure_web'

interface ExampleDef {
  type: string
  label: string
  icon: string
}

interface ReportFileData {
  version: string
  exportedAt?: string
  name: string
  state: string
  report: any[]
}

const store = useTabsStore()

const emit = defineEmits<{
  upload: []
  reportLoaded: [data: { name: string; state: string; report: any[] }]
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const activeTab = ref('file')
const data = ref<string | null>(null)
const file = ref<File | null>(null)
const pastedContent = ref('')
const dragOver = ref(false)
const dialog = ref(false)
const reportDialog = ref(false)
const reportData = ref<ReportFileData | null>(null)
const reportInfo = ref({ name: '', exportedAt: '', resultCount: 0 })
const fileInputRef = ref<HTMLInputElement | null>(null)

const examples: ExampleDef[] = [
  { type: 'roa', label: 'ROA', icon: 'mdi-shield-check-outline' },
  { type: 'mft', label: 'Manifest', icon: 'mdi-format-list-checks' },
  { type: 'crl', label: 'CRL', icon: 'mdi-close-circle-outline' },
  { type: 'cer', label: 'Certificate', icon: 'mdi-certificate-outline' },
  { type: 'asa', label: 'ASPA', icon: 'mdi-link-variant' },
  { type: 'gbr', label: 'Ghostbuster', icon: 'mdi-ghost-outline' },
  { type: 'tls', label: 'TLS', icon: 'mdi-lock-outline' },
  { type: 'csr', label: 'CSR', icon: 'mdi-file-key-outline' }
]

// ─── Methods ──────────────────────────────────────────────────────────────────

function loadExample(type: string): void {
  store.addTab(type + '_example')
  store.stateSet({
    tab: store.currentTab,
    type: 'example',
    data: type
  })
  emit('upload')
}

function open(newTab: boolean): void {
  dialog.value = false
  const type = file.value?.name.endsWith('.json') ? 'json' : 'hex'

  // derive states here
  let states: State[] = State.from_any_data(data.value);
  if (states.length > 0) {
    for (const state of states) {
      store.addTab(state.get_name())
      store.stateSet({
        tab: store.currentTab,
        data: state,
        type: "state"
      })
    }
  } else {
    if (newTab) {
      store.addTab(file.value?.name ?? 'Unnamed')
    }

    store.stateSet({
      tab: store.currentTab,
      data: data.value,
      type: type as any
    })
  }

  clearFile()
  emit('upload')
}

function isReportFile(jsonData: string): boolean {
  try {
    const parsed = JSON.parse(jsonData)
    return !!(parsed.version && parsed.state && parsed.report && Array.isArray(parsed.report))
  } catch {
    return false
  }
}

function loadReportObject(newTab: boolean): void {
  reportDialog.value = false
  if (!reportData.value) return

  const tabName = reportData.value.name || 'Loaded from Report'

  if (newTab) {
    store.addTab(tabName)
  }

  store.stateSet({
    tab: store.currentTab,
    data: reportData.value.state,
    type: 'json'
  })

  emit('reportLoaded', {
    name: reportData.value.name,
    state: reportData.value.state,
    report: reportData.value.report
  })

  reportData.value = null
  clearFile()
  emit('upload')
}

async function processFile(f: File): Promise<void> {
  file.value = f

  try {
    if (f.name.endsWith('.json')) {
      const jsonText = await f.text()

      if (isReportFile(jsonText)) {
        const parsed = JSON.parse(jsonText) as ReportFileData
        reportData.value = parsed
        reportInfo.value = {
          name: parsed.name ?? 'Unknown',
          exportedAt: parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : 'Unknown',
          resultCount: parsed.report ? parsed.report.length : 0
        }
        reportDialog.value = true
        return
      }

      data.value = jsonText
    } else {
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        const arrayBuffer = await f.arrayBuffer()
        data.value = decoder.decode(arrayBuffer)
      } catch {
        const arrayBuffer = await f.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        data.value = [...uint8Array].map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join('')
      }
    }
  } catch (err) {
    console.error('Error processing file:', err)
    alert(`Error processing ${f.name}. Please ensure the file is valid.`)
    file.value = null
  }
}

function triggerFileInput(): void {
  fileInputRef.value?.click()
}

function clearFile(): void {
  file.value = null
  data.value = null
  reportData.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

async function processFiles(files: FileList): Promise<void> {
  if (!files) return
  const multiple = files.length > 1

  for (const f of files) {
    await processFile(f)
    if (reportDialog.value) continue
    if (multiple || store.tabs.length === 0) {
      open(true)
    } else {
      dialog.value = true
    }
  }
}

async function handleFileSelect(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement
  const files = target.files
  await processFiles(files)
}

async function handleDrop(event: DragEvent): Promise<void> {
  dragOver.value = false
  const files = event.dataTransfer?.files
  await processFiles(files)
}

function handlePastedContent(): void {
  if (!pastedContent.value) return
  let content = pastedContent.value.trim()

  if (/^[0-9A-Fa-f\s]+$/.test(content)) { //if hex with space
    content = content.replace(/\s+/g, '')   //remove space/ newline
  }

  data.value = content
  file.value = { name: 'Pasted Content' } as File

  if (store.tabs.length === 0) {
    open(true)
  } else {
    dialog.value = true
  }

  pastedContent.value = ''
}
</script>

<style scoped>
.upload-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 16px;
}

.upload-card {
  border: 1px solid rgba(var(--v-border-color), 0.12);
  border-radius: 12px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.upload-tabs {
  background: transparent;
}

.tab-item {
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0;
}

.tab-content {
  min-height: 220px;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  margin: 20px;
  padding: 24px;
  border: 2px dashed rgba(var(--v-theme-primary), 0.3);
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
}

.drop-zone:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  background: rgba(var(--v-theme-primary), 0.05);
}

.drop-zone--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
  transform: scale(1.01);
}

.drop-zone--has-file {
  border-style: solid;
  border-color: rgba(var(--v-theme-success), 0.5);
  background: rgba(var(--v-theme-success), 0.05);
}

.drop-zone__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.drop-zone__icon {
  opacity: 0.8;
}

.drop-zone__text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.drop-zone__title {
  font-size: 1rem;
  font-weight: 500;
}

.drop-zone__subtitle {
  font-size: 0.875rem;
  opacity: 0.6;
}

.drop-zone__file {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drop-zone__filename {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgb(var(--v-theme-success));
}

.drop-zone__hint {
  margin-top: 16px;
  font-size: 0.75rem;
  opacity: 0.5;
}

.paste-zone {
  padding: 20px;
}

.paste-zone :deep(.v-textarea) {
  overflow: scroll;
  max-height: 80dvh;
}

.paste-textarea :deep(.v-field) {
  border-radius: 8px;
}

.examples-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  padding: 20px;
}

.example-btn {
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0;
}

.examples-hint {
  text-align: center;
  font-size: 0.8rem;
  opacity: 0.5;
  padding: 0 20px 20px;
  margin: 0;
}

.report-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-info div {
  font-size: 0.95rem;
}

@media (max-width: 600px) {
  .examples-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>