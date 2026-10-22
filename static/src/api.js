// NG-gophish - capa de acceso a la API REST (sin jQuery).
//
// Reemplaza el query()/api de static/js/src/app/gophish.js (basado en
// jQuery.ajax, muchas llamadas sincronas) por fetch con Promesas nativas.
// Las pantallas migradas consumen estos metodos con async/await.

/**
 * Realiza una peticion a /api<endpoint>. Devuelve el JSON parseado.
 * Lanza un Error (con .message del servidor si lo hay) en respuestas != 2xx.
 */
export async function query(endpoint, method = 'GET', data = undefined) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  }
  const apiKey = window.user && window.user.api_key
  if (apiKey) {
    opts.headers.Authorization = 'Bearer ' + apiKey
  }
  if (data !== undefined && method !== 'GET') {
    opts.body = JSON.stringify(data)
  }

  const res = await fetch('/api' + endpoint, opts)
  const text = await res.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  if (!res.ok) {
    const message = (body && body.message) || res.statusText || 'Request failed'
    const err = new Error(message)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

// ---------------------------------------------------------------------------
// Endpoints (misma forma que el api legacy para facilitar la migracion)
// ---------------------------------------------------------------------------
export const api = {
  campaigns: {
    get: () => query('/campaigns/', 'GET'),
    post: (data) => query('/campaigns/', 'POST', data),
    summary: () => query('/campaigns/summary', 'GET'),
  },
  campaignId: {
    get: (id) => query('/campaigns/' + id, 'GET'),
    delete: (id) => query('/campaigns/' + id, 'DELETE'),
    results: (id) => query('/campaigns/' + id + '/results', 'GET'),
    complete: (id) => query('/campaigns/' + id + '/complete', 'GET'),
    summary: (id) => query('/campaigns/' + id + '/summary', 'GET'),
  },
  groups: {
    get: () => query('/groups/', 'GET'),
    post: (group) => query('/groups/', 'POST', group),
    summary: () => query('/groups/summary', 'GET'),
  },
  groupId: {
    get: (id) => query('/groups/' + id, 'GET'),
    put: (group) => query('/groups/' + group.id, 'PUT', group),
    delete: (id) => query('/groups/' + id, 'DELETE'),
  },
  templates: {
    get: () => query('/templates/', 'GET'),
    post: (template) => query('/templates/', 'POST', template),
  },
  templateId: {
    get: (id) => query('/templates/' + id, 'GET'),
    put: (template) => query('/templates/' + template.id, 'PUT', template),
    delete: (id) => query('/templates/' + id, 'DELETE'),
  },
  pages: {
    get: () => query('/pages/', 'GET'),
    post: (page) => query('/pages/', 'POST', page),
  },
  pageId: {
    get: (id) => query('/pages/' + id, 'GET'),
    put: (page) => query('/pages/' + page.id, 'PUT', page),
    delete: (id) => query('/pages/' + id, 'DELETE'),
  },
  SMTP: {
    get: () => query('/smtp/', 'GET'),
    post: (smtp) => query('/smtp/', 'POST', smtp),
  },
  SMTPId: {
    get: (id) => query('/smtp/' + id, 'GET'),
    put: (smtp) => query('/smtp/' + smtp.id, 'PUT', smtp),
    delete: (id) => query('/smtp/' + id, 'DELETE'),
  },
  IMAP: {
    get: () => query('/imap/', 'GET'),
    post: (imap) => query('/imap/', 'POST', imap),
    validate: (imap) => query('/imap/validate', 'POST', imap),
  },
  users: {
    get: () => query('/users/', 'GET'),
    post: (u) => query('/users/', 'POST', u),
  },
  userId: {
    get: (id) => query('/users/' + id, 'GET'),
    put: (u) => query('/users/' + u.id, 'PUT', u),
    delete: (id) => query('/users/' + id, 'DELETE'),
  },
  webhooks: {
    get: () => query('/webhooks/', 'GET'),
    post: (webhook) => query('/webhooks/', 'POST', webhook),
  },
  webhookId: {
    get: (id) => query('/webhooks/' + id, 'GET'),
    put: (webhook) => query('/webhooks/' + webhook.id, 'PUT', webhook),
    delete: (id) => query('/webhooks/' + id, 'DELETE'),
    ping: (id) => query('/webhooks/' + id + '/validate', 'POST', {}),
  },
  import_email: (req) => query('/import/email', 'POST', req),
  clone_site: (req) => query('/import/site', 'POST', req),
  send_test_email: (req) => query('/util/send_test_email', 'POST', req),
  reset: () => query('/reset', 'POST', {}),
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
export function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text == null ? '' : String(text)
  return div.innerHTML
}

export function unescapeHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html == null ? '' : String(html)
  return div.textContent
}

export function capitalize(string) {
  if (!string) return string
  return string.charAt(0).toUpperCase() + string.slice(1)
}

// ---------------------------------------------------------------------------
// Mensajes flash (alertas Bootstrap 5)
// ---------------------------------------------------------------------------
const FLASH_ICONS = {
  danger: 'bi-exclamation-circle',
  success: 'bi-check-circle',
  warning: 'bi-exclamation-triangle',
  info: 'bi-info-circle',
}

function renderFlash(targetId, type, message) {
  const container = document.getElementById(targetId)
  if (!container) return null
  const icon = FLASH_ICONS[type] || FLASH_ICONS.info
  container.innerHTML =
    `<div class="alert alert-${type} text-center" role="alert">` +
    `<i class="bi ${icon} me-1"></i> ${escapeHtml(message)}</div>`
  return container
}

export function errorFlash(message) {
  renderFlash('flashes', 'danger', message)
}

export function successFlash(message) {
  renderFlash('flashes', 'success', message)
}

export function errorFlashFade(message, fade) {
  const c = renderFlash('flashes', 'danger', message)
  if (c) setTimeout(() => { c.innerHTML = '' }, fade * 1000)
}

export function successFlashFade(message, fade) {
  const c = renderFlash('flashes', 'success', message)
  if (c) setTimeout(() => { c.innerHTML = '' }, fade * 1000)
}

export function modalError(message) {
  renderFlash('modal.flashes', 'danger', message)
}
