// NG-gophish - Dashboard (Vanilla JS + Bootstrap 5 + Apache ECharts + Grid.js).
import { api, errorFlash, successFlash, escapeHtml } from '../api.js'
import { Grid, html } from 'gridjs'

// ECharts modular (solo lo que usamos, para no cargar la libreria entera).
import * as echarts from 'echarts/core'
import { LineChart, PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([LineChart, PieChart, TitleComponent, TooltipComponent, GridComponent, CanvasRenderer])

// Colores por estado (heredados de la UI original).
const STATUS_COLORS = {
  sent: { label: 'Email Sent', color: '#1abc9c' },
  opened: { label: 'Email Opened', color: '#f9bf3b' },
  clicked: { label: 'Clicked Link', color: '#F39C12' },
  submitted_data: { label: 'Submitted Data', color: '#f05b4f' },
  email_reported: { label: 'Email Reported', color: '#45d6ef' },
}

// Mapea el estado de campaña a una clase de badge de Bootstrap 5.
const STATUS_BADGE = {
  'In progress': 'text-bg-primary',
  Queued: 'text-bg-info',
  Completed: 'text-bg-success',
  'Email Sent': 'text-bg-success',
  'Emails Sent': 'text-bg-success',
  'Campaign Created': 'text-bg-success',
  Error: 'text-bg-secondary',
}

let campaigns = []
const charts = []

function themeTextColor() {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? '#adb5bd' : '#495057'
}

function campaignDate(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function initChart(elId) {
  const el = document.getElementById(elId)
  if (!el) return null
  const existing = echarts.getInstanceByDom(el)
  if (existing) existing.dispose()
  const chart = echarts.init(el, null, { renderer: 'canvas' })
  charts.push(chart)
  return chart
}

function renderDonut(elId, label, count, percent, color) {
  const chart = initChart(elId)
  if (!chart) return
  const text = themeTextColor()
  chart.setOption({
    title: { text: label, left: 'center', bottom: 0, textStyle: { fontSize: 12, color: text, fontWeight: 'normal' } },
    tooltip: { trigger: 'item', formatter: () => `${label}: <b>${percent}%</b> (${count})` },
    graphic: {
      type: 'text', left: 'center', top: '38%',
      style: { text: String(count), fill: color, font: 'bold 20px sans-serif' },
    },
    series: [{
      type: 'pie', radius: ['62%', '82%'], center: ['50%', '45%'], silent: false,
      label: { show: false }, labelLine: { show: false },
      data: [
        { value: percent, name: label, itemStyle: { color } },
        { value: 100 - percent, name: '', itemStyle: { color: '#dddddd' }, tooltip: { show: false } },
      ],
    }],
  })
}

function renderStatsDonuts() {
  const totals = {}
  let total = 0
  campaigns.forEach((c) => {
    Object.entries(c.stats || {}).forEach(([status, count]) => {
      if (status === 'total') { total += count; return }
      totals[status] = (totals[status] || 0) + count
    })
  })
  Object.entries(STATUS_COLORS).forEach(([key, { label, color }]) => {
    const count = totals[key] || 0
    const percent = total > 0 ? Math.floor((count / total) * 100) : 0
    renderDonut(key + '_chart', label, count, percent, color)
  })
}

function renderTimeline() {
  const chart = initChart('overview_chart')
  if (!chart) return
  const text = themeTextColor()
  const points = campaigns.map((c) => {
    const totalStat = (c.stats && c.stats.total) || 0
    const y = totalStat > 0 ? Math.floor((c.stats.clicked / totalStat) * 100) : 0
    return { value: [new Date(c.created_date).getTime(), y], name: c.name, campaign_id: c.id }
  }).sort((a, b) => a.value[0] - b.value[0])

  chart.setOption({
    title: { text: 'Phishing Success Overview', left: 'center', textStyle: { fontSize: 14, color: text } },
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${new Date(p.value[0]).toLocaleString()}<br>${escapeHtml(p.data.name)}<br>% Success: <b>${p.value[1]}%</b>`,
    },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'time', axisLabel: { color: text }, axisLine: { lineStyle: { color: text } } },
    yAxis: {
      type: 'value', min: 0, max: 100, name: '% of Success',
      axisLabel: { color: text }, nameTextStyle: { color: text }, splitLine: { lineStyle: { opacity: 0.2 } },
    },
    series: [{
      type: 'line', data: points, color: '#f05b4f', smooth: true, symbolSize: 7,
      areaStyle: { opacity: 0.3 },
    }],
  })
  chart.on('click', (p) => {
    if (p.data && p.data.campaign_id) window.location.href = '/campaigns/' + p.data.campaign_id
  })
}

function quickStats(c) {
  const future = new Date(c.launch_date).getTime() > Date.now()
  if (future) {
    return `Scheduled to start: ${campaignDate(c.launch_date)}\nRecipients: ${c.stats.total}`
  }
  return `Launch: ${campaignDate(c.launch_date)}\nRecipients: ${c.stats.total}\n` +
    `Opened: ${c.stats.opened} · Clicked: ${c.stats.clicked} · ` +
    `Submitted: ${c.stats.submitted_data} · Errors: ${c.stats.error} · Reported: ${c.stats.email_reported}`
}

function renderTable() {
  const data = campaigns.map((c) => {
    const badge = STATUS_BADGE[c.status] || 'text-bg-secondary'
    return [
      c.name,
      campaignDate(c.created_date),
      c.stats.sent, c.stats.opened, c.stats.clicked, c.stats.submitted_data, c.stats.email_reported,
      { status: c.status, badge, title: quickStats(c) },
      c.id,
    ]
  })
  new Grid({
    columns: [
      { name: 'Name' },
      { name: 'Created' },
      { name: 'Sent' }, { name: 'Opened' }, { name: 'Clicked' }, { name: 'Submitted' }, { name: 'Reported' },
      {
        name: 'Status',
        formatter: (cell) => html(
          `<span class="badge ${cell.badge}" title="${escapeHtml(cell.title)}">${escapeHtml(cell.status)}</span>`
        ),
      },
      {
        name: '', sort: false,
        formatter: (id) => html(
          `<div class="text-end">` +
          `<a class="btn btn-sm btn-outline-primary me-1" href="/campaigns/${id}" title="View Results"><i class="bi bi-bar-chart"></i></a>` +
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
  }).render(document.getElementById('campaignTable'))
}

async function deleteCampaign(id) {
  const c = campaigns.find((x) => x.id == id)
  if (!c) return
  if (!window.confirm(`Delete "${c.name}"?`)) return
  try {
    const data = await api.campaignId.delete(id)
    successFlash(data.message)
    location.reload()
  } catch (e) {
    errorFlash(e.message)
  }
}

function renderAll() {
  renderTimeline()
  renderStatsDonuts()
}

async function init() {
  try {
    const data = await api.campaigns.summary()
    document.getElementById('loading').classList.add('d-none')
    campaigns = data.campaigns || []
    if (campaigns.length === 0) {
      document.getElementById('emptyMessage').classList.remove('d-none')
      return
    }
    document.getElementById('dashboard').classList.remove('d-none')
    renderAll()
    renderTable()

    document.getElementById('campaignTable').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="delete"]')
      if (btn) deleteCampaign(btn.dataset.id)
    })

    window.addEventListener('resize', () => charts.forEach((c) => c.resize()))
    // Re-dibuja los charts al cambiar el tema (colores de ejes/texto).
    new MutationObserver(() => renderAll()).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-bs-theme'],
    })
  } catch (e) {
    document.getElementById('loading').classList.add('d-none')
    errorFlash('Error fetching campaigns')
  }
}

if (document.readyState !== 'loading') init()
else document.addEventListener('DOMContentLoaded', init)
