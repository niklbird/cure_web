<template>
  <v-container fluid class="notify-dashboard pa-4 pa-md-6">
    <!-- Registration Modal -->
    <v-dialog v-model="showRegistration" max-width="500">
      <v-card class="registration-card">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Register for Updates</span>
          <v-btn icon="mdi-close" variant="text" size="small" @click="showRegistration = false" />
        </v-card-title>
        <v-divider />
        <v-card-text class="pt-6">
          <v-text-field
            v-model="registrationForm.repositoryUri"
            label="Repository URI"
            placeholder="rsync://rpki.example.com/repository/"
            variant="outlined"
            density="comfortable"
            :error-messages="registrationErrors.repositoryUri"
            class="mb-4"
          />
          <v-text-field
            v-model="registrationForm.email"
            label="Email"
            placeholder="you@example.com"
            type="email"
            variant="outlined"
            density="comfortable"
            :error-messages="registrationErrors.email"
          />
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer />
          <v-btn variant="tonal" @click="showRegistration = false">Cancel</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="registering"
            @click="submitRegistration"
          >
            Register
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Loading State -->
    <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 60vh;">
      <v-progress-circular indeterminate color="primary" size="64" />
    </div>

    <!-- Error State -->
    <v-alert v-else-if="error" type="error" variant="tonal" class="mb-6">
      {{ error }}
      <template #append>
        <v-btn variant="text" @click="fetchReport">Retry</v-btn>
      </template>
    </v-alert>

    <!-- No Data State -->
    <div v-else-if="!report" class="d-flex justify-center align-center" style="min-height: 60vh;">
      <v-card variant="tonal" class="pa-8 text-center" max-width="400">
        <v-icon size="64" color="grey" class="mb-4">mdi-database-off-outline</v-icon>
        <h3 class="text-h6 mb-2">No Report Data</h3>
        <p class="text-body-2 text-medium-emphasis">
          No report data available yet. Please run the update command.
        </p>
      </v-card>
    </div>

    <!-- Dashboard Content -->
    <template v-else>
      <!-- Header Bar -->
      <div class="d-flex flex-wrap align-center justify-space-between mb-6 ga-4">
        <h1 class="text-h4 font-weight-bold">RPKI Dashboard</h1>
        <v-btn color="primary" variant="flat" @click="showRegistration = true">
          <v-icon start>mdi-bell-outline</v-icon>
          Notify me!
        </v-btn>
      </div>

      <!-- Summary Bar -->
      <v-card class="mb-6" variant="outlined">
        <v-card-text>
          <v-row dense>
            <v-col
              v-for="stat in summaryStats"
              :key="stat.label"
              cols="6"
              sm="4"
              md="auto"
              class="flex-grow-1"
            >
              <div class="text-center pa-2">
                <div class="text-caption text-uppercase text-medium-emphasis font-weight-medium mb-1">
                  {{ stat.label }}
                </div>
                <div class="text-h6 font-weight-medium">
                  {{ stat.value ?? 'N/A' }}
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Dashboard Grid -->
      <v-row>
        <!-- VRPs Summary -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height dashboard-tile" variant="outlined">
            <v-card-title class="d-flex align-center ga-2">
              VRPs Summary
              <v-tooltip location="bottom" max-width="240">
                <template #activator="{ props: tooltipProps }">
                  <v-icon v-bind="tooltipProps" size="small" color="grey">mdi-help-circle-outline</v-icon>
                </template>
                Metrics on the VRPs created by the different relying parties.
              </v-tooltip>
            </v-card-title>
            <v-divider />
            <v-card-text class="tile-scroll-content">
              <div class="text-subtitle-2 text-medium-emphasis mb-2">Overall Breakdown</div>
              <v-list density="compact" class="pa-0 mb-4">
                <v-list-item
                  v-for="item in vrpBreakdown"
                  :key="item.label"
                  class="px-0"
                >
                  <template #title>
                    <div class="d-flex justify-space-between">
                      <span class="text-body-2 font-weight-medium">{{ item.label }}</span>
                      <span class="text-body-2">{{ item.value }}</span>
                    </div>
                  </template>
                </v-list-item>
              </v-list>

              <v-divider class="mb-4" />

              <div class="text-subtitle-2 text-medium-emphasis mb-2">VRPs per Relying Party</div>
              <v-table density="compact" v-if="report.vrps_by_rp?.length">
                <thead>
                  <tr>
                    <th>Relying Party</th>
                    <th class="text-right">VRP Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="([rpName, vrpCount]) in report.vrps_by_rp" :key="rpName">
                    <td>{{ rpName }}</td>
                    <td class="text-right">{{ vrpCount?.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else class="text-body-2 text-medium-emphasis text-center pa-4">
                No data available.
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Relying Party Logs -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height dashboard-tile" variant="outlined">
            <v-card-title class="d-flex align-center ga-2">
              Relying Party Logs
              <v-tooltip location="bottom" max-width="240">
                <template #activator="{ props: tooltipProps }">
                  <v-icon v-bind="tooltipProps" size="small" color="grey">mdi-help-circle-outline</v-icon>
                </template>
                Logs from various relying party software implementations.
              </v-tooltip>
            </v-card-title>
            <v-divider />
            <v-card-text class="tile-scroll-content pa-0">
              <template v-if="rpLogNames.length">
                <v-tabs v-model="activeRpLogTab" density="compact" show-arrows class="px-4 pt-2">
                  <v-tab
                    v-for="rpName in rpLogNames"
                    :key="rpName"
                    :value="rpName"
                    size="small"
                  >
                    {{ rpName }}
                  </v-tab>
                </v-tabs>

                <v-window v-model="activeRpLogTab">
                  <v-window-item
                    v-for="rpName in rpLogNames"
                    :key="rpName"
                    :value="rpName"
                  >
                    <div class="log-entries pa-4">
                      <div
                        v-for="(log, idx) in getDisplayedLogs(rpName)"
                        :key="idx"
                        class="log-entry"
                      >
                        {{ log }}
                      </div>
                      <v-btn
                        v-if="hasMoreLogs(rpName)"
                        variant="outlined"
                        size="small"
                        color="primary"
                        class="mt-3"
                        :loading="loadingAllLogs === rpName"
                        @click="fetchAllLogs(rpName)"
                      >
                        Show complete logs ({{ getLogCount(rpName) }} entries)
                      </v-btn>
                    </div>
                  </v-window-item>
                </v-window>
              </template>
              <div v-else class="text-body-2 text-medium-emphasis text-center pa-8">
                No log data available.
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Repository Reachability Chart -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height dashboard-tile" variant="outlined">
            <v-card-title class="d-flex align-center ga-2">
              Repository Reachability
              <v-tooltip location="bottom" max-width="240">
                <template #activator="{ props: tooltipProps }">
                  <v-icon v-bind="tooltipProps" size="small" color="grey">mdi-help-circle-outline</v-icon>
                </template>
                Status of RPKI repositories.
              </v-tooltip>
            </v-card-title>
            <v-divider />
            <v-card-text class="d-flex align-center justify-center" style="min-height: 280px;">
              <canvas ref="reachabilityChartCanvas" style="max-width: 280px; max-height: 280px;" />
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Analysis / Inconsistencies -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height dashboard-tile" variant="outlined">
            <v-card-title class="d-flex align-center ga-2">
              Analysis
              <v-tooltip location="bottom" max-width="240">
                <template #activator="{ props: tooltipProps }">
                  <v-icon v-bind="tooltipProps" size="small" color="grey">mdi-help-circle-outline</v-icon>
                </template>
                View persistent VRP differences or object inconsistencies.
              </v-tooltip>
            </v-card-title>
            <v-divider />
            <v-card-text class="tile-scroll-content">
              <v-table density="compact" v-if="report.inconsistencies?.length">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Log Message</th>
                    <th class="text-right">Impacted VRPs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, idx) in report.inconsistencies" :key="idx">
                    <td class="text-no-wrap">{{ item.file_name }}</td>
                    <td>{{ item.log_message }}</td>
                    <td class="text-right">{{ item.num_impacted_vrps }}</td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else class="text-body-2 text-medium-emphasis text-center pa-4">
                No inconsistencies found.
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Common Errors -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height dashboard-tile" variant="outlined">
            <v-card-title class="d-flex align-center ga-2">
              Common Errors
              <v-tooltip location="bottom" max-width="240">
                <template #activator="{ props: tooltipProps }">
                  <v-icon v-bind="tooltipProps" size="small" color="grey">mdi-help-circle-outline</v-icon>
                </template>
                Most frequent errors aggregated from relying parties.
              </v-tooltip>
            </v-card-title>
            <v-divider />
            <v-card-text class="tile-scroll-content">
              <v-table density="compact" v-if="report.error_messages?.length">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th class="text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(err, idx) in report.error_messages" :key="idx">
                    <td>{{ err.message }}</td>
                    <td class="text-right">{{ err.count }}</td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else class="text-body-2 text-medium-emphasis text-center pa-4">
                No common errors found.
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Repository Status Details -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height dashboard-tile" variant="outlined">
            <v-card-title class="d-flex align-center ga-2">
              Repository Status Details
              <v-tooltip location="bottom" max-width="240">
                <template #activator="{ props: tooltipProps }">
                  <v-icon v-bind="tooltipProps" size="small" color="grey">mdi-help-circle-outline</v-icon>
                </template>
                List of repositories, their reachability status, and the number of VRPs they affect.
              </v-tooltip>
            </v-card-title>
            <v-divider />
            <v-card-text class="tile-scroll-content">
              <v-table density="compact" v-if="report.repositories?.length">
                <thead>
                  <tr>
                    <th>URI</th>
                    <th class="text-center">Reachable</th>
                    <th class="text-right">Contained VRPs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(repo, idx) in report.repositories" :key="idx">
                    <td class="text-truncate" style="max-width: 200px;">{{ repo.uri }}</td>
                    <td class="text-center">
                      <v-icon :color="repo.reachable ? 'success' : 'error'" size="small">
                        {{ repo.reachable ? 'mdi-check-circle' : 'mdi-close-circle' }}
                      </v-icon>
                    </td>
                    <td class="text-right">{{ repo.contained_vrps }}</td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else class="text-body-2 text-medium-emphasis text-center pa-4">
                No repositories found.
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Code and Data -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height dashboard-tile" variant="outlined">
            <v-card-title>Code and Data</v-card-title>
            <v-divider />
            <v-card-text>
              <p class="text-body-2 mb-4">
                Download the manually created test cases for RP implementations as well as the repository crawler:
              </p>
              <v-btn
                variant="flat"
                color="primary"
                href="static/crawler_and_tests.zip"
                class="mb-6"
              >
                <v-icon start>mdi-download</v-icon>
                Download test cases
              </v-btn>

              <p class="text-body-2 mb-4">
                The source code for our automated RFC analysis tooling can be downloaded and explored in browser:
              </p>
              <div class="d-flex flex-wrap ga-3">
                <v-btn variant="flat" color="primary" href="static/rfc-tool.zip">
                  <v-icon start>mdi-download</v-icon>
                  Download code
                </v-btn>
                <v-btn variant="outlined" color="primary" href="static/rfc-analysis">
                  <v-icon start>mdi-open-in-new</v-icon>
                  Explore in browser
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, type Ref } from 'vue'
import { useTheme } from 'vuetify'
import axios from 'axios'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatestReport {
  time_stamp: string
  num_objects: number
  num_roas: number
  num_cas: number
  num_overlap_vrps: number
  num_diff_vrps: number
  num_total_vrps: number
  max_rp_exec_time: number
  crawler_exec_time: number
  num_repos: number
}

