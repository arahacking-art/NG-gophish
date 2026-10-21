// NG-gophish - pagina Reset Password (autonoma, estilo auth).
import { initTheme } from '../theme.js'
import { initPasswordStrength } from './passwords.js'

document.addEventListener('DOMContentLoaded', () => {
  initTheme()
  initPasswordStrength('password')
})
