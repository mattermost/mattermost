# syntax=docker/dockerfile:1.7

# === Stage 1: build patched Mattermost Go server ===
FROM golang:1.25-bookworm AS server-builder

WORKDIR /src
COPY server /src/server

WORKDIR /src/server
# Set up go workspace (server + public submodule), bypassing the Makefile
RUN go work init && go work use . && go work use ./public

ENV GOOS=linux \
    GOARCH=amd64 \
    CGO_ENABLED=0

RUN go build -trimpath -tags 'production' -o /out/mattermost ./cmd/mattermost

# === Stage 2: final image ===
FROM --platform=linux/amd64 mattermost/mattermost-team-edition:11.6

# Replace server binary with patched build
COPY --from=server-builder /out/mattermost /mattermost/bin/mattermost

# Replace webapp
COPY webapp/channels/dist /mattermost/client
