# infra interface for later owners

- **Base URL:** `http://127.0.0.1:${PILOT_PORT:-8065}`. Set `PW_BASE_URL` to exactly this value.
- **Playwright lib mode:** EXTERNAL server. Leave `PW_USE_TESTCONTAINERS` unset, so `ensureFeatureFlag` / `ensureDefaultServerEnv` restarts and `runMmctlLocal` are not available; the server env is fixed by `docker-compose.yml` (test service environment, `MM_LICENSE` pass-through).
- **Admin:** lib defaults `PW_ADMIN_USERNAME=sysadmin`, `PW_ADMIN_PASSWORD=Sys@dmin-sample1`, `PW_ADMIN_EMAIL=sysadmin@sample.mattermost.com`. Created as the first user by the seed (or the gate). It plays the "qa-admin" seeding role from `scenarios.json`; no separate `qa-admin` account exists.
- **Start:** `explorer-proto/infra/scripts/up.sh [--variant=default|swap-purpose-header|no-archive] [--session=bookmarks] [--no-seed]` (needs `MM_LICENSE` exported; no image pulls). Prints `ready: <base URL>` once the stack is up, the forwarder answers and the seed has run. With `--session=bookmarks` it first prints `IsLicensed === 'true': PASS` or exits 1 with `FAIL (setup failure: licence/bookmarks …)`. The isolation + license gate stays a separate step: `gate.sh --keep`, then `up.sh`.
- **Stop:** `explorer-proto/infra/scripts/down.sh` (idempotent: forwarder SIGTERM, `docker compose down -v`, gate canary, seed manifest; all data is discarded).
- **Forwarder lifecycle:** started in the background by `up.sh`, pid in `.run/forwarder.pid`, log in `.run/forwarder.log`; stopped by `down.sh`. It resolves the Mattermost IP on `explorer-pilot_pilot_internal` at startup and re-resolves after a refused/unreachable upstream. Only binds `127.0.0.1`.
- **Local mode:** `docker exec explorer-pilot-mattermost /mattermost/bin/mmctl --local …` works (no shell needed). Never `docker exec … env`.

## Seed

`scripts/seed.mjs` (run by `up.sh`; can be re-run against a live stack) is API-based, deterministic and idempotent, and reads every name, purpose, header and archived flag from the `PILOT-01` / `PILOT-02` `fixture_setup` sections of `explorer-proto/scenarios.json`. It creates team `qa-team`, user `qa-user` (`system_user`, `team_user`, onboarding preferences from `lib/src/server/user.ts`), and channels `qa-sandbox`, `release-planning` and `legacy-roadmap`. It adds `qa-user` to each channel, archives `legacy-roadmap` after that, and finally marks `release-planning` then `qa-sandbox` viewed as `qa-user`. `scripts/verify_seed.mjs [--variant=…]` reads the state back through the admin API.

Negative-control variants change seed data only (never names, URLs, membership or accessible names):

| Variant | Effect |
| --- | --- |
| `default` | values exactly as in `scenarios.json` |
| `swap-purpose-header` | purpose and header strings swapped between `qa-sandbox` and `release-planning` (PILOT-01 control) |
| `no-archive` | `legacy-roadmap` left active (PILOT-02 control) |

## Signed-in setup

`pw.initSetup()` creates random team/user names, so pilot specs must not use it for the signed-in user. They use the fixed seeded identity from `.run/seed-manifest.json` (git-ignored, synthetic data only) and sign in through the framework: `pw.testBrowser.login(manifest.user)` (`TestBrowser.login` → `loginByAPI`, `e2e-tests/playwright/lib/src/browser_context.ts:24-36,156-196`), which writes the storage state itself. Infra does not create storage state.

Manifest schema (`explorer-pilot-seed/v1`):

```json
{
  "schema": "explorer-pilot-seed/v1",
  "base_url": "http://127.0.0.1:8065",
  "variant": "default | swap-purpose-header | no-archive",
  "session": "optional; see below",
  "team": {"id": "string", "name": "qa-team", "display_name": "QA Team"},
  "user": {"id": "string", "username": "qa-user", "password": "string (synthetic)", "email": "qa-user@sample.mattermost.com", "roles": "system_user"},
  "channels": {
    "<channel name>": {"id": "string", "name": "string", "display_name": "string", "purpose": "string", "header": "string", "archived": true, "url_path": "/qa-team/channels/<channel name>"}
  }
}
```

