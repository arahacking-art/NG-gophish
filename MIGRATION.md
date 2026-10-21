# NG-gophish — Roadmap de modernización de la UI

Modernización comunitaria de la interfaz de Gophish. El objetivo es una UI
actual, accesible y 100 % libre (FOSS), eliminando dependencias obsoletas.

> Gophish es un framework para **simulaciones de phishing autorizadas**
> (concienciación en seguridad). Úsalo solo con autorización.

## Stack: de dónde venimos → a dónde vamos

| Área | Antes | Después |
|---|---|---|
| CSS framework | Bootstrap 3.3.7 (tema flat-ui) | **Bootstrap 5.3** (modo oscuro nativo) |
| DOM / JS | jQuery 1.10.2 (591 llamadas `$()`) | **Vanilla JS** (sin jQuery) |
| Build | gulp 4 + webpack 4 | **Vite** |
| Gráficas | Highcharts (licencia no libre) | **Apache ECharts** (Apache-2.0) |
| Selects | select2 | **Tom Select** |
| Tablas | DataTables | **Grid.js** |
| Fechas | bootstrap-datetime + moment | **flatpickr** |

## Fases

- [x] **Fase 0 — Fundación**: Vite + Bootstrap 5.3 + capa de tokens CSS + modo oscuro.
- [x] **Fase 1 — Chrome común**: `base.html`, `nav.html`, `login.html` (piloto). *(`flashes.html` se migra en Fase 2.)*
- [x] **Fase 2 — Pantallas simples**: dashboard (ECharts), reset_password, webhooks, users, settings. *(capa `api.js` fetch compartida; `flashes.html` se limpia en Fase 5.)*
- [ ] **Fase 3 — Pantallas con tablas**: groups, landing_pages, sending_profiles, templates, campaigns.
- [ ] **Fase 4 — Resultados de campaña**: `campaign_results` (mapa, gráficas y tablas).
- [ ] **Fase 5 — Limpieza**: eliminar jQuery y vendor obsoleto, QA final.

## Principios

- **Incremental**: una pantalla por rama/PR, revisable y reversible.
- **Sin regresiones funcionales**: la API y el backend Go no se tocan salvo necesidad.
- **Verificación manual** de cada pantalla (no hay tests de UI todavía; añadirlos es bienvenido).
- **FOSS**: sin dependencias con licencias restrictivas.

## Cómo seguir el upstream

El remoto `upstream` apunta a `gophish/gophish`. Para traer parches del original:

```bash
git fetch upstream
git merge upstream/master   # o cherry-pick de commits concretos
```
