// NG-gophish - pagina Campaigns (Vanilla JS + Bootstrap 5 + Tom Select + flatpickr + Grid.js).
import { api, errorFlash, modalError, escapeHtml } from '../api.js'
import { confirmDialog, alertDialog } from '../ui.js'
import { Grid, html } from 'gridjs'
import { Modal, Tooltip } from 'bootstrap'
import TomSelect from 'tom-select'
import flatpickr from 'flatpickr'

const STATUS_BADGE = {
  'In progress': 'text-bg-primary',
  Queued: 'text-bg-info',
  Completed: 'text-bg-success',
  'Emails Sent': 'text-bg-success',
  Error: 'text-bg-danger',
}
const DATE_FMT = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }

let campaigns = []
let modal = null
let testModal = null
let activeGrid = null
let archiveGrid = null
const selects = {}
let fpLaunch = null
let fpSendBy = null

function el(id) { return document.getElementById(id) }
function fmtDate(iso) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, DATE_FMT)
}

function quickStats(c) {
  if (new Date(c.launch_date).getTime() > Date.now()) {
    return `Scheduled to start: ${fmtDate(c.launch_date)}\nRecipients: ${c.stats.total}`
  }
  return `Launch: ${fmtDate(c.launch_date)}\nRecipients: ${c.stats.total}\n` +
    `Opened: ${c.stats.opened} · Clicked: ${c.stats.clicked} · ` +
    `Submitted: ${c.stats.submitted_data} · Errors: ${c.stats.error} · Reported: ${c.stats.email_reported}`
}

function rowActions(id) {
  return html(
    `<div class="text-end">` +
    `<a class="btn btn-sm btn-outline-primary me-1" href="/campaigns/${id}" title="View Results"><i class="bi bi-bar-chart"></i></a>` +
    `<button class="btn btn-sm btn-outline-secondary me-1" data-action="copy" data-id="${id}" title="Copy"><i class="bi bi-files"></i></button>` +
    `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${id}" title="Delete"><i class="bi bi-trash"></i></button>` +
    `</div>`
  )
}

function gridConfig(data) {
  return {
    columns: [
      { name: 'Name' },
      { name: 'Created' },
      {
        name: 'Status',
        formatter: (cell) => html(
          `<span class="badge ${STATUS_BADGE[cell.status] || 'text-bg-secondary'}" title="${escapeHtml(cell.title)}">${escapeHtml(cell.status)}</span>`
        ),
      },
      { name: '', sort: false, formatter: (id) => rowActions(id) },
    ],
    data,
    search: true,
    sort: true,
    pagination: { limit: 10 },
    className: { table: 'table table-hover' },
  }
}

function renderTables() {
  const active = []
  const archived = []
  campaigns.forEach((c) => {
    const row = [c.name, fmtDate(c.created_date), { status: c.status, title: quickStats(c) }, c.id]
    ;(c.status === 'Completed' ? archived : active).push(row)
  })
  activeGrid = new Grid(gridConfig(active)).render(el('campaignTable'))
  archiveGrid = new Grid(gridConfig(archived)).render(el('campaignTableArchive'))
}

function initSelects() {
  selects.template = new TomSelect('#template', { placeholder: 'Select a Template' })
  selects.page = new TomSelect('#page', { placeholder: 'Select a Landing Page' })
  selects.profile = new TomSelect('#profile', { placeholder: 'Select a Sending Profile' })
  selects.users = new TomSelect('#users', { placeholder: 'Select Groups', plugins: ['remove_button'], maxItems: null })
}

function fillSelect(ts, items, { selectFirst = false } = {}) {
  ts.clear(true)
  ts.clearOptions()
  items.forEach((it) => ts.addOption({ value: it.name, text: it.name }))
  ts.refreshOptions(false)
  if (selectFirst && items.length === 1) ts.setValue(items[0].name, true)
}

async function populateOptions() {
  el('modal.flashes').innerHTML = ''
  try {
    const [groups, templates, pages, profiles] = await Promise.all([
      api.groups.summary(), api.templates.get(), api.pages.get(), api.SMTP.get(),
    ])
    if (!groups.groups || groups.groups.length === 0) modalError('No groups found!')
    else fillSelect(selects.users, groups.groups)
    if (!templates || templates.length === 0) modalError('No templates found!')
    else fillSelect(selects.template, templates, { selectFirst: true })
    if (!pages || pages.length === 0) modalError('No pages found!')
    else fillSelect(selects.page, pages, { selectFirst: true })
    if (!profiles || profiles.length === 0) modalError('No sending profiles found!')
    else fillSelect(selects.profile, profiles, { selectFirst: true })
  } catch (e) {
    modalError('Error loading campaign options: ' + e.message)
  }
}

function resetForm() {
  el('name').value = ''
  el('url').value = ''
  el('modal.flashes').innerHTML = ''
  Object.values(selects).forEach((ts) => ts.clear(true))
  if (fpLaunch) fpLaunch.setDate(new Date())
  if (fpSendBy) fpSendBy.clear()
}

