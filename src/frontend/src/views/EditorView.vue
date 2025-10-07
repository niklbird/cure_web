<template>
    <!--Exporting the project as repository might take a while, show loading overlay in that time.-->
    <v-overlay
        v-model="loading"
    >
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </v-overlay>
    <!--If some files are loaded already show upload window as overlay instead of as page content.-->
    <v-overlay
        v-model="load"
    >
        <UploadCard 
            @upload="load = false"
        ></UploadCard>
    </v-overlay>
    <!--Menu for modifying/creating nodes.-->
    <v-overlay
        v-model="showElementMenu"
    >
        <ElementMenu
            :parent="parent"
            :node="activeNode"
            @close="showElementMenu = false"
        ></ElementMenu>
    </v-overlay>
    <!-- Report Card, showing all the test reports created -->
    <v-overlay
        v-model="showReports"
    >
        <v-card
        width="70vw"
        height="70vh"
        class="d-flex flex-column"
    >
        <v-card-title class="text-center bg-primary">
            REPORTS
        </v-card-title>

        <v-card-text class="flex-grow-1 overflow-y-auto">
            <v-row no-gutters class="h-100">
                <v-col cols="2">
                    <v-tabs
                        v-model="reportTab"
                        direction="vertical"
                        class="h-100"
                    >
                        <v-tab
                            v-for="(report, idx) in reports"
                            :key="`tab-${idx}`"
                            :value="idx"
                            class="text-capitalize"
                        >
                            {{ report.name.replace(/_/g, ' ') }}
                        </v-tab>
                    </v-tabs>
                </v-col>

                <v-col cols="10">
                    <v-window v-model="reportTab" class="h-100">
                        <v-window-item
                            v-for="(report, idx) in reports"
                            :key="`window-${idx}`"
                            :value="idx"
                            class="pa-4"
                        >
                            <div
                                v-for="(rp, i) in report.report.sort((a, b) => Number(b.crashed) - Number(a.crashed))"
                                :key="i"
                            >
                                <h3>{{ rp.name }}</h3><br>
                                <span :class="{crashed: rp.crashed}">{{ rp.crashed ? "Crash: True" : "Crash: False" }}</span>
                                <br>
                                <table v-if="!rp.crashed" class="table-bordered-centered">
                                    <thead>
                                    <tr>
                                            <th>ASN</th>
                                            <th>IP Prefix</th>
                                            <th>Max Length</th>
                                            <th>Trust Anchor</th>
                                        </tr>                                        
                                    </thead>
                                    <tbody>
                                        <tr
                                            v-for="(vrp, i3) in rp.vrps.content"
                                            :key="i3"    
                                        >
                                            <td>
                                                {{ vrp.asn }}
                                            </td> 
                                            <td>
                                                {{ vrp.ip.ip_s }}
                                            </td>
                                            <td>
                                                {{ vrp.ip.max_len }}
                                            </td>
                                            <td>
                                                ta
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <span :class="{crashed: rp.crashed}">Errors:</span> 
                                <br>
                                <pre 
                                    class="text-pre-wrap"
                                    :class="{'crashed-thin': rp.crashed}"
                                >
                                    {{ rp.errors }}
                                </pre>
                            </div>
                        </v-window-item>
                    </v-window>
                </v-col>
            </v-row>
        </v-card-text>

        <v-divider></v-divider>

        <v-card-actions class="pa-4">
            <v-spacer></v-spacer>
            <v-btn color="primary" variant="tonal">
                Load Test Case
            </v-btn>
            <v-btn @click="showReports = false" color="grey" variant="tonal">
                Close
            </v-btn>
        </v-card-actions>
    </v-card>
    </v-overlay>
    <v-container
        fluid
    >
        <!-- Row for the action buttons, import, export, ... -->
        <v-row>
            <v-btn
                color="primary"
                class="ma-2"
            >
                IMPORT

                <MenuComponent
                    :items="import_items"
                />
            </v-btn>
            <v-btn
                color="primary"
                class="ma-2"
            >
                EXPORT

                <MenuComponent
                    :items="formats.map(format => ({
                        title: format.toUpperCase(),
                        action: () => download(format)
                    }))"
                />           
            </v-btn>
            <v-btn
                v-if="tree.length > 0"
                color="primary"
                class="ma-2"
                @click="runTestCase"
            >
                RUN TEST CASE WITH CURE
            </v-btn>
            <v-btn
                color="primary"
                class="ma-2"
                @click="showReports = true"
            >
                SHOW REPORTS
            </v-btn>
            <v-btn
                v-if="tree.length > 0"
                color="primary"
                class="ma-2"
                @click="$store.dispatch('setAll', !$store.getters.anyExpanded)"
            >
                {{  $store.getters.anyExpanded ? "COLLAPSE ALL" : "EXPAND ALL" }}
            </v-btn>    
        </v-row>
        <v-row
            id="tab-content"
        >
            <v-col
                id="tabs"
                cols="2"
            >
                <v-tabs
                    :value="$store.currentTab" 
                    direction="vertical"
                >
                    <v-tab 
                        v-for="tab, idx in tabs" 
                        :key="idx" 
                        @click="$store.commit('tabSelected', tab.id)"
                        style="width: 100%"
                    >
                        <div
                            style="width: 100%; display: flex; justify-content: space-between; align-items: center;" 
                        >
                            <div>{{ tab.name }}</div>
                            <div>
                                <v-btn
                                    elevation="0"
                                    icon="mdi-close"
                                    size="x-small"
                                    @click.stop="$store.commit('tabRemoved', tab.id)"
                                ></v-btn>
                            </div>
                        </div>
                    </v-tab>
                    <v-tab
                        @click="$store.commit('tabAdded', 'Unnamed')"
                        style="justify-content: center;"
                    >
                        <v-icon
                            style="margin-bottom: 0.13rem;"
                        >
                            mdi-plus
                        </v-icon>
                    </v-tab>
                </v-tabs>
            </v-col>
            <v-col
                cols="7"
            >
                <div
                    :style="{ position: 'absolute', left: `${x}px`, top: `${y}px` }"
                    ref="activator"
                >
                     <MenuComponent
                        :items="context_items"
                    />           
                </div>
                <div class="asn-tree">
                    <TreeNode 
                        v-if="tree.length > 0"
                        :node="findRoot()"
                        @rightclick="(x, y, id) => openMenu(x, y, id)"
                    />
                    <p 
                        v-else
                        style="text-justify: center; font-size: 1.5rem; margin-top: 20px;"
                    >
                        No ASN.1 data loaded. Please upload a file or select an example.
                    </p>
                </div>
            </v-col>
            <v-col
                cols="3"
            >
                <div 
                    class="bytes" 
                    ref="bytes"
                >
                    <ByteNode
                        v-if="tree.length > 0"
                        :node="findRoot()"
                    ></ByteNode>
                </div>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import init from '@/rust/cure_web.js'
