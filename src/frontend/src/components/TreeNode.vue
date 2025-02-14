<template>
    <div class="tree-node"
        @mouseover.stop="$emit('highlight', node.id)"
        @mouseleave.stop="isHovering = false; $emit('highlight', -1)"
    >
        <div 
            class="node-header" 
            :class="{ expandable: hasChildren }" 
            @click="toggleExpand"
            @mouseover="isHovering = true;"
            @mouseleave="isHovering = false;"
        >
            <span v-if="hasChildren" class="toggle-icon">{{ isExpanded ? "▼" : "▶" }}</span>
            <span v-if="node.tag" class="node-tag">{{ node.tag[1] }}</span>
            <span v-if="node.length" class="node-length">({{ node.length[1] }})</span>
            <component
                v-if="node.content"
                :is="editing ? 'input': 'span'"
                class="node-content editable" 
                ref="input"
                @keyup.enter="toggleEditing()"
                @blur="toggleEditing()"
                @dblclick="toggleEditing()"
            >
                {{ editing ? '' : node.content[1] }}
            </component>
            <v-spacer></v-spacer>
            <v-btn 
                v-if="node.tag && isHovering"
                size="small"
                @click.stop="showDialog = true"
            >
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </div>
        <div v-if="isExpanded && hasChildren" class="children">
            <TreeNode 
                v-for="(child, index) in node.children" 
                :key="index" 
                :tree="tree"
                :node="nodeFromId(child)" 
                @highlight="(id) => $emit('highlight', id)"
                @add="(id) => $emit('add', id)"
                @delete="(id) => $emit('delete', id)"
                @change="(id, value) => $emit('change', id, value)"
            />
            <div class="tree-node">
                <div class="node-header">
                    <v-btn
                        size="small"
                        @click="$emit('add', node.id)"
                    >
                        <v-icon>mdi-plus</v-icon> Add element
                    </v-btn>
                </div>
            </div>
        </div>
    </div>
    <v-dialog v-model="showDialog" max-width="400px">
        <v-card>
            <v-card-title class="headline">Confirm Deletion</v-card-title>
            <v-card-text>Are you sure you want to delete this item?</v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="grey" @click="showDialog = false">Cancel</v-btn>
                <v-btn color="red" @click="deleteNode">Delete</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { nextTick } from "vue";
import { asn1Types } from "@/utils/parse";

export default {
props: {
    tree: Array,
    node: Object,
},
emits: ["delete", "add", "change", "highlight"],
data() {
    return {
        isExpanded: false, // Start collapsed
        editing: false,
        showDialog: false,
        isHovering: false
    };
},
computed: {
    hasChildren() {
        return this.node.children && this.node.children.length > 0;
    },
},
methods: {
    toggleExpand() {
        if (this.hasChildren) {
            this.isExpanded = !this.isExpanded;
        }
    },
    nodeFromId: function(id) {
        let candidates = this.tree.filter((node) => node.id == id)
        if (candidates.length > 0) {
            return candidates[0]
        } else {
            return {
                children: []
            }
        }  
    },
    deleteNode: function() {
        this.$emit("delete", this.node.id)
    },
    async toggleEditing() {
        this.editing = !this.editing

        if (this.editing) {
            await nextTick();
            this.$refs.input.focus()
            this.$refs.input.value = this.node.content[2]
        } else {
            if (this.$refs.input.value != this.node.content[2]) {
                if (asn1Types[this.node.tag[0]]["rules"](this.$refs.input.value)) {
                    this.$emit("change", this.node.id, this.$refs.input.value)
                } else {
                    alert("Invalid value " + this.$refs.input.value + " for field of type " + this.node.tag[1] + "\nIf you intended to input an invalid value please use hex notation (0x...)")
                }
                // On change we should either emit an event that triggers recomputation, or just do it from here
            }
        }
    }
},
};
</script>
  
<style scoped>
.tree-node {
padding-left: 20px; /* Indent children */
}

.node-header {
cursor: pointer;
padding: 4px 6px;
display: flex;
align-items: center;
white-space: nowrap;
}

.expandable {
font-weight: bold;
}

.node-header:hover {
background-color: rgba(255, 255, 255, 0.1);
}

.toggle-icon {
margin-right: 6px;
color: lightgray;
cursor: pointer;
}

.node-tag {
font-weight: bold;
color: #61dafb;
}

.node-length {
color: #ffa500;
}

.node-content {
color: #ff79c6;
}

.children {
border-left: 2px solid rgba(255, 255, 255, 0.2);
margin-left: 10px;
padding-left: 10px;
}

.editable {
  cursor: pointer;
  padding: 5px;
  border: 1px solid transparent;
}

</style>
  