<template>
    <v-container
        fluid
    >
        <!-- Dialog to confirm if the file should be opened in a new tab or the current tab -->
        <v-dialog
            v-model="dialog" 
            max-width="500"
        >
            <v-card title="Open in new tab?">
                <v-card-text>
                    Do you want to open the file in a new tab?
                </v-card-text>

                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn
                        @click="open(true)"
                    >
                        New tab
                    </v-btn>
                    <v-btn
                        @click="open(false)"
                    >
                        This tab
                    </v-btn>
                    <v-btn
                        @click="() => (dialog = false)"
                    >
                        Cancel
                    </v-btn>
                </v-card-actions>
                </v-card>
        </v-dialog>        
        <!-- Drop zone with handlers for paste, drag and drop and clicks -->
        <v-card>
            <v-card-text
                style="background-color: white; border-radius: 8px;"
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
                                <span 
                                    class="mt-4"
                                    style="vertical-align:middle"
                                >
                                    {{ file.name }}
                                </span>
                            </div>
                        </span>                      
                    </v-row>
                    <v-row>
                        <v-textarea @click.stop></v-textarea>
                    </v-row>
                </v-col>            
                <!-- File input is hidden but triggered when clicking anywhere in the dropzone -->
                <input type="file" ref="fileInput" style="display: none" @change="handleFileSelect" />
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                    color="primary"
                >
                    Load Example
                    <MenuComponent :items="example_items" />
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-container>    
</template>

<script>
import MenuComponent from "@/components/MenuComponent.vue";

export default {
    data() {
        return {
            data: null,
            file: null,
            dragOver: false,
            dialog: false,
            example_items: [
                {
                    "title": "ROA",
                    "action": () => this.loadExample("roa")
                },
                {
                    "title": "MFT",
                    "action": () => this.loadExample("mft")
                },
                {
                    "title": "CRL",
                    "action": () => this.loadExample("crl")
                },
                {
                    "title": "CER",
                    "action": () => this.loadExample("cer")
                },
                {
                    "title": "ASA",
                    "action": () => this.loadExample("asa")
                },
                {
                    "title": "GBR",
                    "action": () => this.loadExample("gbr")
                },
                {
                    "title": "TLS",
                    "action": () => this.loadExample("tls")
                }
            ]
        };
    },
    emits: ["upload"],
    components: {
        MenuComponent
    },
    methods: {
        loadExample(type) {
            this.$store.dispatch("addTab", type + "_example")
            this.$store.commit("stateSet", {
                tab: this.$store.getters.currentTab,
                type: "example",
                data: type
            })
            this.$emit("upload");
        },
        open(newTab) {
            this.dialog = false;
            const type = this.file.name.endsWith(".json") ? "json" : "hex";

            if (newTab) {
                this.$store.dispatch("addTab", this.file.name || "Unnamed");
            } else {
                // If opening in the current tab, you might want to rename it.
                // this.$store.commit("tabRenamed", { tabId: this.$store.state.currentTab, newName: this.file.name || "Unnamed" });
            }

            this.$store.commit("stateSet", {
                tab: this.$store.getters.currentTab,
                data: this.data,
                type: type
            });

            this.$emit("upload");
        },

        /**
         * NEW: This async function processes a single file.
         * It replaces the old uploadFile method.
         * @param {File} file - The file to process.
         */
        async processFile(file) {
            this.file = file; // Set the current file being processed

            try {
                if (file.name.endsWith(".json")) {
                    // Modern way to read a file as text
                    this.data = await file.text();
                } else {
                    try {
                        const decoder = new TextDecoder('utf-8', { fatal: true });
        
                        // If this line succeeds, the file is valid UTF-8 text.
                        this.data = decoder.decode(arrayBuffer);
                    } catch(e) {
                        // Modern way to read a file as an ArrayBuffer
                        const arrayBuffer = await file.arrayBuffer();
                        const uint8Array = new Uint8Array(arrayBuffer);
                        this.data = [...uint8Array]
                            .map(byte => byte.toString(16).padStart(2, "0").toUpperCase())
                            .join("");
                    }
                }
            } catch (err) {
                console.error("Error processing file:", err);
                alert(`Error processing ${file.name}. Please ensure the file is valid.`);
                this.file = null; // Clear file on error
                return; // Stop execution for this file
            }
        },

        triggerFileInput() {
            this.$refs.fileInput.click();
        },

        /**
         * MODIFIED: Made async to handle multiple files sequentially.
         */
        async handleFileSelect(event) {
            const files = event.target.files;
            const multiple = files.length > 1;

            for (const file of files) {
                await this.processFile(file);

                // Logic to decide whether to show the dialog or open in a new tab
                if (multiple || this.$store.getters.tabs.length == 0) {
                    this.open(true); // Always open in a new tab for multiple files or if other tabs exist
                } else {
                    this.dialog = true; // Show dialog only for the first single file
                }
            }
        },

        /**
         * MODIFIED: Made async to handle multiple files sequentially.
         */
        async handleDrop(event) {
            this.dragOver = false;
            const files = event.dataTransfer.files;
            const multiple = files.length > 1;

            for (const file of files) {
                await this.processFile(file);

                if (multiple || this.$store.getters.tabs.length > 0) {
                    this.open(true);
                } else {
                    this.dialog = true;
                }
            }
        },
        async handlePaste(event) {
            if (!event.clipboardData) return;

            // Handle pasted files
            if (event.clipboardData.files.length > 0) {
                const files = event.clipboardData.files;
                const multiple = files.length > 1;

                for (let file of files) {
                    await this.processFile(file);

                    if (multiple || this.$store.getters.tabs.length > 0) {
                        this.open(true);
                    } else {
                        this.dialog = true;
                    }
                }
            } else { // Handle pasted text
                try {
                    this.data = event.clipboardData.getData('text/plain');
                    // Assuming fromBase64 is a polyfill or custom prototype method
                    // const uint8Array = Uint8Array.fromBase64(text);
                    // this.data = [...uint8Array]
                    //    .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
                    //    .join('')
                    // Create a placeholder file object for the `open` method
                    this.file = { name: "Pasted Content" };

                    if (this.$store.getters.tabs.length > 0) {
                        this.open(true);
                    } else {
                        this.dialog = true;
                    }
                } catch (err) {
                    console.error("Error processing pasted data:", err);
                    alert("Error processing pasted data. Please ensure it is valid base64.");
                }
            }
        },
    },
};
</script>

<style scoped>
/* Style of the drop zone, dashed border with centered text and pointer cursor */
.drop-zone {
    display:flex;
    border: 2px dashed #ccc;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    justify-content: center; 
    align-items: center; 
}

/* Style is automatically applied when cursor hovers over the drop zone */
.drop-zone:hover {
  background-color: #f9f9f9;
}

/* Style is invoked when a file is dragged over the drop zone */
.hovered {
    background-color: #f9f9f9 !important;
}
</style>