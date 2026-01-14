<template>
    <v-card
        class="keyloader-card d-flex flex-column"
        :width="isMobile ? '95vw' : '80vw'"
        :height="isMobile ? '90vh' : '78vh'"
        elevation="2"
    >
        <v-card-text class="keyloader-body">
            <div class="keyloader-title">
                <v-icon class="keyloader-title-icon">mdi-key-variant</v-icon>
                <div class="keyloader-title-text">Key Loader</div>
            </div>

            <div class="keyloader-desc">
                Load a key file (PEM or DER) and insert its bytes into a selected ASN.1 node or automatically into a
                node by label.
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

            <v-divider class="my-6"></v-divider>

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
                    <div class="keyloader-help">
                        Searches node labels and inserts into the first match.
                    </div>
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
                    <div class="keyloader-help">
                        Useful if you want to overwrite a BIT STRING node.
                    </div>
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
            <v-spacer></v-spacer>
            <v-btn class="keyloader-close" variant="tonal" @click="$emit('close')">
                CLOSE
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import { useDisplay } from 'vuetify'

export default {
    name: "KeyLoader",
    props: {
        store: { type: Object, required: true },
        activeNode: { type: Object, default: null }
    },
    emits: ["close"],
    setup() {
        const { mobile } = useDisplay()
        return { isMobile: mobile }
    },
    data() {
        return {
            keyFileModel: null,
            keyBytes: null,
            keyReady: false,
            hexPreview: "",
            errorMsg: "",
            infoMsg: ""
        }
    },
    methods: {
        dec2hex(i) {
            return (i + 0x10000).toString(16).substr(-2).toUpperCase()
        },
        normalizeLabel(s) {
            return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "")
        },
        base64ToUint8Array(base64) {
            const bin = atob(base64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            return bytes
        },
        readFileAsBytes(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(new Uint8Array(reader.result))
                reader.onerror = () => reject(reader.error)
                reader.readAsArrayBuffer(file)
            })
        },
        readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(String(reader.result))
                reader.onerror = () => reject(reader.error)
                reader.readAsText(file)
            })
        },

        async onKeyFileChanged(fileOrArr) {
            this.errorMsg = ""
            this.infoMsg = ""
            this.hexPreview = ""
            this.keyBytes = null
            this.keyReady = false

            const file = Array.isArray(fileOrArr) ? fileOrArr[0] : fileOrArr
            if (!file) return

            try {
                const rawBytes = await this.readFileAsBytes(file)

                let text = null
                try {
                    text = await this.readFileAsText(file)
                } catch (_) {
                    text = null
                }

                // If PEM, extract base64 body. Otherwise treat as DER/raw.
                if (text && text.includes("-----BEGIN")) {
                    const base64Body = text
                        .replace(/-----BEGIN [^-]+-----/g, "")
                        .replace(/-----END [^-]+-----/g, "")
                        .replace(/\s+/g, "")
                        .trim()

                    if (!base64Body) {
                        this.errorMsg = "Could not read PEM body (base64 is empty)."
                        return
                    }

                    this.keyBytes = this.base64ToUint8Array(base64Body)
                } else {
                    this.keyBytes = rawBytes
                }

                this.keyReady = true

                const previewLen = Math.min(96, this.keyBytes.length)
                const head = Array.from(this.keyBytes.slice(0, previewLen)).map(this.dec2hex).join(" ")
                this.hexPreview = head + (this.keyBytes.length > previewLen ? " ..." : "")

                this.infoMsg = `Loaded ${this.keyBytes.length} bytes.`
            } catch (e) {
                console.error("Key load error:", e)
                this.errorMsg = "Failed to load key: " + (e.message || "Unknown error")
            }
        },

        insertIntoSelectedNode() {
            this.errorMsg = ""
            this.infoMsg = ""

            if (!this.keyReady || !this.keyBytes) return

            const highlightedId = this.store.highlighted
            const targetId =
                (highlightedId !== null && highlightedId !== undefined && highlightedId !== -1)
                    ? highlightedId
                    : (this.activeNode ? this.activeNode.id : null)

            if (targetId === null) {
                this.errorMsg = "Select a node first (click a byte on the right, or right-click a node in the tree)."
                return
            }

            const ok = this.applyBytesToNode(targetId, this.keyBytes)
            if (ok) this.infoMsg = `Inserted into node ${targetId}.`
        },

        autoInsertIntoSubjectPublicKeyInfo() {
            this.errorMsg = ""
            this.infoMsg = ""
            if (!this.keyReady || !this.keyBytes) return

            const needle = "subjectpublickeyinfo"
            const node = this.store.tree.find(n => this.normalizeLabel(n.label).includes(needle))

            if (!node) {
                this.errorMsg = 'No node label matches "subjectPublicKeyInfo". (Try INSERT INTO SELECTED NODE for TLS_EXAMPLE.)'
                return
            }

            const ok = this.applyBytesToNode(node.id, this.keyBytes)
            if (ok) this.infoMsg = `Inserted into ${node.label || node.id}.`
        },

        autoInsertIntoSubjectPublicKey() {
            this.errorMsg = ""
            this.infoMsg = ""
            if (!this.keyReady || !this.keyBytes) return

            const needle = "subjectpublickey"
            const node = this.store.tree.find(n => this.normalizeLabel(n.label).includes(needle))

            if (!node) {
                this.errorMsg = 'No node label matches "subjectPublicKey".'
                return
            }

            // BIT STRING usually needs a leading "unused bits" byte.
            const out = new Uint8Array(this.keyBytes.length + 1)
            out[0] = 0x00
            out.set(this.keyBytes, 1)

            const ok = this.applyBytesToNode(node.id, out)
            if (ok) this.infoMsg = `Inserted into ${node.label || node.id}.`
        },

        clearKey() {
            this.keyFileModel = null
            this.keyBytes = null
            this.keyReady = false
            this.hexPreview = ""
            this.errorMsg = ""
            this.infoMsg = ""
        },

        applyBytesToNode(nodeId, bytesUint8) {
            const node = this.store.getNodeFromId(nodeId)
            if (!node) {
                this.errorMsg = `Node not found: ${nodeId}`
                return false
            }

            const bytesArray = Array.from(bytesUint8)

            // 1) Use the store’s edit path first (this is what actually updates the editor state).
            if (typeof this.store.nodeEdited === "function") {
                const payload = {
                    tab: this.store.currentTab,
                    id: nodeId,
                    tag: node.tag ? node.tag[0] : undefined,
                    label: node.label,
                    content: bytesArray
                }

                try {
                    this.store.nodeEdited(payload)
                    this.store.elementHighlighted?.(nodeId)
                    return true
                } catch (e) {
                    console.warn("store.nodeEdited(payload) failed:", e)
                }
            }

            if (typeof this.store.nodeUpdated === "function") {
                try {
                    this.store.nodeUpdated({ tab: this.store.currentTab, id: nodeId, content: bytesArray })
                    this.store.elementHighlighted?.(nodeId)
                    return true
                } catch (e) {
                    console.warn("store.nodeUpdated(...) failed:", e)
                }
            }

            // 2) Fallback (may not affect WASM-backed state, but keeps UI consistent if your store uses the tree directly).
            try {
                node.content = node.content || []
                node.content[2] = bytesArray
                node.content[3] = bytesArray
                node.content[1] = `InsertedKey(${bytesArray.length} bytes)`

                this.store.elementHighlighted?.(nodeId)
                return true
            } catch (e) {
                console.error("Fallback patch failed:", e)
                this.errorMsg = "Failed to insert key bytes into node."
                return false
            }
        }
    }
}
</script>

<style scoped>
.keyloader-card {
    border-radius: 6px;
    background: white;
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
    color: rgba(0, 0, 0, 0.75);
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
    color: rgba(0, 0, 0, 0.75);
    font-weight: 600;
}

.keyloader-error {
    margin-top: 10px;
    color: #b00020;
    font-weight: 600;
}
</style>
