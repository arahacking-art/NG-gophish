// NG-gophish - gestion de tema claro/oscuro.
//
// Usa el soporte nativo de Bootstrap 5.3 (atributo data-bs-theme en <html>).
// La preferencia se guarda en localStorage; si no hay, se sigue el sistema.

const STORAGE_KEY = 'ng-theme'

export function getStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme() {
  return getStoredTheme() || systemTheme()
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme)
  document.querySelectorAll('[data-ng-theme-toggle]').forEach((btn) => {
    const icon = btn.querySelector('i')
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill'
    }
    btn.setAttribute('aria-label', theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')
  })
}

export function setTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* almacenamiento no disponible: se aplica solo en memoria */
  }
  applyTheme(theme)
}

export function initTheme() {
  applyTheme(resolveTheme())

  document.querySelectorAll('[data-ng-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-bs-theme')
      setTheme(current === 'dark' ? 'light' : 'dark')
    })
  })

  // Seguir el sistema si el usuario no ha elegido explicitamente.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getStoredTheme()) applyTheme(systemTheme())
  })
}
