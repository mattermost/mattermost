# Mobile Security Controls Governed by Permission Policies — Implementation Notes

Build-time clarifications: traps an implementer must get right, which aren't needed to understand the design. The spec is `mobile-security-permission-policies.spec.md`.

## End-to-end deliverable

An admin on an Enterprise Advanced server with `PermissionPolicies`, `SessionAttributes` and `EnableAttributeBasedAccessControl` on can: open Mobile Security, pick "Based on a policy" on Enable Biometric Authentication, click Add new policy, continue through the modal, save the prefilled policy, and a current mobile client then opens that server without a prompt only after passing biometrics, while a client that fails or cancels the prompt is blocked with Retry / Switch server / Log out. The same for Prevent Screen Capture with `capture_mobile_screen`. Removing the policy restores today's behaviour on every client without a restart.

Three repos change: `mattermost` (server + webapp), `enterprise` (evaluator), `mattermost-mobile` plus the `@mattermost/react-native-network-client` library (per-server session attribute values).

## Server: model (`server/public/model`)

- `access_policy.go`: add `AccessControlPolicyActionUseMobileApp = "use_mobile_app"` and `AccessControlPolicyActionCaptureMobileScreen = "capture_mobile_screen"`. Add both to `allowedActionsV0_3`. Add `systemLevelActions` and `IsSystemLevelAction(action string) bool` (exported: the app layer and tests need it).
- Do NOT add them to `allowedPermissionActionsV0_4`. That set drives `IsPermissionAction`, which (a) requires a channel `Role` and unique `Name` on the rule and (b) gates channel policies behind `FeatureFlags.ChannelPermissionPolicies` via `HasPermissionRuleAction`. Neither applies.
- In `accessPolicyVersionV0_3` and `accessPolicyVersionV0_4`, inside the per-rule action loop, reject a system-level action when `p.Type != AccessControlPolicyTypePermission`. New error id, e.g. `model.access_policy.is_valid.actions.system_level_type.app_error`, text "system-level actions are only allowed on permission policies". Add the id to `server/i18n/en.json` with a `description`, then run `make i18n-extract`.
- v0.3 permission policies accept `membership` in `allowedActionsV0_3` today; leave that alone, it's pre-existing.
- `session_attributes.go`: add `SessionAttributesPropertyFieldBiometricAuthenticated = "biometric_authenticated"` and `SessionAttributesDisplayNameBiometricAuthenticated = "Biometric authenticated"`. Add the field to `SessionAttributeSystemFields` next to `jailbreak_detected` (both `mobileOnly`, posture TTL/grace, `boolSelectOptions`). The comment on `IsValidSessionAttributeValue` says the schema is fixed and the largest option list has 19 entries; a two-option select changes nothing there.
- `access_control_decision.go`: `ActionSearchRequest.IsValid` already allows `Type == permission` with empty ID (`systemLevel`). No change. Leave the `RenderDecisionReasonRestrictedByPolicy` comment ("the only denial reason") as is; `no_policy` is an allow reason. Consider a `RenderDecisionReasonNoPolicy = string(AccessDecisionReasonNoPolicy)` constant so the client-facing string is reused, not retyped.

## Server: app layer (`server/channels/app`)

- `access_control_decision.go`:
  - Consider adding a licence check to the inactive branch (`!model.MinimumEnterpriseAdvancedLicense(a.License())` → defaults with `no_policy`) so an unlicensed server answers `no_policy` instead of failing closed through `isReady()`. `attributeBasedAccessControlEnabled` deliberately has no licence check (its comment ties it to the render-ETag gates), so add the check here rather than there. Optional: the mobile client gates on licence anyway.
  - Register both actions in `renderableABACActions` with `ResourceType: model.AccessControlPolicyTypePermission`, `DefaultWhenInactive: true`, `FailClosedOnError: true`.
  - `record(action, d)`: when the PDP decision `IsNoPolicy()`, set `Reason` to `no_policy`. The inactive branch (`acs == nil || !attributeBasedAccessControlEnabled()`) must also set `Reason: no_policy` on every action it records, including the file actions; the web app only reads `allowed`/`evaluated` (`useRenderPermission`), so that is safe.
  - `renderDecisionOnError` is unchanged: fail-closed stays `allowed:false, reason:restricted_by_policy`.
  - `channelID` is already `""` for non-channel resource types, so `BuildAccessControlSubjectForSession(rctx, "")` skips the channel-role lookup. Nothing to change there.
