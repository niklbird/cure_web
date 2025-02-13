<template>
    <v-overlay
        v-model="uploadFile"
        style="justify-content: center; align-content: center"
    >
        <v-card class="pa-4" outlined>
            <v-card-title>Upload File</v-card-title>
            <v-card-text>
            <div
                class="drop-zone"
                @dragover.prevent
                @dragenter.prevent
                @drop="handleDrop"
            >
                <input type="file" ref="fileInput" hidden @change="handleFileSelect" />
                <v-btn @click="openFileExplorer" color="primary">Choose File</v-btn>
                <p v-if="selectedFile">Selected file: {{ selectedFile.name }}</p>
                <p v-else>Drag and drop a file here or click to select one.</p>
            </div>
            </v-card-text>
        </v-card>
    </v-overlay>
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
        fluid
    >
        <v-row>
            <v-col
                cols="8"
            >
            <div class="asn-tree">
                <TreeNode 
                    :tree="tree"
                    :node="findRoot()"
                    @highlight="(id) => highlightId = id"
                    @delete="(id) => deleteNode(id)"
                    @change="(id, tag, value) => updateNode(id, tag, value)"
                    @add="(id) => { addElement = true; addElementId = id }"
                />
            </div>
            </v-col>
            <v-col
                cols="4"
            >
                <div class="bytes" style="position:sticky">
                    <p>
                        <ByteNode
                            :tree="tree"
                            :node="findRoot()"
                            :selected="highlightId"
                        ></ByteNode>
                    </p>
                </div>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import { asn1Types } from '@/utils/parse'
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
        uploadFile: ""
    };
  },
  components: {
    ByteNode,
    TreeNode
  },
  methods: {
    handleFileSelect: function (event) {
        const files = event.target.files;
        if (files.length) {
            this.$refs.selectedFile.value = files[0];
        }  
    },
    openFileExplorer: function () {
        this.$refs.fileInput.value.click()
    },
    handleDrop: function(event) {
        const files = event.dataTransfer.files;
        if (files.length) {
            this.$refs.selectedFile.value = files[0];
        }        
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
    addNode: function (type, value) {
        if (!Object.prototype.hasOwnProperty.call(this.types[type], "rules") || this.types[type]["rules"](value)) {
            this.addElement = false
        } else {
            alert(value + " is not a legal value for a field of type " + this.types[type]["name"] + "\n If you intend to use an invalid value submit the value in hex notation.")
        }
    },
    updateNode: function (id, tag, value) {
        console.log("changeNode", id, tag, value)
    },
    deleteNode: function (id) {
        console.log("deleteNode", id)
    },
    setIndices: function (id) {
        this.highlightId = id
    },
    fetchTree: async function() {
        try {
            const response = await fetch("https://api.example.com/data");
            const data = await response.json();
            this.tree = data.value; // Adjust based on API response structure
        } catch (error) {
            this.tree = [
                {
                    "id": 0,
                    "tag": [
                    48,
                    "contentInfo  SEQUENCE ",
                    [
                        48
                    ]
                    ],
                    "length": [
                    2124,
                    "(2 nodes)",
                    [
                        130,
                        8,
                        76
                    ]
                    ],
                    "content": [
                    "",
                    "",
                    []
                    ],
                    "children": [
                    1,
                    2
                    ],
                    "parent": 0
                },
                {
                    "id": 1,
                    "tag": [
                    6,
                    "contentType  OBJECT IDENTIFIER ",
                    [
                        6
                    ]
                    ],
                    "length": [
                    9,
                    "",
                    [
                        9
                    ]
                    ],
                    "content": [
                    "1.2.840.113549.1.7.2",
                    "1.2.840.113549.1.7.2",
                    [
                        42,
                        134,
                        72,
                        134,
                        247,
                        13,
                        1,
                        7,
                        2
                    ]
                    ],
                    "children": [],
                    "parent": 0
                },
                {
                    "id": 2,
                    "tag": [
                    160,
                    "content  [implicit]",
                    [
                        160
                    ]
                    ],
                    "length": [
                    2109,
                    "(1 nodes)",
                    [
                        130,
                        8,
                        61
                    ]
                    ],
                    "content": [
                    "",
                    "",
                    []
                    ],
                    "children": [
                    3
                    ],
                    "parent": 0
                },
                {
                    "id": 3,
                    "tag": [
                    48,
                    "signedData  SEQUENCE ",
                    [
                        48
                    ]
                    ],
                    "length": [
                    2105,
                    "(5 nodes)",
                    [
                        130,
                        8,
                        57
                    ]
                    ],
                    "content": [
                    "",
                    "",
                    []
                    ],
                    "children": [
                    4,
                    5,
                    8,
                    21,
                    110
                    ],
                    "parent": 2
                },
                {
                    "id": 4,
                    "tag": [
                    2,
                    "version  INTEGER ",
                    [
                        2
                    ]
                    ],
                    "length": [
                    1,
                    "",
                    [
                        1
                    ]
                    ],
                    "content": [
                    "3",
                    "3",
                    [
                        3
                    ]
                    ],
                    "children": [],
                    "parent": 3
                },
                {
                    "id": 5,
                    "tag": [
                    49,
                    "digestAlgorithmsSet  SET ",
                    [
                        49
                    ]
                    ],
                    "length": [
                    13,
                    "(1 nodes)",
                    [
                        13
                    ]
                    ],
                    "content": [
                    "",
                    "",
                    []
                    ],
                },
                {
                    "id": 6,
                    "tag": [
                    48,
                    "digestAlgorithmSeq  SEQUENCE ",
                    [
                        48
                    ]
                    ],
                    "length": [
                    11,
                    "(1 nodes)",
                    [
                        11
                    ]
                    ],
                    "content": [
                    "",
                    "",
                    []
                    ],
                    "children": [
                    7
                    ],
                    "parent": 5
                },
                {
                    "id": 7,
                    tag: [
                    6,
                    "digestAlgorithm  OBJECT IDENTIFIER ",
                    [
                        6
                    ]
                    ],
                    "length": [
                    9,
                    "",
                    [
                        9
                    ]
                    ],
                    "content": [
                    "2.16.840.1.101.3.4.2.1",
                    "2.16.840.1.101.3.4.2.1",
                    [
                        96,
                        134,
                        72,
                        1,
                        101,
                        3,
                        4,
                        2,
                        1
                    ]
                    ],
                    "children": [],
                    "parent": 6
                },
                {
                    "id": 8,
                    "tag": [
                    48,
                    "encapsulatedContentInfo  SEQUENCE ",
                    [
                        48
                    ]
                    ],
                    "length": [
                    44,
                    "(2 nodes)",
                    [
                        44
                    ]
                    ],
                    "content": [
                    "",
                    "",
                    []
                    ],
                    "children": [
                    9,
                    10
                    ],
                    "parent": 3
                },
                {
                    "id": 9,
                    "tag": [
                    6,
                    "eContentType  OBJECT IDENTIFIER ",
                    [
                        6
                    ]
                    ],
                    "length": [
                    11,
                    "",
                    [
                        11
                    ]
                    ],
                    "content": [
                    "1.2.840.113549.1.9.16.1.24",
                    "1.2.840.113549.1.9.16.1.24",
                    [
                        42,
                        134,
                        72,
                        134,
                        247,
                        13,
                        1,
                        9,
                        16,
                        1,
                        24
                    ]
                    ],
                    "children": [],
                    "parent": 8
                }
                ]
        }
    }
  },
  mounted() {
    this.fetchTree(); // Fetch immediately
    // this.intervalId = setInterval(this.fetchTree, 5000); // Fetch every 5 seconds
  },
  beforeUnmount() {
    // clearInterval(this.intervalId); // Clear interval when component is destroyed
  },
};
</script>

<style scoped>
.bytes {
  width: 100%;
  background-color: #282c34; /* Dark background for contrast */
  display: flex;
  align-items: start;
  justify-content: start;
  font-family: monospace; /* Monospace for byte representation */
  font-size: 1.3rem; /* Increased font size */
  padding: 20px;
  text-align: left;
  overflow: auto; /* Scroll if text overflows */
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

</style>