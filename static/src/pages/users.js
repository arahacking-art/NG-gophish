// NG-gophish - pagina User Management (Vanilla JS + Bootstrap 5 + Grid.js).
import { api, errorFlash, successFlash, modalError, escapeHtml } from '../api.js'
import { confirmDialog, alertDialog } from '../ui.js'
import { initPasswordStrength } from './passwords.js'
import { Grid, html } from 'gridjs'
// El theme de Grid.js se carga de forma centralizada vía main.css (main.js),
// que todas las paginas modernas incluyen; no lo importamos aqui para no
// duplicarlo ni depender de un CSS per-page.
import { Modal, Tooltip } from 'bootstrap'

let users = []
let grid = null
let modal = null

function el(id) {
  return document.getElementById(id)
}

const ZERO_DATE = '0001-01-01T00:00:00Z'

function formatLastLogin(iso) {
  if (!iso || iso === ZERO_DATE) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function resetForm() {
  el('username').value = ''
  el('username').disabled = false
  el('password').value = ''
  el('confirm_password').value = ''
  el('role').value = 'user'
  el('force_password_change_checkbox').checked = true
  el('account_locked_checkbox').checked = false
  const mf = el('modal.flashes')
  if (mf) mf.innerHTML = ''
}

function rowActions(id) {
  return html(
    `<div class="text-end">` +
    `<button class="btn btn-sm btn-outline-warning me-1" data-action="impersonate" data-id="${id}" title="Impersonate"><i class="bi bi-person-badge"></i></button>` +
    `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${id}" title="Edit"><i class="bi bi-pencil"></i></button>` +
    `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${id}" title="Delete"><i class="bi bi-trash"></i></button>` +
    `</div>`
  )
}

function renderGrid() {
  // Grid.js escapa automaticamente las celdas de texto (username/role).
  const data = users.map((u) => [
    u.username,
    (u.role && u.role.name) || '',
    formatLastLogin(u.last_login),
    u.id,
  ])
  const config = {
    columns: [
      { name: 'Username' },
      { name: 'Role' },
      { name: 'Last Login' },
      { name: '', sort: false, formatter: (cell) => rowActions(cell) },
    ],
    data,
    search: true,
    sort: true,
    pagination: { limit: 10 },
    className: { table: 'table table-hover' },
    language: { search: { placeholder: 'Search users...' } },
  }
  if (grid) {
    grid.updateConfig(config).forceRender()
  } else {
    grid = new Grid(config).render(el('userTable'))
  }
}

async function load() {
  try {
    users = await api.users.get()
    renderGrid()
  } catch (e) {
    errorFlash('Error fetching users')
  }
}

async function saveUser(id) {
  if (el('password').value !== el('confirm_password').value) {
    modalError('Passwords must match.')
    return
  }
  const user = {
    username: el('username').value,
    password: el('password').value,
    role: el('role').value,
    password_change_required: el('force_password_change_checkbox').checked,
    account_locked: el('account_locked_checkbox').checked,
  }
  try {
    if (id != -1) {
      user.id = parseInt(id, 10)
      await api.userId.put(user)
      modal.hide()
      resetForm()
      await load()
      successFlash(`User ${escapeHtml(user.username)} updated successfully!`)
    } else {
      await api.users.post(user)
      modal.hide()
      resetForm()
      await load()
      successFlash(`User ${escapeHtml(user.username)} registered successfully!`)
    }
  } catch (e) {
    modalError(e.message)
  }
}

async function editUser(id) {
  resetForm()
  el('modalSubmit').onclick = () => saveUser(id)
  if (id != -1) {
    el('userModalLabel').textContent = 'Edit User'
    try {
      const user = await api.userId.get(id)
      el('username').value = user.username
      el('role').value = user.role ? user.role.slug : 'user'
      el('force_password_change_checkbox').checked = user.password_change_required
      el('account_locked_checkbox').checked = user.account_locked
      // El usuario admin no puede renombrarse.
      if (user.username === 'admin') el('username').disabled = true
    } catch (e) {
      errorFlash('Error fetching user')
    }
  } else {
    el('userModalLabel').textContent = 'New User'
  }
  modal.show()
}

async function deleteUser(id) {
  const user = users.find((x) => x.id == id)
  if (!user) return
  if (user.username === 'admin') {
    await alertDialog({ title: 'Cannot delete', body: `The user account "${user.username}" cannot be deleted.` })
    return
  }
  const ok = await confirmDialog({
    title: 'Delete user',
    body: `This will delete the account for "${user.username}" as well as all of the objects they have created.\n\nThis can't be undone! Are you sure?`,
    confirmText: 'Delete',
  })
  if (!ok) return
  try {
    await api.userId.delete(id)
    await load()
    successFlash(`The user account for ${escapeHtml(user.username)} and all associated objects have been deleted!`)
  } catch (e) {
    errorFlash(e.message)
  }
}

async function impersonate(id) {
  const user = users.find((x) => x.id == id)
  if (!user) return
  const ok = await confirmDialog({
    title: 'Impersonate user',
    body: `You will be logged out of your account and logged in as "${user.username}". Continue?`,
    confirmText: 'Continue',
    confirmClass: 'btn-warning',
  })
  if (!ok) return
  try {
    const res = await fetch('/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'username=' + encodeURIComponent(user.username) +
        '&csrf_token=' + encodeURIComponent(window.csrf_token || ''),
    })
    if (res.ok) {
      window.location.href = '/'
    } else {
      errorFlash(`Failed to change to user ${escapeHtml(user.username)}.`)
    }
  } catch (e) {
    errorFlash(`Failed to change to user ${escapeHtml(user.username)}: ${escapeHtml(e.message)}`)
  }
}

function init() {
  const modalEl = el('userModal')
  modal = new Modal(modalEl)
  modalEl.addEventListener('hidden.bs.modal', resetForm)

  initPasswordStrength('password')

  el('new_button').addEventListener('click', () => editUser(-1))

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((t) => new Tooltip(t))

  // Delegacion de eventos (Grid.js re-renderiza al ordenar/buscar/paginar).
  el('userTable').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    switch (btn.dataset.action) {
      case 'edit':
        editUser(id)
        break
      case 'delete':
        deleteUser(id)
        break
      case 'impersonate':
        impersonate(id)
        break
    }
  })

  load()
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
