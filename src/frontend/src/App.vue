<template>
    <v-app :theme=mode>
        <nav class="navbar bg-surface">
            <div class="container">
                <div class="logo">WEB CURE</div>
                <div class="nav-links">
                    <router-link 
                        v-for="link in links" 
                        :key="link.path" 
                        :to="link.path" 
                        class="nav-link" 
                        exact-active-class="active-link"
                    >
                        {{ link.name }}
                    </router-link>
                    <v-btn
                        elevation="0"
                        class="bg-primary-darken-1"
                        @click="mode = mode === 'light' ? 'dark' : 'light'"
                    >
                        <v-icon>{{ mode === 'light' ? 'mdi-moon-waning-crescent' : 'mdi-weather-sunny' }}</v-icon>
                    </v-btn>
                </div>
            </div>
        </nav>
        <router-view/>
    </v-app>
</template>

<script>
export default {
    data() {
        return {
            mode: "light",
            links: [
                { name: "ASN.1 PARSER", path: "/" },
                { name: "RPKI NOTIFICATION", path: "/rpki-notify" },
                { name: "ABOUT", path: "/about" },
            ],
        };
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
    color: #777676;
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
