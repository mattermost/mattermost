# Setup del ambiente de desarrollo de Mattermost

Esta guía permite reproducir en Windows el ambiente utilizado por el grupo para desarrollar y validar los issues [#37406](https://github.com/mattermost/mattermost/issues/37406) y [#38480](https://github.com/mattermost/mattermost/issues/38480). Se utiliza **WSL2 con Ubuntu 24.04**, **VS Code conectado a WSL** y **Docker Engine instalado dentro de WSL**; no se requiere Docker Desktop.

## Base reproducible

| Elemento | Versión o valor |
|---|---|
| Repositorio | `https://github.com/agvor/mattermost` |
| Commit base | `53211e45b6e63e99a5cc64d1ce1b344e3b64cc51` |
| Mattermost | `12.0.0-dev` |
| Ubuntu | `24.04` sobre WSL2 |
| Go | `1.26.7` |
| Node.js | `24.11.1` |
| npm | `11.6.2` |
| URL local | `http://localhost:8065` |

Salvo que se indique PowerShell, todos los comandos se ejecutan dentro de Ubuntu WSL.

## 1. Instalar WSL2 y Ubuntu

Abrir PowerShell como administrador:

```powershell
wsl --install -d Ubuntu-24.04
wsl --update
```

Reiniciar Windows si se solicita, abrir Ubuntu y crear el usuario Linux. Confirmar desde PowerShell que la distribución usa WSL2:

```powershell
wsl --list --verbose
```

La columna `VERSION` debe mostrar `2`.

Dentro de Ubuntu, comprobar que `systemd` está activo:

```bash
ps -p 1 -o comm=
```

Si el resultado no es `systemd`, crear o modificar `/etc/wsl.conf`:

```ini
[boot]
systemd=true
```

Aplicar el cambio desde PowerShell y abrir nuevamente Ubuntu:

```powershell
wsl.exe --shutdown
```

## 2. Preparar VS Code

1. Instalar Visual Studio Code en Windows.
2. Instalar la extensión oficial **WSL** de Microsoft.
3. Mantener el repositorio bajo `/home/<usuario>` y no bajo `/mnt/c`.
4. Abrir el repositorio desde Ubuntu con `code .`.
5. Confirmar que VS Code indique una conexión WSL en la esquina inferior izquierda.

## 3. Instalar herramientas base

```bash
sudo apt update
sudo apt install -y build-essential git curl ca-certificates libpng-dev
```

## 4. Instalar Docker Engine en WSL

Seguir la guía oficial [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/) y completar la instalación de:

- Docker Engine.
- Docker CLI.
- `containerd`.
- Docker Buildx.
- Docker Compose plugin.

No instalar ni integrar Docker Desktop. El daemon debe ejecutarse dentro de Ubuntu WSL.

Después de instalar Docker, seguir la sección oficial [Manage Docker as a non-root user](https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user). Como mínimo:

```bash
sudo groupadd docker 2>/dev/null || true
sudo usermod -aG docker "$USER"
```

El grupo `docker` concede privilegios equivalentes a `root`; debe utilizarse únicamente en un ambiente de desarrollo controlado. Cerrar la sesión de Ubuntu y abrirla nuevamente. Si el cambio de grupo no se refleja, ejecutar desde PowerShell:

```powershell
wsl.exe --shutdown
```

Validar dentro de Ubuntu que Docker funcione **sin `sudo`**:

```bash
id
docker --version
docker compose version
docker info
docker run --rm hello-world
```

No continuar si `docker info` muestra `permission denied` o no logra conectarse al daemon.

## 5. Clonar el fork y fijar la base

```bash
mkdir -p "$HOME/projects"
cd "$HOME/projects"
git clone https://github.com/agvor/mattermost.git
cd mattermost
git checkout 53211e45b6e63e99a5cc64d1ce1b344e3b64cc51
git rev-parse HEAD
```

El último comando debe imprimir exactamente el commit indicado. Abrir el repositorio:

```bash
code .
```

Para desarrollar, crear una rama a partir de esta base; no hacer cambios directamente sobre el commit separado (`detached HEAD`).

## 6. Instalar Node.js con NVM

Instalar [NVM](https://github.com/nvm-sh/nvm) siguiendo su documentación oficial. Después, desde la raíz del repositorio:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd "$HOME/projects/mattermost"
nvm install
nvm use
node --version
npm --version
```

Resultados esperados:

```text
v24.11.1
11.6.2
```

## 7. Instalar Go

Instalar Go `1.26.7` desde las [descargas oficiales](https://go.dev/dl/). En este ambiente se instaló bajo el usuario Linux:

```bash
cd /tmp
curl -fLO https://go.dev/dl/go1.26.7.linux-amd64.tar.gz
mkdir -p "$HOME/.local/go1.26.7"
tar -xzf go1.26.7.linux-amd64.tar.gz \
  --strip-components=1 -C "$HOME/.local/go1.26.7"
echo 'export PATH="$HOME/.local/go1.26.7/bin:$PATH"' >> "$HOME/.bashrc"
source "$HOME/.bashrc"
command -v go
go version
```

Resultado esperado:

```text
go version go1.26.7 linux/amd64
```

## 8. Verificar el puerto de PostgreSQL

Mattermost inicia PostgreSQL mediante Docker. Comprobar que el puerto `5432` esté libre:

```bash
ss -ltnp 'sport = :5432'
```

Si existe una instalación nativa de PostgreSQL en ejecución, detenerla de forma reversible:

```bash
sudo systemctl disable --now postgresql
ss -ltnp 'sport = :5432'
```

No es necesario desinstalar PostgreSQL ni borrar sus datos.

## 9. Construir el frontend

```bash
cd "$HOME/projects/mattermost/webapp"
nvm use
make dist
```

El build fue exitoso si termina con código `0` y muestra `Web app built!`.

## 10. Construir el servidor

```bash
cd "$HOME/projects/mattermost/server"
export PATH="$HOME/.local/go1.26.7/bin:$PATH"
command -v go
go version
make build-linux-amd64
```

Validar los binarios:

```bash
test -x bin/mattermost && echo 'mattermost OK'
test -x bin/mmctl && echo 'mmctl OK'
```

## 11. Ejecutar Mattermost

En una primera terminal:

```bash
cd "$HOME/projects/mattermost/server"
export PATH="$HOME/.local/go1.26.7/bin:$PATH"
make run-server RUN_SERVER_IN_BACKGROUND=false
```

Esperar hasta observar:

```text
Server is listening on [::]:8065
```

En una segunda terminal, verificar el servidor:

```bash
curl --fail --silent --show-error \
  http://localhost:8065/api/v4/system/ping
```

La respuesta debe contener `"status":"OK"`. Abrir `http://localhost:8065` en el navegador de Windows y crear el primer usuario desde la interfaz. No guardar contraseñas en Git ni mostrarlas en capturas.

## 12. Desarrollo del frontend

Para validar el estado base basta con `make dist`. Al modificar el frontend, mantener el servidor activo y ejecutar en otra terminal:

```bash
cd "$HOME/projects/mattermost/webapp"
nvm use
make run
```

## 13. Detener el ambiente

Detener el proceso en primer plano con `Ctrl+C` y luego ejecutar:

```bash
cd "$HOME/projects/mattermost/server"
make stop-server
make stop-docker
```

## Solución rápida de problemas

### `make: go: No such file or directory`

La terminal no tiene Go en `PATH`:

```bash
export PATH="$HOME/.local/go1.26.7/bin:$PATH"
command -v go
go version
```

### Docker requiere `sudo` o muestra `permission denied`

Repetir la posinstalación oficial del paso 4, cerrar completamente WSL con `wsl.exe --shutdown` y validar que `id` incluya el grupo `docker`.

## Lista de verificación

- [ ] Ubuntu 24.04 se ejecuta sobre WSL2 con `systemd`.
- [ ] VS Code está conectado a WSL.
- [ ] El repositorio está en el filesystem Linux y en el commit base acordado.
- [ ] Node.js muestra `v24.11.1` y npm `11.6.2`.
- [ ] Go muestra `1.26.7`.
- [ ] `docker info` y `hello-world` funcionan sin `sudo`.
- [ ] El puerto `5432` está libre antes del arranque.
- [ ] Los builds del frontend y del servidor terminan exitosamente.
- [ ] El ping de Mattermost contiene `"status":"OK"`.
- [ ] `http://localhost:8065` muestra la interfaz.

## Referencias

- [Mattermost: Developer setup](https://developers.mattermost.com/contribute/developer-setup/)
- [Microsoft: instalar WSL](https://learn.microsoft.com/windows/wsl/install)
- [Microsoft: systemd en WSL](https://learn.microsoft.com/windows/wsl/systemd)
- [Visual Studio Code: desarrollar en WSL](https://code.visualstudio.com/docs/remote/wsl)
- [Docker Engine: instalación en Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker Engine: posinstalación en Linux](https://docs.docker.com/engine/install/linux-postinstall/)
- [Go: descargas oficiales](https://go.dev/dl/)
- [NVM: repositorio oficial](https://github.com/nvm-sh/nvm)
