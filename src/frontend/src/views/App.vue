<template>
  <div class="fuzzer-container">

    <div v-if="!isFuzzing" class="form-wrapper">
      <h1>RPKI Fuzzer Configuration</h1>
      <form @submit.prevent="startFuzzing">
        <div class="form-group">
          <label for="amount">Amount: <strong>{{ form.amount }}</strong></label>
          <input type="range" id="amount" v-model.number="form.amount" min="1" max="10000" class="slider" />
        </div>
        <hr>
        <div class="form-group">
          <label>Object Types</label>
          <div class="checkbox-group">
            <div v-for="type in availableTypes" :key="type" class="checkbox-item">
              <input type="checkbox" :id="`type-${type}`" :value="type" v-model="form.types">
              <label :for="`type-${type}`">{{ type.toUpperCase() }}</label>
            </div>
          </div>
        </div>
        <hr>
        <div class="form-group">
          <label>Relying Parties (RPs)</label>
          <div class="checkbox-group">
            <div v-for="rp in availableRps" :key="rp" class="checkbox-item">
              <input type="checkbox" :id="`rp-${rp}`" :value="rp" v-model="form.rps">
              <label :for="`rp-${rp}`">{{ rp }}</label>
            </div>
          </div>
        </div>
        <hr>
        <div class="form-grid">
          <div class="form-group">
            <label>Compute coverage?</label>
            <div class="radio-group">
              <div class="radio-item">
                <input type="radio" id="mode-yes" :value="1" v-model.number="form.coverage_mode">
                <label for="mode-yes">Yes</label>
              </div>
              <div class="radio-item">
                <input type="radio" id="mode-no" :value="0" v-model.number="form.coverage_mode">
                <label for="mode-no">No</label>
              </div>
            </div>
          </div>
          <div class="form-group" v-if="form.coverage_mode === 1">
            <label for="coverage-rp">Coverage RP</label>
            <select id="coverage-rp" v-model="form.coverage_rp" :disabled="form.rps.length === 0">
              <option disabled value="">Select an RP</option>
              <option v-for="rp in form.rps" :key="rp" :value="rp">
                {{ rp }}
              </option>
            </select>
            <small v-if="form.rps.length === 0">Please select at least one RP first.</small>
          </div>
        </div>
        <hr>
        <button type="submit" class="start-button" :disabled="!isFormValid">
          🚀 Start Fuzzing
        </button>
      </form>
    </div>

    <div v-else class="log-wrapper">
      <h2 class="fuzzing-title">Fuzzing in Progress...</h2>
      <div class="fuzzing-layout">
        <div class="fuzzing-column">
          <h3>📜 Logs</h3>
          <pre ref="logContainer" class="log-box">{{ logContent }}</pre>
        </div>
        <div class="fuzzing-column">
          <h3>🚨 Errors Found</h3>
          <pre ref="errorContainer" class="log-box">
            <span
              v-for="error, index in errors"
              :key="index"
            >
              {{ error }}
              <br/><br/>
            </span>
          </pre>
        </div>
      </div>
      <button @click="stopFuzzing" class="stop-button">⏹️ Stop Fuzzing</button>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onUnmounted, nextTick } from 'vue';

// --- STATE MANAGEMENT ---

const form = reactive({
  amount: 1000,
  types: ['roa'],
  rps: ['routinator', 'rpki-client', 'fort'],
  coverage_mode: 1,
  coverage_rp: 'routinator',
});

const availableTypes = ['roa', 'manifest', 'gbr', 'aspa'];
const availableRps = ['routinator', 'rpki-client', 'fort', 'octorpki'];

const isFuzzing = ref(false);
const logContent = ref('');
const errors = ref([]); // NEW: Reactive array to store error objects
const logContainer = ref(null);
let pollingInterval = null;

// --- COMPUTED PROPERTIES ---

const isFormValid = computed(() => {
  if (form.coverage_mode === 1) {
      return form.types.length > 0 && form.rps.length > 0 && form.coverage_rp !== '';
  }
  return form.types.length > 0 && form.rps.length > 0;
});

// --- WATCHERS ---

watch(() => form.rps, (newRps) => {
  if (form.coverage_mode === 1) {
      if (newRps.length > 0 && !newRps.includes(form.coverage_rp)) {
          form.coverage_rp = newRps[0];
      } else if (newRps.length === 0) {
          form.coverage_rp = '';
      }
  }
});

