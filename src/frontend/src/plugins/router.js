import { createRouter, createWebHistory } from 'vue-router';
import EditorView from '../views/EditorView.vue';
import AboutView from '../views/AboutView.vue';
import NotifyView from '../views/NotifyView.vue';

const routes = [
  {
    path: '/',
    name: 'Editor',
    component: EditorView
  },
  {
    path: '/editor',
    redirect: '/'
  },
  {
    path: '/about',
    name: 'About',
    component: AboutView
  },
  {
    path: '/notify',
    name: 'Notify',
    component: NotifyView
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;