# [![Mattermost logo](https://user-images.githubusercontent.com/7205829/137170381-fe86eef0-bccc-4fdd-8e92-b258884ebdd7.png)](https://mattermost.com)

I just add OIDC Auth for LDAP/Keycloak support and will do fix some UI

## Примечание по лицензированию Mattermost

Mattermost использует гибридную модель лицензирования.

Официальные собранные бинарные версии Mattermost, распространяемые Mattermost, Inc., могут использоваться в соответствии с условиями MIT-COMPILED-LICENSE.

Однако модификация исходного кода Mattermost может подпадать под требования лицензии GNU AGPL v3.

Требования AGPL могут применяться, если вы:

- модифицируете исходный код Mattermost;
- собираете и распространяете изменённую версию Mattermost;
- предоставляете пользователям сетевой сервис на основе модифицированного Mattermost;
- создаёте производную работу на основе core-компонентов Mattermost.

В таких случаях исходный код модификаций может подлежать обязательному раскрытию в соответствии с условиями AGPLv3.

Данный репозиторий не заявляет никаких прав на товарные знаки Mattermost.  
“Mattermost” и связанные обозначения принадлежат Mattermost, Inc.

Официальная информация:
- https://mattermost.com/licensing/
- https://mattermost.com/trademark-standards-of-use/

## Mattermost Licensing Notes

Mattermost uses a hybrid licensing model.

Official compiled Mattermost binaries provided by Mattermost, Inc. can be used under the terms described in the MIT-COMPILED-LICENSE.

However, modifications to the Mattermost source code may fall under the GNU AGPL v3 license obligations.

AGPL obligations may apply if you:

- modify Mattermost source code;
- build and distribute a modified Mattermost binary;
- provide a modified Mattermost-based network service;
- or create a derivative work based on Mattermost core components.

In such cases, the corresponding modified source code may need to be made available under AGPLv3 terms.

This repository does not claim ownership of Mattermost trademarks.  
“Mattermost” and related marks belong to Mattermost, Inc.

For official licensing details, see:
- https://mattermost.com/licensing/
- https://mattermost.com/trademark-standards-of-use/


## Docs
If you need to install Docker Image:
```sh
docker image inspect asia-southeast3-docker.pkg.dev/gcloud-production-1/mattermost/mattermost:public-pached-11.7
```

## How to build the binary locally

Go to the server module:

```sh
cd server
```

If `go.work` is missing for some reason, create it once:

```sh
go work init
go work use .
go work use ./public
```

Build a binary for your machine, mostly to check that everything compiles:

```sh
go build -buildvcs=false -o ./bin/mattermost ./cmd/mattermost
```

Check it:

```sh
./bin/mattermost version
```

If you need the same linux binary that goes into the Docker image:

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	go build -buildvcs=false -ldflags='-s -w' \
	-o ./bin/mattermost-linux-amd64 \
	./cmd/mattermost
```

Or build only the binary inside Docker, without building the full image:

```sh
docker run --rm \
	-v "$PWD/server:/src/server" \
	-v gomod-cache:/go/pkg/mod \
	-v gobuild-cache:/root/.cache/go-build \
	-w /src/server \
	golang:1.26-alpine \
	sh -lc 'go work init 2>/dev/null || true; go work use . ./public; CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -buildvcs=false -ldflags="-s -w" -o ./bin/mattermost-linux-amd64 ./cmd/mattermost'
```

Short version: for a quick compile check, `go build ./cmd/mattermost` is usually enough. For the container, build with `GOOS=linux GOARCH=amd64`.

## How to run the container

If you changed code and want to test it locally, build the full Docker image from the repo root with the same tag that compose already uses:

```sh
docker build \
	-f Dockerfile.team-patch \
	-t asia-southeast3-docker.pkg.dev/gcloud-production-1/mattermost/mattermost:public-pached-11.7 \
	.
```

Then recreate only the patched Mattermost container:

```sh
cd /Users/pilprod/Projects/chatops/mvp
docker compose up -d --force-recreate --no-deps mattermost-patched
```

After push to `public-pached-11.7`, Cloud Build publishes this image:

```sh
asia-southeast3-docker.pkg.dev/gcloud-production-1/mattermost/mattermost:public-pached-11.7
```

On the server, pull it and recreate only the patched Mattermost container:

```sh
cd ~/chat-stack
docker compose pull mattermost-patched
docker compose up -d --force-recreate mattermost-patched
```

Quick check after restart:

```sh
docker compose logs -f --tail=100 mattermost-patched
```

