// NG-gophish - helpers de UI compartidos (Bootstrap 5).
import { Modal } from 'bootstrap'

// confirmDialog muestra un modal BS5 de confirmacion y resuelve a true/false.
// Reemplaza window.confirm con un dialogo consistente y accesible.
//
//   if (!(await confirmDialog({ body: '¿Borrar?' }))) return
export function confirmDialog({
  title = 'Confirm',
  body = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmClass = 'btn-danger',
} = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div')
    wrap.className = 'modal fade'
    wrap.tabIndex = -1
    wrap.innerHTML =
      '<div class="modal-dialog modal-dialog-centered">' +
      '<div class="modal-content">' +
      '<div class="modal-header"><h5 class="modal-title"></h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body" style="white-space: pre-line;"></div>' +
      '<div class="modal-footer">' +
      '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal"></button>' +
      '<button type="button" class="btn" data-ng-confirm></button>' +
      '</div></div></div>'

    // textContent evita inyeccion de HTML en los mensajes.
    wrap.querySelector('.modal-title').textContent = title
    wrap.querySelector('.modal-body').textContent = body
    const cancelBtn = wrap.querySelector('.btn-secondary')
    if (cancelText) {
      cancelBtn.textContent = cancelText
    } else {
      cancelBtn.remove()
    }
    const confirmBtn = wrap.querySelector('[data-ng-confirm]')
    confirmBtn.textContent = confirmText
    confirmBtn.classList.add(...confirmClass.split(' '))

    document.body.appendChild(wrap)
    const modal = new Modal(wrap)
    let result = false
    confirmBtn.addEventListener('click', () => { result = true; modal.hide() })
    wrap.addEventListener('hidden.bs.modal', () => { wrap.remove(); resolve(result) })
    modal.show()
  })
}

// alertDialog: aviso simple con un solo boton (OK), resuelve al cerrarse.
export function alertDialog({ title = 'Notice', body = '', okText = 'OK', okClass = 'btn-primary' } = {}) {
  return confirmDialog({ title, body, confirmText: okText, confirmClass: okClass, cancelText: null })
}
