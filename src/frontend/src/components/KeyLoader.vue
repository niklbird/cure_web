<template>
  <v-card
    class="keyloader-card d-flex flex-column"
    :width="isMobile ? '95vw' : '80vw'"
    :height="isMobile ? '90vh' : '78vh'"
    elevation="2"
  >
    <v-card-text class="keyloader-body">
      <div class="keyloader-title">
        <v-icon class="keyloader-title-icon" style="color: #1976D2" >mdi-key-variant</v-icon>
        <div class="keyloader-title-text">Key Loader</div>
      </div>

      <div class="keyloader-desc">
        Load a key file (PEM or DER) and insert its bytes into a selected ASN.1 node or
        automatically into a node by label.
      </div>

      <v-file-input
        v-model="keyFileModel"
        class="keyloader-input"
        label="Load key file (.pem, .der, .key)"
        variant="outlined"
        density="comfortable"
        accept=".pem,.der,.key,.cer,.crt,.bin"
        :multiple="false"
        hide-details
        prepend-inner-icon="mdi-file-key-outline"
        @update:modelValue="onKeyFileChanged"
      />

      <v-textarea
        v-model="hexPreview"
        class="keyloader-preview"
        label="Key bytes preview (hex, first 96 bytes)"
        variant="outlined"
        density="comfortable"
        rows="7"
        readonly
        hide-details
      />

      <v-divider class="my-6" />

      <v-row dense>
        <v-col cols="12" md="6">
          <v-btn
            class="keyloader-btn"
            variant="outlined"
            :disabled="!keyReady"
            block
            @click="insertIntoSelectedNode"
          >
            INSERT INTO SELECTED NODE
          </v-btn>
          <div class="keyloader-help">
            Uses highlighted node if present, otherwise the last right-clicked node.
          </div>
        </v-col>

        <v-col cols="12" md="6">
          <v-btn
            class="keyloader-btn"
            variant="outlined"
            :disabled="!keyReady"
            block
            @click="autoInsertIntoSubjectPublicKeyInfo"
          >
            AUTO-INSERT INTO SUBJECTPUBLICKEYINFO
          </v-btn>
          <div class="keyloader-help">Searches node labels and inserts into the first match.</div>
        </v-col>

        <v-col cols="12" md="6" class="mt-2">
          <v-btn
            class="keyloader-btn"
            variant="outlined"
            :disabled="!keyReady"
            block
            @click="autoInsertIntoSubjectPublicKey"
          >
            AUTO-INSERT INTO SUBJECTPUBLICKEY
          </v-btn>
          <div class="keyloader-help">Useful if you want to overwrite a BIT STRING node.</div>
        </v-col>

        <v-col cols="12" md="6" class="mt-2">
          <v-btn
            class="keyloader-btn"
            variant="outlined"
            :disabled="!keyReady && !keyFileModel"
            block
            @click="clearKey"
          >
            CLEAR LOADED KEY
          </v-btn>
        </v-col>
      </v-row>

      <div v-if="infoMsg" class="keyloader-info">{{ infoMsg }}</div>
      <div v-if="errorMsg" class="keyloader-error">{{ errorMsg }}</div>
    </v-card-text>

    <v-card-actions class="keyloader-actions">
      <v-spacer />
      <v-btn class="keyloader-close" variant="tonal" style="color: #1976D2" @click="emit('close')">CLOSE</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'
import type { TreeNode } from '@/types/editor'

const { mobile: isMobile } = useDisplay()
const store = useTabsStore()

const props = defineProps<{
  activeNode?: TreeNode | null
}>()

