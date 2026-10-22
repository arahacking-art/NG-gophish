# ---------------------------------------------------------------------------
# NG-gophish - Dockerfile para despliegue interno
# ---------------------------------------------------------------------------

# 1) Build de assets de cliente con Vite (Bootstrap 5, sin jQuery).
FROM node:20-bookworm AS build-js

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build


# 2) Compilacion del binario Go (version pineada, reproducible)
FROM golang:1.26-bookworm AS build-golang

WORKDIR /src
COPY . .
# CGO activado (lo necesita el driver sqlite3)
RUN CGO_ENABLED=1 go build -o gophish -v .


# 3) Imagen de runtime
FROM debian:stable-slim

RUN useradd -m -d /opt/gophish -s /bin/bash app

RUN apt-get update && \
	apt-get install --no-install-recommends -y jq libcap2-bin ca-certificates && \
	apt-get clean && \
	rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /opt/gophish
COPY --from=build-golang /src/gophish ./gophish
COPY --from=build-golang /src/config.json ./config.json
COPY --from=build-golang /src/VERSION ./VERSION
COPY --from=build-golang /src/db/ ./db/
COPY --from=build-golang /src/templates/ ./templates/
COPY --from=build-golang /src/static/db/ ./static/db/
COPY --from=build-golang /src/static/endpoint/ ./static/endpoint/
COPY --from=build-golang /src/static/images/ ./static/images/
COPY --from=build-golang /src/docker/ ./docker/
# Assets compilados por Vite (el servidor Go los sirve en /dist/*).
COPY --from=build-js /build/static/dist/ ./static/dist/

# Directorio persistente para BD y certificados (montado como volumen en compose).
RUN mkdir -p /opt/gophish/data && \
	touch /opt/gophish/config.json.tmp && \
	chown -R root:app /opt/gophish && \
	chmod -R g+rX,o-rwx /opt/gophish && \
	chown -R app:app /opt/gophish/data /opt/gophish/config.json /opt/gophish/config.json.tmp /opt/gophish/static/endpoint

# Permite escuchar en el puerto 80 sin privilegios de root
RUN setcap 'cap_net_bind_service=+ep' /opt/gophish/gophish

USER app

EXPOSE 80 3333

CMD ["./docker/run.sh"]
