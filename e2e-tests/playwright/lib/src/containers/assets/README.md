# Vendored assets

These files are copied from `server/build/` in the Mattermost monorepo so that
`@mattermost/playwright-lib`'s Testcontainers support is self-contained once published to npm
(it can't reach outside its own package at runtime). If the source files change, these copies
need to be refreshed manually — they are not symlinked or build-generated.

| File                         | Copied from                                      | Date       |
| ---------------------------- | ------------------------------------------------ | ---------- |
| `postgres.conf`              | `server/build/docker/postgres.conf`              | 2026-07-19 |
| `keycloak-realm-export.json` | `server/build/docker/keycloak/realm-export.json` | 2026-07-19 |
| `Dockerfile.elasticsearch`   | `server/build/Dockerfile.elasticsearch`          | 2026-07-19 |
| `Dockerfile.opensearch`      | `server/build/Dockerfile.opensearch`             | 2026-07-19 |
