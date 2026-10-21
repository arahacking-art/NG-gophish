// NG-gophish - pagina Webhooks (Vanilla JS + Bootstrap 5 + Grid.js).
import { api, errorFlash, successFlash, modalError, escapeHtml } from '../api.js'
import { Grid, html } from 'gridjs'
import 'gridjs/dist/theme/mermaid.css'
import { Modal, Tooltip } from 'bootstrap'

let webhooks = []
let grid = null
let modal = null

function el(id) {
  return document.getElementById(id)
}

function resetForm() {
  el('name').value = ''
  el('url').value = ''
  el('secret').value = ''
  el('is_active').checked = false
  const mf = el('modal.flashes')
  if (mf) mf.innerHTML = ''
}

function rowActions(id) {
  return html(
    `<div class="text-end">` +
    `<button class="btn btn-sm btn-outline-secondary me-1" data-action="ping" data-id="${id}" title="Ping"><i class="bi bi-reception-4"></i></button>` +
    `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${id}" title="Edit"><i class="bi bi-pencil"></i></button>` +
    `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${id}" title="Delete"><i class="bi bi-trash"></i></button>` +
    `</div>`
  )
}

function renderGrid() {
  // Grid.js escapa automaticamente las celdas de texto (name/url).
  const data = webhooks.map((w) => [w.name, w.url, w.is_active ? 'Yes' : 'No', w.id])
  const config = {
    columns: [
      { name: 'Name' },
      { name: 'URL' },
      { name: 'Active' },
      { name: '', sort: false, formatter: (cell) => rowActions(cell) },
    ],
    data,
    search: true,
    sort: true,
    pagination: { limit: 10 },
    className: { table: 'table table-hover' },
    language: { search: { placeholder: 'Search webhooks...' } },
  }
  if (grid) {
    grid.updateConfig(config).forceRender()
  } else {
    grid = new Grid(config).render(el('webhookTable'))
  }
}

async function load() {
  try {
    webhooks = await api.webhooks.get()
    renderGrid()
  } catch (e) {
    errorFlash('Error fetching webhooks')
  }
}

async function saveWebhook(id) {
  const wh = {
    name: el('name').value,
    url: el('url').value,
    secret: el('secret').value,
    is_active: el('is_active').checked,
  }
  try {
    if (id != -1) {
      wh.id = parseInt(id, 10)
      await api.webhookId.put(wh)
      modal.hide()
      resetForm()
      await load()
      successFlash(`Webhook "${escapeHtml(wh.name)}" has been updated successfully!`)
    } else {
      await api.webhooks.post(wh)
      modal.hide()
      resetForm()
      await load()
      successFlash(`Webhook "${escapeHtml(wh.name)}" has been created successfully!`)
    }
  } catch (e) {
    modalError(e.message)
  }
}

async function editWebhook(id) {
  resetForm()
  el('modalSubmit').onclick = () => saveWebhook(id)
  if (id != -1) {
    el('webhookModalLabel').textContent = 'Edit Webhook'
    try {
      const wh = await api.webhookId.get(id)
      el('name').value = wh.name
      el('url').value = wh.url
      el('secret').value = wh.secret
      el('is_active').checked = wh.is_active
    } catch (e) {
      errorFlash('Error fetching webhook')
    }
  } else {
    el('webhookModalLabel').textContent = 'New Webhook'
  }
  modal.show()
}

async function deleteWebhook(id) {
  const wh = webhooks.find((x) => x.id == id)
  if (!wh) return
  if (!window.confirm(`This will delete the webhook "${wh.name}". Are you sure?`)) return
  try {
    await api.webhookId.delete(id)
    await load()
    successFlash('The webhook has been deleted!')
  } catch (e) {
    errorFlash(e.message)
  }
}

async function pingWebhook(id, btn) {
  if (btn) btn.disabled = true
  try {
    const wh = await api.webhookId.ping(id)
    successFlash(`Ping of "${escapeHtml(wh.name)}" webhook succeeded.`)
  } catch (e) {
    const wh = webhooks.find((x) => x.id == id)
    errorFlash(`Ping of "${escapeHtml(wh ? wh.name : '')}" webhook failed: "${escapeHtml(e.message)}"`)
  } finally {
    if (btn) btn.disabled = false
  }
}

function init() {
  const modalEl = el('webhookModal')
  modal = new Modal(modalEl)
  modalEl.addEventListener('hidden.bs.modal', resetForm)

  el('new_button').addEventListener('click', () => editWebhook(-1))

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((t) => new Tooltip(t))

  // Delegacion de eventos: Grid.js re-renderiza la tabla al ordenar/buscar.
  el('webhookTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    switch (btn.dataset.action) {
      case 'edit':
        editWebhook(id)
        break
      case 'delete':
        deleteWebhook(id)
        break
      case 'ping':
        pingWebhook(id, btn)
        break
    }
  })

  load()
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
