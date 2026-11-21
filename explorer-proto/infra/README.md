# explorer-pilot infra

Disposable, offline Mattermost Enterprise 12.1.0 + PostgreSQL 15.20 for the Channel Info explorer pilot.
Both images are pinned by digest and never pulled by these scripts (`--pull never`).

| Image | Ref |
| --- | --- |
| Mattermost | `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` (linux/amd64) |
| PostgreSQL | `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5` |
| Mattermost, `--target=main` only | `mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259@sha256:ed4bcaa423e09ddc8ddb229bc55c82178d7403299ce800d4a2b0ed79cf8b105c` (linux/amd64; the index digest, recorded in `../v2/targets/main.json`) |

## Commands (from the repo root)

```bash
explorer-proto/infra/scripts/gate.sh          # isolation + license gate, then full teardown
explorer-proto/infra/scripts/gate.sh --keep   # same, but leave stack + forwarder running
explorer-proto/infra/scripts/gate.sh --down   # teardown only (stack, volumes, canary, forwarder)
explorer-proto/infra/scripts/up.sh            # stack + forwarder + seed (default variant), prints the base URL
explorer-proto/infra/scripts/up.sh --variant=swap-purpose-header   # PILOT-01 negative control
explorer-proto/infra/scripts/up.sh --variant=no-archive            # PILOT-02 negative control
explorer-proto/infra/scripts/up.sh --session=bookmarks             # default seed + one link bookmark per channel (licensed server)
explorer-proto/infra/scripts/up.sh --target=main                   # same stack on the pinned main-branch image (combinable with --variant / --session)
explorer-proto/infra/scripts/gate.sh --target=main --keep          # the same gate on the main-branch image
explorer-proto/infra/scripts/down.sh          # idempotent teardown: forwarder, stack + volumes, canary, manifest
node explorer-proto/infra/scripts/verify_seed.mjs [--variant=...]  # admin API read-back of the seed
node explorer-proto/infra/scripts/verify_seed.mjs --session=bookmarks   # + bookmark read-back
node explorer-proto/infra/scripts/verify_seed.mjs --session=none        # + both channels have zero bookmarks
node explorer-proto/infra/scripts/survey_names.mjs run --label=<name>   # read-only accessible-name survey of the live stack (see below)
node explorer-proto/infra/scripts/survey_names.mjs diff <labelA> <labelB>  # names present in only one of two stored surveys
node explorer-proto/infra/scripts/bookmark_ctl.mjs patch --channel=release-planning --title='<title>'  # owner PATCH, PASS/FAIL
node explorer-proto/infra/scripts/bookmark_ctl.mjs read --channel=<name>                             # display_name list
```

Without `--session`, `up.sh` and `seed.mjs` run exactly the original seed and call no bookmark endpoint.

`MM_LICENSE` must be exported in the invoking shell; Compose passes it through by name only. The Mattermost
container runs with `MM_SERVICEENVIRONMENT=test` (approved for the pilot) because the license is test-signed.
See `INTERFACE.md` for the seed, variants and the `.run/seed-manifest.json` schema.

## Target image

`docker-compose.yml` takes the Mattermost image from `MATTERMOST_PILOT_IMAGE` and the platform from `MATTERMOST_PLATFORM`. With both unset the stack is the pinned 12.1.0 image on `linux/amd64`, exactly as before. `up.sh --target=main` and `gate.sh --target=main` export `MATTERMOST_PILOT_IMAGE` for the pinned main-branch image held in `scripts/lib.sh` (`MM_IMAGE_MAIN`); if `../v2/targets/main.json` exists its `image.ref@image.digest` must equal that pin or the script stops. `--target=default` is the unset case. Teardown needs no target.

The scripts still never pull. `up.sh` and `gate.sh` first check that the configured Mattermost image and the Postgres image are present locally with a `RepoDigests` entry equal to the digest in their ref (an unpinned ref is refused), and stop with a message that does not print the ref. Pull the main image once by digest before using the target:

```bash
docker pull mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259@sha256:ed4bcaa423e09ddc8ddb229bc55c82178d7403299ce800d4a2b0ed79cf8b105c
```

`MM_SERVICEENVIRONMENT=test` and the `MM_LICENSE` pass-through apply to either image unchanged.

## UI name survey

`scripts/survey_names.mjs run --label=<name>` runs `survey_names.pw.ts` (through `survey_names.config.ts`) against the live stack as the seeded `qa-user` on `/qa-team/channels/qa-sandbox`, using `openGuardedSession` from `src/session.ts` (imported, not modified). It needs the git-ignored `explorer-proto/node_modules` symlink (see `src/README-engine.md`) and does not pass `MM_LICENSE` on. It records, from aria snapshots, the sorted accessible names of: landmarks, sidebar channel links, channel-header buttons, the Info toggle closed and open, the Info panel's landmarks and controls, the channel menu items, favorite/star controls, and the bookmark links and controls (the bookmark groups are empty unless the stack was started with `--session=bookmarks`). It opens the Info panel and the channel menu and closes them again; it changes no server data. Icon-font glyphs in names are printed as `\u{...}` code points. The result is stored as `.run/survey/<label>.json` (git-ignored) and printed as names only; the launcher refuses to print an entry that looks like an id, URL or origin. `diff <labelA> <labelB>` prints a markdown table of names present in only one survey. Not measured: the unread suffix of sidebar names, because the seed leaves both channels fully read.

## Layout

- `docker-compose.yml`: project `explorer-pilot`, one network `pilot_internal` (`internal: true`), no `ports:`, Postgres on tmpfs, outbound features off (keys checked in `server/public/model/config.go` at `v12.1.0`).
- `forwarder.mjs`: built-ins-only TCP pipe `127.0.0.1:${PILOT_PORT:-8065}` → Mattermost container IP `:8065` (HTTP and WebSocket). Refuses non-loopback binds, logs no payloads, exits on SIGTERM.
- `scripts/leak_scan.mjs`: in-memory scan of stdin or paths for `MM_LICENSE` (full value and overlapping 24-char substrings). Prints only `PASS`/`FAIL` and a count. Exit 0/1, 2 if unset.
- `scripts/probe.mjs`: ping, DB status, WebSocket handshake and license probes; prints nothing, exit code only.
- `scripts/survey_names.mjs` (+ `.pw.ts`, `.config.ts`): the read-only name survey above.
- `scripts/seed.mjs`, `scripts/verify_seed.mjs`, `scripts/api.mjs`: API seed from `../scenarios.json` (plus `../sessions/bookmarks/charter.json` with `--session=bookmarks`), read-back, shared client.
- `scripts/bookmark_ctl.mjs`: owner-only bookmark title PATCH and a title-only read for the bookmarks session (see `INTERFACE.md`).
- `.run/` (git-ignored): forwarder pid/log, gate output, `seed-manifest.json`.

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
