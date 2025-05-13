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
                        >

                        </v-date-picker>
                        <v-time-picker
                            v-model="time"
                            :use-seconds="true"
                        >

                        </v-time-picker>
                        <span>
                            {{  time }} {{ date }}
                        </span>
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
            {{ edit ? 'Edit Node' : 'Add Node' }}
        </v-card-title>
        <v-card-text>
            <v-row
                id="tag"
            >
                <v-select
                    v-model="type"
                    label="ASN.1 TYPE"
                    :items="Object.entries(types).map((item => {
                        [key, value] = item
                        return {
                            'title': value.name,
                            'value': key
                        }
                    }))"
                >
                </v-select>            
            </v-row>
            <v-row
                id="label"
            >
                <v-text-field
                    v-model="label"
                    label="Label"
                    placeholder="Label"
                ></v-text-field>
            </v-row>
            <v-row
                id="length"
            >
                <v-text-field
                    v-model="length"
                    label="Length"
                    placeholder="Length"
                >
                </v-text-field> 
            </v-row>
            <v-row
                v-if="type"
            >
                <v-col
                    cols="10"
                >
                    <v-text-field
                        v-model="content"
                        label="Field Value" 
                        :placeholder="types[type]['example']"
                    >
                    </v-text-field>                         
                </v-col>
                <v-col
                    cols="2"
                >
                    <v-btn
                        v-if="timeTypes.includes(types[type]['name'])"
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
                    >
                        <v-icon
                            icon="mdi-help-circle"
                        ></v-icon>
                        <v-tooltip
                            activator="parent"
                            location="bottom"
                        >
                            <span
                                v-for="(chunk, index) in types[type]['description'].split('\n')"
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
                v-if="!edit"
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
import { ASN1_TYPES, TIME_TYPES } from '@/utils/parse';
import { VTimePicker } from 'vuetify/labs/VTimePicker'

export default {
    components: {
        VTimePicker
    },
    props: {
        node: {
            type: Object,
            default: null
        },
        edit: {
            type: Boolean,
            default: false
        }
    },
    emits: ['close'],
    data() {
        return {
            type: this.node ? this.node.tag[0] : null,
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
        confirmTime() {
            this.date.setHours(...this.time.split(':'));
            const moment_obj = moment(this.date);
            const type = ASN1_TYPES[this.type].name;

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
            // If the type is set to BIT STRING, check if the content is an IP Address
            // and convert it to a BIT STRING.
            if (this.type == 3 && this.content) {
                // Check if content is IPv4 address
                if (/^(\d{1,3}\.){3}\d{1,3}$/.test(this.content)) {
                    this.content = ASN1_TYPES[this.type].transform["ipv4"](this.content);
                // Check if content is IPv6 address
                } else if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(this.content)) {
                    this.content = ASN1_TYPES[this.type].transform["ipv6"](this.content);
                } else {
                    alert("Invalid IP Address");
                    return false;
                }
            }

            // Check if the content is valid for the given type.
            if (this.type && this.content) {
                if (!ASN1_TYPES[this.type].rules(this.content)) {
                    if (!confirm("The content is not valid for the selected type. Do you still want to continue?")) {
                        return false;
                    } else {
                        this.content = translate(this.content)
                    }
                }
            }
            return true
        },
        addNode() {
            if (!this.verifyContent()) {
                return;
            }

            this.$store.commit('nodeAdded', {
                tab: this.$store.state.currentTab,
                parent: this.node.id,
                type: type,
                label: label,
                content: content
            });
        },
        changeNode() {
            if (!this.verifyContent()) {
                return;
            }

            if (this.node.tag[0] != this.type) {
                this.$store.commit("nodeChanged", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.type
                })
            }

            if (this.node.label != this.label) {
                this.$store.commit("nodeChanged", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.label
                })
            }

            if (this.node.length[0] != this.length) {
                this.$store.commit("nodeChanged", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.length
                })
            }

            if (this.node.content[1] != this.content) {
                this.$store.commit("nodeChanged", {
                    tab: this.$store.state.currentTab,
                    id: this.node.id,
                    value: this.content
                })
            }
        }
    }
};
</script>

<style scoped>

.question-mark {
  cursor: pointer;
}
</style>
