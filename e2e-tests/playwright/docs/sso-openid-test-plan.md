# SSO / Auth / OpenID Test Plan (Keycloak)

This document catalogs planned E2E test cases for SSO, general authentication, and
OpenID Connect flows backed by Keycloak. It complements the existing SAML/LDAP
coverage under `specs/functional/{saml,ldap}/` and tracks what still needs to be
built before each case can be automated.

## Directory conventions

**Rule: `specs/functional/system_console/` is for specs that exercise the System
Console UI. If a spec never opens the System Console — even if it configures that
same feature via the admin API — it does not belong there.** Login flows, claim/switch
flows, and anything else that only touches `/login`, `/claim/*`, or the regular
webapp UI get their own top-level functional folder, named after the feature they
test, not the settings screen that happens to configure it.

New SSO-related specs should **not** default to nesting under
`specs/functional/system_console/`. Use top-level protocol/behavior directories;
reserve `system_console/` only for specs that specifically drive the System Console
admin UI to verify config persistence/labels (no live IdP login involved).

| Case                                                                                                                                                                                | Directory                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Live OpenID login (OIDC-*)                                                                                                                                                          | `specs/functional/oidc/`                                             |
| Live SAML login, incl. SAML+LDAP sync since SAML is the login entry point (SAML-*)                                                                                                  | `specs/functional/saml/`                                             |
| Live LDAP login (LDAP-*)                                                                                                                                                            | `specs/functional/ldap/`                                             |
| Protocol-agnostic auth policy: session extension, password/MFA/domain/account-creation rules, basic email/username login, login-method switching ("claim") (AUTH-3 through AUTH-13) | `specs/functional/auth/`                                             |
| Cross-protocol SSO behavior not owned by a single directory above                                                                                                                   | `specs/functional/sso/`                                              |
| System Console UI config only, no live login (AUTH-1, AUTH-2, auth-method label MM-T953, field-validation-only LDAP/SAML settings)                                                  | `specs/functional/system_console/{openid,authentication,ldap,saml}/` |

`saml_login.spec.ts` and `ldap_login.spec.ts` have both been relocated (to
`specs/functional/saml/` and `specs/functional/ldap/` respectively) — neither ever
opened the System Console; they only configured settings via the admin API and
exercised `/login`.

## Playwright authoring conventions

Every spec produced from this plan must follow the repo's existing standards
(`e2e-tests/playwright/README.md`) with no exceptions:

1. **POM first.** All locators and UI actions live in `lib/src/ui/{pages,components}`,
   established _before_ the spec is written. A spec only ever calls methods/locators
   exposed by a page or component object off `pw.*` — it never imports `Page` or
   builds a locator inline.
2. **No `page.*` / `*.locator(...)` in spec files.** Everything a spec needs —
   including third-party pages like Keycloak's hosted login form — is wrapped in a
   page object. Done: `lib/src/ui/pages/keycloak_login.ts` (`KeycloakLoginPage`) now
   wraps Keycloak's hosted form; `saml_login.spec.ts` and `openid_login.spec.ts` both
   use it instead of raw locators.
