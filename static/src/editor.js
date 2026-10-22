// NG-gophish - editor HTML compartido (CodeMirror 6), reemplaza a CKEditor.
//
// Lo usan templates y landing_pages para editar el HTML fuente de emails y
// paginas de destino, con resaltado de sintaxis, modo oscuro y vista previa.
import { EditorView, basicSetup } from 'codemirror'
import { html } from '@codemirror/lang-html'
import { EditorState, Compartment } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'

function isDark() {
  return document.documentElement.getAttribute('data-bs-theme') === 'dark'
}

// createHtmlEditor monta un editor CodeMirror dentro de `parent`.
// Devuelve { view, getValue, setValue, destroy }.
export function createHtmlEditor({ parent, doc = '', onChange } = {}) {
  const themeComp = new Compartment()

  const updateListener = EditorView.updateListener.of((v) => {
    if (v.docChanged && typeof onChange === 'function') {
      onChange(v.state.doc.toString())
    }
  })

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        html(),
        EditorView.lineWrapping,
        themeComp.of(isDark() ? oneDark : []),
        updateListener,
      ],
    }),
  })

  // Cambia el tema del editor cuando cambia el tema de la app.
  const observer = new MutationObserver(() => {
    view.dispatch({ effects: themeComp.reconfigure(isDark() ? oneDark : []) })
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] })

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (value) => {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value || '' } })
    },
    destroy: () => {
      observer.disconnect()
      view.destroy()
    },
  }
}

// renderPreview vuelca el HTML dado en un iframe de forma aislada (sandbox).
export function renderPreview(iframe, htmlString) {
  if (!iframe) return
  iframe.srcdoc = htmlString || ''
}
