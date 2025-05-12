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
                v-for="(byte, i) in node.content[2]" :key="i"
                class="content pa-1"
            >
                {{ dec2hex(byte) }}
            </span>            
        </span>
        <ByteNode
            v-for="(nodeId, idx) in node.children"
            :key="idx"
            :node="$store.getters.getNodeFromId(nodeId)"
        ></ByteNode>
    </span>
</template>

<script>
export default {
    props: {
        node: Object
    },
    emits: ["position"],
    methods: {
        dec2hex: function (i) {
            return (i+0x10000).toString(16).substr(-2).toUpperCase();
        },
    },
    mounted: function () {
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
    background-color: gray;
    font-weight: bold;
    padding: 2px 4px;
    border-radius: 4px;
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