# Gap Analysis Report

Run ID: gap-local-mma0b9ea-ufklja
Run window: 2026-03-03T02:46:48.656Z -> 2026-03-03T02:47:14.435Z
Run duration (ms): 25777
Since ref: HEAD~1
Framework: playwright
Test Patterns: specs/**/*.spec.ts
Impact Model: flow=heuristic test=heuristic confidence=low
Traceability: enabled=true manifestFound=false matchedFlows=0/48 matchedTests=0 coverageRatio=0
Dependency Graph: enabled=true seeds=14 expanded=38 files=2812 edges=2458 depth=3
Changed Files: 20
Flows: P0=6 P1=26 P2=16

Warnings:
- Dependency graph expanded impacted files by 38 (depth=3).
- Traceability manifest not found or invalid: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/.e2e-ai-agents/traceability.json
- Mattermost profile: traceability manifest is missing; targeted recommendations require traceability evidence.
- Mattermost profile: heuristic-only test mapping is disallowed; forcing broad run recommendation.

Impacted Flows:
- [P0] Admin (admin)
  Score: 14
  Reasons: State or data flow change; Critical keyword: admin
  Files: channels/src/packages/mattermost-redux/src/reducers/entities/admin.ts, platform/types/src/admin.ts, channels/src/packages/mattermost-redux/src/actions/admin.ts
  Audience: channel_admin, member
  Blast radius: broad; unflagged
- [P0] Admin Sidebar (admin_sidebar)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/admin_sidebar/admin_sidebar.tsx, channels/src/components/admin_console/admin_sidebar/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] License Settings (license_settings)
  Score: 11
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/license_settings/license_settings.tsx, channels/src/components/admin_console/license_settings/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] System Analytics (system_analytics)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/analytics/system_analytics/index.ts, channels/src/components/analytics/system_analytics/system_analytics.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Enterprise Edition Left Panel (enterprise_edition_left_panel)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/license_settings/enterprise_edition/enterprise_edition_left_panel.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Single Channel Guest Limit Banner (single_channel_guest_limit_banner)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/announcement_bar/single_channel_guest_limit_banner/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Admin Actions (admin_actions)
  Score: 6
  Reasons: UI logic change; State or data flow change; Critical keyword: admin
  Files: channels/src/actions/admin_actions.jsx
  Audience: channel_admin
  Blast radius: admin-only; unflagged
- [P1] Single Channel Guests Card (single_channel_guests_card)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/analytics/single_channel_guests_card/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Announcement Bar Controller (announcement_bar_controller)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/announcement_bar/announcement_bar_controller.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Admin Definition (admin_definition)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/admin_definition.tsx
  Audience: system_admin
  Flags: SiteURL (on), ListenAddress (on), Forward80To443 (on), ConnectionSecurity (on), TLSCertFile (on), UseLetsEncrypt (on), TLSKeyFile (on), LetsEncryptCertificateCacheFile (on), ReadTimeout (on), WriteTimeout (on), MaximumPayloadSizeBytes (on), WebserverMode (on), EnableInsecureOutgoingConnections (on), ManagedResourcePaths (on), EnableSecurityFixAlert (on), EnableTesting (on), EnableDeveloper (on), EnableClientPerformanceDebugging (on), AllowedUntrustedInternalConnections (on), EnableDesktopLandingPage (on), EnableCustomGroups (on), RefreshPostStatsRunTime (on), DeleteAccountLink (on), EnableEmojiPicker (on), EnableCustomEmoji (on), ThreadAutoFollow (on), CollapsedThreads (on), AllowSyncedDrafts (on), ScheduledPosts (on), PostPriority (on), AllowPersistentNotifications (on), PersistentNotificationMaxRecipients (on), PersistentNotificationIntervalMinutes (on), PersistentNotificationMaxCount (on), AllowPersistentNotificationsForGuests (on), EnableBurnOnRead (on), BurnOnReadDurationSeconds (on), BurnOnReadMaximumTimeToLiveSeconds (on), EnableLinkPreviews (on), RestrictLinkPreviews (on), EnablePermalinkPreviews (on), EnableSVGs (on), EnableLatex (on), EnableInlineLatex (on), GoogleDeveloperKey (on), UniqueEmojiReactionLimitPerPost (on), EnableEmailInvitations (on), EnableMultifactorAuthentication (on), EnforceMultifactorAuthentication (on), EnableIncomingWebhooks (on), EnableOutgoingWebhooks (on), EnableOutgoingOAuthConnections (on), EnableCommands (on), EnableOAuthServiceProvider (on), EnableDynamicClientRegistration (on), OutgoingIntegrationRequestsTimeout (on), EnablePostUsernameOverride (on), EnablePostIconOverride (on), EnableUserAccessTokens (on), EnableBotAccountCreation (on), DisableBotsWhenOwnerIsDeactivated (on), EnableGifPicker (on), AllowCorsFrom (on), CorsExposedHeaders (on), CorsAllowCredentials (on), CorsDebug (on), FrameAncestors (on), ExperimentalEnableAuthenticationTransfer (on), EnableChannelViewedMessages (on), ExperimentalEnableDefaultChannelLeaveJoinMessages (on), ExperimentalEnableHardenedMode (on), EnableTutorial (on), EnableOnboardingFlow (on), EnableUserTypingMessages (on), TimeBetweenUserTypingUpdatesMilliseconds (on)
  Blast radius: admin-only; flagged-on
