// NG-gophish - Campaign Results (Vanilla JS + Bootstrap 5 + ECharts + Grid.js).
import { api, errorFlash, successFlash, escapeHtml, capitalize } from '../api.js'
import { confirmDialog, alertDialog } from '../ui.js'
import { Grid, html } from 'gridjs'
import { Modal } from 'bootstrap'
import Papa from 'papaparse'
import { UAParser } from 'ua-parser-js'

import * as echarts from 'echarts/core'
import { PieChart, ScatterChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, GeoComponent, GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([PieChart, ScatterChart, TitleComponent, TooltipComponent, GridComponent, GeoComponent, GraphicComponent, CanvasRenderer])

// URL del GeoJSON del mundo (se carga solo si el mapa esta activado).
import worldMapUrl from '../assets/world.json?url'

// Estado y color por estado (heredado de la UI original).
const STATUSES = {
  'Email Sent': { color: '#1abc9c', icon: 'bi-envelope' },
  'Emails Sent': { color: '#1abc9c', icon: 'bi-envelope' },
  'Email Opened': { color: '#f9bf3b', icon: 'bi-envelope-open' },
  'Clicked Link': { color: '#F39C12', icon: 'bi-cursor' },
  'Submitted Data': { color: '#f05b4f', icon: 'bi-exclamation-circle' },
  'Email Reported': { color: '#45d6ef', icon: 'bi-megaphone' },
  Success: { color: '#f05b4f', icon: 'bi-exclamation-circle' },
  Error: { color: '#6c7a89', icon: 'bi-x-circle' },
  'Error Sending Email': { color: '#6c7a89', icon: 'bi-x-circle' },
  Unknown: { color: '#6c7a89', icon: 'bi-question-circle' },
  Sending: { color: '#428bca', icon: 'bi-arrow-repeat' },
  Retrying: { color: '#6c7a89', icon: 'bi-clock' },
  Scheduled: { color: '#428bca', icon: 'bi-clock' },
  'Campaign Created': { color: '#1abc9c', icon: 'bi-rocket' },
}
const STATUS_BADGE = {
  'In progress': 'text-bg-primary', Queued: 'text-bg-info', Completed: 'text-bg-success',
  'Email Sent': 'text-bg-success', 'Emails Sent': 'text-bg-success', 'Email Opened': 'text-bg-warning',
  'Clicked Link': 'text-bg-warning', 'Submitted Data': 'text-bg-danger', Success: 'text-bg-danger',
  Error: 'text-bg-secondary', Scheduled: 'text-bg-primary', Retrying: 'text-bg-secondary',
}
const STATUS_MAPPING = {
  'Email Sent': 'sent', 'Email Opened': 'opened', 'Clicked Link': 'clicked',
  'Submitted Data': 'submitted_data', 'Email Reported': 'reported',
}
const DONUTS = [
  { key: 'Email Sent', el: 'sent_chart' },
  { key: 'Email Opened', el: 'opened_chart' },
  { key: 'Clicked Link', el: 'clicked_chart' },
  { key: 'Submitted Data', el: 'submitted_data_chart' },
  { key: 'Email Reported', el: 'reported_chart' },
]
const PROGRESS = ['Email Sent', 'Email Opened', 'Clicked Link', 'Submitted Data']

let campaign = {}
let doPoll = true
let refreshTimer = null
let grid = null
let detailModal = null
let replayModal = null
let replayEventIdx = null
let mapChart = null
let mapRegistered = false
const charts = {}

function el(id) { return document.getElementById(id) }
function themeText() { return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? '#adb5bd' : '#495057' }
function fmtDateTime(iso) {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function initChart(elId) {
  const node = el(elId)
  if (!node) return null
  const existing = echarts.getInstanceByDom(node)
  if (existing) existing.dispose()
  const c = echarts.init(node)
  charts[elId] = c
  return c
}

// ---- Timeline chart (scatter sobre el tiempo) ----
function renderTimelineChart() {
  const chart = initChart('timeline_chart')
  if (!chart) return
  const text = themeText()
  const data = campaign.timeline
    .filter((e) => e.message !== 'Campaign Created')
    .map((e) => ({
      value: [new Date(e.time).getTime(), 1],
      message: e.message,
      email: e.email,
      itemStyle: { color: (STATUSES[e.message] || {}).color || '#888' },
    }))
  chart.setOption({
    title: { text: 'Campaign Timeline', left: 'center', textStyle: { fontSize: 14, color: text } },
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${new Date(p.value[0]).toLocaleString()}<br>Event: ${escapeHtml(p.data.message)}<br>Email: <b>${escapeHtml(p.data.email || '')}</b>`,
    },
    grid: { left: 20, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'time', axisLabel: { color: text }, axisLine: { lineStyle: { color: text } } },
    yAxis: { type: 'value', min: 0, max: 2, show: false },
    series: [{ type: 'scatter', data, symbolSize: 9 }],
  })
}

// ---- Donuts ----
function renderDonut(elId, label, count, percent, color) {
  const chart = initChart(elId)
  if (!chart) return
  const text = themeText()
  chart.setOption({
    title: { text: label, left: 'center', bottom: 0, textStyle: { fontSize: 11, color: text, fontWeight: 'normal' } },
    tooltip: { trigger: 'item', formatter: () => `${label}: <b>${percent}%</b> (${count})` },
    graphic: { type: 'text', left: 'center', top: '38%', style: { text: String(count), fill: color, font: 'bold 20px sans-serif' } },
    series: [{
      type: 'pie', radius: ['62%', '82%'], center: ['50%', '45%'], label: { show: false }, labelLine: { show: false },
      data: [
        { value: percent, name: label, itemStyle: { color } },
        { value: 100 - percent, name: '', itemStyle: { color: '#dddddd' }, tooltip: { show: false } },
      ],
    }],
  })
}

function computeStats() {
  const data = {}
  Object.keys(STATUS_MAPPING).forEach((k) => { data[k] = 0 })
  ;(campaign.results || []).forEach((r) => {
    if (r.status in data) data[r.status]++
    if (r.reported) data['Email Reported']++
    const step = PROGRESS.indexOf(r.status)
    for (let i = 0; i < step; i++) data[PROGRESS[i]]++
  })
  return data
}

function renderDonuts() {
  const stats = computeStats()
  const total = (campaign.results || []).length || 1
  DONUTS.forEach(({ key, el: elId }) => {
    const count = stats[key] || 0
    const percent = Math.floor((count / total) * 100)
    renderDonut(elId, key, count, percent, (STATUSES[key] || {}).color || '#888')
  })
}

// ---- Device / timeline detail ----
function renderDevice(details) {
  if (!details || !details.browser || !details.browser['user-agent']) return ''
  const ua = UAParser(details.browser['user-agent'])
  const os = [ua.os.name, ua.os.version].filter(Boolean).join(' ') || 'Unknown OS'
  const browser = [ua.browser.name, ua.browser.version].filter(Boolean).join(' ') || 'Unknown browser'
  return `<div class="small text-body-secondary mb-2"><i class="bi bi-display me-1"></i>${escapeHtml(os)} · <i class="bi bi-globe me-1"></i>${escapeHtml(browser)}</div>`
}

function renderResultTimeline(result) {
  let out = `<p class="text-body-secondary small mb-3">Email: ${escapeHtml(result.email)} · Result ID: ${escapeHtml(result.id)}</p>`
  out += '<ul class="list-group">'
  campaign.timeline.forEach((event, i) => {
    if (event.email && event.email !== result.email) return
    const st = STATUSES[event.message] || { icon: 'bi-dot', color: '#888' }
    out += '<li class="list-group-item">'
    out += `<div class="d-flex justify-content-between"><span><i class="bi ${st.icon} me-2" style="color:${st.color}"></i>${escapeHtml(event.message)}</span>`
    out += `<small class="text-body-secondary">${fmtDateTime(event.time)}</small></div>`
    if (event.details) {
      let details = {}
      try { details = JSON.parse(event.details) } catch { /* ignore */ }
      if (event.message === 'Clicked Link' || event.message === 'Submitted Data') out += renderDevice(details)
      if (details.payload) {
        out += '<table class="table table-sm table-bordered mt-2 mb-1"><thead><tr><th>Parameter</th><th>Value(s)</th></tr></thead><tbody>'
        Object.keys(details.payload).forEach((param) => {
          if (param === 'rid') return
          out += `<tr><td>${escapeHtml(param)}</td><td>${escapeHtml(String(details.payload[param]))}</td></tr>`
        })
        out += '</tbody></table>'
      }
      if (event.message === 'Submitted Data') {
        out += `<button class="btn btn-sm btn-success mt-1" data-replay="${i}"><i class="bi bi-arrow-repeat me-1"></i>Replay Credentials</button>`
      }
      if (details.error) out += `<div class="mt-2"><span class="badge text-bg-secondary">Error</span> ${escapeHtml(details.error)}</div>`
    }
    out += '</li>'
  })
  out += '</ul>'
  return out
}

function openDetail(resultId) {
  const result = campaign.results.find((r) => r.id == resultId)
  if (!result) return
  el('resultDetailLabel').textContent = `Timeline for ${result.first_name} ${result.last_name}`.trim()
  el('resultDetailBody').innerHTML = renderResultTimeline(result)
  detailModal.show()
}

// ---- Replay credentials ----
function openReplay(eventIdx) {
  replayEventIdx = eventIdx
  let url = ''
  try {
    const details = JSON.parse(campaign.timeline[eventIdx].details)
    if (details.payload && details.payload.__original_url) url = details.payload.__original_url
  } catch { /* ignore */ }
  el('replayUrl').value = url
  replayModal.show()
}

function submitReplay() {
  const url = el('replayUrl').value
  if (!url) return
  let details = {}
  try { details = JSON.parse(campaign.timeline[replayEventIdx].details) } catch { return }
  const form = document.createElement('form')
  form.method = 'POST'
  form.target = '_blank'
  form.action = url
  Object.keys(details.payload || {}).forEach((param) => {
    if (param === 'rid' || param === '__original_url') return
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = param
    input.value = details.payload[param]
    form.appendChild(input)
  })
  document.body.appendChild(form)
  form.submit()
  form.remove()
  replayModal.hide()
}

// ---- Results table ----
function statusBadge(status) {
  return `<span class="badge ${STATUS_BADGE[status] || 'text-bg-secondary'}">${escapeHtml(status)}</span>`
}
function reportedCell(r) {
  if (r.reported) return '<i class="bi bi-check-circle-fill text-success"></i>'
  return `<i role="button" class="bi bi-x-circle text-muted" data-report="${r.id}" title="Mark as reported"></i>`
}

function renderTable() {
  const data = (campaign.results || []).map((r) => [
    r.first_name || '', r.last_name || '', r.email || '', r.position || '',
    r.status, { reported: r.reported, id: r.id }, r.id,
  ])
  const config = {
    columns: [
      { name: 'First Name' }, { name: 'Last Name' }, { name: 'Email' }, { name: 'Position' },
      { name: 'Status', formatter: (c) => html(statusBadge(c)) },
      { name: 'Reported', formatter: (c) => html(reportedCell(c)) },
      { name: '', sort: false, formatter: (id) => html(`<button class="btn btn-sm btn-outline-secondary" data-detail="${id}" title="Timeline"><i class="bi bi-list-ul"></i></button>`) },
    ],
    data, search: true, sort: true, pagination: { limit: 10 }, className: { table: 'table table-hover' },
  }
  if (grid) grid.updateConfig(config).forceRender()
  else { grid = new Grid(config).render(el('resultsTable')) }
}

// ---- Map (lazy, solo si use_map) ----
async function initMap() {
  try {
    if (!mapRegistered) {
      const geo = await fetch(worldMapUrl).then((r) => r.json())
      echarts.registerMap('world', geo)
      mapRegistered = true
    }
    el('resultsMapContainer').classList.remove('d-none')
    mapChart = initChart('resultsMap')
    updateMap()
  } catch (e) {
    // Fallback: si falla el mapa, no bloquea el resto.
    el('resultsMapContainer').classList.add('d-none')
  }
}

function updateMap() {
  if (!mapChart) return
  const byIp = {}
  ;(campaign.results || []).forEach((r) => {
    if (!r.latitude && !r.longitude) return
    if (!byIp[r.ip]) byIp[r.ip] = { name: r.ip, value: [r.longitude, r.latitude, 0] }
    byIp[r.ip].value[2] += 1
  })
  mapChart.setOption({
    tooltip: { trigger: 'item', formatter: (p) => `${escapeHtml(p.name)}: ${p.value[2]}` },
    geo: { map: 'world', roam: true, itemStyle: { areaColor: '#e9ecef', borderColor: '#adb5bd' }, emphasis: { itemStyle: { areaColor: '#1abc9c' } } },
    series: [{
      type: 'scatter', coordinateSystem: 'geo', data: Object.values(byIp),
      symbolSize: (v) => Math.min(8 + v[2] * 2, 30), itemStyle: { color: '#283F50' },
    }],
  })
}

// ---- Actions ----
function exportCSV(scope) {
  const rows = scope === 'results' ? campaign.results : campaign.timeline
  if (!rows) return
  const csv = Papa.unparse(rows, { escapeFormulae: true })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = window.URL.createObjectURL(blob)
  link.setAttribute('download', `${campaign.name} - ${capitalize(scope)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function completeCampaign() {
  if (!(await confirmDialog({ title: 'Complete campaign', body: 'Gophish will stop processing events for this campaign.', confirmText: 'Complete', confirmClass: 'btn-info' }))) return
  try {
    await api.campaignId.complete(campaign.id)
    const btn = el('complete_button')
    btn.disabled = true
    btn.innerHTML = '<i class="bi bi-flag-fill me-1"></i>Completed!'
    doPoll = false
    successFlash('Campaign completed!')
  } catch (e) { errorFlash(e.message) }
}

async function deleteCampaign() {
  if (!(await confirmDialog({ title: 'Delete campaign', body: "This will delete the campaign. This can't be undone!", confirmText: 'Delete' }))) return
  try {
    await api.campaignId.delete(campaign.id)
    window.location.href = '/campaigns'
  } catch (e) { errorFlash(e.message) }
}

async function reportMail(rid) {
  if (!(await confirmDialog({ title: 'Flag as reported', body: `This result will be flagged as reported (RID: ${rid})`, confirmText: 'Continue', confirmClass: 'btn-primary' }))) return
  try {
    const c = await api.campaignId.get(campaign.id)
    const url = new URL(c.url)
    url.pathname = '/report'
    url.search = '?rid=' + rid
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    refresh()
  } catch (e) {
    await alertDialog({ title: 'Error', body: e.message === 'Failed to fetch' ? 'This might be due to Mixed Content or network problems.' : e.message })
  }
}

function renderAll() {
  renderTimelineChart()
  renderDonuts()
  renderTable()
  if (mapChart) updateMap()
}

async function poll() {
  try {
    campaign = await api.campaignId.results(campaign.id)
    renderAll()
  } catch { /* keep previous data */ } finally {
    el('refresh_message').classList.add('d-none')
    el('refresh_btn').classList.remove('d-none')
  }
}

function refresh() {
  if (!doPoll) return
  el('refresh_message').classList.remove('d-none')
  el('refresh_btn').classList.add('d-none')
  poll()
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, 60000)
}

function wireEvents() {
  el('refresh_btn').addEventListener('click', refresh)
  el('complete_button').addEventListener('click', completeCampaign)
  el('delete_button').addEventListener('click', deleteCampaign)
  el('replaySubmit').addEventListener('click', submitReplay)
  document.querySelectorAll('[data-export]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); exportCSV(a.dataset.export) })
  })
  // Delegacion en la tabla (detalle + marcar reportado).
  el('resultsTable').addEventListener('click', (e) => {
    const detail = e.target.closest('[data-detail]')
    if (detail) { openDetail(detail.dataset.detail); return }
    const report = e.target.closest('[data-report]')
    if (report) reportMail(report.dataset.report)
  })
  // Delegacion en el modal de detalle (replay).
  el('resultDetailBody').addEventListener('click', (e) => {
    const r = e.target.closest('[data-replay]')
    if (r) openReplay(parseInt(r.dataset.replay, 10))
  })
  // Re-dibuja charts al cambiar el tema.
  new MutationObserver(() => renderAll()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] })
  window.addEventListener('resize', () => Object.values(charts).forEach((c) => c.resize()))
}

async function load() {
  campaign.id = window.location.pathname.split('/').slice(-1)[0]
  let useMap = false
  try { useMap = JSON.parse(localStorage.getItem('gophish.use_map')) } catch { /* ignore */ }
  try {
    campaign = await api.campaignId.results(campaign.id)
    el('loading').classList.add('d-none')
    el('campaignResults').classList.remove('d-none')
    document.title = campaign.name + ' - Gophish'
    el('page-title').textContent = 'Results for ' + campaign.name
    if (campaign.status === 'Completed') {
      const btn = el('complete_button')
      btn.disabled = true
      btn.innerHTML = '<i class="bi bi-flag-fill me-1"></i>Completed!'
      doPoll = false
    }
    detailModal = new Modal(el('resultDetailModal'))
    replayModal = new Modal(el('replayModal'))
    wireEvents()
    renderAll()
    if (useMap) initMap()
    refreshTimer = setTimeout(refresh, 60000)
  } catch (e) {
    el('loading').classList.add('d-none')
    errorFlash('Campaign not found!')
  }
}

if (document.readyState !== 'loading') load()
else document.addEventListener('DOMContentLoaded', load)
