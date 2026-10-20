import { createApp } from 'vue'
import config from 'devextreme/core/config'
import 'devextreme/dist/css/dx.light.css'
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import './assets/styles.css'
import App from './App.vue'

// Chiave DevExtreme in .env.local (non versionato)
const licenseKey = import.meta.env.VITE_DEVEXTREME_LICENSE_KEY
if (licenseKey) config({ licenseKey })

createApp(App).mount('#app')
