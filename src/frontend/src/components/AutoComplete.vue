<template>
    <v-row 
        justify="center"
        class="mb-4"
        width="100%"
    >
        <v-col cols="12">
            <div 
                style="position: relative; width: 100%;"
                @keydown.down.prevent="moveSelection(1)"
                @keydown.up.prevent.stop="moveSelection(-1)"
                @keydown.enter.prevent.stop="selectSuggestion()"
            >
                <v-text-field
                    v-model="query"
                    @focus="showSelection = true"
                    @input="showSelection = true"
                    @blur="showSelection = false"
                    type="text"
                    placeholder="Search..."
                    style="width: 100%; height: 2.5rem;"
                />

                <v-list
                    v-show="showSelection && suggestions.length > 0"
                    class="elevation-3"
                    style="position: absolute; top: 100%; left: 0; width: 100%; max-height: 200px; overflow-y: auto; background: white; z-index: 10;"
                >
                    <v-list-item
                        v-for="(suggestion, index) in suggestions"
                        :key="index"
                        :class="['suggestion', { 'selected': index === selectedIndex }]"
                        @mousedown.prevent="selectSuggestion(index); showSelection = false"
                    >
                        <v-list-item-title v-text="suggestion" />
                    </v-list-item>
                </v-list>
            </div>
        </v-col>
    </v-row>
</template>


<script setup>
// Autocomplete component 

import { ref, watch } from 'vue'; 

const showSelection = ref(false);
const query = defineModel({
    default: '',
    type: String,
    required: true
});

const props = defineProps({
    completions: {
        type: Array,
        default: () => []
    }
})

const suggestions = ref([]);
const selectedIndex = ref(-1);

watch(query, (val) => {
    if (val) {
        fetchSuggestions(val);
    }
    else {
        suggestions.value = [];
        selectedIndex.value = -1;
    }
})

const fetchSuggestions = async (query) => {
    // Simulate an API call to fetch suggestions
    // In a real application, replace this with an actual API call
    const allSuggestions = [
        query,
        ...props.completions
    ];
    
    suggestions.value = allSuggestions.filter(s => s.toLowerCase().includes(query.toLowerCase()));
    selectedIndex.value = 0; // Reset selection when new query is made
}

function moveSelection(direction) {
    if (!suggestions.value.length) return;
    selectedIndex.value = (selectedIndex.value + direction + suggestions.value.length) % suggestions.value.length;
}

function selectSuggestion(index = selectedIndex.value) {
    if (index >= 0 && suggestions.value[index]) {
        query.value = suggestions.value[index];
    }
}

</script>

<style scoped>
input:focus {
  outline: none;
  border-color: #aaa;
}

.suggestion {
  padding: 0.5rem;
  cursor: pointer;
}

.suggestion:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.selected {
  background-color: rgba(0, 0, 0, 0.1);
}

.selected:hover {
  background-color: rgba(0, 0, 0, 0.15);
}
</style>