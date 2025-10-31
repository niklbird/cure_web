<template>
    <v-app :theme="mode">
        <v-app-bar app color="surface" elevation="2">
            <v-app-bar-nav-icon v-if="isMobile" @click="drawer = !drawer"></v-app-bar-nav-icon>
            
            <v-app-bar-title>
                <div class="d-flex align-center" style="gap: 12px;">
                    <img :src="logo" alt="Logo" height="32"/>
                    <span class="logo-text">{{ path == "editor" || path == "about" ? "DERP" : "CURE" }}</span>
                </div>
            </v-app-bar-title>

            <div v-if="!isMobile" class="d-flex align-center" style="gap: 8px;">
                <v-btn 
                    v-for="link in routes" 
                    :key="link.path" 
                    @click="path = link.path"
                    :variant="path === link.path ? 'outlined' : 'text'"
                >
                    {{ link.name }}
                </v-btn>
            </div>

            <v-btn
                class="ml-2"
                elevation="0"
                density="comfortable"
                :icon="mode === 'light' ? 'mdi-moon-waning-crescent' : 'mdi-weather-sunny'"
                @click="mode = mode === 'light' ? 'dark' : 'light'"
            />
        </v-app-bar>

        <v-navigation-drawer v-model="drawer" v-if="isMobile" temporary>
            <v-list nav>
                <v-list-item
                    v-for="link in routes"
                    :key="link.path"
                    @click="path = link.path; drawer = false"
                    :active="path === link.path"
                    :title="link.name"
                ></v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-main>
            <FuzzingView v-if="path == 'fuzzing'"/>
            <EditorView v-if="path == 'editor'"/>
            <AboutView v-if="path == 'about'"/>
        </v-main>
    </v-app>
</template>

<script>
import EditorView from "./views/EditorView.vue";
import AboutView from "./views/AboutView.vue";
import FuzzingView from "./views/FuzzingView.vue";
import logo from "./assets/logo.png"
import { useDisplay } from 'vuetify'
import init from '@/rust/cure_web.js'


export default {
    // We use setup() to access modern Vuetify features like useDisplay
    setup() {
        const { mobile } = useDisplay()
        init()

        return { isMobile: mobile }
    },
    data() {
        return {
            logo,
            drawer: false, // Controls the mobile navigation drawer
            mode: "light",
            path: "editor",
            routes: [
                { name: "EDITOR", path: "editor" },
                // { name: "FUZZING", path: "fuzzing" },
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
/* Most of the custom CSS is no longer needed! */
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.logo-text {
    font-family: 'Montserrat', sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: rgb(var(--v-theme-primary)); /* Uses Vuetify's primary theme color */
    line-height: 1;
}
</style>