# explorer-pilot infra

Disposable, offline Mattermost Enterprise 12.1.0 + PostgreSQL 15.20 for the Channel Info explorer pilot.
Both images are pinned by digest and never pulled by these scripts (`--pull never`).

| Image | Ref |
| --- | --- |
| Mattermost | `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` (linux/amd64) |
| PostgreSQL | `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5` |

## Commands (from the repo root)

```bash
explorer-proto/infra/scripts/gate.sh          # isolation + license gate, then full teardown
explorer-proto/infra/scripts/gate.sh --keep   # same, but leave stack + forwarder running
explorer-proto/infra/scripts/gate.sh --down   # teardown only (stack, volumes, canary, forwarder)
explorer-proto/infra/scripts/up.sh            # start stack + forwarder, prints the base URL
explorer-proto/infra/scripts/down.sh          # stop forwarder, `docker compose down -v`
```

`MM_LICENSE` must be exported in the invoking shell; Compose passes it through by name only.

## Layout

- `docker-compose.yml`: project `explorer-pilot`, one network `pilot_internal` (`internal: true`), no `ports:`, Postgres on tmpfs, outbound features off (keys checked in `server/public/model/config.go` at `v12.1.0`).
- `forwarder.mjs`: built-ins-only TCP pipe `127.0.0.1:${PILOT_PORT:-8065}` → Mattermost container IP `:8065` (HTTP and WebSocket). Refuses non-loopback binds, logs no payloads, exits on SIGTERM.
- `scripts/leak_scan.mjs`: in-memory scan of stdin or paths for `MM_LICENSE` (full value and overlapping 24-char substrings). Prints only `PASS`/`FAIL` and a count. Exit 0/1, 2 if unset.
- `scripts/probe.mjs`: ping, DB status, WebSocket handshake and license probes; prints nothing, exit code only.
- `.run/` (git-ignored): forwarder pid/log and gate output.

## What the gate proves

DIRECT (tested): both containers attached only to `explorer-pilot_pilot_internal`; network `Internal=true`; no published ports; Postgres container has no default route; Mattermost writes to PostgreSQL (`ping?get_server_status=true` → `database_status: OK`); worker reaches Mattermost via the forwarder (HTTP ping and WebSocket 101); forwarder bound only to `127.0.0.1` and refuses `0.0.0.0`; boundary canary on a separate local bridge is reachable from that bridge (positive control) and unreachable from the Postgres container (negative test); `IsLicensed === 'true'`; leak scans.

INFERRED (reasoned): the Mattermost container's own boundary. It is distroless and is not exec'd, so the canary is not run from it; it shares the single internal network with the tested Postgres container, which rests on the DIRECT network-membership check.

The canary uses the already-pulled Postgres image, trust auth inside its throwaway network, no published ports, and no external hosts. It is always removed at the end of the gate.

## Commands that would expose the license (never run them)

- `docker compose config` (renders the inherited `MM_LICENSE` value)
- `docker inspect` without a narrow `--format` (includes `Config.Env`), or any template touching `.Config.Env`
- `docker exec … env`, `docker exec … printenv`, `env`, `printenv`, `ps eww`, `set -x` / `bash -x` around these scripts
- `docker compose logs` piped anywhere other than `scripts/leak_scan.mjs` (print only grepped lines that pass the scanner)
- writing the value into any `.env`, `--env-file`, compose file, log, test output or commit
