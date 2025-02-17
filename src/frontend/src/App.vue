<template>
  <v-app>
    <nav class="navbar">
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
      links: [
        { name: "ASN.1 PARSER", path: "/asn" },
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
  background-color: black;
  box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);
  padding: 15px 0;
}

/* Center content inside the navbar */
.container {
  max-width: 90vw;
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
  color: #666;
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
