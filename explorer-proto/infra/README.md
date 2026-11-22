# explorer-pilot infra

Disposable, offline Mattermost Enterprise 12.1.0 + PostgreSQL 15.20 for the Channel Info explorer pilot.
Both images are pinned by digest and never pulled by these scripts (`--pull never`).

| Image | Ref |
| --- | --- |
| Mattermost | `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` (linux/amd64) |
| PostgreSQL | `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5` |
| Mattermost, `--target=main` only | `mattermostdevelopment/mattermost-enterprise-edition:2d6c285_fc5e259@sha256:ed4bcaa423e09ddc8ddb229bc55c82178d7403299ce800d4a2b0ed79cf8b105c` (linux/amd64; the index digest, recorded in `../v2/targets/main.json`) |
| Mattermost, `--target=release-12.0.2` | `mattermost/mattermost-enterprise-edition:12.0.2@sha256:d15763d5235f43b6e1833916603603300fd0650b3a6c876a2af6a7c172320427` (linux/amd64 manifest `sha256:8f9b67315d3e88204f4a5b26c0202df7f6e7440484d387b915033063fba2a8c3`; recorded in `../v2/targets/release-12.0.2.json`) |
| Mattermost, `--target=release-12.1.0` | the default image above (recorded in `../v2/targets/release-12.1.0.json`; linux/amd64 manifest `sha256:fc1cf78ca05974c618055ed0e2159f9d78ee393c2599f6ef01b7976216f76974`) |

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
explorer-proto/infra/scripts/up.sh --target=release-12.0.2         # same stack on the 12.0.2 image (the MM-71128 affected build)
explorer-proto/infra/scripts/up.sh --target=release-12.1.0         # same stack on the 12.1.0 image (the fixed build; equals the default)
explorer-proto/infra/scripts/gate.sh --target=release-12.0.2 --keep   # the same gate on the 12.0.2 image
node explorer-proto/infra/scripts/probe_attachment_fields.mjs      # fixture validation of the attachment-fields data path (see below)
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

### Release targets

`--target=release-X.Y.Z` (`up.sh` and `gate.sh`) reads `../v2/targets/release-X.Y.Z.json`, the same record format as `main.json`, and exports `MATTERMOST_PILOT_IMAGE` as `image.ref@image.digest`. Unlike `main`, the file is the single source of the image; `scripts/lib.sh` holds no copy. The script stops unless the file validates against the `target` schema (`../v2/schemas/validate.mjs target <file>`), is `kind: release` with `ref` `vX.Y.Z` and `server_version` `X.Y.Z` for exactly the requested name, has an `image.digest`, and its `database_image` (when present) equals the pinned Postgres image. The name must match `release-<digits>.<digits>.<digits>`; anything else is refused before a file is read.

The image check that follows is independent of the target: `verify_images` in `lib.sh` takes whichever ref is configured (`MATTERMOST_PILOT_IMAGE`, else the 12.1.0 default), refuses one that does not end in `@sha256:<64 hex>`, and requires a local `RepoDigests` entry with that digest. Nothing is ever pulled by the scripts. Pull a release image once by digest, for example:

```bash
docker pull mattermost/mattermost-enterprise-edition:12.0.2@sha256:d15763d5235f43b6e1833916603603300fd0650b3a6c876a2af6a7c172320427
```

A digest pull leaves no tag, so inspect with the full pinned ref. `--target=release-12.1.0` resolves to exactly the default image, so it equals running with no `--target`; with no `--target` nothing in the flow changed (gate lines and the 26 `verify_seed.mjs` checks are identical to the pre-change output).

### Compatibility of the stack with 12.0.2

Checked read-only against the `v12.0.2` and `v12.1.0` tags, then live:

- Every `MM_*` setting in `docker-compose.yml` that maps to a config field exists in `server/public/model/config.go` at both tags (`SqlSettings`, `ServiceSettings`, `LogSettings`, `EmailSettings`, `PluginSettings`, `MetricsSettings`, `AnnouncementSettings` fields), so the compose file needs no per-target override. `MM_SERVICEENVIRONMENT` and `MM_LICENSE` are not config fields; they are read directly (`model.GetServiceEnvironment()`, `LicenseEnv = "MM_LICENSE"`).
- An env var that matches no config field is ignored: `applyEnvKey` in `server/config/environment.go` returns when no struct field matches, so an unknown or removed setting does not stop the server.
- Licence loading (`server/channels/utils/license.go`, `server/public/model/service_environment.go`, `server/channels/app/platform/license.go`) is byte-identical between the two tags: a test-signed licence needs `MM_SERVICEENVIRONMENT=test`, and the log line `License key from ENV is valid` appears on both.
- The Mattermost Blocks flag `FeatureFlags.MmBlocksEnabled` defaults to `true` in `server/public/model/feature_flags.go` at both tags, and live `GET /api/v4/config/client?format=old` reports `FeatureFlagMmBlocksEnabled` `true` on both.
- Live: the full gate (every line PASS, `IsLicensed === 'true'` PASS), `verify_seed.mjs` (26 checks) and `verify_seed.mjs --session=none` give output identical to 12.1.0.

