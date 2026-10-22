// NG-gophish - pagina Email Templates (Vanilla JS + Bootstrap 5 + CodeMirror).
import { api, errorFlash, successFlash, modalError, escapeHtml } from '../api.js'
import { confirmDialog } from '../ui.js'
import { createHtmlEditor, renderPreview } from '../editor.js'
import { Grid, html } from 'gridjs'
import { Modal } from 'bootstrap'

let templates = []
let grid = null
let modal = null
let importModal = null
let editor = null
let attachments = []

function el(id) {
  return document.getElementById(id)
}

function formatDate(iso) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function renderAttachments() {
  const body = el('attachmentsBody')
  body.innerHTML = ''
  attachments.forEach((f, i) => {
    const tr = document.createElement('tr')
    tr.innerHTML =
      `<td><i class="bi bi-paperclip"></i></td>` +
      `<td>${escapeHtml(f.name)}</td>` +
      `<td class="text-end"><button class="btn btn-sm btn-outline-danger" data-remove="${i}"><i class="bi bi-trash"></i></button></td>`
    body.appendChild(tr)
  })
}

function renderGrid() {
  const data = templates.map((t) => [t.name, formatDate(t.modified_date), t.id])
  const config = {
    columns: [
      { name: 'Name' },
      { name: 'Modified Date' },
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
    data, search: true, sort: true, pagination: { limit: 10 },
    className: { table: 'table table-hover' },
    language: { search: { placeholder: 'Search templates...' } },
  }
  if (grid) grid.updateConfig(config).forceRender()
  else grid = new Grid(config).render(el('templateTable'))
}

async function load() {
  el('templateCard').classList.add('d-none')
  el('emptyMessage').classList.add('d-none')
  el('loading').classList.remove('d-none')
  try {
    templates = await api.templates.get()
    el('loading').classList.add('d-none')
    if (templates.length > 0) {
      el('templateCard').classList.remove('d-none')
      renderGrid()
    } else {
      el('emptyMessage').classList.remove('d-none')
    }
  } catch (e) {
    el('loading').classList.add('d-none')
    errorFlash('Error fetching templates')
  }
}

function resetForm() {
  el('name').value = ''
  el('subject').value = ''
  el('envelope-sender').value = ''
  el('text_editor').value = ''
  if (editor) editor.setValue('')
  el('use_tracker_checkbox').checked = true
  attachments = []
  renderAttachments()
  const mf = el('modal.flashes')
  if (mf) mf.innerHTML = ''
}

function fillForm(t) {
  el('name').value = t.name || ''
  el('subject').value = t.subject || ''
  el('envelope-sender').value = t.envelope_sender || ''
  el('text_editor').value = t.text || ''
  if (editor) editor.setValue(t.html || '')
  el('use_tracker_checkbox').checked = (t.html || '').indexOf('{{.Tracker}}') !== -1
  attachments = (t.attachments || []).map((a) => ({ name: a.name, content: a.content, type: a.type }))
  renderAttachments()
}

// saveId: id del template a editar, o -1 para crear.
let saveId = -1

function openModal(mode, idx) {
  resetForm()
  if (mode === 'new') {
    el('templateModalLabel').textContent = 'New Template'
    saveId = -1
  } else {
    const t = templates.find((x) => x.id == idx)
    if (!t) return
    fillForm(t)
    if (mode === 'copy') {
      el('name').value = 'Copy of ' + (t.name || '')
      el('templateModalLabel').textContent = 'Copy Template'
      saveId = -1
    } else {
      el('templateModalLabel').textContent = 'Edit Template'
      saveId = t.id
    }
  }
  modal.show()
}

async function save() {
  let htmlBody = editor ? editor.getValue() : ''
  htmlBody = htmlBody.replace(/https?:\/\/{{\.URL}}/gi, '{{.URL}}')
  if (el('use_tracker_checkbox').checked) {
    if (htmlBody.indexOf('{{.Tracker}}') === -1 && htmlBody.indexOf('{{.TrackingUrl}}') === -1) {
      htmlBody = htmlBody.replace('</body>', '{{.Tracker}}</body>')
    }
  } else {
    htmlBody = htmlBody.replace('{{.Tracker}}</body>', '</body>')
  }
  const template = {
    name: el('name').value,
    subject: el('subject').value,
    envelope_sender: el('envelope-sender').value,
    text: el('text_editor').value,
    html: htmlBody,
    attachments: attachments.map((a) => ({ name: a.name, content: a.content, type: a.type })),
  }
  try {
    if (saveId != -1) {
      template.id = saveId
      await api.templateId.put(template)
      successFlash('Template edited successfully!')
    } else {
      await api.templates.post(template)
      successFlash('Template added successfully!')
    }
    modal.hide()
    load()
  } catch (e) {
    modalError(e.message)
  }
}

async function deleteTemplate(id) {
  const t = templates.find((x) => x.id == id)
  if (!t) return
  if (!(await confirmDialog({ title: 'Delete template', body: `This will delete the template "${t.name}". This can't be undone!`, confirmText: 'Delete' }))) return
  try {
    const data = await api.templateId.delete(id)
    successFlash(data.message)
    load()
  } catch (e) {
    errorFlash(e.message)
  }
}

function attachFiles(files) {
  Array.from(files).forEach((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      attachments.push({
        name: file.name,
        content: e.target.result.split(',')[1],
        type: file.type || 'application/octet-stream',
      })
      renderAttachments()
    }
    reader.readAsDataURL(file)
  })
}

async function importEmail() {
  const raw = el('email_content').value
  if (!raw) {
    modalError('No content specified!')
    return
  }
  try {
    const data = await api.import_email({ content: raw, convert_links: el('convert_links_checkbox').checked })
    el('text_editor').value = data.text || ''
    if (editor) editor.setValue(data.html || '')
    el('subject').value = data.subject || ''
    importModal.hide()
    if (data.html) {
      // Abre la pestana HTML para ver el resultado.
      el('html-tab').click()
    }
  } catch (e) {
    const imf = el('import.flashes')
    if (imf) imf.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`
  }
}

function init() {
  modal = new Modal(el('templateModal'))
  importModal = new Modal(el('importEmailModal'))

  // Editor persistente (se crea una vez; se mide al mostrar su pestana).
  editor = createHtmlEditor({ parent: el('htmlEditor'), doc: '' })

  el('html-tab').addEventListener('shown.bs.tab', () => editor.view.requestMeasure())
  el('preview-tab').addEventListener('shown.bs.tab', () => renderPreview(el('htmlPreview'), editor.getValue()))

  el('new_button').addEventListener('click', () => openModal('new'))
  el('modalSubmit').addEventListener('click', save)
  el('import_email_button').addEventListener('click', () => {
    el('email_content').value = ''
    const imf = el('import.flashes'); if (imf) imf.innerHTML = ''
    importModal.show()
  })
  el('importSubmit').addEventListener('click', importEmail)
  el('attachmentUpload').addEventListener('change', (e) => { attachFiles(e.target.files); e.target.value = '' })

  el('attachmentsBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]')
    if (!btn) return
    attachments.splice(parseInt(btn.dataset.remove, 10), 1)
    renderAttachments()
  })

  el('templateTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    if (btn.dataset.action === 'edit') openModal('edit', id)
    else if (btn.dataset.action === 'copy') openModal('copy', id)
    else if (btn.dataset.action === 'delete') deleteTemplate(id)
  })

  load()
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