const emit = defineEmits<{
  close: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────

const keyFileModel = ref<File | File[] | null>(null)
const keyBytes = ref<Uint8Array | null>(null)
const keyReady = ref(false)
const hexPreview = ref('')
const errorMsg = ref('')
const infoMsg = ref('')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dec2hex(i: number): string {
  return (i + 0x10000).toString(16).substr(-2).toUpperCase()
}

function normalizeLabel(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function readFileAsBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

// ─── Core methods ─────────────────────────────────────────────────────────────

async function onKeyFileChanged(fileOrArr: File | File[] | null): Promise<void> {
  errorMsg.value = ''
  infoMsg.value = ''
  hexPreview.value = ''
  keyBytes.value = null
  keyReady.value = false

  const file = Array.isArray(fileOrArr) ? fileOrArr[0] : fileOrArr
  if (!file) return

  try {
    const rawBytes = await readFileAsBytes(file)

    let text: string | null = null
    try {
      text = await readFileAsText(file)
    } catch {
      text = null
    }

    if (text && text.includes('-----BEGIN')) {
      const base64Body = text
        .replace(/-----BEGIN [^-]+-----/g, '')
        .replace(/-----END [^-]+-----/g, '')
        .replace(/\s+/g, '')
        .trim()

      if (!base64Body) {
        errorMsg.value = 'Could not read PEM body (base64 is empty).'
        return
      }
      keyBytes.value = base64ToUint8Array(base64Body)
    } else {
      keyBytes.value = rawBytes
    }

    keyReady.value = true
    const previewLen = Math.min(96, keyBytes.value.length)
    const head = Array.from(keyBytes.value.slice(0, previewLen)).map(dec2hex).join(' ')
    hexPreview.value = head + (keyBytes.value.length > previewLen ? ' ...' : '')
    infoMsg.value = `Loaded ${keyBytes.value.length} bytes.`
  } catch (e: any) {
    console.error('Key load error:', e)
    errorMsg.value = 'Failed to load key: ' + (e.message ?? 'Unknown error')
  }
}

function insertIntoSelectedNode(): void {
  errorMsg.value = ''
  infoMsg.value = ''
  if (!keyReady.value || !keyBytes.value) return

  const highlightedId = store.highlighted
  const targetId =
    highlightedId !== null && highlightedId !== undefined && highlightedId !== -1
      ? highlightedId
      : props.activeNode?.id ?? null

  if (targetId === null) {
    errorMsg.value =
      'Select a node first (click a byte on the right, or right-click a node in the tree).'
    return
  }

  if (applyBytesToNode(targetId, keyBytes.value)) {
    infoMsg.value = `Inserted into node ${targetId}.`
  }
}

function autoInsertIntoSubjectPublicKeyInfo(): void {
  errorMsg.value = ''
  infoMsg.value = ''
  if (!keyReady.value || !keyBytes.value) return

  const node = store.tree.find(n => normalizeLabel(n.label).includes('subjectpublickeyinfo'))

  if (!node) {
    errorMsg.value =
      'No node label matches "subjectPublicKeyInfo". (Try INSERT INTO SELECTED NODE for TLS_EXAMPLE.)'
    return
  }

  if (applyBytesToNode(node.id, keyBytes.value)) {
    infoMsg.value = `Inserted into ${node.label || node.id}.`
  }
}

function autoInsertIntoSubjectPublicKey(): void {
  errorMsg.value = ''
  infoMsg.value = ''
  if (!keyReady.value || !keyBytes.value) return

  const node = store.tree.find(n => normalizeLabel(n.label).includes('subjectpublickey'))

  if (!node) {
    errorMsg.value = 'No node label matches "subjectPublicKey".'
    return
  }

  const out = new Uint8Array(keyBytes.value.length + 1)
  out[0] = 0x00
  out.set(keyBytes.value, 1)

  if (applyBytesToNode(node.id, out)) {
    infoMsg.value = `Inserted into ${node.label || node.id}.`
  }
}

function clearKey(): void {
  keyFileModel.value = null
  keyBytes.value = null
  keyReady.value = false
  hexPreview.value = ''
  errorMsg.value = ''
  infoMsg.value = ''
}

function applyBytesToNode(nodeId: number, bytesUint8: Uint8Array): boolean {
  const node = store.getNodeFromId(nodeId)
  if (!node || node.id === -1) {
    errorMsg.value = `Node not found: ${nodeId}`
    return false
  }

  const bytesArray = Array.from(bytesUint8)

  try {
    store.nodeChanged({
      tab: store.currentTab,
      id: nodeId,
      tag: node.tag ? node.tag[0] : null,
      length: null,
      content: bytesArray as any
    })
    store.elementHighlighted(nodeId)
    return true
  } catch (e) {
    console.warn('store.nodeChanged failed:', e)
  }

  try {
    store.nodeUpdated({
      tab: store.currentTab,
      id: nodeId,
      value: bytesArray,
      field: 'content'
    })
    store.elementHighlighted(nodeId)
    return true
  } catch (e) {
    console.warn('store.nodeUpdated failed:', e)
  }

  errorMsg.value = 'Failed to insert key bytes into node.'
  return false
}
</script>

<style scoped>
.keyloader-card {
  border-radius: 6px;
}

.keyloader-body {
  padding: 28px 34px;
  flex: 1 1 auto;
  overflow-y: auto;
}

.keyloader-actions {
  padding: 14px 24px 18px;
}

.keyloader-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.keyloader-title-icon {
  font-size: 34px;
}

.keyloader-title-text {
  font-size: 34px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.keyloader-desc {
  font-size: 18px;
  line-height: 1.5;
  margin-bottom: 20px;
  max-width: 1200px;
}

.keyloader-input {
  margin-bottom: 24px;
}

.keyloader-preview {
  margin-top: 6px;
}

.keyloader-btn {
  height: 54px;
  border-radius: 6px;
  font-weight: 600;
  letter-spacing: 1px;
}

.keyloader-help {
  margin-top: 10px;
  font-size: 16px;
  line-height: 1.45;
  opacity: 0.75;
}

.keyloader-close {
  height: 52px;
  border-radius: 6px;
  font-weight: 600;
  letter-spacing: 2px;
  padding: 0 24px;
}

.keyloader-info {
  margin-top: 16px;
  font-weight: 600;
  opacity: 0.75;
}

.keyloader-error {
  margin-top: 10px;
  color: #b00020;
  font-weight: 600;
}
</style>