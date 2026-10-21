# Despliegue interno de Gophish

Dos métodos soportados. El **panel de administración queda siempre en loopback**
(`127.0.0.1:3333`, TLS); se accede por túnel SSH. El **servidor de phishing**
escucha en el puerto 80 de la LAN interna para que las landing pages sean
alcanzables por los objetivos.

Acceso al admin desde tu equipo (ambos métodos):

```bash
ssh -L 3333:127.0.0.1:3333 usuario@servidor
# luego abre https://127.0.0.1:3333  (acepta el cert self-signed)
```

La contraseña inicial de `admin` se imprime en los logs en el primer arranque y
se **regenera en cada reinicio hasta que entres y la cambies** (comportamiento
normal de Gophish). Para fijarla, usa `GOPHISH_INITIAL_ADMIN_PASSWORD`.

---

## Opción A — Docker Compose

```bash
# Antes: edita docker-compose.yml y pon tu CONTACT_ADDRESS real.
docker compose build
docker compose up -d
docker compose logs -f gophish        # ver la contraseña inicial de admin
```

- Estado persistente (BD SQLite + certificados) en el volumen `gophish-data`.
- El admin solo se expone en `127.0.0.1:3333` del host (ver mapeo de puertos).
- Parar: `docker compose down` (los datos sobreviven en el volumen).

---

## Opción B — systemd (binario nativo)

```bash
# 1) Compilar (en una máquina con Go + yarn, o copia el binario ya compilado)
go build -o gophish .

# 2) Crear usuario de servicio sin shell de login
sudo useradd --system --home /opt/gophish --shell /usr/sbin/nologin gophish

# 3) Instalar en /opt/gophish
sudo mkdir -p /opt/gophish
sudo cp -r gophish db static templates VERSION /opt/gophish/
sudo cp deploy/config.prod.json /opt/gophish/config.json
#    -> edita /opt/gophish/config.json y pon tu contact_address real
sudo chown -R gophish:gophish /opt/gophish

# 4) Instalar y arrancar el servicio
sudo cp deploy/gophish.service /etc/systemd/system/gophish.service
sudo systemctl daemon-reload
sudo systemctl enable --now gophish

# 5) Ver logs (incluida la contraseña inicial de admin)
sudo journalctl -u gophish -f
```

El puerto 80 se concede vía `AmbientCapabilities=CAP_NET_BIND_SERVICE` en el
unit: **Gophish no corre como root**. El unit incluye además sandboxing de
systemd (`ProtectSystem=strict`, `NoNewPrivileges`, filtro de syscalls, etc.).

Para fijar la contraseña inicial de admin, añade al `[Service]` del unit:

```ini
Environment=GOPHISH_INITIAL_ADMIN_PASSWORD=tu-password-fuerte
```

---

## Notas de seguridad (uso interno autorizado)

- Usa Gophish **solo** para simulaciones de phishing autorizadas dentro de tu
  organización (concienciación). Deja constancia de la autorización.
- Mantén el admin en loopback. No lo expongas a Internet.
- Cambia la contraseña de admin en el primer login.
- Rellena `contact_address`: aparece en una página de aviso para quien reporte
  el correo, dejando claro que es un ejercicio interno.