interface Inconsistency {
  file_name: string
  log_message: string
  num_impacted_vrps: number
}

interface ErrorMessage {
  message: string
  count: number
}

interface Repository {
  uri: string
  reachable: boolean
  contained_vrps: number
  num_affected_vrps: number
}

interface ReportData {
  latest_report: LatestReport
  ghostbusters_count: number
  num_repos: number
  vrps_by_rp: [string, number][]
  rp_logs_initial: Record<string, string[]>
  rp_logs_counts: Record<string, number>
  reachable_repos_count: number
  unreachable_repos_count: number
  inconsistencies: Inconsistency[]
  error_messages: ErrorMessage[]
  repositories: Repository[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = '/api'
const INITIAL_LOG_LIMIT = 50

// ─── State ────────────────────────────────────────────────────────────────────

const theme = useTheme()

const loading = ref(true)
const error = ref<string | null>(null)
const report = ref<ReportData | null>(null)

// Registration
const showRegistration = ref(false)
const registering = ref(false)
const registrationForm = ref({
  repositoryUri: '',
  email: ''
})
const registrationErrors = ref<Record<string, string>>({})

// RP Logs
const activeRpLogTab = ref<string>('')
const loadingAllLogs = ref<string | null>(null)
const allLogsCache = ref<Record<string, string[]>>({})

// Chart
const reachabilityChartCanvas: Ref<HTMLCanvasElement | null> = ref(null)
let chartInstance: any = null

// ─── Computed ─────────────────────────────────────────────────────────────────

const summaryStats = computed(() => {
  if (!report.value) return []
  const r = report.value.latest_report
  return [
    { label: 'Total Objects', value: r.num_objects?.toLocaleString() },
    { label: 'ROAs', value: r.num_roas?.toLocaleString() },
    { label: 'CAs', value: r.num_cas?.toLocaleString() },
    { label: 'Ghostbusters', value: report.value.ghostbusters_count?.toLocaleString() },
    { label: 'Repositories', value: report.value.num_repos?.toLocaleString() },
    { label: 'Max RP Exec Time (s)', value: r.max_rp_exec_time?.toString() },
    { label: 'Crawler Exec Time (s)', value: r.crawler_exec_time?.toString() },
    { label: 'Last Updated', value: r.time_stamp ? formatDate(r.time_stamp) : 'N/A' }
  ]
})

const vrpBreakdown = computed(() => {
  if (!report.value) return []
  const r = report.value.latest_report
  const consistent = r.num_total_vrps - (r.num_overlap_vrps + r.num_diff_vrps)
  return [
    { label: 'Total Unique VRPs', value: r.num_total_vrps?.toLocaleString() ?? 'N/A' },
    { label: 'VRPs not included by any RP', value: consistent >= 0 ? consistent.toLocaleString() : 'N/A' },
    { label: 'VRPs included by all RPs', value: r.num_overlap_vrps?.toLocaleString() ?? 'N/A' },
    { label: 'VRPs included by some RPs', value: r.num_diff_vrps?.toLocaleString() ?? 'N/A' }
  ]
})

const rpLogNames = computed(() => {
  if (!report.value?.rp_logs_initial) return []
  return Object.keys(report.value.rp_logs_initial)
})

// ─── Methods ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    })
  } catch {
    return dateStr
  }
}

