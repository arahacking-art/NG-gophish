// NG-gophish - entry principal de la UI moderna.
//
// Aqui se concentra el JavaScript base compartido por todas las pantallas.
// Bootstrap 5 ya NO depende de jQuery: se importa como modulos ES.

import * as bootstrap from 'bootstrap'

import { initTheme } from './theme.js'
import { exposeGlobals } from './api.js'

// Theme de Grid.js centralizado aqui (todas las paginas modernas cargan main.css),
// para que las pantallas con tabla no dupliquen este CSS.
import 'gridjs/dist/theme/mermaid.css'
import './styles/main.scss'

// Expone api/helpers en window para el codigo de pagina en transicion.
exposeGlobals()

// Exponer Bootstrap en window para el codigo de pagina que aun no es modular
// (se ira eliminando conforme avancen las fases de migracion).
window.bootstrap = bootstrap

// Activa tooltips y popovers declarativos ([data-bs-toggle]) en toda la app.
function initBootstrapWidgets(root = document) {
  root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    bootstrap.Tooltip.getOrCreateInstance(el)
  })
  root.querySelectorAll('[data-bs-toggle="popover"]').forEach((el) => {
    bootstrap.Popover.getOrCreateInstance(el)
  })
}

// Marca como activo el enlace del sidebar que corresponde a la ruta actual.
function initActiveNav() {
  const path = window.location.pathname
  document.querySelectorAll('.ng-nav .nav-link').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href || href.startsWith('http')) return
    const isActive = href === '/' ? path === '/' : path.startsWith(href)
    if (isActive) link.classList.add('active')
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme()
  initActiveNav()
  initBootstrapWidgets()
})

export { bootstrap, initBootstrapWidgets }
