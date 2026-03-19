<template>
  <v-menu activator="parent" :submenu="submenu">
    <v-list>
      <v-list-item
        v-for="(item, index) in items"
        :key="index"
        @click="item.action"
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
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import type { ContextMenuItem } from '@/types/editor'

// MenuComponent is recursive — Vue 3 <script setup> resolves the component
// by its filename automatically for recursive references.

withDefaults(defineProps<{
  items: ContextMenuItem[]
  submenu?: boolean
}>(), {
  items: () => [],
  submenu: false
})
</script>