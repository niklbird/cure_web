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
                    @click="addNode(type, content)"
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
            class="border-2 border-dashed border-gray-300 p-6 rounded-lg text-center cursor-pointer"
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
            >
                Save changed file
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
                    @change="(id, value) => updateNode(id, value)"
                    @add="(id) => { addElement = true; addElementId = id }"
                />
            </div>
            </v-col>
            <v-col
                cols="4"
            >
                <div class="bytes" ref="bytes">
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
        bytePosition: {}
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
        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);

            // Convert each byte to a two-character hex representation
            const hexString = [...uint8Array]
                .map(byte => byte.toString(16).padStart(2, "0").toUpperCase()) // Convert to uppercase hex
                .join(""); // Join into a single string

            try {
                that.state = new State(hexString); // Pass hex string to WASM
                that.tree = JSON.parse(that.state.get_nodes())
            } catch (err) {
                console.log("Error processing WASM module: " + err)
            }
        };
        reader.onerror = function (e) {
            console.log("Error reading file: " + e.target.error)
        };

        reader.readAsArrayBuffer(this.file);  // Use ArrayBuffer for raw binary
    },
    triggerFileInput: function () {
        this.$refs.fileInput.click()
    },
    handleFileSelect: function (event) {
        const selectedFile = event.target.file
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
    addNode: function (type, value) {
        if (!Object.prototype.hasOwnProperty.call(this.types[type], "rules") || this.types[type]["rules"](value)) {
            this.state.add_node(type, value, this.addElementId)
            this.tree = JSON.parse(this.state.get_nodes())
            this.addElement = false
        } else {
            alert(value + " is not a legal value for a field of type " + this.types[type]["name"] + "\n If you intend to use an invalid value submit the value in hex notation.")
        }
    },
    updateNode: function (id, value) {
        this.state.adapt_node_content(id, value)
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

        const byteContainer = this.$refs.bytes
        // Get positions
        const containerRect = byteContainer.getBoundingClientRect();

        // Calculate scroll position to center the target
        const scrollTop = byteContainer.scrollTop + (this.bytePosition[id][0] - containerRect.top) - (byteContainer.clientHeight / 2) + (this.bytePosition[id][1] / 2);

        // Smooth scrolling
        console.log(this.bytePosition[id])
        console.log(byteContainer.scrollTop, containerRect.top, byteContainer.clientHeight)
        byteContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  },
  async beforeCreate() {
    await init()
  },
  mounted() {
    // this.tree = this.state.get_nodes()
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