import { createRouter, createWebHistory } from 'vue-router';
import EditorView from '../views/EditorView.vue';
import AboutView from '../views/AboutView.vue';

const routes = [
  {
    path: '/',
    name: 'Editor',
    component: EditorView
  },
  {
    path: '/editor',
    // This is a redirect. If anyone lands on /editor,
    // send them to the homepage / which is also the editor.
    redirect: '/' 
  },
  {
    path: '/about',
    name: 'About',
    component: AboutView
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;