// This file is the entry point for the Vue.js application.
// Likely not much to change here apart from registering new plugins.

import { createApp } from 'vue'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import store from './plugins/store'


// Create the Vue application instance and mount it
// Register used plugins (vuex store, vue-router, vuetify)
createApp(App)
    .use(store)
    .use(vuetify)
    .mount('#app')
