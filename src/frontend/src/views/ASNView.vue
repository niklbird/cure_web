<template>
    <v-overlay
        v-model="addElement"
        style="justify-content: center; align-content: center"
    >
        <v-card
            width="50vw"
            height="50vh"
        >
            <v-card-title>Add new element</v-card-title>
            <v-select
                v-model="type"
                label="Select"
                :items="Object.entries(types).map((item => {
                    [key, value] = item
                    return {
                        'title': value.name,
                        'value': key
                    }
                }))"
            >
            </v-select>
            <v-card-text 
                v-if="type && type != 16 && type != 17"
            >
                <v-row>
                    <v-col
                        cols="10"
                    >
                        <v-text-field
                            v-model="content"
                            label="Field Value"
                            :placeholder="types[type]['example']"
                        >
                        </v-text-field>       
                        <v-text-field
                            v-model="label"
                            label="Label"
                            placeholder="Name"
                        >
                        </v-text-field>                   
                    </v-col>
                    <v-col
                        cols="2"
                    >
                    <v-tooltip 
                        bottom
                    >
                        <template v-slot:activator="{ props }">
                            <v-icon v-bind="props">mdi-help</v-icon>
                        </template>
                        <span>
                            <span
                                v-for="part, idx in types[type]['description'].match(/.{1,100}/g)"
                                :key=idx
                            >
                                {{ part }}<br>
                            </span>
                        </span>
                    </v-tooltip>               
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-btn
                    @click="addNode(type, label, content)"
                >
                    Add element
                </v-btn>
                <v-btn
                    @click="addElement = false"
                >
                    Close
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-overlay>
    <v-container
        v-if="state === null"
        style="justify-content: center; align-content: center"
    >
        <h1>Upload file</h1>
        <div
            class="pa-10 border-2 border-dashed border-gray-300 p-6 rounded-lg text-center cursor-pointer"
            @dragover.prevent="dragOver = true"
            @dragleave.prevent="dragOver = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
            :class="{ 'hovered': dragOver }"
            style="display: flex; justify-content: center; align-items: center; height: 50vh;"    
        >
            <span class="text-gray-500">
                Drag & drop files here or click to browse
                <div v-if="file" class="mt-4">
                    <span class="text-gray-700" style="vertical-align:middle">{{ file.name }}</span>
                </div>
            </span>
            <input type="file" ref="fileInput" class="hidden" @change="handleFileSelect" />
        </div>
        <v-btn @click=uploadFile class="ma-2">Upload</v-btn>
    </v-container>
    <v-container
        v-if="state !== null"
        fluid
        max-height="100vh"
        max-width="100vw"
    >
        <v-row>
            <v-btn
                @click="state = null; file = null"
                class="ma-2"
            >
                Load new file
            </v-btn>
            <v-btn
                class="ma-2"
                @click="download('binary')"
            >
                Export binary
            </v-btn>
            <v-btn
                class="ma-2"
                @click="download('base64')"
            >
                Export base64
            </v-btn>
            <v-btn
                class="ma-2"
                @click="download('json')"
            >
                Save project with labels
            </v-btn>
        </v-row>
        <v-row>
            <v-col
                cols="8"
            >
            <div class="asn-tree">
                <TreeNode 
                    :tree="tree"
                    :node="findRoot()"
                    @highlight="(id) => highlightBytes(id)"
                    @delete="(id) => deleteNode(id)"
                    @change="(id, field, value) => updateNode(id, field, value)"
                    @add="(id) => { addElement = true; addElementId = id }"
                />
            </div>
            </v-col>
            <v-col
                cols="4"
            >
                <div 
                    class="bytes" 
                    ref="bytes"
                >
                    <p>
                        <ByteNode
                            :tree="tree"
                            :node="findRoot()"
                            :selected="highlightId"
                            @position="(id, top, height) => addPosition(id, top, height)"
                        ></ByteNode>
                    </p>
                </div>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import { asn1Types } from '@/utils/parse'
import init, { State } from '@/rust/cure_web.js'
import ByteNode from '@/components/ByteNode.vue'
import TreeNode from '@/components/TreeNode.vue'
import { nextTick } from "vue";


