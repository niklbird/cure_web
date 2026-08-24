<template>
  <v-menu 
  :activator="activatorSelector ?? 'parent'"
  :submenu="submenu" 
  v-model="menuOpen"
  >
    <v-list>
      <v-list-item
        v-for="(item, index) in items"
        :key="index"
        :disabled="item.disabled"
        @click="!item.disabled && item.action && item.action()"
      >
        <v-list-item-title>{{ item.title }}</v-list-item-title>
        <template v-slot:append v-if="item.children">
          <v-icon icon="mdi-menu-right" size="x-small" />
        </template>
        <MenuComponent
          v-if="item.children"
          :items="item.children"
          :submenu="true"
        />
      </v-list-item>
      <v-list @mouseleave="closeOnLeave && (menuOpen = false)"></v-list>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ContextMenuItem } from '@/types/editor'

// MenuComponent is recursive — Vue 3 <script setup> resolves the component
// by its filename automatically for recursive references.

withDefaults(defineProps<{
  items: ContextMenuItem[]
  submenu?: boolean
  closeOnLeave?: boolean
  activatorSelector?: string
}>(), {
  items: () => [],
  submenu: false,
  closeOnLeave: false,
  activatorSelector: undefined
})

const menuOpen = ref(false)
</script>