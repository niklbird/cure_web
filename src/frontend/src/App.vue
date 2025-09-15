<template>
    <v-app :theme=mode>
        <nav class="navbar bg-surface">
            <div class="container">
                <div class="logo">WEB CURE</div>
                <div class="nav-links">
                    <!--Router-Link provides a link to the routes defined in plugins/router.js-->
                    <v-btn 
                        v-for="link in routes" 
                        :key="link.path" 
                        elevation="0"
                        @click="path = link.path"
                        class="nav-link"
                        :class="{ 'active-link': path === link.path }" 
                    >
                        {{ link.name }}
                    </v-btn>
                    <!--Vuetify has predefined color themes, like dark and light, which can be switched by pressing this button.-->
                    <v-btn
                        elevation="0"
                        density="comfortable"
                        :icon="mode === 'light' ? 'mdi-weather-sunny' : 'mdi-moon-waning-crescent'"
                        @click="mode = mode === 'light' ? 'dark' : 'light'"
                    />
                </div>
            </div>
        </nav>
        <!--Router-View is a placeholder for the view that will be rendered based on the current route.-->
        <NotifyView v-if="path == 'notify'"/>
        <FuzzingView v-if="path == 'fuzzing'"/>
        <EditorView v-if="path == 'editor'"/>
        <AboutView v-if="path == 'about'"/>
    </v-app>
</template>

<script>
import EditorView from "./views/EditorView.vue";
import NotifyView from "./views/NotifyView.vue";
import AboutView from "./views/AboutView.vue";
import FuzzingView from "./views/FuzzingView.vue";

export default {
    data() {
        return {
            mode: "light",
            path: "editor",
            routes: [
                { name: "EDITOR", path: "editor" },
                { name: "FUZZING", path: "fuzzing" },
                { name: "NOTIFY", path: "notify" },
                { name: "ABOUT", path: "about" }
            ]
        };
    },
    components: {
        EditorView,
        NotifyView,
        AboutView,
        FuzzingView
    },
};
</script>

<style>
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
}

/* Navigation bar styling */
.navbar {
    box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.2);
    padding: 15px 0;
}

/* Center content inside the navbar */
.container {
    max-width: 100vw;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
}

/* Logo styling */
.logo {
    font-size: 1.5rem;
    font-weight: bold;
}

/* Navigation links */
.nav-links {
    display: flex;
    gap: 20px;
}

.nav-link {
    text-decoration: none;
    font-size: 1rem;
    padding: 8px 12px;
    border-radius: 5px;
    transition: color 0.3s ease, background-color 0.3s ease;
}

/* Hover effect */
.nav-link:hover {
  color: #007bff;
  background-color: rgba(0, 123, 255, 0.1);
}

/* Active link styling */
.active-link {
  color: #007bff;
  font-weight: bold;
  border-bottom: 2px solid #007bff;
}

</style>