export default {
  data() {
    return {
        highlightId: -1,
        tree: [],
        intervalId: null,
        types: asn1Types,
        addElement: false,
        addElementId: -1,
        type: null,
        content: "",
        state: null,
        file: null,
        dragOver: false,
        bytePosition: {},
        label: "",
        bytesTop: 0
    };
  },
  components: {
    ByteNode,
    TreeNode
  },
  methods: {
    uploadFile: function () {
        const reader = new FileReader();
        const that = this

        if (this.file.name.endsWith(".json")) {
            reader.onload = async function (e) {
                const enc = new TextDecoder("utf-8");
                const jsonData = enc.decode(e.target.result);
                that.state = State.from_stored(jsonData)
                that.tree = JSON.parse(that.state.get_nodes())
                await nextTick()

                const byteContainer = that.$refs.bytes
                const containerRect = byteContainer.getBoundingClientRect()
                that.bytesTop = containerRect.top
            }

        } else {
            reader.onload = async function (e) {
            try {
                const arrayBuffer = e.target.result;
                const uint8Array = new Uint8Array(arrayBuffer);

                // Convert each byte to a two-character hex representation
                const hexString = [...uint8Array]
                .map(byte => byte.toString(16).padStart(2, "0").toUpperCase()) // Convert to uppercase hex
                .join(""); // Join into a single string
                that.state = new State(hexString); // Pass hex string to WASM
                that.tree = JSON.parse(that.state.get_nodes())
                await nextTick()

                const byteContainer = that.$refs.bytes
                const containerRect = byteContainer.getBoundingClientRect()
                that.bytesTop = containerRect.top
            } catch (err) {
                console.log("Error processing WASM module: " + err)
            }
        };
        }
        reader.onerror = function (e) {
            console.log("Error reading file: " + e.target.error)
        };

        reader.readAsArrayBuffer(this.file);  // Use ArrayBuffer for raw binary
    },
    triggerFileInput: function () {
        this.$refs.fileInput.click()
    },
    handleFileSelect: function (event) {
        console.log(event)
        const selectedFile = event.target.files[0]
        this.file = selectedFile
    },
    handleDrop: function(event) {
        this.dragOver = false;
        const droppedFile = Array.from(event.dataTransfer.files)[0]
        this.file = droppedFile
    },

    findRoot: function () {
        const candidates = this.tree.filter((node) => node.id == node.parent)
        if (candidates.length > 0) {
            return candidates[0]
        } else {
            return {
                children: []
            }
        }
    },
    addPosition: function(id, top, height) {
        this.bytePosition[id] = [top, height]
    },
    addNode: function (type, label, value) {
        if (!Object.prototype.hasOwnProperty.call(this.types[type], "rules") || this.types[type]["rules"](value)) {
            this.state.add_node(type, value, this.addElementId, label)
            this.tree = JSON.parse(this.state.get_nodes())
            this.addElement = false
        } else {
            alert(value + " is not a legal value for a field of type " + this.types[type]["name"] + "\n If you intend to use an invalid value submit the value in hex notation.")
        }
    },
    updateNode: function (id, field, value) {
        if (field == "content") {
            this.state.adapt_node_content(id, value)
        }
        if (field == "length") {
            this.state.adapt_node_length(id, value)
        }
        if (field == "tag") {
            this.state.adapt_node_tag(id, value)
        }
        if (field == "label") {
            this.state.adapt_node_label(id, value)
        }
        this.tree = JSON.parse(this.state.get_nodes())
    },
    deleteNode: function (id) {
        this.state.remove_node(id)
        this.tree = JSON.parse(this.state.get_nodes())
    },
    setIndices: function (id) {
        this.highlightId = id
    },
    highlightBytes: function (id) {
        this.highlightId = id

        if (!Object.prototype.hasOwnProperty.call(this.bytePosition, id)) {
            return
        }

        // Calculate scroll position to center the target
        const scrollTop = (this.bytePosition[id][0] - this.bytesTop) - 50;
        const byteContainer = this.$refs.bytes

        // Smooth scrolling
        byteContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
    },
    download: function (format) {
        let content = null
        let fileName = ""
        let type = ""

        switch (format) {
            case "binary":
                content = this.state.export_bin()
                fileName = "data.bin"
                type = "application/octet-stream"
                break 
            case "base64":
                content = this.state.export_base64()
                fileName = "data.txt"
                type = "text/plain"
                break
            case "json":
                content = this.state.encode_store()
                fileName = "data.json"
                type = "application/json"
                break
        }
        
        // Create a Blob with the content
        const blob = new Blob([content], { type: type });
        
        // Create a temporary anchor element
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    }
  },
  async beforeCreate() {
    await init()
  },
  mounted() {
  },
  beforeUnmount() {
    // clearInterval(this.intervalId); // Clear interval when component is destroyed
  },
};
</script>

<style scoped>
.bytes {
  width: 100%;
  height: 80vh;
  background-color: #282c34; /* Dark background for contrast */
  display: flex;
  align-items: start;
  justify-content: start;
  font-family: monospace; /* Monospace for byte representation */
  font-size: 1.3rem; /* Increased font size */
  padding: 20px;
  text-align: left;
  overflow: scroll; /* Scroll if text overflows */
  position: sticky;
  top: 0;
}

.space {
  white-space: pre;  /* Preserves spaces */
  display: inline-block; /* Ensures it takes up space */
  width: 1rem; /* Adjust for desired space size */
}

.asn-tree {
background-color: #282c34;
color: white;
padding: 20px;
font-family: monospace;
text-align: left;
overflow: scroll;
}

.drop-zone {
  border: 2px dashed #ccc;
  padding: 20px;
  text-align: center;
  cursor: pointer;
}

.drop-zone:hover {
  background-color: #f9f9f9;
}

.hidden {
  display: none;
}

.hovered {
    background-color: rgba(255, 255, 255, 0.1)
}

</style>