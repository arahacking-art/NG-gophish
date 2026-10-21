// NG-gophish - pagina Account Settings (Vanilla JS + Bootstrap 5).
import { api, errorFlash, successFlash, successFlashFade } from '../api.js'
import { initPasswordStrength } from './passwords.js'

// Formatea una fecha ISO como tiempo relativo ("hace 5 minutos") sin moment.js.
function fromNow(iso) {
  const then = new Date(iso).getTime()
  if (!iso || isNaN(then)) return ''
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const diffSec = Math.round((then - Date.now()) / 1000)
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ]
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs || unit === 'second') {
      return rtf.format(Math.round(diffSec / secs), unit)
    }
  }
  return ''
}

function scrollTop() {
  document.body.scrollTop = 0
  document.documentElement.scrollTop = 0
}

// POST application/x-www-form-urlencoded (el endpoint /settings espera un form).
async function postForm(url, form) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(form)),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || res.statusText)
  }
  return data
}

function collectIMAP() {
  return {
    host: document.getElementById('imaphost').value,
    port: document.getElementById('imapport').value,
    username: document.getElementById('imapusername').value,
    password: document.getElementById('imappassword').value,
    enabled: document.getElementById('use_imap').checked,
    tls: document.getElementById('use_tls').checked,
    folder: document.getElementById('folder').value,
    imap_freq: document.getElementById('imapfreq').value,
    restrict_domain: document.getElementById('restrictdomain').value,
    ignore_cert_errors: document.getElementById('ignorecerterrors').checked,
    delete_reported_campaign_email: document.getElementById('deletecampaign').checked,
  }
}

function validateIMAPInput(s) {
  if (s.host === '') return 'No IMAP Host specified'
  if (s.port === '') return 'No IMAP Port specified'
  if (isNaN(s.port) || s.port < 1 || s.port > 65535) return 'Invalid IMAP Port'
  return null
}

async function loadIMAPSettings() {
  const lastLoginDiv = document.getElementById('lastlogindiv')
  try {
    let imap = await api.IMAP.get()
    if (!imap || imap.length === 0) {
      lastLoginDiv.classList.add('d-none')
      return
    }
    imap = imap[0]
    lastLoginDiv.classList.toggle('d-none', !imap.enabled)
    document.getElementById('imapusername').value = imap.username || ''
    document.getElementById('imaphost').value = imap.host || ''
    document.getElementById('imapport').value = imap.port || ''
    document.getElementById('imappassword').value = imap.password || ''
    document.getElementById('use_tls').checked = imap.tls
    document.getElementById('ignorecerterrors').checked = imap.ignore_cert_errors
    document.getElementById('use_imap').checked = imap.enabled
    document.getElementById('folder').value = imap.folder || ''
    document.getElementById('restrictdomain').value = imap.restrict_domain || ''
    document.getElementById('deletecampaign').checked = imap.delete_reported_campaign_email
    document.getElementById('lastloginraw').value = imap.last_login || ''
    document.getElementById('lastlogin').value = fromNow(imap.last_login)
    document.getElementById('imapfreq').value = imap.imap_freq || ''
  } catch {
    errorFlash('Error fetching IMAP settings')
  }
}

function initApiReset() {
  const form = document.getElementById('apiResetForm')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      const response = await api.reset()
      window.user.api_key = response.data
      document.getElementById('api_key').value = response.data
      successFlash(response.message)
    } catch (err) {
      errorFlash(err.message)
    }
  })
}

function initSettingsForm() {
  const form = document.getElementById('settingsForm')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      const data = await postForm('/settings', form)
      successFlash(data.message)
    } catch (err) {
      errorFlash(err.message)
    }
  })
}

function initIMAPSave() {
  document.getElementById('savesettings').addEventListener('click', async () => {
    const imapSettings = collectIMAP()
    const invalid = validateIMAPInput(imapSettings)
    if (invalid) {
      errorFlash(invalid)
      scrollTop()
      return
    }
    if (imapSettings.imap_freq === '') imapSettings.imap_freq = '60'
    try {
      const data = await api.IMAP.post(imapSettings)
      if (data && data.success) {
        successFlashFade('Successfully updated IMAP settings.', 2)
      } else {
        errorFlash('Unable to update IMAP settings.')
      }
      await loadIMAPSettings()
    } catch (err) {
      errorFlash(err.message)
    } finally {
      scrollTop()
    }
  })
}

const IMAP_INPUTS = [
  'imaphost', 'imapport', 'imapusername', 'imappassword', 'use_imap', 'use_tls',
  'ignorecerterrors', 'folder', 'restrictdomain', 'deletecampaign', 'lastlogin',
  'imapfreq', 'validateimap',
]

function initIMAPValidate() {
  const btn = document.getElementById('validateimap')
  btn.addEventListener('click', async () => {
    const server = {
      host: document.getElementById('imaphost').value,
      port: document.getElementById('imapport').value,
      username: document.getElementById('imapusername').value,
      password: document.getElementById('imappassword').value,
      tls: document.getElementById('use_tls').checked,
      ignore_cert_errors: document.getElementById('ignorecerterrors').checked,
    }
    const invalid = validateIMAPInput(server)
    if (invalid) {
      errorFlash(invalid)
      scrollTop()
      return
    }
    const oldHTML = btn.innerHTML
    IMAP_INPUTS.forEach((id) => { document.getElementById(id).disabled = true })
    btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Testing...'
    try {
      const data = await api.IMAP.validate(server)
      if (data && data.success) {
        successFlash('Successfully logged into ' + server.host)
      } else {
        errorFlash('Unable to login to ' + server.host + (data && data.message ? ': ' + data.message : ''))
      }
    } catch (err) {
      errorFlash('An unexpected error occurred. ' + (err.message || ''))
    } finally {
      IMAP_INPUTS.forEach((id) => { document.getElementById(id).disabled = false })
      btn.innerHTML = oldHTML
      scrollTop()
    }
  })
}

function initUIAndTabs() {
  document.getElementById('reporttab').addEventListener('click', loadIMAPSettings)
  document.getElementById('advanced').addEventListener('click', () => {
    document.getElementById('advancedarea').classList.toggle('d-none')
  })

  const useMap = document.getElementById('use_map')
  const stored = localStorage.getItem('gophish.use_map')
  useMap.checked = stored ? JSON.parse(stored) : false
  useMap.addEventListener('change', function () {
    localStorage.setItem('gophish.use_map', JSON.stringify(this.checked))
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initPasswordStrength()
  initApiReset()
  initSettingsForm()
  initIMAPSave()
  initIMAPValidate()
  initUIAndTabs()
  loadIMAPSettings()
})