function getDisplayedLogs(rpName: string): string[] {
  if (allLogsCache.value[rpName]) {
    return allLogsCache.value[rpName]
  }
  return report.value?.rp_logs_initial?.[rpName]?.slice(0, INITIAL_LOG_LIMIT) ?? []
}

function hasMoreLogs(rpName: string): boolean {
  if (allLogsCache.value[rpName]) return false
  const count = report.value?.rp_logs_counts?.[rpName] ?? 0
  return count > INITIAL_LOG_LIMIT
}

function getLogCount(rpName: string): number {
  return report.value?.rp_logs_counts?.[rpName] ?? 0
}

async function fetchAllLogs(rpName: string) {
  loadingAllLogs.value = rpName
  try {
    const response = await axios.get(`${BACKEND_URL}/get_all_rp_logs/${rpName}/`)
    if (response.data?.logs) {
      allLogsCache.value[rpName] = response.data.logs
    }
  } catch (e) {
    console.error('Failed to fetch all logs for', rpName, e)
  } finally {
    loadingAllLogs.value = null
  }
}

async function fetchReport() {
  loading.value = true
  error.value = null
  try {
    const response = await axios.get(`${BACKEND_URL}/get_latest_report/`)
    report.value = response.data
    // Set default active RP log tab
    if (rpLogNames.value.length && !activeRpLogTab.value) {
      activeRpLogTab.value = rpLogNames.value[0]
    }
    await nextTick()
    renderChart()
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load report data.'
    console.error('Failed to fetch report:', e)
  } finally {
    loading.value = false
  }
}