async function openNew() {
  el('campaignModalLabel').textContent = 'New Campaign'
  resetForm()
  await populateOptions()
  modal.show()
}

async function openCopy(id) {
  el('campaignModalLabel').textContent = 'Copy Campaign'
  resetForm()
  await populateOptions()
  try {
    const c = await api.campaignId.get(id)
    el('name').value = 'Copy of ' + c.name
    el('url').value = c.url || ''
    if (c.template && c.template.name) selects.template.setValue(c.template.name, true)
    if (c.page && c.page.name) selects.page.setValue(c.page.name, true)
    if (c.smtp && c.smtp.name) selects.profile.setValue(c.smtp.name, true)
  } catch (e) {
    modalError(e.message)
  }
  modal.show()
}

async function launch() {
  const launchDate = fpLaunch.selectedDates[0]
  if (!el('name').value || !selects.template.getValue() || !selects.page.getValue() ||
    !selects.profile.getValue() || selects.users.getValue().length === 0 || !launchDate) {
    modalError('Please fill in all required fields.')
    return
  }
  const ok = await confirmDialog({
    title: 'Launch campaign',
    body: 'This will schedule the campaign to be launched.',
    confirmText: 'Launch',
    confirmClass: 'btn-primary',
  })
  if (!ok) return

  const sendBy = fpSendBy.selectedDates[0]
  const payload = {
    name: el('name').value,
    template: { name: selects.template.getValue() },
    url: el('url').value,
    page: { name: selects.page.getValue() },
    smtp: { name: selects.profile.getValue() },
    launch_date: launchDate.toISOString(),
    send_by_date: sendBy ? sendBy.toISOString() : null,
    groups: selects.users.getValue().map((name) => ({ name })),
  }
  try {
    const data = await api.campaigns.post(payload)
    modal.hide()
    window.location = '/campaigns/' + data.id
  } catch (e) {
    modalError(e.message)
  }
}

async function sendTestEmail() {
  const btn = el('sendTestModalSubmit')
  const scope = el('sendTestEmailModal')
  const req = {
    template: { name: selects.template.getValue() },
    url: el('url').value,
    page: { name: selects.page.getValue() },
    smtp: { name: selects.profile.getValue() },
  }
  req.first_name = scope.querySelector('[name=to_first_name]').value
  req.last_name = scope.querySelector('[name=to_last_name]').value
  req.email = scope.querySelector('[name=to_email]').value
  req.position = scope.querySelector('[name=to_position]').value
  const old = btn.innerHTML
  btn.disabled = true
  btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Sending'
  const flash = (type, msg) => {
    el('sendTestEmailModal.flashes').innerHTML =
      `<div class="alert alert-${type} text-center" role="alert">${escapeHtml(msg)}</div>`
  }
  try {
    await api.send_test_email(req)
    flash('success', 'Email Sent!')
  } catch (e) {
    flash('danger', e.message)
  } finally {
    btn.disabled = false
    btn.innerHTML = old
  }
}

async function deleteCampaign(id) {
  const c = campaigns.find((x) => x.id == id)
  if (!c) return
  const ok = await confirmDialog({
    title: 'Delete campaign',
    body: `This will delete the campaign "${c.name}". This can't be undone!`,
    confirmText: 'Delete',
  })
  if (!ok) return
  try {
    await api.campaignId.delete(id)
    location.reload()
  } catch (e) {
    await alertDialog({ title: 'Error', body: e.message })
  }
}

function wireTableActions(container) {
  el(container).addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]')
    if (!btn) return
    if (btn.dataset.action === 'copy') openCopy(btn.dataset.id)
    else if (btn.dataset.action === 'delete') deleteCampaign(btn.dataset.id)
  })
}

async function init() {
  modal = new Modal(el('modal'))
  testModal = new Modal(el('sendTestEmailModal'))
  initSelects()
  fpLaunch = flatpickr('#launch_date', { enableTime: true, dateFormat: 'Y-m-d H:i', defaultDate: new Date() })
  fpSendBy = flatpickr('#send_by_date', { enableTime: true, dateFormat: 'Y-m-d H:i' })

  el('new_button').addEventListener('click', openNew)
  el('launchButton').addEventListener('click', launch)
  el('sendTestEmailButton').addEventListener('click', () => testModal.show())
  el('sendTestModalSubmit').addEventListener('click', sendTestEmail)
  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((t) => new Tooltip(t))

  try {
    const data = await api.campaigns.summary()
    campaigns = data.campaigns || []
    el('loading').classList.add('d-none')
    if (campaigns.length === 0) {
      el('emptyMessage').classList.remove('d-none')
      return
    }
    el('campaignTabs').classList.remove('d-none')
    renderTables()
    wireTableActions('campaignTable')
    wireTableActions('campaignTableArchive')
  } catch (e) {
    el('loading').classList.add('d-none')
    errorFlash('Error fetching campaigns')
  }
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
