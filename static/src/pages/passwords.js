// NG-gophish - medidor de fortaleza de contrasena (compartido por settings y users).
import zxcvbn from 'zxcvbn'

const StrengthMapping = {
  0: { class: 'danger', width: '10%', status: 'Very Weak' },
  1: { class: 'danger', width: '25%', status: 'Very Weak' },
  2: { class: 'warning', width: '50%', status: 'Weak' },
  3: { class: 'success', width: '75%', status: 'Good' },
  4: { class: 'success', width: '100%', status: 'Very Good' },
}

// Inicializa el medidor sobre un input de contrasena. Espera (por defecto) estos
// elementos: #password, #password-strength-container, #password-strength-bar,
// #password-strength-description. Es tolerante: si faltan, no hace nada.
export function initPasswordStrength(inputId = 'password') {
  const input = document.getElementById(inputId)
  const container = document.getElementById('password-strength-container')
  const bar = document.getElementById('password-strength-bar')
  const description = document.getElementById('password-strength-description')
  if (!input || !container || !bar || !description) return

  input.addEventListener('input', (e) => {
    const candidate = e.target.value
    if (!candidate) {
      bar.style.width = '0'
      description.textContent = ''
      container.classList.add('d-none')
      return
    }
    const score = zxcvbn(candidate).score
    const evaluation = StrengthMapping[score]
    bar.className = `progress-bar bg-${evaluation.class}`
    bar.style.width = evaluation.width
    description.textContent = evaluation.status
    description.className = `text-${evaluation.class}`
    container.classList.remove('d-none')
  })
}
