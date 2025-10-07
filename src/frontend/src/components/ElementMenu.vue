<template>
    <v-card
        :width="isMobile ? '95vw' : '50vw'"
        :max-height="isMobile ? '90vh' : '70vh'"
        class="d-flex flex-column"
    >
        <v-overlay
            v-model="pick"
            class="d-flex justify-center align-center"
            persistent
        >
            <v-card :width="isMobile ? '90vw' : 'auto'">
                <v-card-text>
                    <v-row>
                        <v-col cols="12" md="auto">
                            <v-date-picker
                                v-model="date"
                            ></v-date-picker>
                        </v-col>
                        <v-col cols="12" md="auto">
                            <v-time-picker
                                v-model="time"
                                :use-seconds="true"
                            ></v-time-picker>
                        </v-col>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn
                        @click="confirmTime"
                        color="primary"
                        variant="tonal"
                    >
                        Confirm
                    </v-btn>
                    <v-btn
                        @click="pick = false"
                        variant="tonal"
                    >
                        Cancel
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-overlay>

        <v-card-title class="text-center flex-shrink-0">
            {{ node ? 'Edit Node' : 'Add Node' }}
        </v-card-title>
        
        <v-card-text class="flex-grow-1 overflow-y-auto">
            <v-row>
                <v-select
                    v-model="tag"
                    label="ASN.1 TYPE"
                    :items="Object.entries(types).map(([key, value]) => ({
                        title: value.name,
                        value: key
                    }))"
                    density="compact"
                ></v-select>
            </v-row>
            <v-row>
                <v-text-field
                    v-model="label"
                    label="Label"
                    placeholder="Label"
                    density="compact"
                ></v-text-field>
            </v-row>
            <v-row>
                <v-text-field
                    v-model="length"
                    label="Length"
                    placeholder="Length"
                    density="compact"
                ></v-text-field> 
            </v-row>
            <v-row v-if="tag != null">
                <v-col cols="10">
                    <v-text-field
                        v-if="types[tag]['completions'].length == 0"
                        v-model="content"
                        label="Content" 
                        :placeholder="types[tag]['example']"
                        density="compact"
                    ></v-text-field>
                    <AutoComplete
                        v-else
                        v-model="content"
                        label="Content"
                        :completions="types[tag]['completions']"
                    ></AutoComplete>
                </v-col>
                <v-col cols="2" class="d-flex align-center">
                    <v-btn
                        v-if="timeTypes.includes(types[tag]['name'])"
                        icon
                        @click="pick = true"
                        variant="text"
                        size="small"
                    >
                        <v-icon icon="mdi-calendar"></v-icon>
                    </v-btn>
                    <v-btn icon variant="text" size="small">
                        <v-icon icon="mdi-help-circle"></v-icon>
                        <v-tooltip activator="parent" location="bottom">
                            <span
                                v-for="(chunk, index) in types[tag]['description'].split('\n')"
                                :key="index"
                            >
                                {{ chunk }}
                                <br>
                            </span>
                        </v-tooltip>
                    </v-btn>
                </v-col>
            </v-row>
        </v-card-text>
        
        <v-divider></v-divider>

        <v-card-actions class="pa-4 flex-shrink-0">
            <v-spacer></v-spacer>
            <v-btn
                v-if="!node"
                @click="addNode()"
                color="primary"
                variant="tonal"
            >
                Add
            </v-btn>
            <v-btn
                v-else
                @click="changeNode()"
                color="primary"
                variant="tonal"
            >
                Apply Changes
            </v-btn>
            <v-btn
                @click="$emit('close')"
                variant="tonal"
            >
                Close
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import moment from "moment";
import { ASN1_TYPES, TIME_TYPES } from '@/utils/types';
import AutoComplete from '@/components/AutoComplete.vue';
import { useDisplay } from 'vuetify'; // NEW: Import useDisplay

export default {
    // NEW: Add setup function to use composables
    setup() {
        const { mobile } = useDisplay();
        return { isMobile: mobile };
    },
    components: {
        AutoComplete
    },
    props: {
        node: {
            type: Object,
            default: null
        },
        parent: {
            type: Number, 
            default: 0
        }
    },
    emits: ['close'],
    data() {
        return {
            tag: this.node ? this.node.tag[0] : null,
            label: this.node ? this.node.label : null,
            length: this.node ? this.node.length[0] : null,
            content: this.node ? this.node.content[1] : null,
            types: ASN1_TYPES,
            timeTypes: TIME_TYPES,
            pick: false,
            date: new Date(),
            time: new Date().toLocaleTimeString('en-GB')
        };
    },
    methods: {
        translate(value) {
            let bytes;
            if (typeof value === 'string') {
                bytes = new TextEncoder().encode(value);
            } else if (typeof value === 'number') {
                const buffer = new ArrayBuffer(4);
                const view = new DataView(buffer);
                view.setUint32(0, value, false);
                bytes = new Uint8Array(buffer);
            } else if (typeof value === 'object' && value !== null) {
                const jsonStr = JSON.stringify(value);
                bytes = new TextEncoder().encode(jsonStr);
            } else {
                throw new TypeError("Unsupported type for hex conversion");
            }
            const hex = Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            return '0x' + hex;
        },
        confirmTime() {
            this.date.setHours(...this.time.split(':'));
            const moment_obj = moment(this.date);
            const type = ASN1_TYPES[this.tag].name;
            if (type == "TIME-OF-DAY") {
                this.content = moment_obj.format('HH:mm:ss');
            } else if (type == "TIME") {
                console.log("TIME")
            } else if (type == "DATE") {
                this.content = moment_obj.format('YYYY-MM-DD');
            } else if (type == "DATE-TIME") {
                this.content = moment_obj.format('YYYY-MM-DDTHH:mm:ss');
            } else if (type == "GeneralizedTime") {
                this.content = moment_obj.format('YYYYMMDDHHmmss');
            } else if (type == "UTCTime") {
                this.content = moment_obj.format('YYMMDDHHmmssZ');
            }
            this.pick = false;
        },
        verifyContent() {
            if (this.content === "" || this.content === null) return true;
            if (this.tag === null) return false;
            if (ASN1_TYPES[this.tag].rules(this.content)) return true;
            if (!confirm("The content is not valid for the selected type. Do you still want to continue?")) {
                return false;
            } else {
                this.content = this.translate(this.content)
                return true;
            }
        },
        addNode() {
            if (!this.verifyContent()) return
            this.$store.commit('nodeAdded', {
                tab: this.$store.state.currentTab,
                parent: this.parent,
                tag: this.tag,
                label: this.label,
                content: this.content
            });
        },
        changeNode() {
            if (!this.verifyContent()) return
            if (this.node.tag[0] != this.tag) {
                this.$store.commit("nodeUpdated", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.tag,
                    field: "tag"
                })
            }
            if (this.node.label != this.label) {
                this.$store.commit("nodeUpdated", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.label,
                    field: "label"
                })
            }
            if (this.node.length[0] != this.length) {
                this.$store.commit("nodeUpdated", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.length,
                    field: "field"
                })
            }
            if (this.node.content[1] != this.content) {
                this.$store.commit("nodeUpdated", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.content,
                    field: "content"
                })
            }
            this.$emit('close');
        }
    }
};
</script>