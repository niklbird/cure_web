<template>
    <v-overlay v-model="loading">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </v-overlay>

    <v-overlay v-model="load">
        <UploadCard @upload="load = false"></UploadCard>
    </v-overlay>

    <v-overlay v-model="showElementMenu">
        <ElementMenu :parent="parent" :node="activeNode" @close="showElementMenu = false"></ElementMenu>
    </v-overlay>

    <v-overlay v-model="showReports">
        <v-card :width="isMobile ? '95vw' : '70vw'" :height="isMobile ? '90vh' : '70vh'" class="d-flex flex-column">
            <v-card-title class="text-center bg-primary">REPORTS</v-card-title>
            <v-card-text class="flex-grow-1 overflow-y-auto">
                <v-row no-gutters class="h-100">
                    <v-col cols="12" md="2">
                        <v-tabs v-model="reportTab" :direction="isMobile ? 'horizontal' : 'vertical'" class="h-100" show-arrows>
                            <v-tab v-for="(report, idx) in reports" :key="`tab-${idx}`" :value="idx" class="text-capitalize">
                                {{ report.name.replace(/_/g, ' ') }}
                            </v-tab>
                        </v-tabs>
                    </v-col>

                    <v-col cols="12" md="10">
                        <v-window v-model="reportTab" class="h-100">
                            <v-window-item v-for="(report, idx) in reports" :key="`window-${idx}`" :value="idx" class="pa-4">
                                <div v-for="(rp, i) in report.report.sort((a, b) => Number(b.crashed) - Number(a.crashed))" :key="i">
                                    <h3>{{ rp.name }}</h3><br>
                                    <span :class="{crashed: rp.crashed}">{{ rp.crashed ? "Crash: True" : "Crash: False" }}</span>
                                    <br>
                                    
                                    <table v-if="!rp.crashed && !isMobile" class="table-bordered-centered">
                                        <thead>
                                            <tr>
                                                <th>ASN</th>
                                                <th>IP Prefix</th>
                                                <th>Max Length</th>
                                                <th>Trust Anchor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr v-for="(vrp, i3) in rp.vrps.content" :key="i3">
                                                <td>{{ vrp.asn }}</td>
                                                <td>{{ vrp.ip.ip_s }}</td>
                                                <td>{{ vrp.ip.max_len }}</td>
                                                <td>ta</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    
                                    <div v-if="!rp.crashed && isMobile" class="mt-4">
                                        <v-card v-for="(vrp, i3) in rp.vrps.content" :key="i3" class="mb-3" variant="outlined">
                                            <v-card-text>
                                                <div><strong>ASN:</strong> {{ vrp.asn }}</div>
                                                <div><strong>IP Prefix:</strong> {{ vrp.ip.ip_s }}</div>
                                                <div><strong>Max Length:</strong> {{ vrp.ip.max_len }}</div>
                                                <div><strong>Trust Anchor:</strong> ta</div>
                                            </v-card-text>
                                        </v-card>
                                    </div>

                                    <span :class="{crashed: rp.crashed}">{{ rp.crashed ? "Errors:" : "Logs:"}} </span>
                                    <br>
                                    <pre class="text-pre-wrap" :class="{'crashed-thin': rp.crashed}">
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
                <v-btn @click="loadTestCase(reports[reportTab].name, reports[reportTab].state)" color="primary" variant="tonal" :size="isMobile ? 'small' : 'default'">Load Test Case</v-btn>
                <v-btn @click="showReports = false" color="grey" variant="tonal" :size="isMobile ? 'small' : 'default'">Close</v-btn>
            </v-card-actions>
        </v-card>
    </v-overlay>

    <!-- Share Dialog -->
    <v-dialog v-model="showShareDialog" max-width="600">
        <v-card>
            <v-card-title class="d-flex align-center">
                <v-icon start>mdi-share-variant</v-icon>
                Share Link
            </v-card-title>
            <v-card-text>
                <p class="text-body-2 mb-3">
                    Copy this link to share the current ASN.1 object:
                </p>
                <v-text-field
                    v-model="shareUrl"
                    readonly
                    variant="outlined"
                    density="compact"
                    hide-details
                    @focus="$event.target.select()"
                >
                    <template v-slot:append-inner>
                        <v-btn
                            icon="mdi-content-copy"
                            size="small"
                            variant="text"
                            @click="copyShareUrl"
                        ></v-btn>
                    </template>
                </v-text-field>
                <v-alert
                    v-if="shareUrlTooLong"
                    type="warning"
                    variant="tonal"
                    density="compact"
                    class="mt-3"
                >
                    The object is large, so the URL is quite long. Some browsers may not support URLs of this length.
                </v-alert>
                <v-alert
                    v-if="copied"
                    type="success"
                    variant="tonal"
                    density="compact"
                    class="mt-3"
                >
                    Link copied to clipboard!
                </v-alert>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn variant="tonal" @click="showShareDialog = false">Close</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-container fluid>
        <v-row v-if="store.tabs.length > 0">
            <v-col cols="12" sm="auto">
                <v-btn @click="this.load = true" color="primary" :block="isMobile">
                    IMPORT
                </v-btn>
            </v-col>
            <v-col cols="12" sm="auto">
                <v-btn color="primary" :block="isMobile">
                    EXPORT
                    <MenuComponent :items="formats.map(format => ({ title: format.toUpperCase(), action: () => download(format) }))" />
                </v-btn>
            </v-col>
            <v-col cols="12" sm="auto" v-if="store.tree.length > 0">
                <v-btn color="primary" @click="openShareDialog" :block="isMobile">
                    <v-icon start>mdi-share-variant</v-icon>
                    SHARE
                </v-btn>
            </v-col>
            <v-col cols="12" sm="auto" v-if="store.tree.length > 0 && reachable && rpki_types.includes(object_type)">
                <v-btn color="primary" @click="runTestCase" :block="isMobile">
                    RUN TEST CASE WITH CURE
                </v-btn>
            </v-col>
            <v-col v-if="reports.length > 0" cols="12" sm="auto">
                <v-btn  color="primary" @click="showReports = true" :block="isMobile">
                    SHOW REPORTS
                </v-btn>
            </v-col>
            <v-col v-if="!isMobile && store.tree.length > 0" cols="12" sm="auto">
                <v-btn  color="primary" @click="store.setAll(!store.anyExpanded)">
                    {{ store.anyExpanded ? "COLLAPSE ALL" : "EXPAND ALL" }}
                </v-btn>
            </v-col>
            <v-spacer v-if="!isMobile"></v-spacer>
            <v-col v-if="!isMobile" cols="12" sm="auto">
                <v-menu offset-y :close-on-content-click="false">
                    <template v-slot:activator="{ props }">
                        <v-btn icon="mdi-cog" v-bind="props" elevation="0"></v-btn>
                    </template>
                    <v-card min-width="300">
                        <v-card-text>
                            <v-checkbox v-model="simplify" label="Simplified View"></v-checkbox>
                            <v-text-field v-model="backendUrl" label="Backend URL" hint="e.g. http://localhost:21999/" persistent-hint></v-text-field>
                        </v-card-text>
                    </v-card>
                </v-menu>
            </v-col>                
        </v-row>

        <v-row v-if="store.tabs.length > 0" id="tab-content">
            <v-col id="tabs" cols="12" md="2">
                <v-tabs 
                    v-model="currentTab"
                    :direction="isMobile ? 'horizontal' : 'vertical'" 
                    show-arrows
                >
                    <v-tab 
                        v-for="tab in store.tabs" 
                        :key="tab.id"
                        :value="tab.id"
                    >
                        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                            <div class="text-truncate">{{ tab.name }}</div>
                            <v-btn elevation="0" icon="mdi-close" size="x-small" @click.stop="store.tabRemoved(tab.id)"></v-btn>
                        </div>
                    </v-tab>
                    <v-tab @click="store.addTab('Unnamed')" style="justify-content: center;">
                        <v-icon>mdi-plus</v-icon>
                    </v-tab>
                </v-tabs>
            </v-col>

            <v-col cols="12" md="6">
                <div :style="{ position: 'absolute', left: `${x}px`, top: `${y}px` }" ref="activator">
                    <MenuComponent :items="context_items" />
                </div>
                <div class="asn-tree">
                    <TreeNode v-if="store.tree.length > 0" :node="findRoot()" @rightclick="(x, y, id) => openMenu(x, y, id)" :simplify="simplify || isMobile"/>
                    <p v-else class="text-h6 text-center pa-5">
                        No ASN.1 data loaded. Please upload a file or select an example.
                    </p>
                </div>
            </v-col>

            <v-col cols="12" md="4">
                <div class="byte-grid-container" ref="bytes">
                    <div class="byte-grid" v-if="store.tree.length > 0">
                        <span
                            v-for="(byte, index) in flatBytes"
                            :key="index"
                            :class="[
                                byte.type,
                                highlightedNodeAndDescendants.has(byte.nodeId) ? 'highlighted' : ''
                            ]"
                            :data-node-id="byte.nodeId"
                            @click="store.elementHighlighted(byte.nodeId)"
                        >
                            {{ dec2hex(byte.value) }}
                        </span>
                    </div>
                </div>
            </v-col>
        </v-row>
        <v-row v-if="store.tabs.length === 0">
            <UploadCard></UploadCard>
        </v-row>
    </v-container>
