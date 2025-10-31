<template>
    <span
        :class="(node.id == $store.getters.highlighted ? 'highlighted' : '')"
        ref="span"
    >
        <span
            v-if="node.tag"
        >
            <span 
                v-for="(byte, i) in node.tag[2]" :key="i"
                class="tag pa-1"
            >
                {{ dec2hex(byte) }}
            </span>            
        </span>
        <span
            v-if="node.length"
        >
            <span
                v-for="(byte, i) in node.length[2]" :key="i"
                class="length pa-1"                             
            >
                {{ dec2hex(byte) }}
            </span>

        </span>
        <span
            v-if="node.content"
        >
            <span
                v-for="(byte, i) in node.content[3]" :key="i"
                class="content pa-1"
            >
                {{ dec2hex(byte) }}
            </span>            
        </span>
        <!-- The bytes of children are rendered recursively -->
        <ByteNode
            v-for="(nodeId, idx) in node.children"
            :key="idx"
            :node="$store.getters.getNodeFromId(nodeId)"
        ></ByteNode>
    </span>
</template>

<script>
// This component renders a node as a series of spans, each representing a byte in hexadecimal format.
// Children nodes are rendered recursively.
// Currently selected node is highlighted and scrolled to in the byte view.

export default {
    props: {
        node: Object
    },
    methods: {
        // Convert decimal to hexadecimal with leading zero
        dec2hex: function (i) {
            return (i+0x10000).toString(16).substr(-2).toUpperCase();
        },
    },
    mounted: function () {
        // Once a node is mounted, we store its position
        // Enables automatic scrolling to the node when highlighted
        const target = this.$refs.span
        const targetRect = target.getBoundingClientRect();

        this.$store.commit("positionAdded", {
            id: this.node.id, 
            top: targetRect.top, 
            height: target.clientHeight
        })
    }
}

</script>

<style>
.highlighted {
    background-color: gray;
    font-weight: bold;
/*    padding: 2px 4px;
    border-radius: 4px;*/
}

.tag, .length, .content {
    display: inline-block;  /* Ensure the byte spans are treated as block-level elements within the line */
    white-space: nowrap;    /* Prevent the bytes from breaking in the middle */
    word-wrap: break-word;  /* Allow wrapping when necessary */
    overflow-wrap: break-word; /* Ensure wrapping within bounds */
}

span {
    word-wrap: break-word;  /* Ensures that the parent container allows wrapping of the child spans */
    overflow-wrap: break-word; /* Same for overflow */
}

</style>