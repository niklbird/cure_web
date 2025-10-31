<template>
  <div>
    <v-card
      width="80vw"
      position="relative"
      style="margin: 20px auto;"
    >
      <v-card-title><h1 style="text-align: center">About DER P(arser)</h1></v-card-title>
      <v-card-text>
        <p style="text-align: justify; font-size: 1.5rem">
          DERP is a web tool suite for parsing, editing and viewing arbitrary ASN.1 encoded files.
          It allows users to parse DER/base64 encoded objects, edit objects content and structure, 
          and nest the final objects into a functional RPKI repository for testing.<br>
          Additionally, it includes integration into the RPKI repository software CURE to live-test edited objects 
          against all real-world RPKI implementations to probe for errors and vulnerabilities. 
          It can thus be used to ensure new configurations are correctly processed by all RPKI software, 
          and to manually create test-cases for RP implementations to identify issues and vulnerabilities.
        </p>
        <br>
        <p style="font-size: 1.5rem">
          DERP is developed and maintained by the Cyberbruecke research group at <a href="">Goethe University Frankfurt (ATHENE).</a>
          <br>Code is available on <a href="https://github.com/Cyberbruecke/cure_web">Github</a> under the MIT license.
        </p>        
      </v-card-text>
    </v-card>

  </div>
</template>