- [P1] Search (search)
  Score: 6
  Reasons: State or data flow change; Critical keyword: search
  Files: channels/src/packages/mattermost-redux/src/actions/search.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Enterprise Edition (enterprise_edition)
  Score: 5
  Reasons: Shared component change; Visual styling change; Critical keyword: admin
  Files: channels/src/components/admin_console/license_settings/enterprise_edition/enterprise_edition.scss
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Analytics (analytics)
  Score: 5
  Reasons: Shared component change; Visual styling change
  Files: channels/src/components/analytics/system_analytics/analytics.scss
  Audience: member
  Blast radius: broad; unflagged
- [P1] Limits (limits)
  Score: 5
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/limits.ts, platform/types/src/limits.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Constants (constants)
  Score: 5
  Reasons: UI logic change
  Files: channels/src/utils/constants.tsx, channels/src/packages/mattermost-redux/src/constants/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Announcement Bar (announcement_bar)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/announcement_bar/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Entities (entities)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/reducers/entities/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Text Formatting (text_formatting)
  Score: 4
  Reasons: UI logic change
  Files: channels/src/utils/text_formatting.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Syntax Highlighting (syntax_highlighting)
  Score: 4
  Reasons: UI logic change
  Files: channels/src/utils/syntax_highlighting.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Schemes (schemes)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/schemes.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Roles (roles)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/roles.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Preferences (preferences)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/preferences.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Jobs (jobs)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/jobs.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Integrations (integrations)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/integrations.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Emojis (emojis)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/emojis.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channels (channels)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/channels.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channel Categories (channel_categories)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/channel_categories.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Boards (boards)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/boards.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Reducers (reducers)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/reducers/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Actions (actions)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] General (general)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/general.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] ConfigureStore (configureStore)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/store/configureStore.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] En (en)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/en.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Stats (stats)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/constants/stats.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Storage Utils (storage_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/storage_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Products (products)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/products.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Overage Team (overage_team)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/overage_team.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Notify Admin Utils (notify_admin_utils)
  Score: 2
  Reasons: Critical keyword: admin
  Files: channels/src/utils/notify_admin_utils.ts
  Audience: channel_admin
  Blast radius: admin-only; unflagged
- [P2] Contact Support Sales (contact_support_sales)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/contact_support_sales.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] A11y Utils (a11y_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/a11y_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Store (store)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/store.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] User Utils (user_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/user_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Team Utils (team_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/team_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Post Utils (post_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/post_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Notify Props (notify_props)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/notify_props.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Group Utils (group_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/group_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] File Utils (file_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/file_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Channel Utils (channel_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/channel_utils.ts
  Audience: member
  Blast radius: broad; unflagged

Coverage Gaps (P0/P1 without tests):
- [P1] Admin Actions (admin_actions)
- [P1] Enterprise Edition (enterprise_edition)
- [P0] Enterprise Edition Left Panel (enterprise_edition_left_panel)
- [P0] License Settings (license_settings)
- [P1] Single Channel Guests Card (single_channel_guests_card)
- [P1] Analytics (analytics)
- [P0] System Analytics (system_analytics)
- [P1] Announcement Bar Controller (announcement_bar_controller)
- [P0] Single Channel Guest Limit Banner (single_channel_guest_limit_banner)
- [P1] Limits (limits)
- [P0] Admin (admin)
- [P1] Constants (constants)
- [P1] Admin Definition (admin_definition)
- [P1] Announcement Bar (announcement_bar)
- [P1] Entities (entities)
- [P1] Text Formatting (text_formatting)
- [P1] Syntax Highlighting (syntax_highlighting)
- [P0] Admin Sidebar (admin_sidebar)
- [P1] Schemes (schemes)
- [P1] Roles (roles)
- [P1] Preferences (preferences)
- [P1] Jobs (jobs)
- [P1] Integrations (integrations)
- [P1] Emojis (emojis)
- [P1] Channels (channels)
- [P1] Channel Categories (channel_categories)
- [P1] Boards (boards)
- [P1] Reducers (reducers)
- [P1] Actions (actions)
- [P1] General (general)
- [P1] Search (search)
- [P1] ConfigureStore (configureStore)

Pipeline Results:
- Runner: playwright-agents
- MCP: requested=true active=true backend=playwright-agents
- admin_actions (Admin Actions): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/admin_actions
- enterprise_edition (Enterprise Edition): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/enterprise_edition
- enterprise_edition_left_panel (Enterprise Edition Left Panel): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/enterprise_edition_left_panel
- license_settings (License Settings): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/license_settings
- single_channel_guests_card (Single Channel Guests Card): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/single_channel_guests_card
- analytics (Analytics): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/analytics
- system_analytics (System Analytics): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/system_analytics
- announcement_bar_controller (Announcement Bar Controller): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/announcement_bar_controller
- single_channel_guest_limit_banner (Single Channel Guest Limit Banner): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/single_channel_guest_limit_banner
- limits (Limits): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/limits
- admin (Admin): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/admin
- constants (Constants): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/constants
- admin_definition (Admin Definition): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/admin_definition
- announcement_bar (Announcement Bar): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/announcement_bar
- entities (Entities): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/entities
- text_formatting (Text Formatting): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/text_formatting
- syntax_highlighting (Syntax Highlighting): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/syntax_highlighting
- admin_sidebar (Admin Sidebar): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/admin_sidebar
- schemes (Schemes): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/schemes
- roles (Roles): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/roles
- preferences (Preferences): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/preferences
- jobs (Jobs): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/jobs
- integrations (Integrations): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/integrations
- emojis (Emojis): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/emojis
- channels (Channels): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/channels
- channel_categories (Channel Categories): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/channel_categories
- boards (Boards): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/boards
- reducers (Reducers): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/reducers
- actions (Actions): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/actions
- general (General): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/general
- search (Search): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/search
- configureStore (ConfigureStore): skipped/skipped -> /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/functional/ai-assisted/configureStore

Suggested New Tests (Actionable):
- [P1] Admin Actions (admin_actions)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_actions.spec.ts
  Source files: channels/src/actions/admin_actions.jsx
  Why: UI logic change; State or data flow change; Critical keyword: admin
- [P1] Enterprise Edition (enterprise_edition)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/enterprise_edition.spec.ts
  Source files: channels/src/components/admin_console/license_settings/enterprise_edition/enterprise_edition.scss
  Why: Shared component change; Visual styling change; Critical keyword: admin
- [P0] Enterprise Edition Left Panel (enterprise_edition_left_panel)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/enterprise_edition_left_panel.spec.ts
  Source files: channels/src/components/admin_console/license_settings/enterprise_edition/enterprise_edition_left_panel.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] License Settings (license_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/license_settings.spec.ts
  Source files: channels/src/components/admin_console/license_settings/license_settings.tsx, channels/src/components/admin_console/license_settings/index.ts
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P1] Single Channel Guests Card (single_channel_guests_card)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/single_channel_guests_card.spec.ts
  Source files: channels/src/components/analytics/single_channel_guests_card/index.tsx
  Why: Shared component change; UI logic change
- [P1] Analytics (analytics)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/analytics.spec.ts
  Source files: channels/src/components/analytics/system_analytics/analytics.scss
  Why: Shared component change; Visual styling change
- [P0] System Analytics (system_analytics)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/system_analytics.spec.ts
  Source files: channels/src/components/analytics/system_analytics/index.ts, channels/src/components/analytics/system_analytics/system_analytics.tsx
  Why: Shared component change; UI logic change
- [P1] Announcement Bar Controller (announcement_bar_controller)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/announcement_bar_controller.spec.ts
  Source files: channels/src/components/announcement_bar/announcement_bar_controller.tsx
  Why: Shared component change; UI logic change
- [P0] Single Channel Guest Limit Banner (single_channel_guest_limit_banner)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/single_channel_guest_limit_banner.spec.ts
  Source files: channels/src/components/announcement_bar/single_channel_guest_limit_banner/index.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Limits (limits)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/limits.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/limits.ts, platform/types/src/limits.ts
  Why: State or data flow change
- [P0] Admin (admin)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/reducers/entities/admin.ts, platform/types/src/admin.ts, channels/src/packages/mattermost-redux/src/actions/admin.ts
  Why: State or data flow change; Critical keyword: admin
- [P1] Constants (constants)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/constants.spec.ts
  Source files: channels/src/utils/constants.tsx, channels/src/packages/mattermost-redux/src/constants/index.ts
  Why: UI logic change
- [P1] Admin Definition (admin_definition)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_definition.spec.ts
  Source files: channels/src/components/admin_console/admin_definition.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P1] Announcement Bar (announcement_bar)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/announcement_bar.spec.ts
  Source files: channels/src/components/announcement_bar/index.ts
  Why: Shared component change
- [P1] Entities (entities)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/entities.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/reducers/entities/index.ts
  Why: State or data flow change
- [P1] Text Formatting (text_formatting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/text_formatting.spec.ts
  Source files: channels/src/utils/text_formatting.tsx
  Why: UI logic change
- [P1] Syntax Highlighting (syntax_highlighting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/syntax_highlighting.spec.ts
  Source files: channels/src/utils/syntax_highlighting.tsx
  Why: UI logic change
- [P0] Admin Sidebar (admin_sidebar)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_sidebar.spec.ts
  Source files: channels/src/components/admin_console/admin_sidebar/admin_sidebar.tsx, channels/src/components/admin_console/admin_sidebar/index.ts
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Schemes (schemes)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/schemes.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/schemes.ts
  Why: State or data flow change
- [P1] Roles (roles)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/roles.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/roles.ts
  Why: State or data flow change
- [P1] Preferences (preferences)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/preferences.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/preferences.ts
  Why: State or data flow change
- [P1] Jobs (jobs)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/jobs.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/jobs.ts
  Why: State or data flow change
- [P1] Integrations (integrations)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/integrations.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/integrations.ts
  Why: State or data flow change
- [P1] Emojis (emojis)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/emojis.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/emojis.ts
  Why: State or data flow change
- [P1] Channels (channels)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channels.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/channels.ts
  Why: State or data flow change
- [P1] Channel Categories (channel_categories)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_categories.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/channel_categories.ts
  Why: State or data flow change
- [P1] Boards (boards)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/boards.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/boards.ts
  Why: State or data flow change
- [P1] Reducers (reducers)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/reducers.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/reducers/index.ts
  Why: State or data flow change
- [P1] Actions (actions)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/actions.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/index.ts
  Why: State or data flow change
- [P1] General (general)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/general.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/general.ts
  Why: State or data flow change
- [P1] Search (search)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/search.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/search.ts
  Why: State or data flow change; Critical keyword: search
- [P1] ConfigureStore (configureStore)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/configureStore.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/store/configureStore.ts
  Why: State or data flow change