// This file is the entry point for the Vue.js application.
// Updated to use Pinia instead of Vuex

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import vuetify from './plugins/vuetify'
import router from './plugins/router'

// Create the Pinia instance
const pinia = createPinia()

// Create the Vue application instance and mount it
// Register used plugins (pinia store, vue-router, vuetify)
createApp(App)
  .use(pinia)
  .use(vuetify)
  .use(router)
  .mount('#app')