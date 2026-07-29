import { createRouter, createWebHistory } from 'vue-router';
import EditorView from '../views/EditorView.vue';
import AboutView from '../views/AboutView.vue';
import NotifyView from '../views/NotifyView.vue';

// Detects directory with actual source of the app to fix web reload issue etc
function detectBase() {
  const scripts = document.getElementsByTagName('script');
  for (const script of scripts) {
    const match = script.src && script.src.match(/^(.*\/)js\/app(?:\.[^/]+)?\.js(?:\?.*)?$/);
    if (match) {
      // match[1] is a full absolute URL (e.g. "http://localhost:8081/app/cure_web/")
      // createWebHistory needs only the path portion.
      return new URL(match[1]).pathname;
    }
  }
  // Fallback: no matching script tag found - assume root
  return '/';
}

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
  history: createWebHistory(detectBase()),
  //history: createWebHistory(process.env.BASE_URL),
  routes
});

export default router;