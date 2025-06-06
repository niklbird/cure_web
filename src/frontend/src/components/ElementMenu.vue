<template>
    <v-card
        width="50vw"
        height="50vh"
    >
        <v-overlay
            v-model="pick"
            style="justify-content: center; align-items: center;"
        >
            <v-card>
                <v-card-text>
                    <v-row>
                        <v-date-picker
                            v-model="date"
                        ></v-date-picker>
                        <v-time-picker
                            v-model="time"
                            :use-seconds="true"
                        ></v-time-picker>
                    </v-row>
                </v-card-text>
                <v-card-actions>
                    <v-btn
                        @click="confirmTime"
                    >
                        Confirm
                    </v-btn>
                    <v-btn
                        @click="pick = false"
                    >
                        Cancel
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-overlay>
        <v-card-title
            style="text-align: center;"
            class="mb-5"
        >
            {{ node ? 'Edit Node' : 'Add Node' }}
        </v-card-title>
        <v-card-text>
            <v-row>
                <v-select
                    v-model="tag"
                    label="ASN.1 TYPE"
                    :items="Object.entries(types).map((item => {
                        [key, value] = item
                        return {
                            'title': value.name,
                            'value': key
                        }
                    }))"
                ></v-select>            
            </v-row>
            <v-row>
                <v-text-field
                    v-model="label"
                    label="Label"
                    placeholder="Label"
                ></v-text-field>
            </v-row>
            <v-row>
                <v-text-field
                    v-model="length"
                    label="Length"
                    placeholder="Length"
                ></v-text-field> 
            </v-row>
            <v-row
                v-if="tag != null"
            >
                <v-col
                    cols="10"
                >
                    <v-text-field
                        v-if="types[tag]['completions'].length == 0"
                        v-model="content"
                        label="Content" 
                        :placeholder="types[tag]['example']"
                    ></v-text-field>
                    <AutoComplete
                        v-else
                        v-model="content"
                        label="Content"
                        :completions="types[tag]['completions']"
                    ></AutoComplete>                         
                </v-col>
                <v-col
                    cols="2"
                >
                    <v-btn
                        v-if="timeTypes.includes(types[tag]['name'])"
                        icon
                        @click="pick = true"
                    >
                        <v-icon
                            icon="mdi-calendar"                            
                        ></v-icon>
                    </v-btn>
                    <v-btn
                        icon
                        elevation="0"
                        style="cursor: pointer"
                    >
                        <v-icon
                            icon="mdi-help-circle"
                        ></v-icon>
                        <v-tooltip
                            activator="parent"
                            location="bottom"
                        >
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
        <v-card-actions
            class="d-flex justify-end"
            style="position: absolute; bottom: 0; right: 0; left: 0;"
        >
            <v-btn
                v-if="!node"
                @click="addNode()"
            >
                Add
            </v-btn>
            <v-btn
                v-else
                @click="changeNode()"
            >
                Apply changes
            </v-btn>
            <v-btn
                @click="$emit('close')"
            >
                Close
            </v-btn>
        </v-card-actions>
    </v-card>
</template>

<script>
import moment from "moment";
import { ASN1_TYPES, TIME_TYPES } from '@/utils/types';
import { VTimePicker } from 'vuetify/labs/VTimePicker'
import AutoComplete from '@/components/AutoComplete.vue'

export default {
    components: {
        VTimePicker,
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
            date: null,
            time: null
        };
    },
    methods: {
        translate(value) {
            // Translate invalid values into a hex string representation with leading "0x"
            let bytes;

            if (typeof value === 'string') {
                // Encode string to UTF-8 bytes
                bytes = new TextEncoder().encode(value);
            } else if (typeof value === 'number') {
                // Use 4 bytes (32-bit unsigned integer)
                const buffer = new ArrayBuffer(4);
                const view = new DataView(buffer);
                view.setUint32(0, value, false); // false = big-endian
                bytes = new Uint8Array(buffer);
            } else if (typeof value === 'object' && value !== null) {
                // Convert object to JSON string then encode
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
            // Combine date and time into a single moment object
            this.date.setHours(...this.time.split(':'));
            const moment_obj = moment(this.date);

            // Format the time based on the ASN.1 type
            const type = ASN1_TYPES[this.tag].name;

            if (type == "TIME-OF-DAY") {
                this.content = moment_obj.format('HH:mm:ss');
            } else if (type == "TIME") {
                // TODO? TIME can be any of the formats 
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
            // Check if tag and content are set
            if (!this.tag || !this.content) return false;

            // Check if the content is valid for the given type
            if (ASN1_TYPES[this.tag].rules(this.content)) return true;             
                    
            // If not, check if there is a transformation defined for the given type
            // and try to apply it to the content
            if (ASN1_TYPES[this.tag].transform) {
                for (const transform of ASN1_TYPES[this.tag].transform) {
                    if (transform.regex.test(this.content)) {
                        this.content = transform.converter(this.content);
                        return true;
                    }
                }
            }

            // Users are allowed to enter invalid values if they want
            // So we ask for confirmation before proceeding
            if (!confirm("The content is not valid for the selected type. Do you still want to continue?")) {
                return false;
            } else {
                // The backend expects invalid values to be translated to a hex string
                this.content = translate(this.content)
                return true;
            }
        },
        addNode() {
            // Check if the content is valid before adding the node
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
            // Check if the content is valid before changing the node
            if (!this.verifyContent()) return

            // Individually update all made changes
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
                    field: "length"
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
