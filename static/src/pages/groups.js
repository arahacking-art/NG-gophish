// NG-gophish - pagina Users & Groups (Vanilla JS + Bootstrap 5 + Grid.js).
import { api, errorFlash, successFlash, modalError, escapeHtml } from '../api.js'
import { confirmDialog } from '../ui.js'
import { Grid, html } from 'gridjs'
import { Modal } from 'bootstrap'
import Papa from 'papaparse'

let groups = []
let targets = [] // destinatarios del grupo en edicion (en memoria)
let grid = null
let modal = null

function el(id) {
  return document.getElementById(id)
}

function formatDate(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

// --- Tabla principal de grupos (Grid.js) ---
function rowActions(id) {
  return html(
    `<div class="text-end">` +
    `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${id}" title="Edit"><i class="bi bi-pencil"></i></button>` +
    `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${id}" title="Delete"><i class="bi bi-trash"></i></button>` +
    `</div>`
  )
}

function renderGrid() {
  const data = groups.map((g) => [g.name, g.num_targets, formatDate(g.modified_date), g.id])
  const config = {
    columns: [
      { name: 'Name' },
      { name: '# of Members' },
      { name: 'Modified Date' },
      { name: '', sort: false, formatter: (cell) => rowActions(cell) },
    ],
    data,
    search: true,
    sort: true,
    pagination: { limit: 10 },
    className: { table: 'table table-hover' },
    language: { search: { placeholder: 'Search groups...' } },
  }
  if (grid) {
    grid.updateConfig(config).forceRender()
  } else {
    grid = new Grid(config).render(el('groupTable'))
  }
}

async function load() {
  el('groupCard').classList.add('d-none')
  el('emptyMessage').classList.add('d-none')
  el('loading').classList.remove('d-none')
  try {
    const response = await api.groups.summary()
    el('loading').classList.add('d-none')
    if (response.total > 0) {
      groups = response.groups
      el('groupCard').classList.remove('d-none')
      renderGrid()
    } else {
      groups = []
      el('emptyMessage').classList.remove('d-none')
    }
  } catch (e) {
    el('loading').classList.add('d-none')
    errorFlash('Error fetching groups')
  }
}

// --- Gestion de destinatarios (en memoria) ---
function renderTargets() {
  const body = el('targetsBody')
  body.innerHTML = targets
    .map(
      (t, i) =>
        `<tr>` +
        `<td>${escapeHtml(t.first_name)}</td>` +
        `<td>${escapeHtml(t.last_name)}</td>` +
        `<td>${escapeHtml(t.email)}</td>` +
        `<td>${escapeHtml(t.position)}</td>` +
        `<td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" data-del="${i}" title="Remove"><i class="bi bi-x-lg"></i></button></td>` +
        `</tr>`
    )
    .join('')
  el('targetCount').textContent = targets.length
}

// Anade o actualiza (por email) un destinatario.
function addTarget(first_name, last_name, email, position) {
  const normalized = (email || '').trim().toLowerCase()
  const target = {
    first_name: (first_name || '').trim(),
    last_name: (last_name || '').trim(),
    email: normalized,
    position: (position || '').trim(),
  }
  if (!target.email) return
  const idx = targets.findIndex((t) => t.email === normalized)
  if (idx >= 0) {
    targets[idx] = target
  } else {
    targets.push(target)
  }
}

// Mapea una fila de CSV (cabeceras libres) a un destinatario.
function csvRowToTarget(row) {
  const get = (...keys) => {
    for (const k of Object.keys(row)) {
      const norm = k.trim().toLowerCase().replace(/[\s_]+/g, '')
      if (keys.includes(norm)) return row[k]
    }
    return ''
  }
  return {
    first_name: get('firstname'),
    last_name: get('lastname'),
    email: get('email'),
    position: get('position'),
  }
}

function importCSV(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      let added = 0
      results.data.forEach((row) => {
        const t = csvRowToTarget(row)
        if (t.email) {
          addTarget(t.first_name, t.last_name, t.email, t.position)
          added += 1
        }
      })
      renderTargets()
      if (added === 0) {
        modalError('No valid rows found. Expected columns: First Name, Last Name, Email, Position.')
      }
    },
    error: () => modalError('Could not parse the CSV file.'),
  })
}

function downloadCSVTemplate(e) {
  e.preventDefault()
  const csv = Papa.unparse([
    { 'First Name': 'Example', 'Last Name': 'User', Email: 'foobar@example.com', Position: 'Systems Administrator' },
  ])
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'group_template.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// --- Modal alta/edicion ---
function resetModal() {
  el('name').value = ''
  targets = []
  renderTargets()
  const mf = el('modal.flashes')
  if (mf) mf.innerHTML = ''
  el('csvupload').value = ''
}

async function openGroup(id) {
  resetModal()
  el('modalSubmit').onclick = () => saveGroup(id)
  if (id != -1) {
    el('groupModalLabel').textContent = 'Edit Group'
    try {
      const group = await api.groupId.get(id)
      el('name').value = group.name
      targets = (group.targets || []).map((t) => ({
        first_name: t.first_name || '',
        last_name: t.last_name || '',
        email: t.email || '',
        position: t.position || '',
      }))
      renderTargets()
    } catch (e) {
      errorFlash('Error fetching group')
    }
  } else {
    el('groupModalLabel').textContent = 'New Group'
  }
  modal.show()
}

async function saveGroup(id) {
  const group = { name: el('name').value, targets }
  try {
    if (id != -1) {
      group.id = parseInt(id, 10)
      await api.groupId.put(group)
      successFlash('Group updated successfully!')
    } else {
      await api.groups.post(group)
      successFlash('Group added successfully!')
    }
    modal.hide()
    await load()
  } catch (e) {
    modalError(e.message)
  }
}

async function deleteGroup(id) {
  const group = groups.find((x) => x.id == id)
  if (!group) return
  const ok = await confirmDialog({
    title: 'Delete group',
    body: `This will delete the group "${group.name}". This can't be undone!`,
    confirmText: 'Delete',
  })
  if (!ok) return
  try {
    await api.groupId.delete(id)
    await load()
    successFlash('Group deleted!')
  } catch (e) {
    errorFlash(e.message)
  }
}

function init() {
  const modalEl = el('groupModal')
  modal = new Modal(modalEl)
  modalEl.addEventListener('hidden.bs.modal', resetModal)

  el('new_button').addEventListener('click', () => openGroup(-1))

  // Grupos: delegacion (Grid.js re-renderiza).
  el('groupTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    if (btn.dataset.action === 'edit') openGroup(id)
    else if (btn.dataset.action === 'delete') deleteGroup(id)
  })

  // Alta manual de destinatario.
  el('targetForm').addEventListener('submit', (e) => {
    e.preventDefault()
    if (!el('targetForm').checkValidity()) {
      el('targetForm').reportValidity()
      return
    }
    addTarget(el('firstName').value, el('lastName').value, el('email').value, el('position').value)
    renderTargets()
    el('targetForm').reset()
    el('firstName').focus()
  })

  // Borrado de destinatario (delegacion).
  el('targetsBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-del]')
    if (!btn) return
    targets.splice(parseInt(btn.dataset.del, 10), 1)
    renderTargets()
  })

  // CSV.
  el('csvupload').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) importCSV(file)
  })
  el('csv-template').addEventListener('click', downloadCSVTemplate)

  load()
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