- `authorization.go` `HasPermissionToChannelAction`: untouched. It reads only `decision.Decision`, so the `no_policy` context is invisible to it.
- `migrations.go` `seedSessionAttributeFields` creates missing built-in fields on every startup; no migration entry needed for the new attribute.
- Nothing in `access_control.go` needs to change for the mobile actions. `publishPermissionPolicyUpdate` already fires on every permission-policy save/delete and the mobile app keys off that event.

## Server: api4

- `access_control.go` `searchAccessControlDecisionActions`: add `case model.AccessControlPolicyTypePermission:` with no body (no resource to authorise; `SearchAllowedActionsForCurrentUser` already rejects a Subject that isn't the session user). Keep the `default:` rejection for every other type.
- The route is `POST /api/v4/access_control/decisions/actions/search` (`BaseRoutes.AccessControlDecisions`). `Client4.SearchAccessControlDecisionActions` already exists; mobile needs its own client method (see below).
- `searchAccessControlPolicies` passes `AccessControlPolicySearch.Actions` straight to the store, which filters with a JSONB containment on `rules[].actions` and skips expression-less rules. No change; the console uses it as is. It requires `manage_system`, which is why "Based on a policy" is gated on that permission.

## Enterprise: evaluator (`access_control/evaluation/evaluator.go`)

- `Evaluate`: after the plugin-type branch, add `if accessRequest.Resource.Type == model.AccessControlPolicyTypePermission { return e.evaluatePermissionPolicy(rctx, role, accessRequest, evalCtx) }`. Without this the resource lane calls `cache.ResolveRule(rctx, "", ...)`, which fetches `AccessControlPolicy().Get(rctx, "")`, gets `ErrNotFound`, and pollutes the no-policy LRU with the `""` key. It would still allow, so the skip is correctness hygiene rather than a behaviour change.
- `evaluatePermissionPolicy`: replace the final `return model.AccessDecision{Decision: true}, nil` (the "no policy of any role" branch after `ActionHasPermissionPolicy` returns false) with `return model.NewNoPolicyAccessDecision(), nil`. Leave the `role == ""` early return alone: an empty role means no session (background worker) and the current plain allow is deliberate.
- `Evaluate`'s combined return for channel actions stays `model.AccessDecision{Decision: true}`; only system-level requests propagate the permission lane's decision object.
- `resolveSystemRole(rctx)` reads `rctx.Session()`. The decision endpoint is `APISessionRequired`, so the session is present.
- `simulation.go` `collectSystemPermissionContributions` and `cel_utils` need no change; actions are strings. `administration.go` `checkSessionAttributes` already rejects a rule referencing a disabled attribute with "is not enabled, please enable it in Session Attributes".
- Tests: extend `evaluator_test.go` (no-policy reason, skip of the resource lane for permission type) and `permission_cache` tests if `ActionHasPermissionPolicy` behaviour is asserted anywhere for unknown actions.

## Webapp: Mobile Security page

- `admin_definition.tsx` `mobile_security` schema: replace the two `type: 'bool'` settings for `NativeAppSettings.MobileEnableBiometrics` and `NativeAppSettings.MobilePreventScreenCapture` with `type: 'custom'` entries using one new component (e.g. `components/admin_console/mobile_security/policy_governed_setting.tsx`). Keep the existing `label`/`help_text` message ids so translations survive. Pass `action` (`use_mobile_app` / `capture_mobile_screen`), the prefill attribute (`biometric_authenticated` / `mdm_enrolled`) and the footer message through `componentProps` or props on the setting definition, following how other custom settings receive config (`GroupsFeatureDiscovery`, `PolicyList`).
- The custom-setting component receives `value` and `onChange(id, value)` from the schema page. "Always on" → `onChange(key, true)`, "Off" → `onChange(key, false)`, "Based on a policy" → `onChange(key, true)` plus local UI state showing the empty list and Add new policy. The page's own Save button persists the config; the component never calls the config API itself.
- Lock state: on mount, search permission policies by action. `Client4.searchPermissionPolicies(term, after, limit)` in `platform/client/src/client4.ts` builds `{term, type: 'permission', cursor, limit}` and has no `actions` parameter; extend it (and the `searchPermissionPolicies` redux action in `mattermost-redux/actions/access_control.ts`) with an optional `actions?: string[]` rather than adding a second method. Any result → radios disabled, "Based on a policy" selected, list rows with `policy.name`, a role chip from `policy.roles[0]` using the same labels as `AVAILABLE_ROLES` in the editor, and a link to `/admin_console/system_attributes/permission_policies/edit_policy/<id>`.
- Gating for showing the third radio: reuse `isPermissionPoliciesEnabled` (feature flag), `getConfig().EnableAttributeBasedAccessControl === 'true'`, `isMinimumEnterpriseAdvancedLicense(license)` from `utils/license_utils` and `haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM})`. When any is false render the two radios only and skip the policy search (it would 501/403). Known gap: an admin with Mobile Security write access but without `manage_system` can't see the lock, so they see editable switches that governed clients ignore. Accepted; the Permission Policies pages are already hidden from that admin.
- Re-fetch the lock state on mount and whenever the admin returns to the page; `permission_policy_updated` already dispatches `clearRenderDecisions()` in `websocket_actions.ts`, which is unrelated to this list, so don't rely on it.
- "Add new policy": `getHistory().push('/admin_console/system_attributes/permission_policies/edit_policy', {prefill: {...}})` with `{name, role: 'system_user', action, attribute, value: 'true'}`. Default names from the prototype: "Biometric authentication for mobile access", "Screen capture on mobile".
- Modal ("We've set up the policy for you") lives on the Mobile Security side and shows before navigation. Its Continue handler: if the prefill attribute's `PropertyField` has `attrs.enabled === false`, patch it with `{attrs: {enabled: true}}` through `patchPropertyField`, the same call `useSessionAttributeEdits` in `components/admin_console/session_attributes/` makes. Send only `enabled` (plus TTL/grace if you carry them): the server-side `SessionAttributesHook.validateUpdate` rejects every other attr edit, and `platforms` is schema-owned (`biometric_authenticated` is mobile-only, `mdm_enrolled` is desktop+mobile, so both already cover mobile). Then navigate. If the patch fails, show the error in the modal and don't navigate.
- `biometric_authenticated` requires `FeatureFlagSessionAttributes === 'true'` in the client config. When it's off, the biometrics "Add new policy" still works but prefills no rule row (the editor then shows the "add an attribute" state); make the modal copy reflect that.

## Webapp: Permission Policy editor and list

- `platform/types/src/access_control.ts`: add `ACCESS_CONTROL_ACTION_USE_MOBILE_APP` and `ACCESS_CONTROL_ACTION_CAPTURE_MOBILE_SCREEN`. Do NOT add them to `ACCESS_CONTROL_PERMISSION_ACTIONS`: that list means "channel-scoped permission rules" and drives the Channel Settings permissions tab's rule filtering.
- `permission_policy_details.tsx`: add two `AVAILABLE_PERMISSIONS` entries with `defineMessages` ids `admin.permission_policies.permission.use_mobile_app.label` ("Use this server in the mobile app"), `.description` ("Allow the user to open this server from the mobile app."), `admin.permission_policies.permission.capture_mobile_screen.label` ("Screen capture on mobile"), `.description` ("Allow screenshots and screen recordings in the mobile app."). Add both to the `actionLabels` map passed to the simulate modal (around line 848).
- Read `location.state.prefill` (react-router `useLocation`) when `policyId` is absent. Preselect role and permission, set the policy name, and seed the table editor with one row `{attribute, operator: 'is'/'==', values: ['true'], attribute_object_type: 'session'}`. The table editor already keys session rows by `attribute_object_type === SESSION_ATTRIBUTES_OBJECT_TYPE` and generates `user.session.<name> == "true"`. Mark `saveNeeded` so leaving without saving prompts.
- `permission_policies.tsx`: add both actions to `ACTION_LABELS`. Prefer moving these labels into i18n while there; today they're hard-coded strings.
- Add all new strings to `webapp/channels/src/i18n/en.json` only.

## Mobile: network client library (`@mattermost/react-native-network-client`)

- Add `setSessionAttributesServerValues(serverUrl: string, values: Record<string, string>)` to `src/SessionAttributes/index.tsx` and `NativeApiClient`.
- iOS: `SessionAttributesStore` gains per-server `serverValues: [String: String]` on the server state; `SessionAttributesEngine.setServerValues` writes them and clears `lastSentAt[name]` for each key so `getOutboundHeader` sends on the next request; `SessionAttributesCollector.collect` checks server values before `store.getStableValue` and before the native `switch`.
- Android: mirror in `SessionAttributesStore.kt` / `SessionAttributesEngine.kt` / `SessionAttributesCollector.kt`.
- An empty string value means "don't report" (the engine already skips empty values). Report `"false"` explicitly, not empty, when the user hasn't authenticated: the policy row `== "true"` fails either way, but an explicit value shows up correctly in the simulate view's session snapshot.
- Bump the library version in `mattermost-mobile/package.json` once released.

## Mobile: app

- `SecurityManager`:
  - Everywhere `config.authenticated` is assigned (`runAuthenticationAttempt` success/failure, `probeDeviceSecured` not-secured branch, `handleAppStateResume` when the window lapses), call `setSessionAttributesServerValues(server, {biometric_authenticated: config.authenticated ? 'true' : 'false'})`. Also write `'false'` in `addServer` so a fresh server reports a value before the first prompt.
  - New `ensureMobileAccess(server)` replacing step 3 of `setActiveServer`: fetch decisions → branch per the spec's numbered flow. `authenticateWithBiometricsIfNeeded` remains the `no_policy` path.
  - `switchToServer` in `app/actions/app/server.ts` calls `isDeviceJailbroken` and `authenticateWithBiometricsIfNeeded` itself before `setActiveServerDatabase(..., {skipBiometricCheck: true})`. Swap its biometrics call for `ensureMobileAccess` or the switch bypasses the policy. `switchToServerAndLogin` (same file) and `app/screens/server/index.tsx` run pre-login and stay on the switch.
  - `isScreenCapturePrevented`: after the MAM check, read the cached `capture_mobile_screen` decision; `no_policy`/absent → `config.PreventScreenCapture`; otherwise `!allowed`.
  - `onAppStateChange` `isEnabled`: return true when `use_mobile_app` is governed (cached decision without `no_policy`) OR `config.Biometrics`; `authenticate` runs `ensureMobileAccess` so the decision is re-asked after the prompt.
  - MAM precedence is unchanged: `intunePolicy.isPINRequired` still short-circuits biometrics and `isScreenCaptureAllowed === false` still wins over both setting and policy.
- Client: add `searchAccessControlDecisionActions(req)` in `app/client/rest/` using the ClientMix pattern (there's already an access-control-related mix in `app/client/rest/channels.ts`); URL `${this.urlVersion}/access_control/decisions/actions/search`.
- Remote action `fetchMobileAccessDecisions(serverUrl)` in `app/actions/remote/`: skip unless `getConfigBooleanValue(database, 'FeatureFlagPermissionPolicies')` AND `isMinimumLicenseTier(license, EnterpriseAdvanced)`, the same pair `SessionAttributesManager.refreshManifest` checks. The licence check matters: `Channels.AccessControl` is non-nil on any enterprise build, and `Service.isReady()` errors below Enterprise Advanced, which `SearchAllowedActionsForCurrentUser` turns into a fail-closed `restricted_by_policy` denial, not `no_policy`. Without the client-side gate a licence downgrade would lock every mobile user out. On success write `SYSTEM_IDENTIFIERS.MOBILE_ACCESS_DECISIONS` (new constant in `app/constants/database.ts`) with `{decisions, fetchedAt}` via the system operator; on 404/501 (older server) write `no_policy` for both. Return `{error}` on other failures and let `SecurityManager` fall back to the cached value.
- Websocket: `permission_policy_updated` is a new event for mobile. Add it to `app/constants/websocket.ts` and the switch in `app/actions/websocket/event.ts`; handler re-fetches decisions for that server and, if it's the active server, calls `SecurityManager.applyDecisions(serverUrl)` (re-run `ensureMobileAccess` + `setScreenCapturePolicy`).
- `config_changed` handling in `SecurityManager.onConfigChanged` already re-applies screen capture; make it read through the decision-aware `isScreenCapturePrevented`.
- Blocked alert: new `showAccessPolicyBlockedAlert(server, siteName, locale, retry)` in `app/utils/alerts/index.ts`, title `messages.blocked_by`, new body message, buttons from `buildSecurityAlertOptions(server, locale, cb, retry)`. Never log the decision reason with user-identifying fields beyond IDs.
- Pre-login (`app/screens/server/index.tsx`, `app/actions/app/server.ts`) keeps reading `MobileEnableBiometrics === 'true'`. With the page writing `true` in policy mode, a user may get one biometric prompt at login and then none once the policy allows; accepted.
- Offline on launch: `SecurityManager.init` loads configs from the DB; also load the cached decisions so `setActiveServer` can apply them before the network is up.
- Tests: `security_manager/index.test.ts` (each flow branch, MAM precedence preserved), `session_attributes_manager/index.test.ts` (no change in static values; add a test that `addServer` writes `false`), new remote action test with mocked `NetworkManager.getClient`, websocket handler test.

## Migration set

No DB migration. Startup seeding adds the `biometric_authenticated` PropertyField. No config migration: the two keys stay `*bool`.

## Operations

- Feature flags: everything hangs off existing flags (`PermissionPolicies`, `SessionAttributes`). Turning `PermissionPolicies` off makes the decision endpoint report defaults with `no_policy`, hides the radio and stops mobile calls.
- Rollback of the server alone leaves policies carrying the new actions; `IsValid` on the old binary rejects them on the next save (400 "unrecognized action"). Delete those policies before rolling back, or expect admins to have to delete rather than edit them.

## Deferred to verify during build

- Whether the schema-driven custom setting passes enough context (`config`, `license`, permissions) to compute the gating inside the component, or whether `isHidden` on two sibling definitions (bool vs custom) is simpler.
- Exact shape of react-router state through `getHistory().push` in the admin console (some routes remount and drop state; fall back to query params if so).
- Which existing redux action the Session Attributes page uses to patch a field's `attrs.enabled`, so the modal reuses it.
- Whether `Emm.authenticate` on Android returns distinguishable outcomes for "cancelled" vs "failed" in the policy-denied retry path; the current `getAuthenticationOutcome` mapping should be sufficient.
- Server version gate for the mobile call, in addition to the feature flag, in case the flag is on but the server predates the `permission` resource type on the decision endpoint (it returns 400 `unsupported_resource_type` today; treat 400 like 404 → `no_policy`).
