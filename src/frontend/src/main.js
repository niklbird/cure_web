// This file is the entry point for the Vue.js application.
// Likely not much to change here apart from registering new plugins.

import { createApp } from 'vue'
import App from './App.vue'
import { loadFonts } from './plugins/webfontloader'
import vuetify from './plugins/vuetify'
import router from './plugins/router'
import store from './plugins/store'

loadFonts()

// Create the Vue application instance and mount it
// Register used plugins (vuex store, vue-router, vuetify)
createApp(App)
    .use(store)
    .use(router)
    .use(vuetify)
    .mount('#app')
