<template>
    <v-row>
        <v-col cols="4">
            <v-table>
                <template v-slot:top>
                    <v-toolbar flat>
                        <v-toolbar-title>Inconsistencies</v-toolbar-title>
                        <v-divider class="mx-4" inset vertical></v-divider>
                        <v-spacer></v-spacer>
                        <v-text-field
                            v-model="search"
                            append-icon="mdi-magnify"
                            label="Search"
                            single-line
                            hide-details
                        ></v-text-field>
                    </v-toolbar>
                </template>
                <thead>
                    <tr>
                        <th class="text-left">ID</th>
                        <th class="text-left">Owner</th>
                        <th class="text-left">Affected Object</th>
                        <th class="text-left">Object Type</th>
                        <th class="text-left">Reason</th>
                        <th class="text-left">Time Stamp</th>
                        <th class="text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="inconsistency in inconsistencies" :key="inconsistency.id">
                        <td>{{ inconsistency.id }}</td>
                        <td>{{ inconsistency.owner.id }}</td>
                        <td>{{ inconsistency.affected_object }}</td>
                        <td>{{ inconsistency.object_type }}</td>
                        <td>{{ inconsistency.reason }}</td>
                        <td>{{ inconsistency.time_stamp }}</td>
                        <td>
                            <v-btn @click="showDetails(inconsistency)">Show details</v-btn>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-col>
        <v-col cols="4">
            <v-table>
                <template v-slot:top>
                    <v-toolbar flat>
                        <v-toolbar-title>Errors</v-toolbar-title>
                        <v-divider class="mx-4" inset vertical></v-divider>
                        <v-spacer></v-spacer>
                        <v-text-field
                            v-model="search"
                            append-icon="mdi-magnify"
                            label="Search"
                            single-line
                            hide-details
                        ></v-text-field>
                    </v-toolbar>
                </template>
                <thead>
                    <tr>
                        <th class="text-left">ID</th>
                        <th class="text-left">Owner</th>
                        <th class="text-left">Name</th>
                        <th class="text-left">Object Type</th>
                        <th class="text-left">Reason</th>
                        <th class="text-left">Time Stamp</th>
                        <th class="text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="error in errors" :key="error.id">
                        <td>{{ error.id }}</td>
                        <td>{{ error.owner.id }}</td>
                        <td>{{ error.name }}</td>
                        <td>{{ error.object_type }}</td>
                        <td>{{ error.reason }}</td>
                        <td>{{ error.time_stamp }}</td>
                        <td>
                            <v-btn @click="showDetails(error)">Show Details</v-btn>
                        </td>
                    </tr>
                </tbody>
            </v-table>
        </v-col>
        <v-col cols="4">
            <v-table>
                <template v-slot:top>
                    <v-toolbar flat>
                        <v-toolbar-title>Reachability</v-toolbar-title>
                        <v-divider class="mx-4" inset vertical></v-divider>
                        <v-spacer></v-spacer>
                        <v-text-field
                            v-model="search"
                            append-icon="mdi-magnify"
                            label="Search"
                            single-line
                            hide-details
                        ></v-text-field>
                    </v-toolbar>
                </template>
                <thead>
                    <tr>
                        <th class="text-left">Repository</th>
                        <th class="text-left">URL</th>
                        <th class="text-left">Communication Type</th>
                        <th class="text-left">Error Message</th>
                        <th class="text-left">Time Stamp</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="reach in unreachabilities" :key="reach.id">
                        <td>{{ reach.publication_point.repository }}</td>
                        <td>{{ reach.publication_point.urls.map((x) => x.url) }}</td>
                        <td>{{ reach.publication_point.communication_types.map((x) => x.name) }}</td>
                        <td>{{ reach.error_messages.map((x) => x.text) }}</td>
                        <td>{{ reach.time_stamp }}</td>
                    </tr>
                </tbody>
            </v-table>
        </v-col>
    </v-row>    
  </template>
  
  <script>
  // @ is an alias to /src
  import axios from 'axios';

  export default {
    name: 'InconsistencyView',
    components: {},
    data: () => ({
      search: '',
      inconsistencies: [],
      errors: [],
      unreachabilities: []
    }),
    mounted() {
      this.getInconsistencies()
      this.getErrors()
      this.getUnreachabilities()
    },
    methods: {
        async getInconsistencies() {
            try {
                const response = await axios.get('http://127.0.0.1:8000/inconsistencies/')
                this.inconsistencies = response.data
            } catch (error) {
                console.error(error)
            }
        },
        async getErrors() {
            try {
                const response = await axios.get('http://127.0.0.1:8000/errors/');
                this.errors = response.data;
            } catch (error) {
                console.error(error);
            }
        },
        async getUnreachabilities() {
            try {
                const response = await axios.get('http://127.0.0.1:8000/unreachabilities/');
                this.unreachabilities = response.data;
            } catch (error) {
                console.error(error);
            }
        },
    }
  }
  </script>