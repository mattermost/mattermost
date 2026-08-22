# Test Plan — @mattermost/testcontainers

## Behavior Tests (CLI Commands)

### `start`

| #   | Scenario                                                         | Expected                                                                                 |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Basic start (no options)                                         | Starts postgres, inbucket, and Mattermost container. Writes `.tc.out/` artifacts.        |
| 2   | Start with dependencies (`-D openldap,minio`)                    | Starts requested deps alongside postgres + inbucket.                                     |
| 3   | Start in HA mode (`--ha`)                                        | Starts multiple Mattermost nodes + nginx load balancer. Requires `MM_LICENSE`.           |
| 4   | Start with subpath (`--subpath`)                                 | Starts two Mattermost servers behind nginx with `/mattermost1` and `/mattermost2` paths. |
| 5   | Start subpath + HA (`--subpath --ha`)                            | Server1 runs as HA cluster behind nginx; server2 runs single-node.                       |
| 6   | Start deps-only (`--deps-only`)                                  | Starts dependencies only; no Mattermost container. Outputs `.env.tc` for local server.   |
| 7   | Start with admin (`--admin`)                                     | Creates default admin user after server starts.                                          |
| 8   | Start with custom admin (`--admin myuser --admin-password P@ss`) | Creates admin with specified credentials.                                                |
| 9   | Start with env vars (`-E MM_SERVICESETTINGS_ENABLETESTING=true`) | Passes env vars to Mattermost container.                                                 |
| 10  | Start with config file (`mm-tc.config.mjs`)                      | Auto-discovers config, applies settings.                                                 |
| 11  | Start with edition (`--edition team`)                            | Uses team edition image.                                                                 |
| 12  | Start with tag (`--tag v10.0.0`)                                 | Uses specific image tag.                                                                 |

### `stop`

| #   | Scenario                         | Expected                                    |
| --- | -------------------------------- | ------------------------------------------- |
| 1   | Stop running environment         | All containers and network stop gracefully. |
| 2   | Stop already-stopped environment | No error; idempotent.                       |

### `restart`

| #   | Scenario                    | Expected                                                   |
| --- | --------------------------- | ---------------------------------------------------------- |
| 1   | Restart running environment | Dependencies restart first, then servers. Ports preserved. |
| 2   | Restart with subpath        | Health check passes for subpath URLs after restart.        |
| 3   | Config diff generated       | Before/after config saved to `.tc.out/`.                   |

### `rm` / `rm-all`

| #   | Scenario                      | Expected                                                             |
| --- | ----------------------------- | -------------------------------------------------------------------- |
| 1   | `rm` with confirmation prompt | Prompts user; removes containers + networks + output dir on confirm. |
| 2   | `rm -y` (skip confirmation)   | Removes immediately without prompt.                                  |
| 3   | `rm-all`                      | Removes all testcontainers-labeled containers and networks.          |

### `upgrade`

| #   | Scenario                  | Expected                                                    |
| --- | ------------------------- | ----------------------------------------------------------- |
| 1   | Upgrade to new image      | Swaps Mattermost image; preserves port mapping and network. |
| 2   | Config diff after upgrade | Saves before/after server config diff.                      |

### `info`

| #   | Scenario | Expected                                                      |
| --- | -------- | ------------------------------------------------------------- |
| 1   | `info`   | Displays dependency list, image versions, and usage examples. |

## Usability Tests (Developer Experience)

| #   | Scenario                                    | Expected                                                             |
| --- | ------------------------------------------- | -------------------------------------------------------------------- |
| 1   | First-run (no config file)                  | Defaults work out of the box; postgres + inbucket start.             |
| 2   | Invalid combo: HA without `MM_LICENSE`      | Clear error message explaining license requirement.                  |
| 3   | Invalid combo: elasticsearch + opensearch   | Clear error: only one search engine allowed.                         |
| 4   | Invalid combo: dejavu without search engine | Clear error: dejavu requires elasticsearch or opensearch.            |
| 5   | Invalid combo: loki without promtail        | Clear error: loki and promtail must be paired.                       |
| 6   | Invalid combo: grafana without data source  | Clear error: grafana needs prometheus or loki.                       |
| 7   | Invalid combo: redis without license        | Clear error: redis requires `MM_LICENSE`.                            |
| 8   | Output readability                          | Connection info, progress logs, and timing are human-readable.       |
| 9   | Config file auto-discovery                  | Walks up to git root looking for `mm-tc.config.mjs`.                 |
| 10  | npx experience                              | `npx @mattermost/testcontainers start` works without global install. |

## Unit Tests (Automated)

See `src/**/*.test.ts` files. Run with `npm test`.

| File                                    | Coverage                                   |
| --------------------------------------- | ------------------------------------------ |
| `src/utils/docker-cli.test.ts`          | `validateContainerId`, `validateNetworkId` |
| `src/environment/types.test.ts`         | `formatElapsed`                            |
| `src/environment/server-config.test.ts` | `formatConfigValue`                        |
| `src/environment/validation.test.ts`    | `validateDependencies`                     |
| `src/containers/mattermost.test.ts`     | `generateNodeNames`, `buildMattermostEnv`  |
| `src/cli/container-utils.test.ts`       | `findConfigDiffs`, `buildPingUrl`          |
| `src/cli/utils.test.ts`                 | `validateOutputDir`                        |
| `src/environment/mmctl.test.ts`         | `parseCommand`                             |
