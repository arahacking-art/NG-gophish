// NG-gophish - entry principal de la UI moderna.
//
// Aqui se concentra el JavaScript base compartido por todas las pantallas.
// Bootstrap 5 ya NO depende de jQuery: se importa como modulos ES.

import * as bootstrap from 'bootstrap'

import './styles/main.scss'

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

document.addEventListener('DOMContentLoaded', () => initBootstrapWidgets())

export { bootstrap, initBootstrapWidgets }
