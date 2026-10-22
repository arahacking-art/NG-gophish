// NG-gophish - entry principal de la UI moderna.
//
// Aqui se concentra el JavaScript base compartido por todas las pantallas.
// Bootstrap 5 ya NO depende de jQuery: se importa como modulos ES.

import * as bootstrap from 'bootstrap'

import { initTheme } from './theme.js'

// CSS de librerias centralizado aqui (todas las paginas modernas cargan main.css),
// para que las pantallas no dupliquen estos estilos.
import 'gridjs/dist/theme/mermaid.css'
import 'tom-select/dist/css/tom-select.bootstrap5.css'
import 'flatpickr/dist/flatpickr.min.css'
import './styles/main.scss'

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
