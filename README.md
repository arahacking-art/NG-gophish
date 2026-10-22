NG-gophish
==========

![CI](https://github.com/arahacking-art/NG-gophish/workflows/CI/badge.svg)

Modernización comunitaria de la interfaz de administración de
[Gophish](https://github.com/gophish/gophish), el framework open-source de
simulación de phishing para programas de concienciación en seguridad.

> ⚠️ Úsalo **solo** para simulaciones de phishing **autorizadas** dentro de tu
> organización. Deja constancia de la autorización.

El backend en Go es el de Gophish (sin cambios). Lo que cambia es toda la UI:

| Antes | Ahora |
|---|---|
| Bootstrap 3 + jQuery | **Bootstrap 5.3 + Vanilla JS** (modo oscuro) |
| gulp + webpack | **Vite** |
| Highcharts / select2 / DataTables / CKEditor | **ECharts / Tom Select / Grid.js / CodeMirror 6** (todo FOSS) |

## Build

Requisitos: **Go 1.21+** y **Node 18+**.

```bash
npm ci          # dependencias de frontend
npm run build   # compila la UI a static/dist/ (con Vite)
go build -o gophish .
./gophish        # abre https://127.0.0.1:3333 (usuario/clave en el log)
```

## Despliegue

Guía completa (Docker Compose y systemd, con el admin en loopback) en
[`deploy/README.md`](deploy/README.md). Resumen con Docker:

```bash
docker compose build
docker compose up -d
docker compose logs -f gophish   # muestra la contraseña inicial de admin
```

## Licencia

MIT — ver [`LICENSE`](LICENSE). Gophish es obra original de Jordan Wright.
