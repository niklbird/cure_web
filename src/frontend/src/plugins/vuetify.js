// Setup for the vuetify plugin (https://vuetifyjs.com/en/)
// Vuetify is a framework for Vue.js with already defined html components, styles and css classes
// which can be used in the views.

// Load Vuetify styles and icons
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

// Setup Vuetify
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    themes: {
      light: {
        colors: {
          // keep defaults + add yours
          content: '#1D3557',
        },
      },
      dark: {
        colors: {
          content: '#BDE1EF',
        },
      },
    },
  },
})