watch(logContent, async () => {
  await nextTick();
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

// --- METHODS ---

const startFuzzing = async () => {
  if (!isFormValid.value) return;

  isFuzzing.value = true;
  logContent.value = `[${new Date().toLocaleTimeString()}] Starting fuzzing process...\n`;
  logContent.value += `[${new Date().toLocaleTimeString()}] Configuration: ${JSON.stringify(form, null, 2)}\n\n`;
  errors.value = []; // Clear previous errors

  try {
    const response = await fetch('http://127.0.0.1:21999/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status: ${response.status}`);
    }

    await fetch('http://127.0.0.1:21234/fuzz', { method: 'GET' });

    logContent.value += `[${new Date().toLocaleTimeString()}] Fuzzing successfully initiated. Polling for data...\n`;

    // Start polling both logs and errors
    pollingInterval = setInterval(pollData, 2000);

  } catch (error) {
    console.error("Failed to start fuzzing:", error);
    logContent.value += `[${new Date().toLocaleTimeString()}] ERROR: Could not start fuzzing process. ${error.message}\n`;
    isFuzzing.value = false;
  }
};

// NEW: Combined polling function
const pollData = () => {
  fetchLogs();
  fetchErrors();
};

const fetchLogs = async () => {
  try {
    const response = await fetch('http://127.0.0.1:21234/get_log');
    if (response.ok) {
      const newLogText = await response.text();
      if (newLogText) {
        logContent.value += newLogText;
      }
    } else {
      logContent.value += `[${new Date().toLocaleTimeString()}] Warning: Could not fetch logs (status: ${response.status}).\n`;
    }
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    logContent.value += `[${new Date().toLocaleTimeString()}] ERROR: Lost connection to log stream. Stopping polling.\n`;
    stopFuzzing();
  }
};

// NEW: Function to fetch errors
const fetchErrors = async () => {
  try {
    const response = await fetch('http://127.0.0.1:21234/get_errors');
    if (response.ok) {
      const newErrors = await response.json();
      if (newErrors && newErrors.length > 0) {
        // Append new errors to the existing array
        errors.value.push(...newErrors);
      }
    } else {
      logContent.value += `[${new Date().toLocaleTimeString()}] Warning: Could not fetch errors (status: ${response.status}).\n`;
    }
  } catch (error) {
      console.error("Failed to fetch errors:", error);
      logContent.value += `[${new Date().toLocaleTimeString()}] ERROR: Problem fetching errors. ${error.message}\n`;
  }
};

const stopFuzzing = async () => {
  await fetch("http://127.0.0.1:21234/stop")
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  logContent.value += `\n[${new Date().toLocaleTimeString()}] Fuzzing stopped by user.`;
  
  setTimeout(() => { 
      isFuzzing.value = false; 
      // Optionally clear content on return to form
      // logContent.value = '';
      // errors.value = [];
  }, 3000);
};

// --- LIFECYCLE HOOKS ---

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});

</script>

<style scoped>
/* --- Existing Styles (with minor adjustments) --- */
.fuzzer-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #333;
}

.form-wrapper, .log-wrapper {
  width: 100%;
  max-width: 1200px; /* Increased max-width for the new layout */
  background-color: #ffffff;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

h1, h2.fuzzing-title {
  text-align: center;
  margin-bottom: 2rem;
  color: #1a1a1a;
}

hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 1.5rem 0;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #555;
}

.slider {
  width: 100%;
}

.checkbox-group, .radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.checkbox-item, .radio-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item input[type="checkbox"], .radio-item input[type="radio"] {
  width: 1.2em;
  height: 1.2em;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

select {
  width: 100%;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  background-color: #f9f9f9;
  font-size: 1rem;
}

select:disabled {
  background-color: #ebebeb;
  cursor: not-allowed;
}

small {
  display: block;
  margin-top: 0.5rem;
  color: #888;
}

.start-button {
  display: block;
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: white;
  background-color: #007bff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out, transform 0.1s ease;
}

.start-button:hover:not(:disabled) {
  background-color: #0056b3;
  transform: translateY(-2px);
}

.start-button:disabled {
  background-color: #a0c7ef;
  cursor: not-allowed;
}

.stop-button {
  display: block;
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: white;
  background-color: #dc3545;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
  margin-top: 1.5rem; /* Spacing above the stop button */
}

.stop-button:hover {
  background-color: #c82333;
}

/* --- NEW & UPDATED STYLES for the fuzzing view --- */

.fuzzing-layout {
  display: flex;
  gap: 2rem; /* Space between the log and error columns */
}

.fuzzing-column {
  flex: 1; /* Each column takes up half the space */
  display: flex;
  flex-direction: column;
  min-width: 0; /* Prevents flexbox overflow issues */
}

.fuzzing-column h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
}

.log-box {
  background-color: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 8px;
  height: 500px;
  overflow-y: scroll;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: "Courier New", Courier, monospace;
  font-size: 0.9rem;
  flex-grow: 1; /* Allows the box to fill the column height */
}

.table-wrapper {
  height: 500px; /* Match the height of the log box */
  overflow-y: auto; /* Make this container scrollable */
  border: 1px solid #ddd;
  border-radius: 8px;
  flex-grow: 1; /* Allows the wrapper to fill the column height */
}

.no-errors {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #888;
  font-style: italic;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
  word-break: break-word; /* Break long error descriptions */
}

thead th {
  background-color: #f9f9f9;
  position: sticky; /* Keep headers visible on scroll */
  top: 0;
  font-weight: 600;
}

tbody tr:nth-child(even) {
  background-color: #fcfcfc;
}
</style>