`channels` has keys `qa-sandbox`, `release-planning` and `legacy-roadmap`; `purpose` / `header` / `archived` reflect the variant actually seeded. Expected values in specs must still come from `scenarios.json`, not from the manifest.

The schema stays `explorer-pilot-seed/v1`. A `session` key is added only when the seed ran with `--session=…`. Without it the manifest is byte-identical to the one written before sessions existed:

```json
{
  "session": {
    "name": "bookmarks",
    "bookmarks": {
      "qa-sandbox": {"id": "string", "display_name": "string", "type": "link", "link_url": "<base_url>/qa-team/channels/qa-sandbox"},
      "release-planning": {"id": "string", "display_name": "string", "type": "link", "link_url": "<base_url>/qa-team/channels/release-planning"}
    }
  }
}
```

`link_url` holds the origin, so read it only in infra code. Never copy it into specs or committed files. Expected titles come from `sessions/bookmarks/charter.json`, not from the manifest.

## Session: bookmarks (opt-in)

`up.sh --session=bookmarks` (or `seed.mjs --session=bookmarks` on a live stack) runs the default seed unchanged. Then, as the seeding admin (lib default `sysadmin`), it seeds one link bookmark per channel from `sessions/bookmarks/charter.json` `fixture_setup.bookmarks`. The default seed (no `--session`) calls no bookmark endpoint. The v12.1.0 API calls (`server/channels/api4/channel_bookmark.go`) are:

1. `GET /api/v4/channels/{channel_id}/bookmarks` returns 200 with an array. With no `bookmarks_since` it returns only non-deleted bookmarks.
2. `DELETE /api/v4/channels/{channel_id}/bookmarks/{bookmark_id}` returns 200. It removes every bookmark except one that matches the declared title, type `link`, `link_url`, no emoji/image/file, and is owned by the admin.
3. If no bookmark matched, `POST /api/v4/channels/{channel_id}/bookmarks` with `{"display_name", "type": "link", "link_url": "<base_url>/qa-team/channels/<own channel>"}` must return 201.
4. A read-back requires exactly that one bookmark.

Any other status fails the seed with `setup failure: licence/bookmarks: <call> -> HTTP <status>`. A 501 means the server is not licensed: every bookmark endpoint, including GET, returns 501 then. No response body is printed. Afterwards, as `qa-user`, the seed marks `release-planning` then `qa-sandbox` viewed (`POST /api/v4/channels/members/me/view`, `{channel_id, prev_channel_id: ""}`). It checks `msg_count` / `mention_count` 0 for both and creates nothing after the view calls. Bookmark writes create no posts. Re-running it is idempotent: it keeps the same ids and deletes extras.

Read-back: `verify_seed.mjs --session=bookmarks` runs the default checks and then the bookmark checks. For each channel it requires exactly one non-deleted bookmark with the declared title, type `link`, no emoji/image/file, `link_url` origin equal to the base URL and path equal to the channel's own path, owned by the admin, and matching the manifest. It also checks that `qa-user` is a plain `channel_user` and that `qa-user` can list the same single bookmark. `verify_seed.mjs --session=none` runs the default checks plus "zero bookmarks" in `qa-sandbox` and `release-planning`, which proves the default seed is bookmark-free. Plain `verify_seed.mjs` is unchanged (26 checks) and makes no bookmark assertion.

Helper `scripts/bookmark_ctl.mjs` (reads channel and bookmark ids from the manifest; output never has ids, URLs or the origin):

- `node bookmark_ctl.mjs patch --channel=<name> --title='<title>'` sends `PATCH /api/v4/channels/{channel_id}/bookmarks/{bookmark_id}` with `{"display_name": "<title>"}` as the seeding admin. It prints `PASS` only after a 200 that updated the same id in place and a read-back showing the new title; otherwise it prints `FAIL (<reason>)`. The response shape is `{"updated": {…}, "deleted": {…}?}`. The title is always an argument; the script holds no charter values. Restore by patching the declared title back.
- `node bookmark_ctl.mjs read --channel=<name>` prints the JSON list of non-deleted `display_name`s.
- The owner must patch. In v12.1.0 a patch by anyone other than the owner soft-deletes the bookmark and saves a copy with a new id and `original_id` = old id (`server/channels/app/channel_bookmark.go:77-95`; confirmed live). So `patch` refuses a bookmark the admin does not own. Any repair path other than `patch` (for example re-running the seed after a non-owner edit) replaces the bookmark and changes its id.
