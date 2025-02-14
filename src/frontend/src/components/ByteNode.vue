<template>
    <span
        :class="(node.id == selected ? 'highlighted' : '')"
        ref="span"
    >
        <span
            v-if="node.tag"
        >
            <span 
                v-for="(byte, i) in node.tag[2]" :key="i"
                class="tag"
            >
                {{ dec2hex(byte) }}&VeryThinSpace;
            </span>            
        </span>
        <span
            v-if="node.length"
        >
            <span
                v-for="(byte, i) in node.length[2]" :key="i"
                class="length"                             
            >
                {{ dec2hex(byte) }}&VeryThinSpace;
            </span>            
        </span>
        <span
            v-if="node.content"
        >
            <span
                v-for="(byte, i) in node.content[2]" :key="i"
                class="content"
            >
                {{ dec2hex(byte) }}&VeryThinSpace;
            </span>            
        </span>
        <ByteNode
            v-for="(nodeId, idx) in node.children"
            :key="idx"
            :tree="tree"
            :node="nodeFromId(nodeId)"
            :selected="selected"
            @position="(id, top, height) => $emit('position', id, top, height)"
        ></ByteNode>
    </span>
</template>

<script>
export default {
    props: {
        tree: Array,
        node: Object,
        selected: Number
    },
    emits: ["position"],
    methods: {
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
        dec2hex: function (i) {
            return (i+0x10000).toString(16).substr(-2).toUpperCase();
        },
    },
    mounted: function () {
        const target = this.$refs.span
        const targetRect = target.getBoundingClientRect();

        this.$emit("position", this.node.id, targetRect.top, target.clientHeight)
    }
}

</script>

<style>
.tag {
    color: #61dafb;
}

.length {
    color: #ffa500;
}

.content {
    color: #ff79c6;/* White text for readability */
}

.highlighted {
  background-color: white;
  opacity: 0.5;
  color: black;
  font-weight: bold;
  /*padding: 2px 4px;
  border-radius: 4px;*/
}
</style>