// Setup for the vue-router plugin, documentation at: https://router.vuejs.org/
// Vue-Router creates a mapping between the visited URL and the vue view that is rendered,
// e.g. when the user visits `/about`, the `AboutView.vue` component is rendered.

import { createRouter, createWebHistory } from 'vue-router'

// List of all available routes, new routes can be added here, 
// the according views should be created in the `views` directory.
export const routes = [
  {
    path: '/',
    name: 'ASN.1 EDITOR',
    // route level code-splitting
    // this generates a separate chunk (editor.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "editor" */'../views/EditorView.vue')
  },
  {
    path: "/rpki-notify",
    name: "NOTIFICATIONS",
    component: () => import(/* webpackChunkName: "notify" */'../views/NotifyView.vue')
  },
  {
    path: '/about',
    name: 'ABOUT',
    component: () => import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
  }
]

const router = createRouter({
  // history allows to go back and forth in the browser history, e.g. when the user clicks the back button.
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
