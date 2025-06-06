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
        <div
            class="drop-zone"
            :class="{ 'hovered': dragOver }"  
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
            @paste="handlePaste"
        >
            <span>
                Paste base64 content, drag & drop files here or click to browse
                <div v-if="file">
                    <span 
                        class="mt-4"
                        style="vertical-align:middle"
                    >
                        {{ file.name }}
                    </span>
                </div>
            </span>
            <!-- File input is hidden but triggered when clicking anywhere in the dropzone -->
            <input type="file" ref="fileInput" style="display: none" @change="handleFileSelect" />
        </div>
    </v-container>    
</template>

<script>
export default {
    // Component consists of a drop zone for file upload, drag & drop functionality, and paste support for base64 content.
    data() {
        return {
            data: null,
            file: null,
            // Flag to indicate if a file is being dragged over the drop zone
            dragOver: false,
            // Flag to indicate if dialog window should be shown
            dialog: false
        };
    },
    emits: ["upload"],
    methods: {
        open: function (newTab) {
            this.dialog = false
            if (newTab) {
                // File should be opened in a new tab
                this.$store.commit("tabAdded", this.file.name || "Unnamed")
                this.$store.commit("stateSet", {
                    tab: this.$store.state.currentTab,
                    data: this.data,
                    type: this.file.name.endsWith(".json") ? "json" : "hex"
                })
            } else {
                // File should be opened in the current tab
                // Rename tab to the current file name ?
                // this.$store.commit("tabRenamed", this.file.name || "Unnamed")
                this.$store.commit("stateSet", {
                    tab: this.$store.state.currentTab,
                    data: this.data,
                    type: this.file.name.endsWith(".json") ? "json" : "hex"
                })
            }
            this.$emit("upload")
        },
        uploadFile: function (multiple) {
            const reader = new FileReader();
            // To access `this` inside the reader's onload function, we need to store it in a variable
            // because the context of `this` changes inside the function.
            const that = this

            // Two kinds of files are supported:
            // - JSON project files (created when using the EXPORT JSON button)
            // - Binary ASN files
            if (this.file.name.endsWith(".json")) {
                reader.onload = async function (e) {
                    try {
                        const enc = new TextDecoder("utf-8");
                        that.data = enc.decode(e.target.result);

                        if (multiple || !that.$store.getters.tabs.length == 0) {
                            that.open(true)
                        } else {
                            that.dialog = true
                        }
                    } catch (err) {
                        console.log("Error processing JSON file: " + err)
                        alert("Error processing file. Please ensure it is project file.")
                        that.file = null
                    }
                }
            } else {
                reader.onload = async function (e) {
                    try {
                        const arrayBuffer = e.target.result;
                        const uint8Array = new Uint8Array(arrayBuffer);

                        // Convert each byte to a two-character hex representation
                        const hexString = [...uint8Array]
                            // Convert to uppercase hex
                            .map(byte => byte.toString(16).padStart(2, "0").toUpperCase()) 
                            // Join into a single string
                            .join(""); 
                        that.data = hexString
                        if (multiple || that.$store.getters.tabs.length == 0) {
                            that.open(true)
                        } else {
                            that.dialog = true
                        }
                    } catch (err) {
                        console.log("Error processing WASM module: " + err)
                        alert("Error processing file. Please ensure it is valid ASN.1 data.")
                        that.file = null
                    }
                };
            }
            reader.onerror = function (e) {
                console.log("Error reading file: " + e.target.error)
                alert("Error reading file.")
            };

            reader.readAsArrayBuffer(this.file);  // Use ArrayBuffer for raw binary
        },
        triggerFileInput: function () {
            // Clicking anywhere in the drop zone will trigger the file input click
            // and open the file dialog
            this.$refs.fileInput.click()
        },
        handleFileSelect: function (event) {
            // Handle file selection from the file input
            for (const file of event.target.files) {
                this.file = file
                this.uploadFile(event.target.files.length > 1)
            }
        },
        handleDrop: function(event) {
            // Handle file drop into the drop zone
            this.dragOver = false;
            for (const file of event.dataTransfer.files) {
                this.file = file
                this.uploadFile(event.dataTransfer.files.length > 1)
            }
        },
        handlePaste: function(event) {
            if (!event.clipboardData) return
            if (!event.clipboardData.files.length) {
                // No files in clipboard
                // -> Try to paste text
                try {
                    const text = event.clipboardData.getData('text/plain');

                    // The input is expected to be a base64 encoded string
                    // Convert base64 string to Uint8Array
                    const uint8Array = Uint8Array.fromBase64(text);

                    // Convert to uppercase hex string
                    const hexString = [...uint8Array]
                        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
                        .join('');

                    this.data = hexString
                    if (!this.$store.getters.tabs.length == 0) {
                        this.open(true)   
                    } else {
                        this.dialog = true
                    }              
                } catch (err) {
                    console.log("Error processing pasted data: " + err)
                    alert("Error processing pasted data. Please ensure it is valid ASN.1 data.")
                }
            } else {
                // Files in clipboard
                // -> Paste file
                for (let file of event.clipboardData.files) {
                    this.file = file
                    this.uploadFile(event.clipboardData.files.length > 1)
                }            
            }
        },
    },
};
</script>

<style>
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