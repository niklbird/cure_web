<template>
    <v-app :theme="mode">
        <v-app-bar app color="surface" elevation="2">
            <v-app-bar-nav-icon v-if="isMobile" @click="drawer = !drawer"></v-app-bar-nav-icon>
            
            <v-app-bar-title>
                <div class="d-flex align-center" style="gap: 12px;">
                    <img :src="logo" alt="Logo" height="32"/>
                    <span class="logo-text">{{ logoText }}</span>
                </div>
            </v-app-bar-title>

            <div v-if="!isMobile" class="d-flex align-center" style="gap: 8px;">
                <v-btn 
                    to="/"
                    :variant="$route.path === '/' ? 'outlined' : 'text'"
                >
                    EDITOR
                </v-btn>
                <v-btn 
                    to="/notify"
                    :variant="$route.path === '/notify' ? 'outlined' : 'text'"
                >
                    NOTIFY
                </v-btn>
                <v-btn 
                    to="/about"
                    :variant="$route.path === '/about' ? 'outlined' : 'text'"
                >
                    ABOUT
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
                    to="/"
                    title="EDITOR"
                    @click="drawer = false"
                ></v-list-item>
                <v-list-item
                    to="/notify"
                    title="NOTIFY"
                    @click="drawer = false"
                ></v-list-item>
                <v-list-item
                    to="/about"
                    title="ABOUT"
                    @click="drawer = false"
                ></v-list-item>
            </v-list>
        </v-navigation-drawer>

        <v-main>
            <router-view />
        </v-main>
    </v-app>
</template>

<script>
import logo from "./assets/logo.png"
import { useDisplay } from 'vuetify'
import init from '@/rust/cure_web.js'


export default {
    setup() {
        const { mobile } = useDisplay()
        init()

        return { isMobile: mobile }
    },
    data() {
        return {
            logo,
            drawer: false,
            mode: "light"
        };
    },
    computed: {
        logoText() {
            if (this.$route.path === '/about') return 'DERP'
            if (this.$route.path === '/notify') return 'RPKI Notify'
            return 'CURE'
        }
    }
};
</script>

<style>
#app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.logo-text {
    font-family: 'Montserrat', sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
    line-height: 1;
}
</style>