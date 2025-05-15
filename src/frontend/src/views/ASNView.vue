<template>
    <UploadCard 
        v-if="tabs.length == 0"
    ></UploadCard>
    <v-container
        v-if="tabs.length > 0"
        fluid
    >
        <v-overlay
            v-model="load"
            style="align-items: center; justify-content: center;"
            
        >
            <v-card
                width="50vw"
                height="53vh"
            >
                <UploadCard @upload-done="load = false"></UploadCard>
            </v-card>
        </v-overlay>
        <v-overlay
            v-model="showElementMenu"
            style="align-items: center; justify-content: center;"
        >
            <ElementMenu
                :node="activeNode"
                :edit="edit"
                @close="showElementMenu = false"
            ></ElementMenu>
        </v-overlay>
        <v-row>
            <v-btn
                color="primary"
                class="ma-2"
            >
                IMPORT

                <v-menu
                    open-on-hover
                    activator="parent"
                >
                    <v-list>
                        <v-list-item
                            @click="load = true"
                        >
                            <v-list-item-title>FILE</v-list-item-title>
                        </v-list-item>
                        <v-list-item>
                            <v-list-item-title>EXAMPLE</v-list-item-title>
                            <template v-slot:append>
                                <v-icon icon="mdi-menu-right" size="x-small"></v-icon>
                            </template>
                            <v-menu
                                :open-on-focus="false"
                                activator="parent"
                                open-on-hover
                                submenu
                            >
                                <v-list>
                                    <v-list-item
                                        @click="loadExample('roa')"
                                    >
                                        <v-list-item-title>RoA</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item
                                        @click="loadExample('mft')"
                                    >
                                        <v-list-item-title>MFT</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item
                                        @click="loadExample('crl')"
                                    >
                                        <v-list-item-title>CRL</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item
                                        @click="loadExample('cer')"
                                    >
                                        <v-list-item-title>CER</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item
                                        @click="loadExample('asa')"
                                    >
                                        <v-list-item-title>ASA</v-list-item-title>
                                    </v-list-item>
                                    <v-list-item
                                        @click="loadExample('gbr')"
                                    >
                                        <v-list-item-title>GBR</v-list-item-title>
                                    </v-list-item>
                                </v-list>
                            </v-menu>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </v-btn>
            <v-btn
                color="primary"
                class="ma-2"
            >
                EXPORT

                <v-menu
                    open-on-hover
                    activator="parent"
                >
                    <v-list>
                        <v-list-item
                            @click="download('binary')"
                        >
                            <v-list-item-title>BINARY</v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            @click="download('base64')"
                        >
                            <v-list-item-title>BASE64</v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            @click="download('json')"
                        >
                            <v-list-item-title>JSON</v-list-item-title>
                        </v-list-item>
                        <v-list-item
                            @click="download('repository')"
                        >
                            <v-list-item-title>REPOSITORY</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>                
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
                    ref="activator"
                    :style="{ position: 'absolute', left: `${x}px`, top: `${y}px` }"
                ></div>

                <v-menu
                    v-model="contextMenuVisible"
                    absolute
                    :activator="$refs.activator"
                >
                    <v-list>
                        <v-list-item @click="copy('node')">
                            <v-list-item-title>Copy node</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="copy('value')">
                            <v-list-item-title>Copy content</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="deleteNode(activeNode)">
                            <v-list-item-title>Delete node</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="edit = true; showElementMenu = true">
                            <v-list-item-title>Edit node</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="edit = false; showElementMenu = true">
                            <v-list-item-title>Add child</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>

                <div class="asn-tree">
                    <TreeNode 
                        v-if="tree"
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
                        v-if="tree"
                        :node="findRoot()"
                    ></ByteNode>
                </div>
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import init, { State } from '@/rust/cure_web.js'
import ByteNode from '@/components/ByteNode.vue'
import TreeNode from '@/components/TreeNode.vue'
import UploadCard from '@/components/UploadCard.vue'
import ElementMenu from '@/components/ElementMenu.vue'

export default {
    data() {
        return {
            x: 0,
            y: 0,
            activeNode: null,
            contextMenuVisible: false,
            showElementMenu: false,
            highlightId: -1,
            bytesTop: 0,
            bytePosition: {},
            load: false,
            edit: false
        };
    },
    components: {
        ByteNode,
        TreeNode,
        UploadCard,
        ElementMenu
    },
    computed: {
        state: function () {
            return this.$store.getters.state
        },
        tree: function () {
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
        openMenu(x, y, id) {
            this.x = x;
            this.y = y;
            this.contextMenuVisible = true;
            this.activeNode = this.$store.getters.getNodeFromId(id);
        },
        copy (type) {
            if (type == "node") {
                this.$store.commit("nodeCopied", this.activeNode)
            } else if (type == "value") {
                navigator.clipboard.writeText(this.activeNode.content[1]);
            }
        },
        deleteNode: function() {
            confirm("Are you sure you want to delete this node?") && this.$store.commit("nodeRemoved", {
                id: this.activeNode.id,
                tab: this.$store.state.currentTab
            })
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
        download: function (format) {
            let content = null
            let fileName = this.$store.getters.name
            let type = ""

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
                    fileName += ".zip"
                    type = "text/plain"
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
        },
        loadExample: function (type) {
            const state = State.load_example(type)
            const tree = JSON.parse(state.get_nodes())
            this.$store.commit("tabRenamed", type + "_example")
            that.$store.commit("stateSet", {
                tab: that.$store.state.currentTab,
                state: state,
                tree: tree
            })                        
        },
        handleKeydown (event) {
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
        if (this.$refs.bytes) {
            const byteContainer = this.$refs.bytes
            const containerRect = byteContainer.getBoundingClientRect()
            this.bytesTop = containerRect.top
        }

    }
};
</script>

<style>
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

</style>