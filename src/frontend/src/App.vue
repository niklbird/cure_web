<template>
    <v-app :theme="mode">
        <nav class="navbar bg-surface">
            <div class="container">
                <div class="logo">
                    <img :src="logo" alt="Logo" height="40"/>
                    <span class="logo-text">{{ path == "editor" ? "DERP" : "CURE" }}</span>
                </div>
                <div class="nav-links">
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
                    <v-btn
                        elevation="0"
                        density="comfortable"
                        :icon="mode === 'light' ? 'mdi-weather-sunny' : 'mdi-moon-waning-crescent'"
                        @click="mode = mode === 'light' ? 'dark' : 'light'"
                    />
                </div>
            </div>
        </nav>
        <FuzzingView v-if="path == 'fuzzing'"/>
        <EditorView v-if="path == 'editor'"/>
        <AboutView v-if="path == 'about'"/>
    </v-app>
</template>

<script>
import EditorView from "./views/EditorView.vue";
import AboutView from "./views/AboutView.vue";
import FuzzingView from "./views/FuzzingView.vue";
import logo from "./assets/logo.png"

export default {
    data() {
        return {
            logo,
            mode: "light",
            path: "editor",
            routes: [
                { name: "EDITOR", path: "editor" },
                { name: "FUZZING", path: "fuzzing" },
                { name: "ABOUT", path: "about" }
            ]
        };
    },
    components: {
        EditorView,
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

/* MODIFIED: Logo container styling for better alignment */
.logo {
    display: flex;
    align-items: center; /* Vertically centers the icon and text */
    gap: 12px; /* Adds a nice space between the icon and text */
}

/* NEW: Specific styling for the logo text */
.logo-text {
    font-family: 'Montserrat', sans-serif; /* A clean, modern heading font */
    font-size: 32px; /* Adjusted to visually match the 40px icon height */
    font-weight: 700; /* A strong, bold weight */
    color: rgb(var(--v-theme-primary)); /* Uses Vuetify's primary theme color */
    line-height: 1; /* Ensures text height is tight */
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