async function submitRegistration() {
  registrationErrors.value = {}
  const { repositoryUri, email } = registrationForm.value

  if (!repositoryUri.trim()) {
    registrationErrors.value.repositoryUri = 'Repository URI is required.'
  }
  if (!email.trim() || !email.includes('@')) {
    registrationErrors.value.email = 'A valid email is required.'
  }
  if (Object.keys(registrationErrors.value).length) return

  registering.value = true
  try {
    await axios.post(`${BACKEND_URL}/register/`, {
      repository_uri: repositoryUri,
      email
    })
    showRegistration.value = false
    registrationForm.value = { repositoryUri: '', email: '' }
  } catch (e: any) {
    if (e?.response?.data) {
      registrationErrors.value = e.response.data
    } else {
      registrationErrors.value.email = 'Registration failed. Please try again.'
    }
  } finally {
    registering.value = false
  }
}

function renderChart() {
  if (!reachabilityChartCanvas.value || !report.value) return

  // Dynamically import Chart.js since it's loaded via CDN in the main template
  // but for the Vue SPA we use the npm package
  const Chart = (window as any).Chart
  if (!Chart) {
    console.warn('Chart.js not available')
    return
  }

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const isDark = theme.global.current.value.dark
  const textColor = isDark ? '#ecf0f1' : '#333'
  const bgColor = isDark ? '#34495e' : '#ffffff'

  chartInstance = new Chart(reachabilityChartCanvas.value.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Reachable', 'Unreachable'],
      datasets: [{
        data: [
          report.value.reachable_repos_count ?? 0,
          report.value.unreachable_repos_count ?? 0
        ],
        backgroundColor: [
          isDark ? '#66BB6A' : '#4CAF50',
          isDark ? '#EF5350' : '#F44336'
        ],
        borderColor: bgColor,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { size: 12 }
          }
        }
      }
    }
  })
}

// Re-render chart when theme changes
watch(() => theme.global.current.value.dark, () => {
  renderChart()
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  document.title = 'RPKI Dashboard | Notify'
  fetchReport()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<style scoped>
.notify-dashboard {
  max-width: 1600px;
  margin: 0 auto;
}

.dashboard-tile {
  display: flex;
  flex-direction: column;
  max-height: 480px;
}

.dashboard-tile > .v-card-text.tile-scroll-content {
  flex: 1 1 auto;
  overflow-y: auto;
}

.log-entries {
  max-height: 340px;
  overflow-y: auto;
}

.log-entry {
  font-family: 'Roboto Mono', 'Courier New', monospace;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-all;
  padding: 3px 0;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
  line-height: 1.5;
}
</style>