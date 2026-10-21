# ---------------------------------------------------------------------------
# Gophish - Dockerfile para despliegue interno
# ---------------------------------------------------------------------------

# 1) Minificado de assets de cliente (JS/CSS)
#    Node 18 LTS + flag de OpenSSL legacy para que webpack 4 / gulp 4 funcionen.
FROM node:18-bullseye AS build-js

ENV NODE_OPTIONS=--openssl-legacy-provider
RUN npm install gulp gulp-cli -g

WORKDIR /build
COPY . .
RUN npm install --only=dev
RUN gulp


# 2) Compilacion del binario Go (version pineada, reproducible)
FROM golang:1.23-bookworm AS build-golang

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
COPY --from=build-golang /src/ ./
COPY --from=build-js /build/static/js/dist/ ./static/js/dist/
COPY --from=build-js /build/static/css/dist/ ./static/css/dist/

# Directorio persistente para BD y certificados (montado como volumen en compose).
# Se crea aqui con el dueno correcto para que el volumen herede esos permisos.
RUN mkdir -p /opt/gophish/data && chown -R app:app /opt/gophish

# Permite escuchar en el puerto 80 sin privilegios de root
RUN setcap 'cap_net_bind_service=+ep' /opt/gophish/gophish

USER app
RUN touch config.json.tmp

EXPOSE 80 3333

CMD ["./docker/run.sh"]