3. **Accessibility locators as the primary strategy**, in the README's preference
   order: `getByRole` > `getByLabel` > `getByText`/`getByPlaceholder` > test ID > CSS.
   Applies inside page/component objects (that's where locators are defined) — reach
   for a test ID or CSS selector only when no accessible role/label/text exists.
4. **Comments: short, human-readable, no background context.** Match the existing
   convention exactly: `// #` marks an action step, `// *` marks an assertion, one
   short line each — state what's happening, not why, not what was fixed, not which
   ticket prompted it. Each `test(...)` gets a JSDoc block above it with `@objective`
   (what's verified) and `@precondition` (external system dependency), same as
   `saml_login.spec.ts`/`ldap_login.spec.ts`.
5. **Full Testcontainers usage, no docker-compose, no mocks.** Every external
   dependency (Keycloak, OpenLDAP, etc.) runs as a real Testcontainer, started via
   `PW_TESTCONTAINERS_SERVICES` and the container classes in `lib/src/containers/`.
   Tests exercise the real login/claim flow end-to-end against the real container —
   no stubbed IdP responses, no mocked network calls, no fixture-only "pretend it
   logged in" shortcuts. If a scenario needs a capability the current Keycloak/
   OpenLDAP container helpers don't expose yet (e.g. suspending a user, deleting a
   session), extend the helper in `lib/src/server/` rather than working around it
   with a mock.
6. **Minimize reliance on the Testcontainers-internal Docker alias
   (`server:8065`, `keycloak:8080`, etc.) — never for an endpoint an external
   client is meant to call directly.** The same server a test drives is also the
   one a developer brings up manually with `npm run tc:up` and pokes at with an
   ordinary browser. A config value like an IdP's `AuthEndpoint` must stay
   host-reachable so that login still works there — only a container's own
   _outbound_ call (e.g. the server's own `TokenEndpoint`/`UserAPIEndpoint`
   requests, which can never reach a host-mapped port from inside its container)
   may legitimately use the alias, since the browser is never involved in that leg.
   See "Implementation prerequisites" → OIDC-1 below for two worked examples of
   getting this wrong and the actual fixes: `AuthEndpoint` on the alias
   (fixed by `ensureKeycloakRealmFrontendUrl()`) and `ServiceSettings.SiteURL`
   locked to the alias (fixed by a fixed container host port + `pw.ensureSiteUrl()`).

## A. OpenID Connect via Keycloak — highest priority

The realm export (`lib/src/containers/assets/keycloak-realm-export.json`) already
provisions an OIDC client (`mattermost-openid`).

**OIDC-1 through OIDC-6 are implemented** (`specs/functional/oidc/openid_login.spec.ts`, passing a
3x stability run) — see "Implementation prerequisites" below for the infra it required. **OIDC-2
was rewritten from its original premise** once server-code research showed a pre-existing
email/password account isn't linked on OpenID login — it's rejected outright
(`api.user.create_oauth_user.already_attached.app_error`); the test verifies that rejection
instead. **OIDC-7 is dropped**: `OpenIdSettings.DiscoveryEndpoint` is not actually consumed to
resolve `AuthEndpoint`/`TokenEndpoint`/`UserAPIEndpoint` at login time anywhere in the server -
its only consumer is the Support Packet's diagnostics-only connectivity probe
(`platform/support_packet.go`), a completely different, admin-console-only surface. There is no
real "discovery-based login" behavior to test.

| ID         | Title                                                      | Objective                                                                                                                                                            | Tag       |
| ---------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| OIDC-1     | Directory-only user logs in via OpenID SSO                 | User exists only in Keycloak; enabling `OpenIdSettings` + clicking the OpenID button provisions a Mattermost account on first login with `auth_service === 'openid'` | `@openid` |
| OIDC-2     | OpenID login is rejected for an existing basic-auth email  | A user created locally with the same email is not linked/switched - the login is rejected with the server's "already associated with a sign in method" error         | `@openid` |
| OIDC-3     | Login fails gracefully with wrong Keycloak credentials     | Wrong password on Keycloak's hosted login page keeps the user on Keycloak's error state, no Mattermost session created                                               | `@openid` |
| OIDC-4     | Disabled/suspended Keycloak user cannot log in             | User suspended via Keycloak admin API (`enabled: false`) sees Keycloak's "Account is disabled" message and is not authenticated                                      | `@openid` |
| OIDC-5     | OpenID button visibility follows config                    | `OpenIdSettings.Enable=false` hides the button on `/login`; enabling it shows it with the configured button text/color                                               | `@openid` |
| OIDC-6     | Logout invalidates session created via OpenID              | After OpenID login, logging out clears the Mattermost session; revisiting a team channel redirects back to `/login` (generic OpenID has no IdP-side single logout)   | `@openid` |
| ~~OIDC-7~~ | ~~OpenID login respects `DiscoveryEndpoint`-based config~~ | Dropped - `DiscoveryEndpoint` isn't consumed at login time at all (see above)                                                                                        | -         |

## B. SAML via Keycloak — extend beyond current happy path

**SAML-1 through SAML-6 and SAML-9 through SAML-11 are implemented** across
`specs/functional/saml/saml_login.spec.ts` and `specs/functional/saml/saml_ldap_sync.spec.ts`
(passing a 3x stability run). SAML-10 covers RSAwithSHA256/512 only (SHA1 is rejected by
Keycloak's own SAML client as too weak to configure, so isn't a realistic case here). **SAML-7
and SAML-8 are deferred** — see "Still needed" below for why.

| ID      | Title                                                      | Objective                                                                                                                                                         | Tag           |
| ------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| SAML-1  | Directory-only user logs in via SAML                       | Exists at `specs/functional/saml/saml_login.spec.ts`                                                                                                              | `@saml`       |
| SAML-2  | Suspended Keycloak user is denied SAML login               | Exists at `specs/functional/saml/saml_login.spec.ts`                                                                                                              | `@saml`       |
| SAML-3  | SAML login audit trail records "SAML obtained user"        | Verify server logs/audit reflect SAML-based provisioning                                                                                                          | `@saml`       |
| SAML-4  | SAML + LDAP sync: attribute sync on login                  | Port `saml_ldap_sync_spec.ts` / `saml_ldap_sync_id_attrib_spec.ts` — LDAP-sourced attributes sync correctly via SAML assertion mapping, incl. custom ID Attribute | `@saml @ldap` |
| SAML-5  | SAML + LDAP sync removal suspends Mattermost account       | Port `saml_ldap_sync_remove_spec.ts`                                                                                                                              | `@saml @ldap` |
| SAML-6  | Guest account provisioning via SAML                        | Port `saml_guest_member_spec.ts` and the guest-related cases in `okta_login_spec.ts`                                                                              | `@saml`       |
| SAML-7  | Session extension behavior for SAML-authenticated sessions | Deferred - needs direct-DB session manipulation, an infra gap (see "Still needed")                                                                                | `@saml`       |
| SAML-8  | Admin login via SAML                                       | Deferred - needs a Keycloak realm attribute mapper for admin status (see "Still needed")                                                                          | `@saml`       |
| SAML-9  | SAML metadata without encryption enabled                   | Port `saml_automated_spec.ts` MM-T3012                                                                                                                            | `@saml`       |
| SAML-10 | SAML signature algorithm variants (RSAwithSHA256/512)      | Port `saml_automated_spec.ts` signature-algorithm cases                                                                                                           | `@saml`       |
| SAML-11 | SAML IdP metadata fetch failure vs. success                | Port `saml_metadata_spec.ts`                                                                                                                                      | `@saml`       |

## C. LDAP via OpenLDAP — extend beyond current happy path

**LDAP-1 and LDAP-3 are fully implemented, and LDAP-2 is implemented except for its
group-synced-team case** — across `specs/functional/ldap/ldap_login.spec.ts` and
`specs/functional/ldap/ldap_filters.spec.ts` (passing a 3x stability run).

| ID     | Title                                                                                | Objective                                                                                                                                                                                                              | Tag     |
| ------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| LDAP-1 | Directory-only user logs in via LDAP                                                 | Exists at `specs/functional/ldap/ldap_login.spec.ts`                                                                                                                                                                   | `@ldap` |
| LDAP-2 | LDAP guest filter provisions/re-evaluates guest status                               | Guest filter provisioning (MM-T1422) and demote-to-guest (MM-T1425) are implemented; the System Console UI disabled-state check (MM-T1424) and the group-synced-team case (MM-T1427) are deferred - see "Still needed" | `@ldap` |
| LDAP-3 | LDAP login/filter edge cases (admin filter, user filter, guest filter, team invites) | Implemented at `specs/functional/ldap/ldap_filters.spec.ts` (team-invite variants aren't separately re-tested - already covered by existing team-membership + guest/member assertions)                                 | `@ldap` |

## D. General Auth/SSO behavior (protocol-agnostic policy)

| ID      | Title                                                                   | Objective                                                                                                                                                                                                                                                                                                                  | Tag                             |
| ------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| AUTH-1  | OpenID service-provider dropdown config persists correctly              | System Console UI: selecting Google/GitLab/Office365/OpenID pre-fills correct endpoints; saved config round-trips via API with `Secret` masked as `FAKE_SETTING`                                                                                                                                                           | `@openid`                       |
| AUTH-2  | External login button reflects configured provider                      | Button href (`/oauth/openid/login` etc.), label, and color match saved settings                                                                                                                                                                                                                                            | `@openid`                       |
| AUTH-3  | Correct auth method label shown in System Console                       | Port `authentication_method_spec.js` (MM-T953)                                                                                                                                                                                                                                                                             | `@authentication`               |
| AUTH-4  | Session extension behavior for LDAP-authenticated sessions              | Port `with_ldap_login_spec.ts`                                                                                                                                                                                                                                                                                             | `@ldap`                         |
| AUTH-5  | Account creation / domain restriction / verification policy             | Port `authentication_1/3/4_spec.ts`, `authentication_not_cloud_spec.ts`, `hide_create_account_spec.ts`, `enterprise/auth_sso/authentication_spec.ts`                                                                                                                                                                       | `@authentication`               |
| AUTH-6  | Password requirements and MFA enforcement/visibility                    | Port `authentication_2_spec.ts`, `enterprise/auth_sso/mfa_authentication_spec.ts`                                                                                                                                                                                                                                          | `@authentication @mfa`          |
| AUTH-7  | Basic login via email + password                                        | Happy path: valid email/password logs in and lands on default channel; empty-field and invalid-credential messaging doesn't reveal which field is wrong (MM-T3306, MM-T3080)                                                                                                                                               | `@authentication`               |
| AUTH-8  | Basic login via username + password                                     | Same as AUTH-7 but with `pw.loginPage.login(user, {useUsername: true})`; also covers `EnableSignInWithEmail`/`EnableSignInWithUsername` combinations showing the right help text (MM-T1767/1768/1769)                                                                                                                      | `@authentication`               |
| AUTH-9  | Switch login method: email/LDAP → Keycloak SSO (SAML/OpenID)            | From Account Settings → Security, user on basic auth (or LDAP) enters their **current password** and is redirected to `/claim/email_to_oauth` (SAML/OpenID) or `/claim/email_to_ldap`; switch only completes once they authenticate at Keycloak; `auth_service` updates accordingly (MM-T2559, MM-T2708, MM-T2560 pattern) | `@authentication @openid @saml` |
| AUTH-10 | Switch login method: Keycloak SSO (SAML/OpenID) → email/LDAP            | While logged in via SSO, user goes to Account Settings → Security → `/claim/oauth_to_email` or `/claim/ldap_to_email`, sets a **new password** (no re-auth against Keycloak required — session-based), can then log back in with email/username+password (MM-T2559, MM-T2706)                                              | `@authentication @openid @saml` |
| AUTH-11 | Switch login method fails with incorrect current password               | `email_to_oauth`/`email_to_ldap` claim rejects an incorrect current password with an error and does not change `auth_service` (MM-T2707, MM-T2705 pattern)                                                                                                                                                                 | `@authentication`               |
| AUTH-12 | Round-trip switch: email → SSO → email                                  | Combines AUTH-9 + AUTH-10 back to back on the same account to confirm the account isn't left in an inconsistent state and both login forms work at each stage                                                                                                                                                              | `@authentication @openid @saml` |
| AUTH-13 | Switch login method requires `ExperimentalEnableAuthenticationTransfer` | Claim endpoints reject the switch (or the "Switch to X" UI is hidden) when this config flag is off                                                                                                                                                                                                                         | `@authentication`               |

### Login-method switching ("claim") mechanics

Grounded in the actual implementation, since it's non-obvious:

- There is **one** generic API endpoint, `POST /api/v4/users/login/switch` (`SwitchRequest`), not one per method pair. It dispatches on `(current_service, new_service)`.
- **SAML has no dedicated claim path** — it reuses the OAuth claim UI/API (`email_to_oauth` / `oauth_to_email` with `new_type`/`old_type=saml`), same as GitLab/Google/Office365/OpenID.
- **Email/LDAP → SSO** requires the user's current password (+ MFA code if enabled); the server then returns a `follow_link` redirecting to the IdP, and the switch only finalizes when the IdP callback (SAML ACS or OAuth callback with `action=email_to_sso`) succeeds.
- **SSO → Email/LDAP** requires an active session (no re-check of the SSO credential) plus a new password; gated by `EnableSignUpWithEmail`/sign-in-with-email-or-username settings.
- Entry points live in Account Settings → Security ("Sign-in Method" section), which link to `/claim/{email_to_oauth,oauth_to_email,email_to_ldap,ldap_to_email}`.
- No Cypress or Playwright automation exists for this flow today (confirmed via both a code search and the test-management data below) — this is greenfield.

## E. Cypress → Playwright migration inventory

Full inventory of existing Cypress SSO/Auth/LDAP/SAML/OpenID specs under
`e2e-tests/cypress/tests/`, to be ported to Playwright and tracked here. Once a row's
Playwright equivalent exists and is passing in CI, mark it `Ported` and its Cypress
source becomes a candidate for deletion (see workflow below).

Cross-referenced against the test case management data at
`mattermost-test-management/data` (`test-cases-manifest.json` maps folder → MM-T file;
each `test-cases/MM-T####.md` has a `cypress:`/`playwright:` frontmatter field that is
the authoritative automation-status signal — `playwright:` is `null` for every
auth-related test case today, confirming none have been migrated yet). This surfaced
additional test cases with no known Cypress spec at all (rows below marked
"MM-T-only" have no `Cypress file` because the case is untriaged/gap in Cypress too —
they'll be automated directly in Playwright with no Cypress source to delete).

Status legend: `Not started` / `Ported` / `Deleted`.

### E.1 Live-IdP (Keycloak / OpenLDAP / Okta) — real login flow

| Cypress file                                                                 | Tags                                                           | MM-T       | Test case                                                         | Maps to         | Status                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| `integration/channels/ad_ldap/saml_ldap_sync_spec.ts`                        | `@channels @enterprise @ldap @saml @keycloak`                  | MM-T3013_1 | SAML/LDAP sync off: attributes pulled from SAML assertion         | SAML-4          | Not started                                      |
|                                                                              |                                                                | MM-T3013_2 | SAML/LDAP sync on: attributes pulled from LDAP instead            | SAML-4          | Ported (`saml_ldap_sync.spec.ts`)                |
| `integration/channels/ad_ldap/saml_ldap_sync_id_attrib_spec.ts`              | same                                                           | MM-T3666   | SAML/LDAP sync using a custom ID Attribute mapping                | SAML-4          | Not started                                      |
| `integration/channels/ad_ldap/saml_ldap_sync_remove_spec.ts`                 | same                                                           | MM-T3664   | SAML user not present in LDAP is handled correctly                | SAML-5          | Not started                                      |
|                                                                              |                                                                | MM-T3665   | User removed from LDAP is deactivated in Mattermost via SAML sync | SAML-5          | Ported (`saml_ldap_sync.spec.ts`)                |
| `integration/channels/enterprise/extend_session/.../with_ldap_login_spec.ts` | `@enterprise @not_cloud @extend_session @ldap`                 | MM-T4046_1 | LDAP session extends with activity when enabled                   | AUTH-4          | Not started                                      |
|                                                                              |                                                                | MM-T4046_2 | LDAP session does not extend when disabled                        | AUTH-4          | Not started                                      |
| `integration/channels/enterprise/extend_session/.../with_saml_login_spec.ts` | `@enterprise @not_cloud @extend_session @ldap @saml @keycloak` | MM-T4047_1 | SAML/SSO session extends with activity when enabled               | SAML-7          | Deferred - needs direct-DB infra                 |
|                                                                              |                                                                | MM-T4047_2 | SAML/SSO session does not extend when disabled                    | SAML-7          | Deferred - needs direct-DB infra                 |
| `integration/channels/enterprise/ldap/ldap_guest_spec.ts`                    | `@enterprise @ldap`                                            | MM-T1422   | LDAP guest filter provisions user as guest                        | LDAP-2          | Ported (`ldap_filters.spec.ts`)                  |
|                                                                              |                                                                | MM-T1424   | Guest filter behavior when Guest Access disabled                  | LDAP-2          | Deferred - console-UI check only                 |
|                                                                              |                                                                | MM-T1425   | Changing the guest filter re-evaluates guest status               | LDAP-2          | Ported (`ldap_filters.spec.ts`)                  |
|                                                                              |                                                                | MM-T1427   | Invite-guest blocked for LDAP group-synced teams                  | LDAP-2          | Deferred - needs LDAP group support              |
| `integration/channels/enterprise/ldap/ldap_login_spec.ts`                    | `@enterprise @ldap`                                            | MM-T2821   | LDAP Admin Filter                                                 | LDAP-3          | Ported (`ldap_filters.spec.ts`)                  |
|                                                                              |                                                                | —          | LDAP login, existing MM admin                                     | LDAP-3          | Not started                                      |
|                                                                              |                                                                | —          | Invalid login with user filter                                    | LDAP-3          | Ported (`ldap_filters.spec.ts`)                  |
|                                                                              |                                                                | —          | LDAP login, new MM user, no channels                              | LDAP-3          | Ported (subsumed by LDAP-1)                      |
|                                                                              |                                                                | —          | Invalid login with guest filter                                   | LDAP-3          | Ported (`ldap_filters.spec.ts`)                  |
|                                                                              |                                                                | —          | LDAP login, new guest, no channels                                | LDAP-3          | Ported (`ldap_filters.spec.ts`)                  |
|                                                                              |                                                                | —          | LDAP member login with team invite                                | LDAP-3          | Not started                                      |
|                                                                              |                                                                | —          | LDAP guest login with team invite                                 | LDAP-3          | Not started                                      |
| `integration/channels/enterprise/ldap/ldap_setting_spec.ts`                  | `@enterprise @ldap`                                            | MM-T2704   | Create new LDAP account from login page                           | LDAP-1 (exists) | Ported (`ldap_login.spec.ts`)                    |
| `integration/channels/enterprise/saml/okta_login_spec.ts`                    | `@enterprise @saml` (Okta, not Keycloak)                       | —          | SAML login: new MM regular user                                   | SAML-1-variant  | Not started — re-target to Keycloak              |
|                                                                              |                                                                | —          | SAML login: existing MM regular user                              | SAML-1-variant  | Not started                                      |
|                                                                              |                                                                | —          | SAML login: new guest (x2 variants)                               | SAML-6          | Ported (equiv. via Keycloak, not a literal port) |
|                                                                              |                                                                | —          | SAML login: admin (x2 variants)                                   | SAML-8          | Deferred - needs a realm attribute mapper        |
|                                                                              |                                                                | —          | SAML login: invited guest                                         | SAML-6          | Not started                                      |
| `integration/channels/enterprise/saml/saml_automated_spec.ts`                | `@enterprise @saml` (Okta)                                     | MM-T3012   | SAML metadata without encryption                                  | SAML-9          | Ported (`saml_login.spec.ts`)                    |
|                                                                              |                                                                | MM-T3280   | SAML login audit trail entry                                      | SAML-3          | Ported (`saml_login.spec.ts`)                    |
|                                                                              |                                                                | MM-T3281   | Signature algorithm RSAwithSHA256                                 | SAML-10         | Ported (`saml_login.spec.ts`)                    |
|                                                                              |                                                                | —          | Signature algorithm RSAwithSHA512                                 | SAML-10         | Ported (`saml_login.spec.ts`)                    |
| `integration/channels/enterprise/saml/saml_guest_member_spec.ts`             | `@enterprise @saml` (Keycloak + OpenLDAP)                      | MM-T1423_1 | SAML guest setting disabled when Guest Access off                 | SAML-6          | Deferred - console-UI check only                 |
|                                                                              |                                                                | MM-T1423_2 | SAML user logs in as member                                       | SAML-1-variant  | Ported (`saml_login.spec.ts`)                    |
|                                                                              |                                                                | MM-T1426_1 | Member login, filter doesn't match                                | SAML-6          | Ported (`saml_login.spec.ts`)                    |
|                                                                              |                                                                | MM-T1426_2 | Guest login, correct filter                                       | SAML-6          | Ported (`saml_login.spec.ts`)                    |

#### MM-T-only rows (no existing Cypress spec — found via test-management cross-reference, `cypress: To Do`/blank)

| Source (test-management folder) | MM-T     | Test case                                                                                                                  | Maps to                                    | Status      |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------- |
| `suite/redirect`                | MM-T2558 | Open team invite link, sign in using SSO                                                                                   | new (team-invite variant of SAML-1/OIDC-1) | Not started |
| `suite/redirect`                | MM-T2559 | Change SSO to email/password                                                                                               | AUTH-10                                    | Not started |
| `suite/redirect`                | MM-T2560 | Change email/password to SSO                                                                                               | AUTH-9                                     | Not started |
| `suite/ad-ldap`                 | MM-T2705 | Switch LDAP → Email: incorrect password rejected                                                                           | AUTH-11                                    | Not started |
| `suite/ad-ldap`                 | MM-T2706 | Switch LDAP → Email succeeds, can log back in with email                                                                   | AUTH-10                                    | Not started |
| `suite/ad-ldap`                 | MM-T2707 | Switch Email → LDAP: incorrect password rejected                                                                           | AUTH-11                                    | Not started |
| `suite/ad-ldap`                 | MM-T2708 | Switch Email → LDAP succeeds, can log back in with LDAP                                                                    | AUTH-9                                     | Not started |
| `suite/saml`                    | MM-T3657 | SAML login with Keycloak (full manual Keycloak setup walkthrough)                                                          | SAML-1 (canonical source ticket)           | Not started |
| `smoke-tests/webapp`            | MM-T3080 | Sign in with email/password (or username, alternating)                                                                     | AUTH-7 / AUTH-8                            | Not started |
| `suite/sign-in-authentication`  | MM-T3306 | Login page validation: autofocus, empty-field errors, generic invalid-credential message, successful login/logout redirect | AUTH-7                                     | Not started |

Note: MM-T1767/1768/1769 (`EnableSignInWithEmail`/`EnableSignInWithUsername` combinations
showing the right login-page help text) already have a Cypress spec
(`auth_sso/authentication_3_spec.ts`, listed in E.2) — re-mapped there to **AUTH-8**
rather than AUTH-5, since they're about the username/email login mechanic specifically.

### E.2 Config-only (API/UI settings, no live login) — lower priority

| Cypress file                                              | Tags                               | MM-T                    | Test case                                                     | Maps to        | Status      |
| --------------------------------------------------------- | ---------------------------------- | ----------------------- | ------------------------------------------------------------- | -------------- | ----------- |
| `auth_sso/authentication_1_spec.ts`                       | `@authentication`                  | MM-T1756-1758           | Domain restriction                                            | AUTH-5         | Not started |
|                                                           |                                    | MM-T1763                | Email verification not required                               | AUTH-5         | Not started |
|                                                           |                                    | MM-T1765                | Email creation disabled                                       | AUTH-5         | Not started |
| `auth_sso/authentication_2_spec.ts`                       | `@authentication @mfa`             | MM-T1771-1774           | Password length/requirements validation                       | AUTH-6         | Not started |
|                                                           |                                    | MM-T1777/1779/1780      | MFA option visibility                                         | AUTH-6         | Not started |
| `auth_sso/authentication_3_spec.ts`                       | `@authentication`                  | MM-T1767-1769           | Email/username sign-in combinations (parametrized)            | AUTH-8         | Not started |
| `auth_sso/authentication_4_spec.ts`                       | `@authentication`                  | MM-T1764                | Verification required                                         | AUTH-5         | Not started |
|                                                           |                                    | MM-T1770                | Default password settings                                     | AUTH-5         | Not started |
|                                                           |                                    | MM-T1783                | Username validation                                           | AUTH-5         | Not started |
|                                                           |                                    | MM-T1752/1753           | Enable account creation                                       | AUTH-5         | Not started |
|                                                           |                                    | MM-T1754/1755           | Domain restriction on signup                                  | AUTH-5         | Not started |
| `auth_sso/authentication_not_cloud_spec.ts`               | `@authentication @not_cloud`       | MM-T1762                | Invite salt                                                   | AUTH-5         | Not started |
|                                                           |                                    | MM-T1775/1776           | Max login attempts field                                      | AUTH-5         | Not started |
| `auth_sso/hide_create_account_spec.ts`                    | `@authentication`                  | MM-T1760                | Create-account link hidden when open server disabled          | AUTH-5         | Not started |
| `enterprise/auth_sso/authentication_spec.ts`              | `@enterprise @authentication`      | MM-T1759                | Domain restriction (open team invite)                         | AUTH-5         | Not started |
|                                                           |                                    | MM-T1761                | Create-link visibility                                        | AUTH-5         | Not started |
|                                                           |                                    | MM-T1766                | Email creation enabled                                        | AUTH-5         | Not started |
| `enterprise/auth_sso/mfa_authentication_spec.ts`          | `@enterprise @authentication @mfa` | MM-T1778                | MFA enforced                                                  | AUTH-6         | Not started |
|                                                           |                                    | MM-T1781                | Admin removes user's MFA                                      | AUTH-6         | Not started |
|                                                           |                                    | MM-T1782                | Remove-MFA option hidden                                      | AUTH-6         | Not started |
| `enterprise/saml/saml_metadata_spec.ts`                   | `@enterprise @saml`                | —                       | Metadata fetch failure vs. success from IdP metadata URL      | SAML-11        | Not started |
| `enterprise/system_console/openid/openid_spec.js`         | `@enterprise @system_console`      | MM-T3623/3620/3621/3622 | UI dropdown sets Generic/Google/GitLab/Exchange OpenID config | AUTH-1, AUTH-2 | Not started |
| `enterprise/system_console/authentication_method_spec.js` | `@enterprise @system_console @mfa` | MM-T953                 | Correct auth method label shown                               | AUTH-3         | Not started |

### E.3 Out of scope — not part of this migration

- `enterprise/oauth/oauth_spec.ts` — Mattermost acting as an **OAuth 2.0 provider** for
  third-party apps (create/edit/delete OAuth app, token exchange, reconnect,
  regenerate secret). Different feature area from SSO login into Mattermost.
- `enterprise/ldap/ldap_group_sync_spec.ts` — channel privacy conversion behavior for
  LDAP-group-synced teams/channels, not the login/auth flow itself.
- `enterprise/ldap_group/*.spec.ts` (6 files: channel_modes, group_mentions,
  groups_assign_roles, invite_bot, search_channels, team_and_channel_assign_roles) —
  LDAP group → role/permission mapping, not authentication.
- Test-management folder `suite/ldap-group-sync` (107 test cases) and the group-constraint
  block within `suite/ad-ldap` (MM-T2734–MM-T2824, ~90 test cases) — group↔team/channel
  linking, constrained-channel UI, permission promotion/demotion. Same "Groups" feature
  area as the two bullets above; a separate migration effort, not core login/SSO.
- Test-management folder `easy-login/*` (22 test cases) — a distinct passwordless
  magic-link feature, unrelated to SSO/SAML/LDAP/OpenID.
- Test-management folder `suite/oauth` (MM-T3005–3008: OAuth SSO login against real
  Google/Office365/GitLab) — mechanically identical to generic OpenID pointed at
  Keycloak's endpoints (already covered by OIDC-* and AUTH-1/AUTH-2); redundant to
  re-automate against real third-party IdPs for this migration.
- MM-T3899 (Account setting for OpenID SSO) and MM-T3946 (Convert Office 365 to
  OpenID) — folded into AUTH-1/AUTH-2 scope (System Console OpenID config), not
  separate cases.

Helpers referenced by the specs above (not specs themselves, but need Playwright
equivalents in `lib/src/server/`): `support/keycloak_commands.ts`,
`support/api/keycloak.js`, `support/saml_commands.ts`, `support/ldap_commands.js`,
`support/ldap_server_commands.ts`, `support/okta_commands.ts` (Okta-only; the two
Okta-backed specs should be re-targeted to Keycloak rather than porting Okta support).

## Migration & deletion workflow

1. Pick a row (or a small batch sharing one Cypress file) from section E.
2. Implement the Playwright spec/helper/page-object per the "Implementation
   prerequisites" below, placed per the directory conventions above, reusing
   `pw.ensureKeycloak()` / `pw.createKeycloakUser()` where possible instead of
   re-inventing Cypress's helper surface.
3. Pass the quality gate below.
4. Flip the row's Status to `Ported` in this doc.
5. Once all test cases in a Cypress file are `Ported`, delete that Cypress spec file
   in the same PR (or an immediate follow-up) and flip Status to `Deleted`. Don't
   delete a Cypress file while any of its test cases are still `Not started`.
6. Section E.3 files are excluded from this workflow and are left in Cypress as-is.
7. **Final step, once every row above is `Ported` or explicitly deferred**: remove all
   remaining Cypress LDAP/SAML/OpenID/Keycloak-related tests and support code
   (`e2e-tests/cypress/tests/integration/channels/enterprise/{ldap,saml}/`,
   `ad_ldap/saml_ldap_sync*`, `extend_session/.../with_{ldap,saml}_login_spec.ts`,
   `okta_login_spec.ts`, `keycloak_commands.ts`, `ldap_server_commands.ts` and any
   fixtures only they use) so Playwright is the sole home for this coverage. Don't do
   this until this doc's Section E shows nothing outstanding for those areas.

### Git workflow

**Never commit automatically.** Implement, verify against the quality gate, and leave
the changes staged/unstaged for review — only create a commit when the user
explicitly asks for one. This applies throughout this migration, including file
moves/deletes (section E's Cypress deletions included).

### Quality gate

No test case may be flipped to `Ported` until it passes both checks below.

1. **Static checks** — `npm run check` (runs `lint`, `prettier`, `tsc`, and
   `lint:test-docs` in sequence). Fix everything it flags; don't merge with any of
   the four suppressed or skipped.
2. **Stability run — repeat each new/changed spec file 3x** to catch flakiness before
   it reaches CI, against real Testcontainers (no mocks, per the authoring conventions
   above):

    ```bash
    npx playwright test <path/to/spec.ts> --repeat-each=3 --project=chrome
    ```

    All runs must pass. A spec that's flaky under `--repeat-each` is not done — fix the
    root cause (timing, container readiness, leftover state from a prior iteration)
    rather than adding retries or loosening assertions.

## Implementation prerequisites

### Done (OIDC-1)

1. **`lib/src/ui/pages/login.ts`** — added `openIdLoginButton` (`#openid`, same reasoning as `samlLoginButton`: accessible name is the configurable `ButtonText`, not stable across tests). `goto()` now takes an optional absolute URL override (needed below).
2. **`lib/src/ui/pages/keycloak_login.ts`** (new) — `KeycloakLoginPage` object wrapping Keycloak's hosted login form. Also used to fix `saml_login.spec.ts`'s pre-existing POM violation.
3. **`lib/src/server/keycloak.ts`** — added `openidServerConfig()` and `ensureKeycloakOpenId()`, targeting the existing `mattermost-openid` client. Exported from `server/index.ts` and wired into `test_fixture.ts` as `pw.ensureKeycloakOpenId()`.
4. **`specs/functional/oidc/openid_login.spec.ts`** — OIDC-1, passing a 10x `--repeat-each` stability run.

Several non-obvious infra fixes were required to get OIDC-1 actually working end-to-end (not just compiling) — future OAuth-family SSO specs (OIDC-2 through OIDC-7, and any GitLab/Google/Office365-via-Keycloak test) will need the same:

- **`openidServerConfig()`'s `AuthEndpoint` stays host-reachable** (`testConfig.keycloakUrl`), _not_ the Testcontainers alias. This is the guideline this section exists to state:

    > **Minimize reliance on the Testcontainers-internal alias (`server:8065`/`keycloak:8080`) — never for an endpoint an external client is meant to call directly.** Only use it where there is truly no other option (a container's own outbound call, like the server's TokenEndpoint/UserAPIEndpoint requests, which can never reach a host-mapped port). Anything a _browser_ drives — especially a config value like `AuthEndpoint` that a real user's browser follows — must stay host-reachable. The same Testcontainers-started server can be, and regularly is, poked at manually (`npm run tc:up`) with an ordinary browser that has no special setup; an alias-only `AuthEndpoint` would make OpenID login silently unusable there, breaking the very thing being tested for anyone outside the test harness.

    Originally `AuthEndpoint` was also set to the alias, matching `TokenEndpoint`/`UserAPIEndpoint`, to work around Keycloak (`KC_HOSTNAME_STRICT=false`) tying an issued access token's validity to whichever hostname received the request that issued it — a real hostname-mismatch bug, but the wrong fix. The right fix: **`ensureKeycloakRealmFrontendUrl()`** (in `lib/src/server/keycloak.ts`) sets the realm's `attributes.frontendUrl` to the host-reachable Keycloak URL via the admin REST API, fixing Keycloak's issuer identity so it no longer depends on which hostname a given request arrived on. `TokenEndpoint`/`UserAPIEndpoint` still use the alias — that part is a plain container-to-container call the browser is never involved in, so it carries none of the "unusable outside the harness" risk and has no host-reachable alternative.

- **`ServiceSettings.SiteURL` is now genuinely host-reachable, not alias-locked** — the actual fix for the redirect_uri/cookie problem below, superseding an earlier, abandoned approach (running the whole flow on the internal alias origin via `--host-resolver-rules`). Two changes made this possible:

    1. **`lib/src/containers/mattermost_container.ts`** — the Mattermost container now binds to a **fixed host port**, `MATTERMOST_FIXED_HOST_PORT = 8055` (`lib/src/containers/constants.ts`), via `.withExposedPorts({container: MATTERMOST_PORT, host: MATTERMOST_FIXED_HOST_PORT})`, instead of a random one. This was the real blocker: `MM_SERVICESETTINGS_SITEURL` can be moved out of the "always wins" `structuralEnv()` tier (see next point) just fine, but every `restartMattermostContainer()` call recreates the container from scratch, and Testcontainers assigns a **new random host port** on every fresh container — so any `SiteURL` value baked in from a pre-restart `testConfig.baseURL` goes stale the instant the restart finishes. A fixed port makes `baseURL` stable across restarts, which is what makes the rest of this work at all. Deliberately **not** `MATTERMOST_PORT` (8065) itself — that's the conventional port a locally-run dev server (`make run`, external mode) already listens on, so a developer can run both at once without a collision. Assumes one Mattermost testcontainers stack per host at a time (already true of `PW_TESTCONTAINERS_REUSE`'s single-stack model); CI runs each matrix job on its own isolated runner, so no collision there either.
    2. **`lib/src/containers/env_baseline.ts`** — `MM_SERVICESETTINGS_SITEURL` moved from `structuralEnv()` (always wins over any restart-requested override) down to `SERVER_ENV_BASELINE` (overridable), still defaulting to the alias for every spec that doesn't touch it. Unlike `MM_CONFIG`/`MM_SQLSETTINGS_*` (kept in `structuralEnv()` — overriding those risks the server failing to boot or connecting to the wrong database entirely), overriding `SiteURL` can't corrupt connectivity; the only real risk was prepackaged plugins needing a valid value at `OnActivate`, which was verified empirically (`specs/functional/channels/ai/recaps.spec.ts`, all 13 cases, passed with `SiteURL` flipped host-facing).

    **`lib/src/server/server_env.ts`** — `ensureServerEnv(key, value)` (generic boot-only-env restart-if-needed helper, mirroring `ensureFeatureFlag`) and `ensureSiteUrl()` (restarts with `SiteURL` set to `testConfig.baseURL`, verifying against `adminClient.getConfig()` afterward) both live here. `ensureSiteUrl()` persists once set — `restartMattermostContainer()` merges env rather than replacing it, so every spec sharing the reused server afterward also gets the host-facing `SiteURL` — call it only from a spec that genuinely needs this, not casually.

    `openid_login.spec.ts` now calls `pw.ensureSiteUrl()` and otherwise looks exactly like `saml_login.spec.ts`/`ldap_login.spec.ts` — no more `internalBaseURL`, no more `--host-resolver-rules` (removed entirely from `playwright.config.ts`/`test_config.ts`, since nothing needs it anymore).

### Related cleanup: `SERVER_ENV_BASELINE` feature flags

Investigating `ensureServerEnv()`/boot-env precedence surfaced 7 feature flags
forced on globally in `env_baseline.ts` with no per-spec ownership. Cross-checked
against `server/public/model/feature_flags.go`'s actual production defaults:

| Flag                           | Prod default | Action                                                                                         |
| ------------------------------ | ------------ | ---------------------------------------------------------------------------------------------- |
| `AttributeValueMasking`        | `true`       | Deleted — forcing it was a no-op                                                               |
| `PermissionPolicies`           | `true`       | Deleted — no-op                                                                                |
| `PropertyFieldRank`            | `true`       | Deleted — no-op                                                                                |
| `TeamMembershipAccessControl`  | `true`       | Deleted — no-op                                                                                |
| `RecurringScheduledPosts`      | `false`      | Moved to `scheduled_messages.spec.ts` (was `skipIfFeatureFlagNotSet`, now `ensureFeatureFlag`) |
| `ResourceAttributesInPolicies` | `false`      | Moved to `abac/resource_attributes/*.spec.ts` (same swap)                                      |
| `WysiwygEditor`                | `false`      | Moved to `wysiwyg_editor/*.spec.ts` via a `test.beforeEach` per file (no prior guard at all)   |

Verified empirically, not just by reading defaults: ran all 5 touched files (41
tests) plus a spot-check across other ABAC areas relying on the 4 deleted flags
(masking, permission-policy UI, team sync — 36 tests). All passed.

### Done (OIDC-3, OIDC-4, OIDC-5, SAML-2)

5. `suspendKeycloakUser(userId)` added to `lib/src/server/keycloak.ts` (real admin REST API `PUT .../users/{id}` with `enabled: false`), used by both OIDC-4 and SAML-2. `keycloakDeleteUserSessions` wasn't needed — disabling the account is sufficient to make Keycloak refuse the login outright.
   `KeycloakLoginPage` gained `errorMessage` (`#input-error`, wrong-password field error) and `accountDisabledMessage` (`getByText('Account is disabled, contact your administrator.')`, the disabled-account page-level alert) — both verified empirically against real Keycloak responses, not assumed from theme docs.

### Done (OIDC-2/6, SAML-3/4/5/6/9/10/11, LDAP-2 partial/3)

10. `suspendKeycloakUser`'s pattern extended to a `keycloakSamlDescriptorUrl()` export (was
    module-private) for SAML-11's direct `getSamlMetadataFromIdp()` success-case check.
11. **`SamlSettings.EnableSyncWithLdap` must be reset to `false` in `samlServerConfig()`** — found
    the hard way via a 3x combined stability run: once `saml_ldap_sync.spec.ts` turns it on, every
    later `ensureKeycloak()` call in the same run leaves it on (patchConfig only merges), and from
    server v10.9+ a SAML user absent from LDAP then fails login outright. Fixed by having
    `samlServerConfig()` explicitly return `EnableSyncWithLdap: false`, so any spec starts clean
    regardless of run order, instead of requiring every SAML+LDAP-sync test to remember to reset it.
12. **`LdapSettings.EnableSync` must be explicitly turned on for `adminClient.syncLdap()` to do
    anything** — `App.SyncLdap()` silently no-ops (server-side log only, no client error) when it's
    off, and `ldapServerConfig()` doesn't set it. `saml_ldap_sync.spec.ts` patches it on directly.
13. SAML+LDAP sync (`EnableSyncWithLdap`) matches users by **email** by default (confirmed via
    server docs; `EnableSyncWithLdapIncludeAuth` is the opt-in to match by ID attribute instead) -
    the two sync tests give the LDAP and Keycloak users matching emails, then diverge only the
    LDAP-side name after first login to prove a follow-up sync (not the original SAML assertion)
    is the source of the new value.

### Deferred (with rationale)

14. **SAML-7** (session extension for SAML-authenticated sessions): Cypress's only source file
    (`extend_session/.../with_saml_login_spec.ts`) forces a session to nearly expire by writing
    directly to the `Sessions` table (`cy.dbUpdateUserSession`) rather than waiting out the real
    interval - there's no Playwright-lib equivalent for direct DB access today. Needs either new
    direct-DB infra in the lib or a (much slower) real-time-based rewrite before this is worth
    porting.
15. **SAML-8** (admin login via SAML): Cypress's `okta_login_spec.ts` matches admin status off an
    Okta-side `UserType`/`IsAdmin` profile field via `SamlSettings.AdminAttribute`. Keycloak's
    current realm export (`keycloak-realm-export.json`) has no equivalent user attribute or SAML
    assertion mapper - doing this right needs a realm-export change (a new mapper + attribute),
    which is out of scope for this pass.
16. **LDAP-2's MM-T1427** (invite-guest blocked for LDAP group-synced teams): needs LDAP group
    objects (`groupOfNames`/`posixGroup`) and group-to-team sync, and `lib/src/server/openldap.ts`
    has no group CRUD at all today - only flat `inetOrgPerson` users under one org unit. Out of
    scope until group support is added there.
17. **LDAP-2's MM-T1424** (System Console UI: Guest Attribute/Guest Filter inputs disabled when
    Guest Access is off): a pure admin-console UI check with no new server behavior: needs a
    `LdapSettings`/`GuestAccountsSettings` System Console page object this plan hasn't built yet.
    Lower priority than the behavioral cases above.

Additionally, for the login-method switching cases (AUTH-9 through AUTH-13), still greenfield:

6. New page object `lib/src/ui/components/user_settings/security.ts` (or similar) for the Account Settings → Security "Sign-in Method" section, exposing the "Switch to using X" links. Confirmed selectors (no test ids/aria-labels exist - name-based only): `"Switch to Using OpenID SSO"` (`switchOpenId`), `"Switch to Using SAML SSO"` (`switchSaml`), `"Switch to Using AD/LDAP"` (`switchLdap`), `"Switch to Using Email and Password"` (`switchEmail`). The whole section is hidden unless `ExperimentalEnableAuthenticationTransfer` is on (webapp-side gate, independent of licensing).
7. New page objects under `lib/src/ui/pages/claim/` (or a single `claim.ts` with sub-views) for `/claim/email_to_oauth`, `/claim/oauth_to_email`, `/claim/email_to_ldap`, `/claim/ldap_to_email`. Confirmed fields (all plain `name`-attribute inputs, no test ids): `email_to_oauth` has `password`; `oauth_to_email` has `password` (new) + `passwordconfirm`; `email_to_ldap` has `emailPassword` + `ldapId` + `ldapPassword`; `ldap_to_email` has `ldapPassword` + `password` (new) + `passwordconfirm`. Each redirects via `window.location.href = data.follow_link` on success.
8. No dedicated server helper is required beyond what `keycloak.ts`/`openldap.ts` already provide — the switch itself is driven through the UI (password field) plus following the redirect to Keycloak's hosted login form, matching the pattern in `saml_login.spec.ts`. Since this is also an OAuth-style redirect for the SSO direction, it will likely need `pw.ensureSiteUrl()` too (see OIDC-1's prerequisites above).
9. New spec directory: `specs/functional/auth/switch_login_method.spec.ts` (per Directory conventions above).
