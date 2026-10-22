// NG-gophish - pagina Sending Profiles (Vanilla JS + Bootstrap 5 + Grid.js).
import { api, errorFlash, successFlash, modalError, escapeHtml } from '../api.js'
import { confirmDialog } from '../ui.js'
import { Grid, html } from 'gridjs'
import { Modal, Tooltip } from 'bootstrap'

let profiles = []
let headers = []
let editId = -1
let grid = null
let profileModal = null
let testModal = null

function el(id) {
  return document.getElementById(id)
}

function fmtDate(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

// --- Cabeceras personalizadas (lista en memoria) ---------------------------
function renderHeaders() {
  const body = el('headersBody')
  body.innerHTML = ''
  headers.forEach((h, i) => {
    const tr = document.createElement('tr')
    const k = document.createElement('td'); k.textContent = h.key
    const v = document.createElement('td'); v.textContent = h.value
    const a = document.createElement('td'); a.className = 'text-end'
    a.innerHTML = `<button type="button" class="btn btn-sm btn-outline-danger" data-remove="${i}"><i class="bi bi-trash"></i></button>`
    tr.append(k, v, a)
    body.appendChild(tr)
  })
  el('headersTable').classList.toggle('d-none', headers.length === 0)
}

function addHeader(key, value) {
  if (!key || !value) return
  const existing = headers.find((h) => h.key === key)
  if (existing) existing.value = value
  else headers.push({ key, value })
  renderHeaders()
}

// --- Tabla de perfiles -----------------------------------------------------
function rowActions(id) {
  return html(
    `<div class="text-end">` +
    `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${id}" title="Edit"><i class="bi bi-pencil"></i></button>` +
    `<button class="btn btn-sm btn-outline-secondary me-1" data-action="copy" data-id="${id}" title="Copy"><i class="bi bi-files"></i></button>` +
    `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${id}" title="Delete"><i class="bi bi-trash"></i></button>` +
    `</div>`
  )
}

function renderGrid() {
  const data = profiles.map((p) => [p.name, p.interface_type, fmtDate(p.modified_date), p.id])
  const config = {
    columns: [
      { name: 'Name' },
      { name: 'Interface Type' },
      { name: 'Last Modified' },
      { name: '', sort: false, formatter: (cell) => rowActions(cell) },
    ],
    data,
    search: true,
    sort: true,
    pagination: { limit: 10 },
    className: { table: 'table table-hover' },
    language: { search: { placeholder: 'Search profiles...' } },
  }
  if (grid) grid.updateConfig(config).forceRender()
  else grid = new Grid(config).render(el('profileTable'))
}

async function load() {
  try {
    profiles = await api.SMTP.get()
    el('loading').classList.add('d-none')
    if (profiles.length === 0) {
      el('emptyMessage').classList.remove('d-none')
      el('profileCard').classList.add('d-none')
      return
    }
    el('emptyMessage').classList.add('d-none')
    el('profileCard').classList.remove('d-none')
    renderGrid()
  } catch (e) {
    el('loading').classList.add('d-none')
    errorFlash('Error fetching profiles')
  }
}

// --- Modal de perfil -------------------------------------------------------
function fillForm(p) {
  el('name').value = p.name || ''
  el('interface_type').value = p.interface_type || 'SMTP'
  el('from').value = p.from_address || ''
  el('host').value = p.host || ''
  el('username').value = p.username || ''
  el('password').value = p.password || ''
  el('ignore_cert_errors').checked = p.ignore_cert_errors !== false
  headers = Array.isArray(p.headers) ? p.headers.map((h) => ({ key: h.key, value: h.value })) : []
  renderHeaders()
}

function resetForm() {
  fillForm({ interface_type: 'SMTP', ignore_cert_errors: true, headers: [] })
  const mf = el('modal.flashes')
  if (mf) mf.innerHTML = ''
}

function openEdit(id) {
  resetForm()
  editId = id
  const p = profiles.find((x) => x.id == id)
  if (p) {
    el('profileModalLabel').textContent = 'Edit Sending Profile'
    fillForm(p)
  } else {
    el('profileModalLabel').textContent = 'New Sending Profile'
  }
  profileModal.show()
}

function openCopy(id) {
  resetForm()
  editId = -1
  const p = profiles.find((x) => x.id == id)
  if (p) {
    fillForm(p)
    el('name').value = 'Copy of ' + p.name
  }
  el('profileModalLabel').textContent = 'New Sending Profile'
  profileModal.show()
}

function collectProfile() {
  return {
    name: el('name').value,
    interface_type: el('interface_type').value,
    from_address: el('from').value,
    host: el('host').value,
    username: el('username').value,
    password: el('password').value,
    ignore_cert_errors: el('ignore_cert_errors').checked,
    headers: headers.map((h) => ({ key: h.key, value: h.value })),
  }
}

async function saveProfile() {
  const profile = collectProfile()
  try {
    if (editId != -1) {
      profile.id = parseInt(editId, 10)
      await api.SMTPId.put(profile)
      successFlash('Profile edited successfully!')
    } else {
      await api.SMTP.post(profile)
      successFlash('Profile added successfully!')
    }
    profileModal.hide()
    await load()
  } catch (e) {
    modalError(e.message)
  }
}

async function deleteProfile(id) {
  const p = profiles.find((x) => x.id == id)
  if (!p) return
  const ok = await confirmDialog({
    title: 'Delete sending profile',
    body: `This will delete the sending profile "${p.name}". This can't be undone!`,
    confirmText: 'Delete',
  })
  if (!ok) return
  try {
    await api.SMTPId.delete(id)
    await load()
    successFlash('Sending profile deleted!')
  } catch (e) {
    errorFlash(e.message)
  }
}

// --- Test email ------------------------------------------------------------
async function sendTestEmail() {
  const req = {
    template: {},
    first_name: el('to_first_name').value,
    last_name: el('to_last_name').value,
    email: el('to_email').value,
    position: el('to_position').value,
    url: '',
    smtp: {
      from_address: el('from').value,
      host: el('host').value,
      username: el('username').value,
      password: el('password').value,
      ignore_cert_errors: el('ignore_cert_errors').checked,
      headers: headers.map((h) => ({ key: h.key, value: h.value })),
    },
  }
  const btn = el('sendTestModalSubmit')
  const old = btn.innerHTML
  btn.disabled = true
  btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Sending'
  const flashes = el('sendTestEmailModal.flashes')
  try {
    await api.send_test_email(req)
    if (flashes) flashes.innerHTML = '<div class="alert alert-success text-center"><i class="bi bi-check-circle me-1"></i> Email Sent!</div>'
  } catch (e) {
    if (flashes) flashes.innerHTML = `<div class="alert alert-danger text-center"><i class="bi bi-exclamation-circle me-1"></i> ${escapeHtml(e.message)}</div>`
  } finally {
    btn.disabled = false
    btn.innerHTML = old
  }
}

function init() {
  profileModal = new Modal(el('profileModal'))
  testModal = new Modal(el('sendTestEmailModal'))

  el('profileModal').addEventListener('hidden.bs.modal', resetForm)
  el('sendTestEmailModal').addEventListener('hidden.bs.modal', () => {
    const f = el('sendTestEmailModal.flashes'); if (f) f.innerHTML = ''
  })

  el('new_button').addEventListener('click', () => openEdit(-1))
  el('modalSubmit').addEventListener('click', saveProfile)
  el('openTestEmail').addEventListener('click', () => testModal.show())
  el('sendTestModalSubmit').addEventListener('click', sendTestEmail)

  el('addCustomHeader').addEventListener('click', () => {
    addHeader(el('headerKey').value.trim(), el('headerValue').value.trim())
    el('headerKey').value = ''
    el('headerValue').value = ''
    el('headerKey').focus()
  })
  el('headersBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]')
    if (!btn) return
    headers.splice(parseInt(btn.dataset.remove, 10), 1)
    renderHeaders()
  })

  el('profileTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    if (btn.dataset.action === 'edit') openEdit(id)
    else if (btn.dataset.action === 'copy') openCopy(id)
    else if (btn.dataset.action === 'delete') deleteProfile(id)
  })

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((t) => new Tooltip(t))
  load()
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
