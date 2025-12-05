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
                            <v-date-picker v-model="date"></v-date-picker>
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
                    <v-btn @click="pick = false" variant="tonal">
                        Cancel
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-overlay>

        <v-card-title class="text-center flex-0">
            {{ node ? 'Edit Node' : 'Add Node' }}
        </v-card-title>
        
        <v-divider></v-divider>

        <v-card-text class="flex-grow-1" style="overflow-y: auto;">
            <v-form
                @keydown.enter.prevent="node ? changeNode() : addNode()"
            >
                <v-select
                    v-model="tag"
                    label="ASN.1 TYPE"
                    :items="asn1TypesForSelect"
                    item-title="title"
                    item-value="value"
                    density="compact"
                ></v-select>

                <v-text-field
                    v-model="label"
                    label="Label"
                    placeholder="Label"
                    density="compact"
                ></v-text-field>

                <v-text-field
                    v-if="node != null"
                    v-model="length"
                    label="Length"
                    placeholder="Length"
                    density="compact"
                ></v-text-field>
                
                <v-row v-if="tag != null && tag != 48 && tag != 49" class="align-center">
                    <v-col>
                        <v-text-field
                            v-if="types[tag]['completions'].length == 0"
                            v-model="content"
                            label="Content"
                            :placeholder="types[tag]['example']"
                            density="compact"
                            hide-details
                        ></v-text-field>
                        <AutoComplete
                            v-else
                            v-model="content"
                            label="Content"
                            :completions="types[tag]['completions']"
                        ></AutoComplete>
                    </v-col>
                    <v-col cols="auto" class="d-flex">
                        <v-btn
                            v-if="timeTypes.includes(types[tag]['name'])"
                            icon="mdi-calendar"
                            @click="pick = true"
                            variant="text"
                            size="small"
                        ></v-btn>
                        
                        <v-btn icon variant="text" size="small">
                            <v-icon>mdi-help-circle</v-icon>
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
            </v-form>
        </v-card-text>
        
        <v-divider></v-divider>

        <v-card-actions class="pa-4 flex-0">
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
import moment from "moment"
import { ASN1_TYPES, TIME_TYPES } from '@/utils/types'
import AutoComplete from '@/components/AutoComplete.vue'
import { useDisplay } from 'vuetify'
import { useTabsStore } from '@/stores/tabs'

export default {
    setup() {
        const { mobile } = useDisplay()
        const store = useTabsStore()
        return { isMobile: mobile, store }
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
            content: this.node ? this.node.content[2] : null,
            types: ASN1_TYPES,
            timeTypes: TIME_TYPES,
            pick: false,
            date: new Date(),
            time: new Date().toLocaleTimeString('en-GB')
        }
    },
    computed: {
        asn1TypesForSelect() {
            return Object.entries(this.types).map(([key, value]) => ({
                title: value.name,
                value: key
            }))
        }
    },
    methods: {
        translate(value) {
            let bytes
            if (typeof value === 'string') {
                bytes = new TextEncoder().encode(value)
            } else if (typeof value === 'number') {
                const buffer = new ArrayBuffer(4)
                const view = new DataView(buffer)
                view.setUint32(0, value, false)
                bytes = new Uint8Array(buffer)
            } else if (typeof value === 'object' && value !== null) {
                const jsonStr = JSON.stringify(value)
                bytes = new TextEncoder().encode(jsonStr)
            } else {
                throw new TypeError("Unsupported type for hex conversion")
            }
            const hex = Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
            return '0x' + hex
        },
        confirmTime() {
            this.date.setHours(...this.time.split(':'))
            const moment_obj = moment(this.date)
            const type = ASN1_TYPES[this.tag].name

            if (type == "TIME-OF-DAY") {
                this.content = moment_obj.format('HH:mm:ss')
            } else if (type == "TIME") {
                this.content = moment_obj.format('YYYY-MM-DDTHH:mm:ss')
            } else if (type == "DATE") {
                this.content = moment_obj.format('YYYY-MM-DD')
            } else if (type == "DATE-TIME") {
                this.content = moment_obj.format('YYYY-MM-DDTHH:mm:ss')
            } else if (type == "GeneralizedTime") {
                this.content = moment_obj.format('YYYYMMDDHHmmss')
            } else if (type == "UTCTime") {
                this.content = moment_obj.format('YYMMDDHHmmssZ')
            } else if (type == "DURATION") {
                const years = moment_obj.years()
                const months = moment_obj.months()
                const days = moment_obj.days()
                const hours = moment_obj.hours()
                const minutes = moment_obj.minutes()
                const seconds = moment_obj.seconds()

                let result = 'P'
                if (years) result += `${years}Y`
                if (months) result += `${months}M`
                if (days) result += `${days}D`

                if (hours || minutes || seconds) {
                    result += 'T'
                    if (hours) result += `${hours}H`
                    if (minutes) result += `${minutes}M`
                    if (seconds) result += `${seconds}S`
                }

                if (result === 'P') result = 'PT0S'

                this.content = result
            }
            this.pick = false
        },
        verifyContent() {
            if (this.content === "" || this.content === null) return true
            if (this.tag === null) return false
            if (ASN1_TYPES[this.tag].rules(this.content)) return true
            if (ASN1_TYPES[this.tag].transform) {
                const regex = ASN1_TYPES[this.tag].transform.regex
                if (regex.test(this.content)) {
                    this.content = ASN1_TYPES[this.tag].transform.converter(this.content)
                    return true
                }
            }
            if (!confirm("The content is not valid for the selected type. Do you still want to continue?")) {
                return false
            } else {
                this.content = this.translate(this.content)
                return true
            }
        },
        addNode() {
            if (!this.verifyContent()) return
            this.store.nodeAdded({
                tab: this.store.currentTab,
                parent: this.parent,
                tag: this.tag,
                label: this.label,
                content: this.content ? this.content : ""
            })
            this.$emit('close')
        },
        changeNode() {
            if (!this.verifyContent()) return

            this.store.nodeChanged({
                tab: this.store.currentTab,
                id: this.node.id,
                tag: this.tag,
                length: this.length[0] != this.length ? this.length : null,
                content: this.content
            })

            if (this.node.label != this.label) {
                this.store.nodeUpdated({
                    tab: this.store.currentTab,
                    id: this.node.id,
                    value: this.label,
                    field: "label"
                })
            }
            this.$emit('close')
        }
    }
}
</script>