import ByteNode from '@/components/ByteNode.vue'
import TreeNode from '@/components/TreeNode.vue'
import UploadCard from '@/components/UploadCard.vue'
import ElementMenu from '@/components/ElementMenu.vue'
import MenuComponent from '@/components/MenuComponent.vue'
import axios from 'axios';

export default {
    data() {
        return {
            // position of context menu activator
            x: 0,
            y: 0,
            // Current parent relevant for adding children
            parent: 0,
            // Currently selected node for the context menu
            activeNode: null,
            // Flag, whether to show new element menu or not
            showElementMenu: false,
            // Information on the bytes window for scrolling
            bytesTop: 0,
            // Flag to show if upload window should be shown
            load: false,
            // While exporting, loading is set to show the loading overlay
            loading: false,
            reports: [],
            showReports: false,
            reportTab: 0,
            // Menu Items shown when clicking the "Import" button
            import_items: [
                {
                    "title": "file",
                    "action": () => this.load = true
                },
                {
                    "title": "example",
                    "action": () => "",
                    "children": [
                        {
                            "title": "roa",
                            "action": () => this.loadExample("roa")
                        },
                        {
                            "title": "mft",
                            "action": () => this.loadExample("mft")
                        },
                        {
                            "title": "crl",
                            "action": () => this.loadExample("crl")
                        },
                        {
                            "title": "cer",
                            "action": () => this.loadExample("cer")
                        },
                        {
                            "title": "asa",
                            "action": () => this.loadExample("asa")
                        },
                        {
                            "title": "gbr",
                            "action": () => this.loadExample("gbr")
                        }                        
                    ]
                }
            ],
            // Formats allowed for the export button
            formats: ["binary", "base64", "json", "repository"],
            // Menu items of the context menu, new items can be added here
            context_items: [
                {
                    "title": "Copy node",
                    "action": () => this.copy("node")
                },
                {
                    "title": "Copy content",
                    "action": () => this.copy("value")
                },
                {
                    "title": "Delete node",
                    "action": () => this.deleteNode(this.activeNode)
                },
                {
                    "title": "Edit node",
                    "action": () => { this.showElementMenu = true }
                },
                {
                    "title": "Add child",
                    "action": () => { 
                        this.parent = this.activeNode.id; 
                        this.activeNode = null; 
                        this.showElementMenu = true 
                    }
                }
            ]
        };
    },
    components: {
        ByteNode,
        TreeNode,
        UploadCard,
        ElementMenu,
        MenuComponent
    },
    computed: {
        state: function () {
            return this.$store.getters.state
        },
        tree: function () {
            console.log(this.$store.getters.tree)
            return this.$store.getters.tree
        },
        tabs: function () {
            return this.$store.getters.tabs
        },
        highlighted: function () {
            return this.$store.getters.highlighted
        },
    },
    watch: {
        highlighted: function (id) {
            // Scroll the byte view to the bytes of the currently selected element
            if (!Object.prototype.hasOwnProperty.call(this.$store.getters.positions, id)) {
                return
            }
            // Calculate scroll position to center the target
            const scrollTop = (this.$store.getters.positions[id][0] - this.bytesTop) - 50;
            const byteContainer = this.$refs.bytes

            // Smooth scrolling
            byteContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
    },
    methods: {
        uint8ToBase64(uint8Array) {
            const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            let result = '';
            let i;

            for (i = 0; i < uint8Array.length; i += 3) {
                const byte1 = uint8Array[i];
                const byte2 = i + 1 < uint8Array.length ? uint8Array[i + 1] : 0;
                const byte3 = i + 2 < uint8Array.length ? uint8Array[i + 2] : 0;

                const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

                result += base64Chars[(triplet >> 18) & 0x3F];
                result += base64Chars[(triplet >> 12) & 0x3F];
                result += i + 1 < uint8Array.length ? base64Chars[(triplet >> 6) & 0x3F] : '=';
                result += i + 2 < uint8Array.length ? base64Chars[triplet & 0x3F] : '=';
            }

            return result;
        },
        async runTestCase() {
            // The file is embedded in a repository and setup to be run on the test backend
            let z = this.state.repositorify();
            const serialized = this.uint8ToBase64(z)
            // const serialized = btoa(String.fromCharCode(z))
            // let serialized = z.toBase64();
 
            let port = 21999;
            let url = `http://localhost:${port}/execute`

            try {
                const response = await axios.post(url, serialized, {
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });

                this.showReports = true;

                let report = response.data.map(JSON.parse)
                console.log(report)
                // Add new report to list of  reports
                this.reports.push({
                    name: this.$store.getters.name,
                    state: this.state.encode_store(),
                    report: report
                })
            
            } catch (error) {
                console.error("Error during test case execution:", error);
                console.log(serialized);
                alert("Error during test case execution. Please check the console for details.");
            }
        },  
        openMenu(x, y, id) {
            // X and Y are the coordinates of the rightclick event
            // move the activator component to there and click it so that
            // the context menu opens
            this.x = x;
            this.y = y;
            this.$refs.activator.click()
            this.activeNode = this.$store.getters.getNodeFromId(id);
        },
        copy (type) {
            // TODO It should be possible to copy the content of a node in a variety of different
            // formats, and also possible to copy and paste full nodes to a new location in the tree
            if (type == "node") {
                this.$store.commit("nodeCopied", this.activeNode)
            } else if (type == "value") {
                navigator.clipboard.writeText(this.activeNode.content[1]);
            }
        },
        deleteNode: function() {
            // Confirm with user that he actually wants to delete the node
            confirm("Are you sure you want to delete this node?") && this.$store.commit("nodeRemoved", {
                id: this.activeNode.id,
                tab: this.$store.state.currentTab
            })
        },
        findRoot: function () {
            // Identify the root of the tree and start ByteTree and NodeTree from there
            const candidates = this.tree.filter((node) => node.id == node.parent)
            if (candidates.length > 0) {
                return candidates[0]
            } else {
                return {
                    children: []
                }
            }
        },
        download: function (format) {
            // Download current state in variety of formats
            let content = null
            let fileName = this.$store.getters.name
            let type = ""

            this.loading = true
            switch (format) {
                case "binary":
                    content = this.state.export_bin()
                    fileName += ".bin"
                    type = "application/octet-stream"
                    break 
                case "base64":
                    content = this.state.export_base64()
                    fileName += ".txt"
                    type = "text/plain"
                    break
                case "json":
                    content = this.state.encode_store()
                    fileName += ".json"
                    type = "application/json"
                    break
                case "repository":
                    content = this.state.repositorify()
                    fileName += ".tar.gz"
                    type = "application/x-gzip"
                    break
            }
            
            // Create a Blob with the content
            const blob = new Blob([content], { type: type });
            
            // Create a temporary anchor element
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            
            // Trigger download by clicking the link
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            this.loading = false
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        },
        loadExample: function (type) {
            this.$store.commit("tabAdded", type + "_example")
            this.$store.commit("stateSet", {
                tab: this.$store.state.currentTab,
                type: "example",
                data: type
            })                        
        },
        handleKeydown (event) {
            // Key handlers to allow undo and redo using ctrl + z and ctrl + y
            if (event.ctrlKey && event.key === 'z') {
                this.$store.dispatch('undo')
            }
            if (event.ctrlKey && event.key === 'y') {
                this.$store.dispatch('redo')
            }
        },
    },
    async beforeCreate() {
        await init()
    },
    mounted() {
        window.addEventListener('keydown', this.handleKeydown)
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.handleKeydown)
    },
    updated() {
        // Get position of the byte view so that scrolling works properly
        if (this.$refs.bytes) {
            const byteContainer = this.$refs.bytes
            const containerRect = byteContainer.getBoundingClientRect()
            this.bytesTop = containerRect.top
        }
    }
};
</script>

<style>
.tag {
    color: #7EBDC2;
}

.label {
    color: #E63946;
    font-weight: bold;

}

.length {
    color: #60A561;
}

.content {
    color: rgb(var(--v-theme-content));;
    font-weight: bold;
}

.table-bordered-centered {
  border-collapse: collapse;
  width: 100%;
}

.table-bordered-centered th,
.table-bordered-centered td {
  border: 1px solid #000;
  text-align: center;
  vertical-align: middle;
  padding: 8px;
}

.crashed {
    color: red;
    font-weight: bold;
}

.crashed-thin {
    color: red;
}

.bytes {
    width: 100%;
    height: 84vh;
    display: flex;
    font-family: monospace; /* Monospace for byte representation */
    font-size: 1rem; /* Increased font size */
    padding: 20px;
    overflow: scroll; 
    position: sticky;
    border: 1px solid #ccc;
}

.asn-tree {
    font-family: monospace;
    overflow: scroll;
    width: 100%;
    height: 84vh;
    border: 1px solid #ccc;
}

.v-overlay {
    align-items: center; 
    justify-content: center;
}

</style>