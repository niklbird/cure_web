<template>
    <v-container
        fluid
    >
        <v-dialog
            v-model="openDialog" 
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
                        @click="() => (openDialog = false)"
                    >
                        Cancel
                    </v-btn>
                </v-card-actions>
                </v-card>
        </v-dialog>        
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
            <input type="file" ref="fileInput" class="hidden" @change="handleFileSelect" />
        </div>
    </v-container>    
</template>

<script>
export default {
    data() {
        return {
            data: null,
            file: null,
            dragOver: false,
            openDialog: false
        };
    },
    emits: ["uploadDone"],
    computed: {
        tabs() {
            return this.$store.getters.tabs
        }
    },
    methods: {
        open: function (newTab) {
            this.openDialog = false
            if (newTab) {
                this.$store.commit("tabAdded", this.file.name || "Unnamed")
                this.$store.commit("stateSet", {
                    tab: this.$store.state.currentTab,
                    data: this.data,
                    type: this.file.name.endsWith(".json") ? "json" : "hex"
                })
            } else {
                this.$store.commit("stateSet", {
                    tab: this.$store.state.currentTab,
                    data: this.data,
                    type: this.file.name.endsWith(".json") ? "json" : "hex"
                })
            }
            this.$emit("uploadDone")
        },
        uploadFile: function () {
            const reader = new FileReader();
            const that = this

            if (this.file.name.endsWith(".json")) {
                reader.onload = async function (e) {
                    try {
                        const enc = new TextDecoder("utf-8");
                        that.data = enc.decode(e.target.result);

                        if (!that.tabs.length == 0) {
                            that.open(true)
                        } else {
                            that.openDialog = true
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
                        if (that.tabs.length == 0) {
                            that.open(true)
                        } else {
                            that.openDialog = true
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
            this.$refs.fileInput.click()
        },
        handleFileSelect: function (event) {
            const selectedFile = event.target.files[0]
            this.file = selectedFile
            this.uploadFile()
        },
        handleDrop: function(event) {
            this.dragOver = false;
            const droppedFile = Array.from(event.dataTransfer.files)[0]
            this.file = droppedFile
            this.uploadFile()
        },
        handlePaste: function(event) {
            if (!event.clipboardData || !event.clipboardData.files.length) {
                // No files in clipboard
                // Paste text
                try {
                    const text = event.clipboardData.getData('text/plain');

                    // Convert binary string to Uint8Array
                    const uint8Array = Uint8Array.fromBase64(text);

                    // Convert to uppercase hex string
                    const hexString = [...uint8Array]
                        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
                        .join('');

                    this.data = hexString
                    if (!this.tabs.length == 0) {
                        this.open(true)   
                    } else {
                        this.openDialog = true
                    }              
                } catch (err) {
                    console.log("Error processing pasted data: " + err)
                    alert("Error processing pasted data. Please ensure it is valid ASN.1 data.")
                }
            } else {
                const pastedFile = event.clipboardData.files[0]
                this.file = pastedFile
                this.uploadFile()                
            }
        },
    },
};
</script>

<style>
.hidden {
  display: none;
}

.drop-zone {
    display:flex;
    border: 2px dashed #ccc;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    justify-content: center; 
    align-items: center; 
    height: 50vh;
}

.hovered {
    background-color: #f9f9f9 !important;
}

.drop-zone:hover {
  background-color: #f9f9f9;
}
</style>