</template>

<script>
import TreeNode from '@/components/TreeNode.vue'
import UploadCard from '@/components/UploadCard.vue'
import ElementMenu from '@/components/ElementMenu.vue'
import MenuComponent from '@/components/MenuComponent.vue'
import axios from 'axios'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'

const public_backend = "https://api.asn1.app/"
const local_backend = "http://localhost:21999/"

export default {
    setup() {
        const { mobile } = useDisplay()
        const store = useTabsStore()

        return { isMobile: mobile, store }
    },
    data() {
        return {
            x: 0,
            y: 0,
            parent: 0,
            activeNode: null,
            showElementMenu: false,
            bytesTop: 0,
            backendUrl: local_backend,
            reachable: false,
            load: false,
            loading: false,
            reports: [],
            showReports: false,
            reportTab: 0,
            simplify: false,
            formats: ["binary", "base64", "json", "repository"],
            showShareDialog: false,
            shareUrl: '',
            shareUrlTooLong: false,
            copied: false,
            context_items: [
                {
                    "title": "COPY ...",
                    "children": [
                        { "title": "NODE", "action": () => this.copy("node") },
                        { "title": "CONTENT", "action": () => this.copy("content") },
                        { "title": "AS BASE64", "action": () => this.copy("base64") },
                        { "title": "AS HEX", "action": () => this.copy("hex") }
                    ]
                },
                { "title": "DUPLICATE NODE", "action": () => this.duplicateNode(this.activeNode) },
                { "title": "DELETE NODE", "action": () => this.deleteNode(this.activeNode) },
                { "title": "EDIT NODE", "action": () => { this.showElementMenu = true } },
                {
                    "title": "ADD CHILD",
                    "action": () => {
                        this.parent = this.activeNode.id
                        this.activeNode = null
                        this.showElementMenu = true
                    }
                }
            ]
        }
    },
    components: {
        TreeNode,
        UploadCard,
        ElementMenu,
        MenuComponent
    },
    computed: {
        rpki_types() {
            return ["roa", "mft", "crl", "cer", "asa", "gbr"]
        },
        object_type() {
            return this.store.state?.infer_object_type() || ''
        },
        currentTab: {
            get() {
                return this.store.currentTab
            },
            set(value) {
                this.store.tabSelected(value)
            }
        },
        flatBytes() {
            const bytes = []
            const root = this.findRoot()

            if (!root) return []

            const traverse = (node) => {
                if (node.tag && node.tag[2]) {
                    node.tag[2].forEach(byte => {
                        bytes.push({ value: byte, type: 'tag', nodeId: node.id })
                    })
                }
                if (node.length && node.length[2]) {
                    node.length[2].forEach(byte => {
                        bytes.push({ value: byte, type: 'length', nodeId: node.id })
                    })
                }
                if (node.content && node.content[3]) {
                    node.content[3].forEach(byte => {
                        bytes.push({ value: byte, type: 'content', nodeId: node.id })
                    })
                }
                if (node.children) {
                    node.children.forEach(childId => {
                        const childNode = this.store.getNodeFromId(childId)
                        if (childNode) traverse(childNode)
                    })
                }
            }

            traverse(root)
            return bytes
        },
        highlightedNodeAndDescendants() {
            const highlightedId = this.store.highlighted
            const highlightSet = new Set()
            
            if (highlightedId === null || highlightedId === undefined || highlightedId === -1) {
                return highlightSet
            }

            const collectChildren = (nodeId) => {
                if (highlightSet.has(nodeId)) return
                highlightSet.add(nodeId)
                
                const node = this.store.getNodeFromId(nodeId)
                if (node && node.children) {
                    node.children.forEach(childId => collectChildren(childId))
                }
            }

            collectChildren(highlightedId)
            return highlightSet
        }
    },
    watch: {
        'store.highlighted'(id) {
            if (!id || !this.$refs.bytes) return
            
            const byteContainer = this.$refs.bytes
            const targetElement = byteContainer.querySelector(`span[data-node-id="${id}"]`)

            if (targetElement) {
                const containerHeight = byteContainer.clientHeight
                const targetTopRelativeToContainer = targetElement.offsetTop
                const scrollTop = targetTopRelativeToContainer - (containerHeight / 2) + (targetElement.clientHeight / 2)
                
                byteContainer.scrollTo({ top: scrollTop, behavior: 'smooth' })
            }
        }
    },
    methods: {
        uint8ToBase64(uint8Array) {
            const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
            let result = ''

            for (let i = 0; i < uint8Array.length; i += 3) {
                const byte1 = uint8Array[i]
                const byte2 = i + 1 < uint8Array.length ? uint8Array[i + 1] : 0
                const byte3 = i + 2 < uint8Array.length ? uint8Array[i + 2] : 0
                const triplet = (byte1 << 16) | (byte2 << 8) | byte3

                result += base64Chars[(triplet >> 18) & 0x3F]
                result += base64Chars[(triplet >> 12) & 0x3F]
                result += i + 1 < uint8Array.length ? base64Chars[(triplet >> 6) & 0x3F] : '='
                result += i + 2 < uint8Array.length ? base64Chars[triplet & 0x3F] : '='
            }

            return result
        },
        // Generate a shareable URL with the current object encoded
        generateShareUrl() {
            if (!this.store.state) return ''
            
            try {
                const base64Data = this.store.state.export_base64()
                // Use URL-safe base64 encoding (replace + with -, / with _, remove padding =)
                const urlSafeBase64 = base64Data
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '')
                
                const baseUrl = window.location.origin + window.location.pathname
                const name = encodeURIComponent(this.store.name || 'Shared')
                return `${baseUrl}?data=${urlSafeBase64}&name=${name}`
            } catch (e) {
                console.error('Error generating share URL:', e)
                return ''
            }
        },
        openShareDialog() {
            this.shareUrl = this.generateShareUrl()
            this.shareUrlTooLong = this.shareUrl.length > 2000
            this.copied = false
            this.showShareDialog = true
        },
        async copyShareUrl() {
            try {
                await navigator.clipboard.writeText(this.shareUrl)
                this.copied = true
                setTimeout(() => {
                    this.copied = false
                }, 3000)
            } catch (e) {
                console.error('Failed to copy URL:', e)
            }
        },
        // Load data from URL query parameters
        loadFromUrl() {
            const urlParams = new URLSearchParams(window.location.search)
            const data = urlParams.get('data')
            const name = urlParams.get('name')
            
            if (data) {
                try {
                    // Convert URL-safe base64 back to standard base64
                    let base64Data = data
                        .replace(/-/g, '+')
                        .replace(/_/g, '/')
                    
                    // Add padding if needed
                    const padding = base64Data.length % 4
                    if (padding) {
                        base64Data += '='.repeat(4 - padding)
                    }
                    
                    console.log('Loading from URL, base64 length:', base64Data.length)
                    
                    const tabName = name ? decodeURIComponent(name) : 'Shared Object'
                    this.store.addTab(tabName)
                    
                    // The State constructor accepts base64 strings directly
                    this.store.stateSet({
                        tab: this.store.currentTab,
                        data: base64Data,
                        type: 'base64'
                    })
                    
                    // Clear the URL parameters after loading (keeps URL clean)
                    window.history.replaceState({}, document.title, window.location.pathname)
                    
                    return true
                } catch (e) {
                    console.error('Error loading data from URL:', e)
                    // Show more detailed error message
                    alert('Failed to load the shared object: ' + (e.message || 'Unknown error'))
                }
            }
            return false
        },
        async runTestCase() {
            let z = this.store.state.repositorify()
            const serialized = this.uint8ToBase64(z)

            try {
                const response = await axios.post(this.backendUrl + "execute", serialized, {
                    headers: { 'Content-Type': 'text/plain' }
                })
                this.showReports = true

                let report = response.data.map(JSON.parse)
                this.reports.push({
                    name: this.store.name,
                    state: this.store.state.encode_store(),
                    report: report
                })
                this.reportTab = this.reports.length - 1
            
            } catch (error) {
                console.error("Error during test case execution:", error)
                console.log(serialized)
                alert("Error during test case execution. Please check the console for details.")
            }
        },
        openMenu(x, y, id) {
            this.x = x
            this.y = y
            this.$refs.activator.click()
            this.activeNode = this.store.getNodeFromId(id)
        },
        dec2hex(i) {
            return (i + 0x10000).toString(16).substr(-2).toUpperCase()
        },
        copy(type) {
            if (type === "node") {
                this.store.copiedCellSet(this.activeNode)
            } else if (type === "hex") {
                let array = Array.prototype.concat(this.activeNode.tag[2], this.activeNode.length[2], this.activeNode.content[3])
                navigator.clipboard.writeText(array.map(this.dec2hex).join(' '))
            } else if (type === "base64") {
                let array = Array.prototype.concat(this.activeNode.tag[2], this.activeNode.length[2], this.activeNode.content[3])
                const base64String = this.uint8ToBase64(array)
                navigator.clipboard.writeText(base64String)
            } else if (type === "content") {
                navigator.clipboard.writeText(this.activeNode.content[1])
            }
        },
        duplicateNode(node) {
            if (!node) return

            this.store.nodeAdded({
                tab: this.store.currentTab,
                tag: node.tag[0],
                content: node.content[2],
                parent: node.parent,
                label: node.label,
                index: this.store.getNodeFromId(node.parent).children.indexOf(node.id) + 1
            })
        },
        deleteNode() {
            confirm("Are you sure you want to delete this node?") && this.store.nodeRemoved({
                id: this.activeNode.id,
                tab: this.store.currentTab
            })
        },
        findRoot() {
            const candidates = this.store.tree.filter(node => node.id === node.parent)
            return candidates.length > 0 ? candidates[0] : { children: [] }
        },
        download(format) {
            let content = null
            let fileName = this.store.name
            let type = ""

            this.loading = true
            switch (format) {
                case "binary":
                    content = this.store.state.export_bin()
                    fileName += ".bin"
                    type = "application/octet-stream"
                    break
                case "base64":
                    content = this.store.state.export_base64()
                    fileName += ".txt"
                    type = "text/plain"
                    break
                case "json":
                    content = this.store.state.encode_store()
                    fileName += ".json"
                    type = "application/json"
                    break
                case "repository":
                    content = this.store.state.repositorify()
                    fileName += ".tar.gz"
                    type = "application/x-gzip"
                    break
            }
            
            const blob = new Blob([content], { type: type })
            const link = document.createElement("a")
            link.href = URL.createObjectURL(blob)
            link.download = fileName
            
            document.body.appendChild(link)
            link.click()
            
            this.loading = false
            document.body.removeChild(link)
            URL.revokeObjectURL(link.href)
        },
        loadTestCase(name, storeData) {
            this.store.addTab(name)
            this.store.stateSet({
                tab: this.store.currentTab,
                data: storeData,
                type: "json"
            })
        },
        handleKeydown(event) {
            if (event.ctrlKey && event.key === 'z') {
                this.store.undo()
            }
            if (event.ctrlKey && event.key === 'y') {
                this.store.redo()
            }
        }
    },
    async beforeCreate() {
        try {
            await axios.get(local_backend + "probe")
            this.reachable = true
        } catch (error) {
            console.log("No local backend detected at", local_backend)
            try {
                await axios.get(public_backend + "probe")
                this.backendUrl = public_backend
                this.reachable = true
            } catch (error) {
                console.error("Backend not reachable at", this.backendUrl)
                this.reachable = false
            }
        }
    },
    mounted() {
        document.title = "Live ASN.1 Editor & Parser | DERP"
        window.addEventListener('keydown', this.handleKeydown)
        
        // Try to load data from URL on mount
        // Use a small delay to ensure WASM is initialized
        this.$nextTick(() => {
            // Check if there's data in URL and try to load it
            // Retry a few times if WASM isn't ready yet
            const tryLoad = (attempts = 0) => {
                try {
                    this.loadFromUrl()
                } catch (e) {
                    if (attempts < 5) {
                        console.log('WASM may not be ready, retrying...', attempts + 1)
                        setTimeout(() => tryLoad(attempts + 1), 200)
                    } else {
                        console.error('Failed to load from URL after retries:', e)
                    }
                }
            }
            
            // Initial delay to let WASM initialize
            setTimeout(() => tryLoad(), 100)
        })
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
}
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
    color: rgb(var(--v-theme-content));
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

.byte-grid-container {
    height: 84vh;
    font-family: monospace;
    font-size: 1rem;
    padding: 10px;
    overflow: scroll;
    position: sticky;
    border: 1px solid #ccc;
    box-sizing: border-box;
}

.byte-grid {
    display: grid;
    grid-template-columns: repeat(16, minmax(min-content, 1fr));
}

.byte-grid > span {
    display: inline-block;
    text-align: center;
    padding: 0.01em;
    cursor: pointer;
    white-space: nowrap;
}

.byte-grid > span:nth-child(16n + 9) {
    padding-left: 0.65em;
}

.highlighted {
    background-color: gray;
    font-weight: bold;
}

@media (max-width: 960px) {
    .asn-tree, .byte-grid-container {
        height: 50vh;
    }
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

@media (max-width: 960px) {
    .asn-tree, .bytes {
        height: 50vh;
    }
}
</style>