## Attachment-field probe (fixture validation, not the benchmark)

`scripts/probe_attachment_fields.mjs` validates the data path of the MM-71128 regression on a live stack, with no browser, no screenshots and no rendered page. As the seeded `qa-user` it posts through the REST API into the scratch channel `qa-probe-polls` (created through the admin API only when missing and with `qa-user` added; the default seed is untouched) one post whose `props.attachments` has one attachment with a title, a text and three fields: `Apple (3 votes)` (empty value, short), `Pear (0 votes)` (empty value, short) and `Control` (value `present`, not short). It then reads the post back and prints:

- whether `props.attachments[0].fields` has all three titles, and whether values and `short` are intact (`PASS`/`FAIL`), plus a 12-character SHA-256 of the stored `props.attachments` so two builds can be compared without printing data;
- `FeatureFlagMmBlocksEnabled` from `GET /api/v4/config/client?format=old`;
- the server `Version`, `BuildHash` and `BuildEnterpriseReady`.

It never prints ids and exits 0 only when all three fields come back intact. Run it after `up.sh` (and after `verify_seed.mjs`, because it adds a channel). It validates the fixture only: the same data must be stored on the affected and the fixed build, so any difference between builds would be in how the page renders it, which this probe does not read.

## Unread read-back diagnostic

`node explorer-proto/infra/scripts/diag_unread_readback.mjs` (after `up.sh`, default seed) creates a fresh synthetic team with two synthetic users A and B (admin API, `adminApi()` from `api.mjs`) and public channels with both as members, then prints counts only (no ids, names, origin or credentials). All readings use A's own session: A's channel member record (`msg_count`, `msg_count_root`, `mention_count`, `mention_count_root`), `GET /users/{A}/channels/{channel}/unread`, the channel totals (`total_msg_count`, `total_msg_count_root`) and the post count by type. Cases:

- one plain post by B: readings before the post, after it, and after A's `POST /channels/members/me/view`;
- a self-join comparison (A joins on its own), which attributes the mention A has before any post to the "added to the channel" system post;
- `mark_unread`: A's member and user notify props, then `mark_unread: 'mention'` with a plain post and a mention by B, restored to `all`, then viewed;
- a live check of the engine's own `readChannelUnread` and `unreadReadBackProblem` (imported from `src/journey_fixture.ts`): an unviewed post is rejected, it is accepted after the view, a member record with `msg_count` equal to the total and nothing unread is accepted, and mentions-only is refused.

Observed on 12.1.0, identical over two runs: the member record's `msg_count`/`msg_count_root` are the read cursor (the channel totals at the last view); the unread endpoint reports totals minus the cursor; join system posts are not in the totals, but an admin adding A to a channel gives A one unread mention until A views; with `mark_unread: 'mention'` the unread endpoint reports 0 msgs for an unviewed plain post while still counting mentions. Exit 0 only when every printed expectation is `PASS`.

## UI name survey

`scripts/survey_names.mjs run --label=<name>` runs `survey_names.pw.ts` (through `survey_names.config.ts`) against the live stack as the seeded `qa-user` on `/qa-team/channels/qa-sandbox`, using `openGuardedSession` from `src/session.ts` (imported, not modified). It needs the git-ignored `explorer-proto/node_modules` symlink (see `src/README-engine.md`) and does not pass `MM_LICENSE` on. It records, from aria snapshots, the sorted accessible names of: landmarks, sidebar channel links, channel-header buttons, the Info toggle closed and open, the Info panel's landmarks and controls, the channel menu items, favorite/star controls, and the bookmark links and controls (the bookmark groups are empty unless the stack was started with `--session=bookmarks`). It opens the Info panel and the channel menu and closes them again; it changes no server data. Icon-font glyphs in names are printed as `\u{...}` code points. The result is stored as `.run/survey/<label>.json` (git-ignored) and printed as names only; the launcher refuses to print an entry that looks like an id, URL or origin. `diff <labelA> <labelB>` prints a markdown table of names present in only one survey. Not measured: the unread suffix of sidebar names, because the seed leaves both channels fully read.

## Layout

- `docker-compose.yml`: project `explorer-pilot`, one network `pilot_internal` (`internal: true`), no `ports:`, Postgres on tmpfs, outbound features off (keys checked in `server/public/model/config.go` at `v12.1.0`).
- `forwarder.mjs`: built-ins-only TCP pipe `127.0.0.1:${PILOT_PORT:-8065}` → Mattermost container IP `:8065` (HTTP and WebSocket). Refuses non-loopback binds, logs no payloads, exits on SIGTERM.
- `scripts/leak_scan.mjs`: in-memory scan of stdin or paths for `MM_LICENSE` (full value and overlapping 24-char substrings). Prints only `PASS`/`FAIL` and a count. Exit 0/1, 2 if unset.
- `scripts/probe_attachment_fields.mjs`: REST-only fixture validation of attachment fields (see above).
- `scripts/diag_unread_readback.mjs`: the unread read-back diagnostic above (synthetic data, counts only).
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
