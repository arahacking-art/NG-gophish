// NG-gophish - pagina Landing Pages (Vanilla JS + Bootstrap 5 + CodeMirror + Grid.js).
import { api, errorFlash, successFlash, modalError, escapeHtml } from '../api.js'
import { confirmDialog } from '../ui.js'
import { createHtmlEditor, renderPreview } from '../editor.js'
import { Grid, html } from 'gridjs'
import { Modal, Tooltip } from 'bootstrap'

let pages = []
let grid = null
let modal = null
let editor = null

function el(id) {
  return document.getElementById(id)
}

function formatDate(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function toggleCapture() {
  const on = el('capture_credentials_checkbox').checked
  el('capture_passwords').classList.toggle('d-none', !on)
  el('redirect_url').classList.toggle('d-none', !on)
}

function showSource() {
  el('htmlEditor').classList.remove('d-none')
  el('htmlPreview').classList.add('d-none')
  el('editorTabBtn').classList.add('active')
  el('previewTabBtn').classList.remove('active')
}

function showPreview() {
  if (editor) renderPreview(el('htmlPreview'), editor.getValue())
  el('htmlEditor').classList.add('d-none')
  el('htmlPreview').classList.remove('d-none')
  el('previewTabBtn').classList.add('active')
  el('editorTabBtn').classList.remove('active')
}

function resetForm() {
  el('name').value = ''
  el('url').value = ''
  el('redirect_url_input').value = ''
  el('capture_credentials_checkbox').checked = false
  el('capture_passwords_checkbox').checked = false
  toggleCapture()
  showSource()
  const mf = el('modal.flashes')
  if (mf) mf.innerHTML = ''
}

function ensureEditor(doc = '') {
  if (editor) editor.destroy()
  el('htmlEditor').innerHTML = ''
  editor = createHtmlEditor({ parent: el('htmlEditor'), doc })
}

function openModal(id) {
  resetForm()
  el('modalSubmit').onclick = () => save(id)
  if (id != -1) {
    const page = pages.find((p) => p.id == id)
    el('pageModalLabel').textContent = 'Edit Landing Page'
    el('name').value = page.name
    el('capture_credentials_checkbox').checked = page.capture_credentials
    el('capture_passwords_checkbox').checked = page.capture_passwords
    el('redirect_url_input').value = page.redirect_url || ''
    toggleCapture()
    ensureEditor(page.html || '')
  } else {
    el('pageModalLabel').textContent = 'New Landing Page'
    ensureEditor('')
  }
  modal.show()
}

function openCopy(id) {
  const page = pages.find((p) => p.id == id)
  if (!page) return
  resetForm()
  el('modalSubmit').onclick = () => save(-1)
  el('pageModalLabel').textContent = 'New Landing Page'
  el('name').value = 'Copy of ' + page.name
  el('capture_credentials_checkbox').checked = page.capture_credentials
  el('capture_passwords_checkbox').checked = page.capture_passwords
  el('redirect_url_input').value = page.redirect_url || ''
  toggleCapture()
  ensureEditor(page.html || '')
  modal.show()
}

async function save(id) {
  const page = {
    name: el('name').value,
    html: editor ? editor.getValue() : '',
    capture_credentials: el('capture_credentials_checkbox').checked,
    capture_passwords: el('capture_passwords_checkbox').checked,
    redirect_url: el('redirect_url_input').value,
  }
  try {
    if (id != -1) {
      page.id = parseInt(id, 10)
      await api.pageId.put(page)
      successFlash('Page edited successfully!')
    } else {
      await api.pages.post(page)
      successFlash('Page added successfully!')
    }
    modal.hide()
    await load()
  } catch (e) {
    modalError(e.message)
  }
}

async function importSite() {
  const url = el('url').value
  if (!url) {
    modalError('No URL specified!')
    return
  }
  try {
    const data = await api.clone_site({ url, include_resources: false })
    ensureEditor(data.html || '')
    showSource()
  } catch (e) {
    modalError(e.message)
  }
}

async function deletePage(id) {
  const page = pages.find((p) => p.id == id)
  if (!page) return
  const ok = await confirmDialog({
    title: 'Delete landing page',
    body: `This will delete the landing page "${page.name}". This can't be undone!`,
    confirmText: 'Delete',
  })
  if (!ok) return
  try {
    await api.pageId.delete(id)
    await load()
    successFlash('Landing page deleted!')
  } catch (e) {
    errorFlash(e.message)
  }
}

function renderGrid() {
  const data = pages.map((p) => [p.name, formatDate(p.modified_date), p.id])
  const config = {
    columns: [
      { name: 'Name' },
      { name: 'Last Modified' },
      {
        name: '', sort: false,
        formatter: (id) => html(
          `<div class="text-end">` +
          `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${id}" title="Edit"><i class="bi bi-pencil"></i></button>` +
          `<button class="btn btn-sm btn-outline-secondary me-1" data-action="copy" data-id="${id}" title="Copy"><i class="bi bi-files"></i></button>` +
          `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${id}" title="Delete"><i class="bi bi-trash"></i></button>` +
          `</div>`
        ),
      },
    ],
    data,
    search: true,
    sort: true,
    pagination: { limit: 10 },
    className: { table: 'table table-hover' },
    language: { search: { placeholder: 'Search pages...' } },
  }
  if (grid) {
    grid.updateConfig(config).forceRender()
  } else {
    grid = new Grid(config).render(el('pagesTable'))
  }
}

async function load() {
  el('loading').classList.remove('d-none')
  el('pagesCard').classList.add('d-none')
  el('emptyMessage').classList.add('d-none')
  try {
    pages = await api.pages.get()
    el('loading').classList.add('d-none')
    if (pages.length > 0) {
      el('pagesCard').classList.remove('d-none')
      renderGrid()
    } else {
      el('emptyMessage').classList.remove('d-none')
    }
  } catch (e) {
    el('loading').classList.add('d-none')
    errorFlash('Error fetching pages')
  }
}

function init() {
  const modalEl = el('pageModal')
  modal = new Modal(modalEl)
  modalEl.addEventListener('hidden.bs.modal', () => {
    if (editor) { editor.destroy(); editor = null }
    resetForm()
  })

  el('new_button').addEventListener('click', () => openModal(-1))
  el('importSiteBtn').addEventListener('click', importSite)
  el('capture_credentials_checkbox').addEventListener('change', toggleCapture)
  el('editorTabBtn').addEventListener('click', showSource)
  el('previewTabBtn').addEventListener('click', showPreview)

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((t) => new Tooltip(t))

  el('pagesTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    switch (btn.dataset.action) {
      case 'edit': openModal(id); break
      case 'copy': openCopy(id); break
      case 'delete': deletePage(id); break
    }
  })

  load()
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
