<template>
    <v-container fluid>
        <!-- Dialog to confirm if the file should be opened in a new tab or the current tab -->
        <v-dialog v-model="dialog" max-width="500">
            <v-card title="Open in new tab?">
                <v-card-text>
                    Do you want to open the file in a new tab?
                </v-card-text>

                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn @click="open(true)">New tab</v-btn>
                    <v-btn @click="open(false)">This tab</v-btn>
                    <v-btn @click="() => (dialog = false)">Cancel</v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>        
        
        <!-- Drop zone with handlers for paste, drag and drop and clicks -->
        <v-card>
            <v-card-text
                style="border-radius: 8px;"
                class="drop-zone"
                :class="{ 'hovered': dragOver }"  
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="handleDrop"
                @click="triggerFileInput"
                @paste="handlePaste"
            >
                <v-col>
                    <v-row>
                        <span>
                            Paste base64 content below, drag & drop files here or click to browse
                            <div v-if="file">
                                <span class="mt-4" style="vertical-align:middle">
                                    {{ file.name }}
                                </span>
                            </div>
                        </span>                      
                    </v-row>
                    <v-row>
                        <v-textarea @click.stop></v-textarea>
                    </v-row>
                </v-col>            
                <input type="file" ref="fileInput" style="display: none" @change="handleFileSelect" />
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="primary">
                    Load Example
                    <MenuComponent :items="example_items" />
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-container>    
</template>

<script>
import MenuComponent from "@/components/MenuComponent.vue"
import { useTabsStore } from '@/stores/tabs'

export default {
    setup() {
        const store = useTabsStore()
        return { store }
    },
    data() {
        return {
            data: null,
            file: null,
            dragOver: false,
            dialog: false,
            example_items: [
                { "title": "ROA", "action": () => this.loadExample("roa") },
                { "title": "MFT", "action": () => this.loadExample("mft") },
                { "title": "CRL", "action": () => this.loadExample("crl") },
                { "title": "CER", "action": () => this.loadExample("cer") },
                { "title": "ASA", "action": () => this.loadExample("asa") },
                { "title": "GBR", "action": () => this.loadExample("gbr") },
                { "title": "TLS", "action": () => this.loadExample("tls") }
            ]
        }
    },
    emits: ["upload"],
    components: {
        MenuComponent
    },
    methods: {
        loadExample(type) {
            this.store.addTab(type + "_example")
            this.store.stateSet({
                tab: this.store.currentTab,
                type: "example",
                data: type
            })
            this.$emit("upload")
        },
        open(newTab) {
            this.dialog = false
            const type = this.file.name.endsWith(".json") ? "json" : "hex"

            if (newTab) {
                this.store.addTab(this.file.name || "Unnamed")
            }

            this.store.stateSet({
                tab: this.store.currentTab,
                data: this.data,
                type: type
            })

            this.$emit("upload")
        },
        async processFile(file) {
            this.file = file

            try {
                if (file.name.endsWith(".json")) {
                    this.data = await file.text()
                } else {
                    try {
                        const decoder = new TextDecoder('utf-8', { fatal: true })
                        const arrayBuffer = await file.arrayBuffer()
                        this.data = decoder.decode(arrayBuffer)
                    } catch(e) {
                        const arrayBuffer = await file.arrayBuffer()
                        const uint8Array = new Uint8Array(arrayBuffer)
                        this.data = [...uint8Array]
                            .map(byte => byte.toString(16).padStart(2, "0").toUpperCase())
                            .join("")
                    }
                }
            } catch (err) {
                console.error("Error processing file:", err)
                alert(`Error processing ${file.name}. Please ensure the file is valid.`)
                this.file = null
                return
            }
        },
        triggerFileInput() {
            this.$refs.fileInput.click()
        },
        async handleFileSelect(event) {
            const files = event.target.files
            const multiple = files.length > 1

            for (const file of files) {
                await this.processFile(file)

                if (multiple || this.store.tabs.length == 0) {
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

                if (multiple || this.store.tabs.length > 0) {
                    this.open(true)
                } else {
                    this.dialog = true
                }
            }
        },
        async handlePaste(event) {
            if (!event.clipboardData) return

            if (event.clipboardData.files.length > 0) {
                const files = event.clipboardData.files
                const multiple = files.length > 1

                for (let file of files) {
                    await this.processFile(file)

                    if (multiple || this.store.tabs.length == 0) {
                        this.open(true)
                    } else {
                        this.dialog = true
                    }
                }
            } else {
                try {
                    this.data = event.clipboardData.getData('text/plain')
                    this.file = { name: "Pasted Content" }

                    if (this.store.tabs.length == 0) {
                        this.open(true)
                    } else {
                        this.dialog = true
                    }
                } catch (err) {
                    console.error("Error processing pasted data:", err)
                    alert("Error processing pasted data. Please ensure it is valid base64.")
                }
            }
        }
    }
}
</script>

<style scoped>
.drop-zone {
    display: flex;
    border: 2px dashed #ccc;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    justify-content: center; 
    align-items: center; 
}

.drop-zone:hover {
    background-color: #f9f9f9;
}
</style>