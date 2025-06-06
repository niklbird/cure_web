<template>
    <v-menu
        activator="parent"
        :submenu="submenu"        
    >
        <v-list>
            <v-list-item
                v-for="(item, index) in items"
                :key="index"
                @click="item.action"
            >
                <v-list-item-title>
                    {{ item.title }}
                </v-list-item-title>                    
                <template 
                    v-slot:append
                    v-if="item.children"
                >
                    <v-icon icon="mdi-menu-right" size="x-small"></v-icon>
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

<script>
// Menu component used for context menu or dropdown menus
// Takes an object with the items that should appear in the menu
// [items] should look like this:
//  {
//      <item_title>: {
//          title: 'Item Title',
//          action: () => { /* action to perform */ },
//          children: [ /* array of child items */ ]   
//      }, ... 
//  }
// [submenu] is used internally to display children as submenus recursively
// [activator] can be set to 'parent' or the ref of an element to activate the menu on hover or click

export default {
    props: {
        items: {
            type: Object,
            default: () => {}
        },
        submenu: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {};
    }
};
</script>