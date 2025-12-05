<template>
    <v-container fluid class="upload-container">
        <!-- Dialog to confirm if the file should be opened in a new tab or the current tab -->
        <v-dialog v-model="dialog" max-width="400">
            <v-card class="confirm-dialog">
                <v-card-title class="text-h6">Open in new tab?</v-card-title>
                <v-card-text class="text-body-1">
                    Do you want to open the file in a new tab?
                </v-card-text>
                <v-card-actions class="justify-end pa-4">
                    <v-btn variant="tonal" @click="() => (dialog = false)">Cancel</v-btn>
                    <v-btn variant="tonal" @click="open(false)">This tab</v-btn>
                    <v-btn variant="flat" color="primary" @click="open(true)">New tab</v-btn>
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

            <v-divider></v-divider>

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
                            ref="fileInput"
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
                            ></v-icon>

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
                                ></v-btn>
                            </div>
                        </div>

                        <div class="drop-zone__hint">
                            Supports DER, PEM, Base64, and JSON files
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
                        ></v-textarea>

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
                    <p class="examples-hint">
                        Load a sample RPKI object to explore the editor
                    </p>
                </v-window-item>
            </v-window>
        </v-card>
    </v-container>
</template>

<script>
import { useTabsStore } from '@/stores/tabs'

export default {
    setup() {
        const store = useTabsStore()
        return { store }
    },
    data() {
        return {
            activeTab: 'file',
            data: null,
            file: null,
            pastedContent: '',
            dragOver: false,
            dialog: false,
            examples: [
                { type: 'roa', label: 'ROA', icon: 'mdi-shield-check-outline' },
                { type: 'mft', label: 'Manifest', icon: 'mdi-format-list-checks' },
                { type: 'crl', label: 'CRL', icon: 'mdi-close-circle-outline' },
                { type: 'cer', label: 'Certificate', icon: 'mdi-certificate-outline' },
                { type: 'asa', label: 'ASPA', icon: 'mdi-link-variant' },
                { type: 'gbr', label: 'Ghostbuster', icon: 'mdi-ghost-outline' },
                { type: 'tls', label: 'TLS', icon: 'mdi-lock-outline' }
            ]
        }
    },
    emits: ['upload'],
    methods: {
        loadExample(type) {
            this.store.addTab(type + '_example')
            this.store.stateSet({
                tab: this.store.currentTab,
                type: 'example',
                data: type
            })
            this.$emit('upload')
        },
        open(newTab) {
            this.dialog = false
            const type = this.file.name.endsWith('.json') ? 'json' : 'hex'

            if (newTab) {
                this.store.addTab(this.file.name || 'Unnamed')
            }

            this.store.stateSet({
                tab: this.store.currentTab,
                data: this.data,
                type: type
            })

            this.clearFile()
            this.$emit('upload')
        },
        async processFile(file) {
            this.file = file

            try {
                if (file.name.endsWith('.json')) {
                    this.data = await file.text()
                } else {
                    try {
                        const decoder = new TextDecoder('utf-8', { fatal: true })
                        const arrayBuffer = await file.arrayBuffer()
                        this.data = decoder.decode(arrayBuffer)
                    } catch (e) {
                        const arrayBuffer = await file.arrayBuffer()
                        const uint8Array = new Uint8Array(arrayBuffer)
                        this.data = [...uint8Array]
                            .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
                            .join('')
                    }
                }
            } catch (err) {
                console.error('Error processing file:', err)
                alert(`Error processing ${file.name}. Please ensure the file is valid.`)
                this.file = null
                return
            }
        },
        triggerFileInput() {
            this.$refs.fileInput.click()
        },
        clearFile() {
            this.file = null
            this.data = null
            if (this.$refs.fileInput) {
                this.$refs.fileInput.value = ''
            }
        },
        async handleFileSelect(event) {
            const files = event.target.files
            const multiple = files.length > 1

            for (const file of files) {
                await this.processFile(file)

                if (multiple || this.store.tabs.length === 0) {
                    this.open(true)
                } else {
                    this.dialog = true
                }
            }
        },
        async handleDrop(event) {
            this.dragOver = false
            const files = event.dataTransfer.files
            const multiple = files.length > 1

            for (const file of files) {
                await this.processFile(file)

                if (multiple || this.store.tabs.length === 0) {
                    this.open(true)
                } else {
                    this.dialog = true
                }
            }
        },
        handlePastedContent() {
            if (!this.pastedContent) return

            this.data = this.pastedContent.trim()
            this.file = { name: 'Pasted Content' }

            if (this.store.tabs.length === 0) {
                this.open(true)
            } else {
                this.dialog = true
            }

            this.pastedContent = ''
        }
    }
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

/* Drop Zone Styles */
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
    color: rgb(var(--v-theme-on-surface));
}

.drop-zone__subtitle {
    font-size: 0.875rem;
    color: rgba(var(--v-theme-on-surface), 0.6);
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
    color: rgba(var(--v-theme-on-surface), 0.5);
}

/* Paste Zone Styles */
.paste-zone {
    padding: 20px;
}

.paste-textarea :deep(.v-field) {
    border-radius: 8px;
}

/* Examples Grid Styles */
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
    color: rgba(var(--v-theme-on-surface), 0.5);
    padding: 0 20px 20px;
    margin: 0;
}

/* Responsive adjustments */
@media (max-width: 600px) {
    .examples-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>