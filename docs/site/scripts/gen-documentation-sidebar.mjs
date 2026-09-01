#!/usr/bin/env node
// Generate the Documentation sidebar from the migrated content tree under
// main/. Output: docs-site/sidebars/documentation.generated.json
//
// Mirrors gen-developer-sidebar.mjs in structure. Only differences are
// the source directory and the top-level section list (per PLAN.md 3.1).
//
// File layout: all manual-grouping CONFIG lives at the top (one section per
// group of constants below) — that's what you touch when adding/moving a
// page. All FUNCTIONS (generic helpers, per-section builders, main) live at
// the bottom, and normally don't need to change for a content-only edit.
//
// Usage: node docs-site/scripts/gen-documentation-sidebar.mjs

import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join, resolve, basename, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(HERE, '..');
const REPO_ROOT = resolve(SITE_ROOT, '..');
const SRC = join(REPO_ROOT, 'main');
const OUT = join(SITE_ROOT, 'sidebars', 'documentation.generated.json');

// ===========================================================================
// CONFIG — top-level sections, and manual grouping overrides.
// ===========================================================================
//
// Most sections build their sidebar straight from the filesystem: each
// subdirectory becomes a category, each file a doc, sorted by
// `sidebar_position` frontmatter then filename (see buildCategory below).
// Overview, Deployment Guide, Administration Guide > Configure/Manage/
// Onboard/Scale, End User Guide > Collaborate, and Integrations Guide are
// flat piles of 15-49 files that read badly as one long alphabetical list,
// so each gets a manual grouping override applied at sidebar-render time
// only — the files themselves stay flat on disk, so URLs don't move.
//
// Each override is a `*_GROUPS` map (group key -> {label, landing?, items})
// plus a `*_ROOT_ORDER`/`*_ORDER` array giving the top-level order (plain
// strings for standalone docs, `{group: 'key'}` for a group from the map).
// A `*_HIDDEN` set lists files that got re-parented into a group so the
// orphan check below doesn't re-append them at the section root. (A page that
// should not appear in the sidebar at all — an MDX snippet include — is not
// listed here: it carries `unlisted: true` in its own frontmatter, which both
// this generator and Docusaurus honour. See isHidden below.) A group's
// `items` can itself contain nested `{label, items}` sub-groups (see e.g.
// OVERVIEW_GROUPS.subscription's "Cloud" sub-group below) — that's what
// gets you a 3rd level of TOC nesting (Guide > Group > Sub-group > page)
// when a section's flat list is large enough to need it.
//
// This pattern isn't a single generic engine — each section with an
// override gets its own small `buildXItem`/`regroupX` pair (see
// buildCollaborateItem/regroupCollaborate for the newest one) that mirrors
// the others in shape. Adding an override for a new section means copying
// that shape, not extending a shared function; sections without one of
// these overrides just render every level of their filesystem tree as-is
// (buildCategory already recurses to unlimited depth on its own).
//
// Adding a new file to one of these sections: add its basename to the
// relevant group's `items` (or to the root order array, if standalone). If
// you forget, the generator logs `WARN: N file(s) missing from *_ORDER` and
// falls back to appending it at the section root — so it surfaces as a
// build warning instead of silently disappearing.

const TOP_LEVEL = [
  {dir: 'product-overview',     label: 'Overview'},
  {dir: 'use-case-guide',       label: 'Use Case Guide'},
  {dir: 'deployment-guide',     label: 'Deployment Guide'},
  {dir: 'administration-guide', label: 'Administration Guide'},
  {dir: 'security-guide',       label: 'Security Guide'},
  {dir: 'end-user-guide',       label: 'End User Guide'},
  {dir: 'integrations-guide',   label: 'Integrations Guide'},
  {dir: 'get-help',             label: 'Get Help'},
];

// ---------------------------------------------------------------------------
// Overview — manual grouping override.
// ---------------------------------------------------------------------------
//
// The Overview directory is flat (~40 .mdx files at one level) for URL-
// stability reasons — moving files into sub-directories would break the
// redirect table. Mirrors the live docs.mattermost.com Overview structure.

const OVERVIEW_GROUPS = {
  // 'Subscription Overview' — paid subscription model: Self-Hosted, Cloud, Non-Profit.
  subscription: {
    label: 'Subscription Overview',
    landing: 'subscription',
    items: [
      'self-hosted-subscriptions',
      {label: 'Cloud', landing: 'cloud-subscriptions', items: [
        'cloud-dedicated',
        'cloud-shared',
        'cloud-vpc-private-connectivity',
      ]},
      'non-profit-subscriptions',
    ],
  },
  // 'Releases and Life Cycle' with Server / Desktop / Mobile sub-groups.
  releases: {
    label: 'Releases and Life Cycle',
    landing: 'releases-lifecycle',
    items: [
      'release-policy',
      {label: 'Server', landing: 'server', items: [
        'mattermost-server-releases',
        'mattermost-v11-changelog',
        'mattermost-v10-changelog',
        'unsupported-legacy-releases',
        'version-archive',
        'ui-ada-changelog',
      ]},
      {label: 'Desktop', landing: 'desktop', items: [
        'mattermost-desktop-releases',
        'desktop-app-changelog',
      ]},
      {label: 'Mobile', landing: 'mobile', items: [
        'mattermost-mobile-releases',
        'mobile-app-changelog',
      ]},
      'deprecated-features',
    ],
  },
  // 'Frequently Asked Questions'.
  faq: {
    label: 'Frequently Asked Questions',
    landing: 'frequently-asked-questions',
    items: [
      'faq-general',
      'faq-enterprise',
      'faq-federal-procurement',
      {label: 'Business & Licensing', landing: 'faq-license', items: [
        'faq-mattermost-source-available-license',
      ]},
    ],
  },
};

// Top-level items in the Overview section, in order. Strings are doc basenames;
// objects are group keys from OVERVIEW_GROUPS above. Mirrors the live site.
const OVERVIEW_ROOT_ORDER = [
  'editions-and-offerings',
  'plans',
  {group: 'subscription'},
  'certifications-and-compliance',
  'accessibility-compliance-policy',
  {group: 'releases'},
  {group: 'faq'},
];

// ---------------------------------------------------------------------------
// Deployment Guide — manual grouping override.
// ---------------------------------------------------------------------------
//
// The Deployment Guide directory has loose top-level files mixed with sub-
// directories (server/, desktop/, mobile/, air-gapped-operations/, scale/,
// deployment-scenarios/). The auto-generated sidebar ends up as 16 mostly-
// alphabetical items at the top level, with a 16-item kitchen-sink under Server.
//
// This override applies a progression-ordered grouping: evaluate → choose a
// scenario → Plan → Prepare → Install → Secure → Scale → Back up → operate.
// The `server/` directory is dissolved into the Plan / Prepare / Install
// groups, and the troubleshooting pages scattered across server/, desktop/,
// and mobile/ are pulled up into the top-level "Troubleshoot deployments"
// category, which is their single sidebar home.

const DEPLOYMENT_GROUPS = {
  // 'Deployment Scenarios' — a top-level group at position 2. DISC-relevant
  // patterns (OOB, Mission Partner, DDIL, Sovereign-on-Microsoft, Air-Gapped)
  // deserve prominence, not burial.
  deploymentScenarios: {
    label: 'Deployment Scenarios',
    landing: 'deployment-scenarios/deployment-scenarios-index',
    items: [
      'deployment-scenarios/deploy-oob',
      'deployment-scenarios/deploy-mission-partner',
      'deployment-scenarios/deploy-ddil-operations',
      'deployment-scenarios/deploy-sovereign-collaboration',
      'deployment-scenarios/air-gapped-deployment',
    ],
  },

  // Plan — what you decide before touching a server: the component model,
  // the sizing builder, the requirements matrix, and who can deploy for you.
  plan: {
    label: 'Plan',
    landing: 'server/server-deployment-planning',
    items: [
      'application-architecture',
      'deployment-architecture',
      'software-hardware-requirements',
      'server/orchestration',
    ],
  },

  // Prepare — prerequisites that must exist before the install runs. This
  // group sits BEFORE Install deliberately: NGINX and TLS are prerequisites
  // for a working deployment, so a reader following the sidebar top to bottom
  // must not finish installing before reaching them. `server/preparations` is
  // already a hub page linking to exactly these, so it's the landing page.
  prepare: {
    label: 'Prepare',
    landing: 'server/preparations',
    items: [
      'server/setup-nginx-proxy',
      'server/setup-tls',
      'server/prepare-mattermost-mysql-database',
      'server/image-proxy',
      'server/pre-authentication-secrets',
    ],
  },

  // Deploy the Server — one sub-group per deployment method. No landing page;
  // the choice between them is made in Plan. "Deploy" rather than "Install"
  // because all nine child pages are titled "Deploy Mattermost ...", and these
  // pages use "install" for a narrower step within them (getting the binary
  // onto the host) alongside database setup, configuration, and startup.
  install: {
    label: 'Deploy the Server',
    items: [
      {label: 'Linux', landing: 'server/deploy-linux', items: [
        'server/linux/deploy-ubuntu',
        'server/linux/deploy-rhel',
        'server/linux/deploy-tar',
        'server/linux/deploy-azure-native-vm',
      ]},
      {label: 'Kubernetes', landing: 'server/deploy-kubernetes', items: [
        'server/kubernetes/deploy-k8s',
        'server/kubernetes/deploy-k8s-oke',
      ]},
      {label: 'Containers', landing: 'server/deploy-containers', items: [
        'server/containers/fips-stig',
      ]},
    ],
  },

  // Secure your deployment — at-rest + in-transit encryption. These are
  // install-time decisions, so this sits next to Install rather than after
  // the day-2 topics below. The former one-child "Encryption" category is
  // flattened into this group, with encryption-options as its landing page.
  secure: {
    label: 'Secure Your Deployment',
    landing: 'encryption-options',
    items: [
      'transport-encryption',
    ],
  },

  // Scale — capacity planning, HA, storage sizing, search, caching.
  // `scaling-for-enterprise` is the general entry point referencing the
  // sub-groups below, so it's the group's landing page.
  scaling: {
    label: 'Scale',
    landing: 'scale/scaling-for-enterprise',
    items: [
      {label: 'Reference Architectures by User Count', items: [
        'scale/scale-to-200-users',
        'scale/scale-to-2000-users',
        'scale/scale-to-15000-users',
        'scale/scale-to-30000-users',
        'scale/scale-to-50000-users',
        'scale/scale-to-80000-users',
        'scale/scale-to-90000-users',
        'scale/scale-to-100000-users',
        'scale/scale-to-200000-users',
      ]},
      {label: 'High Availability and Clustering', items: [
        'scale/high-availability-cluster-based-deployment',
        'scale/server-architecture',
      ]},
      // additional-ha-considerations, estimated-storage-per-user-per-month and
      // lifetime-storage are `unlisted: true` snippet includes rendered inside
      // the scale-to-* pages, so they are not listed here.
      {label: 'Storage Sizing', items: [
        'scale/backing-storage-benchmarks',
      ]},
      {label: 'Search Infrastructure', landing: 'scale/enterprise-search', items: [
        'scale/elasticsearch-setup',
        'scale/opensearch-setup',
      ]},
      // Flattened from a category holding a single page.
      {doc: 'scale/redis', label: 'Caching with Redis'},
    ],
  },

  // Back up and recover — deployment-time architecture (HA-vs-DR,
  // active/passive across two sites), not routine administration, so it sits
  // next to Scale rather than down with the day-2 topics.
  backupDr: {
    label: 'Back Up and Recover',
    landing: 'backup-disaster-recovery',
    items: [
      'disaster-recovery-aws',
    ],
  },

  // Calls deployment — moved here from Administration Guide → Configure.
  // RTCD, Offloader, Kubernetes, logging, and metrics are deployment and
  // operations concerns, not settings-reference material.
  calls: {
    label: 'Calls Deployment',
    landing: 'calls/calls-deployment-guide',
    items: [
      'calls/calls-rtcd-setup',
      'calls/calls-offloader-setup',
      'calls/calls-kubernetes',
      'calls/calls-logging',
      'calls/calls-metrics-monitoring',
    ],
  },

  // Desktop app deployment — explicit group rather than the auto-generated
  // tree, so the section overview is the landing page (alphabetically it only
  // happened to sort first) and the children run in procedural order instead
  // of alphabetically. desktop-troubleshooting is deliberately absent: its
  // sidebar home is the central troubleshooting hub below.
  desktop: {
    label: 'Desktop App Deployment',
    landing: 'desktop/desktop-app-deployment',
    items: [
      'desktop/linux-desktop-install',
      'desktop/distribute-a-custom-desktop-app',
      'desktop/silent-windows-desktop-distribution',
      'desktop/desktop-msi-installer-and-group-policy-install',
      'desktop/desktop-custom-dictionaries',
      'desktop/desktop-app-managed-resources',
    ],
  },

  // Mobile app deployment — same treatment as Desktop. Without this,
  // mobile-app-deployment (the section overview) sorts 6th of 10 inside its
  // own section. mobile-troubleshooting's sidebar home is the hub below.
  mobile: {
    label: 'Mobile App Deployment',
    landing: 'mobile/mobile-app-deployment',
    items: [
      'mobile/deploy-mobile-apps-using-emm-provider',
      'mobile/configure-microsoft-intune-mam',
      'mobile/distribute-custom-mobile-apps',
      'mobile/host-your-own-push-proxy-service',
      'mobile/consider-mobile-vpn-options',
      'mobile/mobile-security-features',
      'mobile/secure-mobile-file-storage',
      'mobile/mobile-faq',
    ],
  },

  // Troubleshoot deployments — the single sidebar home for every deployment
  // troubleshooting page, including the desktop and mobile ones that live
  // under those directories on disk. Readers arrive at a troubleshooting hub
  // in a failure state and are least likely to reason about which product
  // surface owns the problem, so a hub that silently covered only the server
  // would be worse than no hub. The desktop and mobile section landing pages
  // link here rather than duplicating the entries, which would split
  // prev/next pagination across two sidebar locations.
  troubleshooting: {
    label: 'Troubleshoot Deployments',
    landing: 'deployment-troubleshooting',
    items: [
      'server/troubleshooting',
      'server/docker-troubleshooting',
      'server/trouble-postgres',
      'server/trouble_mysql',
      'desktop/desktop-troubleshooting',
      'mobile/mobile-troubleshooting',
    ],
  },
};

// Top-level Deployment Guide order — evaluate → choose a scenario → Plan →
// Prepare → Install → Secure → Scale → Back up → operate → troubleshoot.
// Strings are paths relative to docs/deployment-guide/; objects reference
// DEPLOYMENT_GROUPS keys, or an auto-generated sub-directory tree.
const DEPLOYMENT_ROOT_ORDER = [
  'quick-start-evaluation',
  {group: 'deploymentScenarios'},
  {group: 'plan'},
  {group: 'prepare'},
  {group: 'install'},
  {group: 'secure'},
  {group: 'scaling'},
  {group: 'backupDr'},
  // Air-Gapped Operations keeps its auto-generated tree: it has its own
  // index file and its children are already ordered by sidebar_position.
  {auto: 'air-gapped-operations'},
  {group: 'calls'},
  {group: 'desktop'},
  {group: 'mobile'},
  {group: 'troubleshooting'},
];

// Files re-parented into other groups — excluded from the orphan check so they
// don't get re-appended at root level. Every Deployment Guide page is now
// placed explicitly in DEPLOYMENT_ROOT_ORDER above, so this is empty. An empty
// hidden list is the health signal that nothing in the section is unreachable
// — keep it that way.
const DEPLOYMENT_HIDDEN = new Set([]);

// ---------------------------------------------------------------------------
// Administration Guide — Configure — manual grouping override.
// ---------------------------------------------------------------------------
//
// Configure is a flat settings-reference dump. This override groups it by
// task/subsystem so the ~13 "*-configuration-settings" reference pages don't
// drown the task-oriented pages (Search, Email, Branding) sitting alongside
// them at the same level.
//
// Every System Console settings page belongs in the settings reference group,
// including the two billing/licensing ones and System attributes, which used
// to sit outside it: a reader looking up a System Console section shouldn't
// have to know which of three places in the nav it was filed under. Pages that
// describe turning a capability on (Boards, plugins, auto-translation, content
// flagging, connected workspaces) stay as top-level leaves rather than being
// bundled into a catch-all, because a "misc" label predicts nothing.
//
// Three items live outside administration-guide/configure/ on disk and are
// referenced with the `{doc: '<full id>'}` form: auto-translation and content
// flagging (in manage/admin/, both System Console toggles) and connected
// workspaces (in onboard/, but not an onboarding task).

const ADMIN_CONFIGURE_GROUPS = {
  settingsReference: {
    // Ordered to follow the System Console's own left-hand nav, so the page a
    // reader is looking at maps onto the entry they need.
    label: 'System Console settings reference',
    landing: 'configuration-settings',
    items: [
      'site-configuration-settings',
      'authentication-configuration-settings',
      'user-management-configuration-settings',
      'system-attributes',
      // rate-limiting-configuration-settings and
      // push-notification-server-configuration-settings are `unlisted: true`
      // snippet includes rendered inside Environment configuration settings.
      'environment-configuration-settings',
      'reporting-configuration-settings',
      'compliance-configuration-settings',
      'integrations-configuration-settings',
      'plugins-configuration-settings',
      'self-hosted-account-settings',
      'cloud-billing-account-settings',
      'experimental-configuration-settings',
      'deprecated-configuration-settings',
    ],
  },
  search: {
    label: 'Search',
    items: [
      'bleve-search',
      'enabling-chinese-japanese-korean-search',
    ],
  },
  email: {
    label: 'Email',
    items: [
      'smtp-email',
      'email-templates',
    ],
  },
  branding: {
    // Landing lives in manage/admin/ and is left there: it's a group landing,
    // not a category landing, so its URL is far less prominent than the two
    // hubs that were moved (configure-index, onboard-index).
    label: 'Branding and customization',
    landingDoc: 'administration-guide/manage/admin/customize-branding',
    items: [
      'customize-mattermost',
      'custom-branding-tools',
      {doc: 'administration-guide/manage/code-signing-custom-builds'},
    ],
  },
  // Nests the Agents plugin's own provider/setup pages (vendored from the
  // mattermost-plugin-agents submodule, staged by stage-agents-docs.mjs
  // into main/agents/docs/) under the admin guide landing page, instead of
  // a standalone top-level "Agents" section — mirrors Sphinx, which hides
  // these behind a small toctree on administration-guide/configure/
  // agents-admin-guide.rst rather than giving Agents its own nav entry.
  // Items use the {doc: '<full id>'} form since they live outside
  // administration-guide/configure/.
  agents: {
    label: 'AI agents',
    landing: 'agents-admin-guide',
    items: [
      {doc: 'agents/docs/providers'},
      {doc: 'agents/docs/aws_bedrock_setup'},
      {doc: 'agents/docs/sovereign_ai'},
    ],
  },
};

// Top-level Configure order. Strings are doc basenames relative to
// administration-guide/configure/; objects reference ADMIN_CONFIGURE_GROUPS
// keys. The settings reference comes first (where most admins land), then the
// subsystems you configure once at setup time, then the capabilities you turn
// on afterwards.
const ADMIN_CONFIGURE_ORDER = [
  {group: 'settingsReference'},
  'configuration-in-your-database',
  'environment-variables',
  {group: 'search'},
  {group: 'email'},
  'azure-blob-storage',
  {group: 'branding'},
  {group: 'agents'},
  'manage-plugins',
  'install-boards',
  {doc: 'administration-guide/manage/admin/autotranslation'},
  {doc: 'administration-guide/manage/admin/content-flagging', label: 'Set up content flagging'},
  {doc: 'administration-guide/onboard/connected-workspaces'},
];

// Files re-parented into groups, or listed under a different section —
// exclude from the orphan check.
const ADMIN_CONFIGURE_HIDDEN = new Set([
  'site-configuration-settings', 'authentication-configuration-settings',
  'integrations-configuration-settings', 'plugins-configuration-settings',
  'compliance-configuration-settings', 'reporting-configuration-settings',
  'user-management-configuration-settings', 'environment-configuration-settings',
  'experimental-configuration-settings', 'deprecated-configuration-settings',
  'system-attributes', 'self-hosted-account-settings', 'cloud-billing-account-settings',
  'bleve-search', 'enabling-chinese-japanese-korean-search',
  'smtp-email', 'email-templates',
  'custom-branding-tools', 'customize-mattermost',
  // Listed elsewhere: workspace optimization is a health check (Monitor and
  // troubleshoot), user surveys are an ongoing admin task (Manage).
  'optimize-your-workspace', 'manage-user-surveys',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Manage — manual grouping override.
// ---------------------------------------------------------------------------
//
// Manage has 37 files split into a flat top level (19) plus a nested
// manage/admin/ sub-folder (18) — a raw filesystem artifact, not a real
// Sphinx grouping (Sphinx has no manage-index.rst/toctree that groups this
// content; the admin/ sub-folder exists on disk but is never surfaced as
// its own nav level in Sphinx's real sidebar). Worse, the flat-vs-admin
// split is internally inconsistent — e.g. monitoring/health pages and
// billing pages are each scattered across both buckets. This override
// replaces both with one set of task-based groups.

const ADMIN_MANAGE_GROUPS = {
  userAccess: {
    // Access control was split across two sections: attribute-based access
    // control and user attributes here, advanced permissions and delegated
    // granular administration under Onboard. They are all day-2 tasks on a
    // running server, so they are listed together, here.
    label: 'Users and access',
    landing: 'admin/user-management',
    items: [
      'admin/user-attributes',
      'team-channel-members',
      {doc: 'administration-guide/onboard/advanced-permissions'},
      {doc: 'administration-guide/onboard/advanced-permissions-backend-infrastructure'},
      {doc: 'administration-guide/onboard/delegated-granular-administration'},
      {label: 'Attribute-based access control', landing: 'admin/attribute-based-access-control', items: [
        'admin/abac-system-wide-policies',
        'admin/abac-team-membership',
        'admin/abac-team-channel-policies',
        'admin/abac-channel-access-rules',
      ]},
    ],
  },
  serverOps: {
    label: 'Server operations',
    items: [
      'mmctl-command-line-tool',
      'command-line-tools',
      'logging',
    ],
  },
  licensing: {
    label: 'Licensing and billing',
    items: [
      'admin/self-hosted-billing',
      'admin/installing-license-key',
    ],
  },
  cloudWorkspace: {
    label: 'Cloud workspace management',
    landing: 'cloud-workspace-management',
    items: [
      'cloud-data-export',
      'cloud-data-residency',
      'cloud-ip-filtering',
      'cloud-byok',
    ],
  },
  notices: {
    label: 'Notices and surveys',
    items: [
      'system-wide-notifications',
      'in-product-notices',
      {doc: 'administration-guide/upgrade/notify-admin'},
      {doc: 'administration-guide/configure/manage-user-surveys'},
      'user-satisfaction-surveys',
    ],
  },
  dataMigration: {
    // Infrastructure migration only. Moving off Slack or Rocket.Chat is a
    // day-0 onboarding project and lives under Onboard users; the two group
    // landings cross-link.
    label: 'Data export and infrastructure migration',
    landing: 'admin/migration',
    items: [
      'bulk-export-tool',
      {label: 'Migrate from MySQL to PostgreSQL', landing: 'admin/postgres-migration', items: [
        'admin/postgres-migration-assist-tool',
        'admin/manual-postgres-migration',
      ]},
      'admin/fips-migration',
    ],
  },
  reference: {
    label: 'Reference',
    items: [
      'product-limits',
      'feature-labels',
    ],
  },
};

// Top-level Manage order. Strings are doc basenames relative to
// administration-guide/manage/ (admin/-prefixed ones live in the nested
// sub-folder); objects reference ADMIN_MANAGE_GROUPS keys.
const ADMIN_MANAGE_ORDER = [
  {group: 'userAccess'},
  {group: 'serverOps'},
  {group: 'licensing'},
  {group: 'cloudWorkspace'},
  {group: 'notices'},
  {group: 'dataMigration'},
  {group: 'reference'},
];

// Files re-parented into groups, used as the section landing, or listed under
// a different section — exclude from the orphan check.
const ADMIN_MANAGE_HIDDEN = new Set([
  'admin/server-maintenance',
  'admin/user-management', 'admin/user-attributes', 'team-channel-members',
  'admin/attribute-based-access-control', 'admin/abac-system-wide-policies',
  'admin/abac-team-channel-policies', 'admin/abac-team-membership', 'admin/abac-channel-access-rules',
  'command-line-tools', 'mmctl-command-line-tool', 'logging',
  'admin/self-hosted-billing', 'admin/installing-license-key',
  'cloud-workspace-management', 'cloud-data-export', 'cloud-data-residency', 'cloud-ip-filtering',
  'cloud-byok',
  'in-product-notices', 'system-wide-notifications', 'user-satisfaction-surveys',
  'bulk-export-tool', 'admin/migration', 'admin/postgres-migration',
  'admin/postgres-migration-assist-tool', 'admin/manual-postgres-migration',
  'admin/fips-migration',
  'product-limits', 'feature-labels',
  // Listed under Configure: System Console toggles and branding.
  'admin/content-flagging', 'admin/autotranslation', 'admin/customize-branding',
  'code-signing-custom-builds',
  // Listed under Monitor and troubleshoot.
  'admin/monitoring-and-performance', 'statistics', 'telemetry',
  'configure-health-check-probes', 'request-server-health-check',
  'admin/error-codes', 'admin/generating-support-packet',
]);

// ---------------------------------------------------------------------------
// End User Guide — Collaborate — manual grouping override.
// ---------------------------------------------------------------------------
//
// Collaborate is a flat 49-file dump (Channels, Messaging, Calls, Teams, and
// Accessibility topics all interleaved alphabetically) — the section
// End-user Guide > Collaborate feedback (Eric Sethna review, item 6) called
// out as "overwhelming". This override groups it by topic, same pattern as
// Administration Guide's Configure/Manage/Onboard/Scale (see #37591/#37630).
//
// `collaborate-within-channels` doubles as both the Channels group's landing
// page and a regular grouped item — it already reads as a "Channels" hub
// page in its own "Learn more" section, which the `channels` group's item
// list below mirrors.

const COLLABORATE_GROUPS = {
  channels: {
    label: 'Channels',
    landing: 'collaborate-within-channels',
    items: [
      'channel-types',
      'browse-channels',
      'create-channels',
      'join-leave-channels',
      'navigate-between-channels',
      'channel-naming-conventions',
      'channel-header-purpose',
      'rename-channels',
      'archive-unarchive-channels',
      'favorite-channels',
      'mark-channels-unread',
      'manage-channel-members',
      'manage-channel-bookmarks',
      'display-channel-banners',
      'autotranslate-messages',
      'convert-public-channels',
      'convert-group-messages',
    ],
  },
  messaging: {
    label: 'Messaging & Threads',
    items: [
      'send-messages',
      'communicate-with-messages',
      'reply-to-messages',
      'organize-conversations',
      'format-messages',
      'mark-messages-unread',
      'mention-people',
      'message-priority',
      'message-reminders',
      'schedule-messages',
      'save-pin-messages',
      'flag-messages',
      'forward-messages',
      'search-for-messages',
      'share-links',
      'share-files-in-messages',
      'react-with-emojis-gifs',
    ],
  },
  calls: {
    label: 'Calls & Screen Sharing',
    items: [
      'make-calls',
      'audio-and-screensharing',
    ],
  },
  teamsAndRoles: {
    label: 'Teams, Groups & Roles',
    items: [
      'learn-about-roles',
      'organize-using-teams',
      'team-settings',
      'organize-using-custom-user-groups',
    ],
  },
  integrations: {
    label: 'Integrations & Connected Apps',
    items: [
      'extend-mattermost-with-integrations',
      'agents-context-management',
      'collaborate-within-connected-microsoft-teams',
    ],
  },
  accessibility: {
    label: 'Keyboard Shortcuts & Accessibility',
    items: [
      'keyboard-shortcuts',
      'team-keyboard-shortcuts',
      'keyboard-accessibility',
      'view-system-information',
    ],
  },
};

// Top-level Collaborate order. Strings are doc basenames relative to
// end-user-guide/collaborate/; objects reference COLLABORATE_GROUPS keys.
const COLLABORATE_ORDER = [
  'invite-people',
  {group: 'channels'},
  {group: 'messaging'},
  {group: 'calls'},
  {group: 'teamsAndRoles'},
  {group: 'integrations'},
  {group: 'accessibility'},
];

// Files re-parented into groups — exclude from the orphan check.
const COLLABORATE_HIDDEN = new Set([
  'channel-types', 'browse-channels', 'create-channels', 'join-leave-channels',
  'navigate-between-channels', 'channel-naming-conventions', 'channel-header-purpose',
  'rename-channels', 'archive-unarchive-channels', 'favorite-channels',
  'mark-channels-unread', 'manage-channel-members', 'manage-channel-bookmarks',
  'display-channel-banners', 'autotranslate-messages', 'convert-public-channels',
  'convert-group-messages',
  'send-messages', 'communicate-with-messages', 'reply-to-messages', 'organize-conversations',
  'format-messages', 'mark-messages-unread', 'mention-people', 'message-priority',
  'message-reminders', 'schedule-messages', 'save-pin-messages', 'flag-messages',
  'forward-messages', 'search-for-messages', 'share-links', 'share-files-in-messages',
  'react-with-emojis-gifs',
  'make-calls', 'audio-and-screensharing',
  'organize-using-teams', 'team-settings', 'organize-using-custom-user-groups',
  'learn-about-roles', 'invite-people',
  'extend-mattermost-with-integrations', 'agents-context-management',
  'collaborate-within-connected-microsoft-teams',
  'keyboard-shortcuts', 'team-keyboard-shortcuts', 'keyboard-accessibility',
  'view-system-information',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Onboard — manual grouping override.
// ---------------------------------------------------------------------------
//
// Onboard is a flat 30-odd-file dump spanning SSO/identity setup, guest
// accounts, user provisioning, and one-time migration tasks. Single sign-on
// protocols (SAML, OIDC, Google, GitLab, Entra ID native, OAuth->OIDC
// conversion) live under one group, with SAML nested as its own sub-category
// since it alone accounts for 8 of those files (one per IdP plus the
// technical reference). AD/LDAP is a sibling group rather than an SSO child:
// it's directory synchronization, and an admin can run it without SSO.
//
// The section is scoped to getting users into a new workspace. Ongoing
// access-control administration (advanced permissions, delegated granular
// administration) is listed under Manage > Users and access instead.

const ADMIN_ONBOARD_GROUPS = {
  sso: {
    label: 'Single sign-on',
    landing: 'corporate-directory-integration',
    items: [
      {
        // sso-saml-before-you-begin, sso-saml-ldapsync and sso-saml-faq are
        // `unlisted: true` snippet includes rendered inside each identity
        // provider page below, so they are not listed separately. Matches the
        // Sphinx sso-saml toctree.
        label: 'SAML Single Sign-On',
        landing: 'sso-saml',
        items: [
          'sso-saml-adfs',
          'sso-saml-adfs-msws2016',
          'sso-saml-entraid',
          'sso-saml-keycloak',
          'sso-saml-okta',
          'sso-saml-onelogin',
          'sso-saml-technical',
        ],
      },
      'sso-openidconnect',
      'sso-google',
      'sso-gitlab',
      'sso-entraid',
      'convert-oauth20-service-providers-to-openidconnect',
    ],
  },
  adldap: {
    label: 'AD/LDAP',
    items: [
      'ad-ldap',
      'ad-ldap-groups-synchronization',
      'managing-team-channel-membership-using-ad-ldap-sync-groups',
    ],
  },
  mfaCert: {
    label: 'Multi-factor and certificate authentication',
    items: [
      'multi-factor-authentication',
      'certificate-based-authentication',
      'ssl-client-certificate',
    ],
  },
  migration: {
    // Platform migration only — the infrastructure counterpart is
    // Manage > Data export and infrastructure migration.
    label: 'Migrate from another platform',
    landing: 'migrating-to-mattermost',
    items: [
      'migrate-from-slack',
      'migrate-from-rocketchat',
      'migrate-gitlab-omnibus',
      'migration-announcement-email',
    ],
  },
};

// Top-level Onboard order. Identity setup first (SSO, AD/LDAP, then
// MFA/certificates), then getting accounts in, then the one-time platform
// migration tasks admins hit least often.
const ADMIN_ONBOARD_ORDER = [
  {group: 'sso'},
  {group: 'adldap'},
  {group: 'mfaCert'},
  'user-provisioning-workflows',
  'bulk-loading-data',
  'guest-accounts',
  {group: 'migration'},
];

// Files re-parented into groups, used as the section landing, or listed under
// a different section — exclude from the orphan check.
const ADMIN_ONBOARD_HIDDEN = new Set([
  'sso-saml', 'sso-saml-adfs', 'sso-saml-adfs-msws2016',
  'sso-saml-entraid', 'sso-saml-keycloak', 'sso-saml-okta',
  'sso-saml-onelogin', 'sso-saml-technical',
  'sso-openidconnect', 'sso-google', 'sso-gitlab', 'sso-entraid',
  'convert-oauth20-service-providers-to-openidconnect',
  'corporate-directory-integration',
  'ad-ldap', 'ad-ldap-groups-synchronization', 'managing-team-channel-membership-using-ad-ldap-sync-groups',
  'multi-factor-authentication', 'certificate-based-authentication', 'ssl-client-certificate',
  'migrating-to-mattermost', 'migrate-from-slack', 'migrate-from-rocketchat', 'migrate-gitlab-omnibus',
  'migration-announcement-email',
  // Listed under Manage > Users and access: ongoing administration, not onboarding.
  'advanced-permissions', 'advanced-permissions-backend-infrastructure',
  'delegated-granular-administration',
  // Listed under Configure: a System Console connection, not an onboarding task.
  'connected-workspaces',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Scale — manual grouping override.
// ---------------------------------------------------------------------------
//
// Scale was originally a flat 28-file dump mixing a whole run of
// `scale-to-N-users` capacity-planning pages with unrelated HA, search, and
// monitoring topics. In Sphinx's live nav, only the 7 monitoring/observability
// pages below actually stay under Administration Guide — the other 21 files
// (capacity planning, HA/architecture, search infrastructure, caching) are
// listed under Deployment Guide → Reference Architecture instead (Sphinx
// decouples toctree/nav placement from a page's physical file location, so
// those files keep their `/administration-guide/scale/...` URLs there even
// though they're navigated to from Deployment Guide). We mirror that split
// here by physically moving those 21 files to `deployment-guide/scale/` (see
// the `scaling` group in DEPLOYMENT_GROUPS).
//
// What's left is monitoring, so the category is presented as "Monitor and
// troubleshoot" — a name a reader searching for dashboards, health checks, or
// a support packet can act on, where "Scale" told them nothing. The eight
// monitoring and diagnostics pages that live in manage/ on disk are listed
// here too, by full doc id: Sphinx grouped all of this under one
// "Monitoring and performance" hub, which also becomes this category's
// landing page. Files keep their existing URLs.

const ADMIN_SCALE_GROUPS = {
  metrics: {
    label: 'Metrics and dashboards',
    items: [
      'collect-performance-metrics',
      'deploy-prometheus-grafana-for-performance-monitoring',
      'performance-monitoring-metrics',
      'performance-alerting',
      'push-notification-health-targets',
    ],
  },
  health: {
    label: 'Health and diagnostics',
    items: [
      {doc: 'administration-guide/configure/optimize-your-workspace'},
      {doc: 'administration-guide/manage/statistics'},
      {doc: 'administration-guide/manage/configure-health-check-probes'},
      {doc: 'administration-guide/manage/request-server-health-check'},
      {doc: 'administration-guide/manage/admin/generating-support-packet'},
      {doc: 'administration-guide/manage/admin/error-codes'},
    ],
  },
};

const ADMIN_SCALE_ORDER = [
  {group: 'metrics'},
  'deploy-grafana-loki-for-centralized-logging',
  {group: 'health'},
  {doc: 'administration-guide/manage/telemetry'},
  'ensuring-releases-perform-at-scale',
];

// Files re-parented into groups — exclude from the orphan check.
const ADMIN_SCALE_HIDDEN = new Set([
  'collect-performance-metrics', 'deploy-prometheus-grafana-for-performance-monitoring',
  'performance-monitoring-metrics', 'performance-alerting', 'push-notification-health-targets',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Comply and Upgrade — manual ordering overrides.
// ---------------------------------------------------------------------------
//
// Neither section needs regrouping — they're small and single-themed — but
// both read badly in filename order. Comply is ordered by how many
// deployments use each capability, ending with the audit log schema, which is
// reference material rather than a task. Upgrade follows the procedure:
// what to know, prepare, upgrade, then the post-upgrade rollout tasks.

const ADMIN_COMPLY_GROUPS = {};

const ADMIN_COMPLY_ORDER = [
  'compliance-export',
  'compliance-monitoring',
  'electronic-discovery',
  'data-retention-policy',
  'export-mattermost-channel-data',
  'legal-hold',
  'custom-terms-of-service',
  'embedded-json-audit-log-schema',
];

const ADMIN_COMPLY_HIDDEN = new Set([]);

const ADMIN_UPGRADE_GROUPS = {
  afterUpgrade: {
    label: 'After you upgrade',
    items: [
      'admin-onboarding-tasks',
      'enterprise-roll-out-checklist',
      'welcome-email-to-end-users',
    ],
  },
};

const ADMIN_UPGRADE_ORDER = [
  'important-upgrade-notes',
  'prepare-to-upgrade-mattermost',
  'communicate-scheduled-maintenance',
  'upgrading-mattermost-server',
  'upgrade-mattermost-kubernetes-ha',
  'upgrading-postgres',
  'enterprise-install-upgrade',
  'downgrading-mattermost-server',
  {group: 'afterUpgrade'},
  'open-source-components',
];

// Files re-parented into groups, or listed under a different section —
// exclude from the orphan check.
const ADMIN_UPGRADE_HIDDEN = new Set([
  'admin-onboarding-tasks', 'enterprise-roll-out-checklist', 'welcome-email-to-end-users',
  // Listed under Manage > Notices and surveys: it's an end-user request an
  // admin fields at any time, not an upgrade step.
  'notify-admin',
]);

const ADMIN_ROOT_ORDER = [
  'Configure', 'Onboard users', 'Manage', 'Monitor and troubleshoot', 'Comply', 'Upgrade',
];

const ENDUSER_ROOT_ORDER = ['Access', 'Collaborate', 'Workflow Automation', 'Project Management', 'AI Agents', 'Preferences'];

// ---------------------------------------------------------------------------
// Integrations Guide — manual grouping override.
// ---------------------------------------------------------------------------
//
// Integrations Guide is a genuinely flat 20-item list (not just a migration
// artifact — Sphinx has the same problem).
//
// `plugins` opens the guide because it explains the delivery mechanism
// (pre-built / Mattermost-built / custom) that the catalogue and every
// vendor page below depend on. The vendor pages then nest under the
// catalogue they belong to, split Microsoft / third-party to mirror the
// tables on popular-integrations, alphabetical within each group so a
// reader scanning for a vendor name can predict where to look. The
// remaining entries follow the order the landing page introduces them.

const INTEGRATIONS_GROUPS = {
  prebuilt: {
    label: 'Popular Pre-Built Integrations',
    landing: 'popular-integrations',
    items: [
      {label: 'Microsoft Integrations', items: [
        'mattermost-mission-collaboration-for-m365',
        'microsoft-calendar',
        'microsoft-teams-meetings',
        'microsoft-teams-sync',
      ]},
      {label: 'Third-Party Integrations', items: [
        'github',
        'gitlab',
        'jira',
        'servicenow',
        'zoom',
      ]},
    ],
  },
  webhooks: {
    label: 'Webhooks',
    landing: 'webhook-integrations',
    items: [
      'incoming-webhooks',
      'outgoing-webhooks',
    ],
  },
  slashCommands: {
    label: 'Slash Commands',
    landing: 'slash-commands',
    items: [
      'run-slash-commands',
      'built-in-slash-commands',
    ],
  },
};

// Top-level Integrations Guide order. Strings are doc basenames relative to
// integrations-guide/; objects reference INTEGRATIONS_GROUPS keys or are
// inline sub-groups (Microsoft Integrations, Third-Party Integrations).
const INTEGRATIONS_ROOT_ORDER = [
  'plugins',
  {group: 'prebuilt'},
  {group: 'webhooks'},
  {group: 'slashCommands'},
  'restful-api',
  'no-code-automation',
  'faq',
];

const INTEGRATIONS_HIDDEN = new Set([
  'popular-integrations',
  'mattermost-mission-collaboration-for-m365', 'microsoft-calendar',
  'microsoft-teams-meetings', 'microsoft-teams-sync',
  'github', 'gitlab', 'jira', 'servicenow', 'zoom',
  'webhook-integrations', 'incoming-webhooks', 'outgoing-webhooks',
  'slash-commands', 'run-slash-commands', 'built-in-slash-commands',
]);

// ---------------------------------------------------------------------------
// Security Guide — manual grouping override.
// ---------------------------------------------------------------------------
//
// Sphinx lists these flat in an arbitrary order, which put the regulatory
// pages (CMMC/FINRA/HIPAA) ahead of the hardening guidance most readers
// actually arrive for. Order here is by reader intent instead: harden the
// deployment, then the architectural posture model, then the platform-
// specific surface, then "prove it to an auditor" last.

const SECURITY_GROUPS = {
  frameworks: {
    // The three industry-regulation pages. Grouped so the section reads as
    // "secure it" then "certify it" rather than interleaving the two.
    label: 'Compliance Frameworks',
    items: [
      'cmmc-compliance',
      'finra-compliance',
      'hipaa-compliance',
    ],
  },
};

// Strings are doc basenames relative to security-guide/; objects reference
// SECURITY_GROUPS keys.
const SECURITY_ROOT_ORDER = [
  'secure-mattermost',
  'zero-trust',
  'mobile-security',
  {group: 'frameworks'},
];

const SECURITY_HIDDEN = new Set([
  'cmmc-compliance', 'finra-compliance', 'hipaa-compliance',
]);

// ===========================================================================
// FUNCTIONS — generic helpers, per-section builders, main.
// ===========================================================================

// ---------------------------------------------------------------------------
// Generic helpers, shared by the auto-generator and every manual override.
// ---------------------------------------------------------------------------

function humanize(name) {
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function readFm(filePath, key) {
  try {
    const text = readFileSync(filePath, 'utf8').slice(0, 4000);
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const r = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm');
    const x = m[1].match(r);
    return x ? x[1].trim().replace(/^"|"$/g, '') : null;
  } catch { return null; }
}

// Pages excluded from the sidebar by their own frontmatter: `draft: true`
// (not ready) and `unlisted: true` (MDX snippet includes imported by another
// page — Docusaurus already drops these from the sidebar, search, and sitemap
// in production, so the generator must agree or dev and prod disagree).
function isHidden(filePath) {
  return readFm(filePath, 'draft') === 'true' || readFm(filePath, 'unlisted') === 'true';
}

function pathToDocId(relPath) { return relPath.replace(/\.(md|mdx)$/, ''); }

// Landing pages in this tree are conventionally named either `index.md(x)`
// or `<something>-index.md(x)` (e.g. integrations-guide-index.mdx,
// use-cases-index.mdx) — the latter avoids "index.mdx" filename collisions
// when files are flattened for URL stability, and doesn't always exactly
// match the directory name. Recognize both, everywhere a directory's
// landing file is looked up, so category headers/sorting/labels resolve
// consistently instead of assuming a literal index.md(x).
function findIndexFile(absDir) {
  let entries;
  try { entries = readdirSync(absDir); } catch { return null; }
  return entries.find((e) => /^index\.(md|mdx)$/.test(e)) ||
    entries.find((e) => /-index\.(md|mdx)$/.test(e)) ||
    null;
}

function buildCategory(absDir, docsRelDir) {
  const entries = readdirSync(absDir);
  const indexFile = findIndexFile(absDir);
  let categoryLink = null;
  if (indexFile && !isHidden(join(absDir, indexFile))) {
    categoryLink = {type: 'doc', id: pathToDocId(join(docsRelDir, indexFile))};
  }

  const subDirs = [];
  const leafDocs = [];
  for (const name of entries) {
    if (name === indexFile) continue;
    const abs = join(absDir, name);
    const st = statSync(abs);
    if (st.isDirectory()) subDirs.push(name);
    else if (st.isFile() && /\.(md|mdx)$/.test(name) && !isHidden(abs)) leafDocs.push(name);
  }

  function key(name, abs) {
    const p = readFm(abs, 'sidebar_position');
    return [p ? Number(p) : 9999, name.toLowerCase()];
  }
  leafDocs.sort((a, b) => {
    const ka = key(a, join(absDir, a));
    const kb = key(b, join(absDir, b));
    return ka[0] - kb[0] || ka[1].localeCompare(kb[1]);
  });
  function subDirKey(name) {
    const subAbs = join(absDir, name);
    const subIndex = findIndexFile(subAbs);
    return key(name, subIndex ? join(subAbs, subIndex) : join(subAbs, 'index.mdx'));
  }
  subDirs.sort((a, b) => {
    const ka = subDirKey(a);
    const kb = subDirKey(b);
    return ka[0] - kb[0] || ka[1].localeCompare(kb[1]);
  });

  const items = [];
  for (const name of leafDocs) {
    const id = pathToDocId(join(docsRelDir, name));
    const filePath = join(absDir, name);
    const label = readFm(filePath, 'sidebar_label') ||
      readFm(filePath, 'title') ||
      humanize(basename(name, /\.(md|mdx)$/.exec(name)[0]));
    items.push({type: 'doc', id, label});
  }
  for (const name of subDirs) {
    const sub = buildCategory(join(absDir, name), join(docsRelDir, name));
    if (sub) items.push(sub);
  }

  const label =
    (indexFile && (readFm(join(absDir, indexFile), 'sidebar_label') || readFm(join(absDir, indexFile), 'title'))) ||
    humanize(basename(absDir));

  if (!categoryLink && items.length === 0) return null;

  return {type: 'category', label, collapsed: true, ...(categoryLink ? {link: categoryLink} : {}), items};
}

// The content sub-directory a category was built from (e.g. 'comply' for
// administration-guide/comply/), read off its landing page or first doc.
// Used by buildAdminGuideSidebar/buildEndUserGuideSidebar below to find the
// Configure/Manage/Onboard/Scale/Collaborate sub-category to regroup,
// independent of its (label-based) display text.
function categoryDirName(cat) {
  if (cat.link && cat.link.id) return cat.link.id.split('/')[1];
  const items = cat.items || [];
  const firstDoc = items.find((c) => c.type === 'doc' && c.id);
  if (firstDoc) return firstDoc.id.split('/')[1];
  // Regrouped categories (e.g. Onboard) hold only sub-groups at the top level.
  for (const it of items) {
    if (it.type !== 'category') continue;
    const nested = categoryDirName(it);
    if (nested) return nested;
  }
  return null;
}

// Reorder a guide's top-level categories by label. Anything not named in
// `order` keeps its relative position at the end.
function orderRootCategories(sectionCat, order, sectionLabel) {
  const rank = new Map(order.map((label, i) => [label, i]));
  const listed = [];
  const rest = [];
  for (const it of sectionCat.items) {
    if (it.type === 'category' && rank.has(it.label)) listed.push(it);
    else rest.push(it);
  }
  listed.sort((a, b) => rank.get(a.label) - rank.get(b.label));

  const missing = order.filter((label) => !listed.some((it) => it.label === label));
  if (missing.length > 0) {
    console.warn(`[sidebar] WARN: ${sectionLabel} root order names categor(y/ies) that don't exist: ${missing.join(', ')}`);
  }

  sectionCat.items = [...listed, ...rest];
  return sectionCat;
}

// Pull every doc label from an auto-generated category so a manual ordering
// preserves the frontmatter-derived titles.
function collectLeafLabels(cat, acc = {}) {
  if (!cat || !cat.items) return acc;
  for (const it of cat.items) {
    if (it.type === 'doc' && it.id && it.label) acc[it.id] = it.label;
    else if (it.type === 'category') collectLeafLabels(it, acc);
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Overview — builder.
// ---------------------------------------------------------------------------

function buildOverviewItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `product-overview/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec)};
  }
  if (spec.group) {
    const g = OVERVIEW_GROUPS[spec.group];
    if (!g) throw new Error(`unknown overview group: ${spec.group}`);
    return buildOverviewGroup(g, leafLabels);
  }
  return buildOverviewGroup(spec, leafLabels);
}

function buildOverviewGroup(g, leafLabels) {
  const items = g.items.map((it) => buildOverviewItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landing) {
    cat.link = {type: 'doc', id: `product-overview/${g.landing}`};
  }
  return cat;
}

function buildOverviewSidebar(autoCat) {
  const leafLabels = collectLeafLabels(autoCat);
  const items = OVERVIEW_ROOT_ORDER.map((spec) => buildOverviewItem(spec, leafLabels));

  // Surface any flat docs we didn't include in the manual order so a new
  // file dropped into docs/product-overview/ doesn't silently disappear.
  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && id !== 'product-overview/product-overview-index') orphans.push(id);
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Overview file(s) missing from OVERVIEW_ROOT_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  return {
    type: 'category',
    label: 'Overview',
    collapsed: true,
    // Merged with the site landing — clicking "Overview" opens the
    // root doc (docs/index.mdx, slug: /), which is the unified
    // welcome / Overview page.
    link: {type: 'doc', id: 'index'},
    items,
  };
}

// ---------------------------------------------------------------------------
// Deployment Guide — builder.
// ---------------------------------------------------------------------------

function buildDeploymentItem(spec, leafLabels, autoCats) {
  if (typeof spec === 'string') {
    const id = `deployment-guide/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec.split('/').pop())};
  }
  if (spec.doc) {
    // Explicit doc leaf with an inline label override.
    const id = `deployment-guide/${spec.doc}`;
    return {type: 'doc', id, label: spec.label || leafLabels[id] || humanize(spec.doc.split('/').pop())};
  }
  if (spec.auto) {
    // Reference an auto-generated sub-category (e.g., Desktop, Mobile, Air-Gapped).
    const cat = autoCats.get(spec.auto);
    if (!cat) throw new Error(`auto-category not found: deployment-guide/${spec.auto}`);
    return cat;
  }
  if (spec.group) {
    const g = DEPLOYMENT_GROUPS[spec.group];
    if (!g) throw new Error(`unknown deployment group: ${spec.group}`);
    return buildDeploymentGroup(g, leafLabels, autoCats);
  }
  return buildDeploymentGroup(spec, leafLabels, autoCats);
}

function buildDeploymentGroup(g, leafLabels, autoCats) {
  const items = g.items.map((it) => buildDeploymentItem(it, leafLabels, autoCats));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landing) {
    cat.link = {type: 'doc', id: `deployment-guide/${g.landing}`};
  }
  return cat;
}

function buildDeploymentSidebar(autoCat) {
  // Index the auto-generated sub-categories by directory name so we can
  // hand them off intact to the manual ordering. We look at the category's
  // link target first, and fall back to the first doc child if the dir
  // has no index.{md,mdx} (e.g., desktop/, mobile/).
  const autoCats = new Map();
  function dirNameFromId(id) {
    const parts = id.split('/');
    return parts.length >= 2 ? parts[1] : null;
  }
  for (const it of autoCat.items) {
    if (it.type !== 'category') continue;
    let dirName = null;
    if (it.link && it.link.id) {
      dirName = dirNameFromId(it.link.id);
    }
    if (!dirName && it.items) {
      const firstDoc = it.items.find((c) => c.type === 'doc' && c.id);
      if (firstDoc) dirName = dirNameFromId(firstDoc.id);
    }
    if (dirName) autoCats.set(dirName, it);
  }

  const leafLabels = collectLeafLabels(autoCat);
  const items = DEPLOYMENT_ROOT_ORDER.map((spec) => buildDeploymentItem(spec, leafLabels, autoCats));

  // Orphan detection: surface any leaf doc in the Deployment Guide that we
  // didn't include in the manual order, so new files don't silently disappear.
  // DEPLOYMENT_HIDDEN is files we KNOW are re-parented inside groups — they
  // are referenced (so their labels need to stay in leafLabels) but they
  // must not be re-emitted as orphans.
  const hiddenIds = new Set();
  for (const h of DEPLOYMENT_HIDDEN) hiddenIds.add(`deployment-guide/${h}`);
  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id) && id !== 'deployment-guide/deployment-guide-index') {
      orphans.push(id);
    }
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Deployment Guide file(s) missing from DEPLOYMENT_ROOT_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  return {
    type: 'category',
    label: 'Deployment Guide',
    collapsed: true,
    link: {type: 'doc', id: 'deployment-guide/deployment-guide-index'},
    items,
  };
}

// ---------------------------------------------------------------------------
// Administration Guide — builder (regroups the "Configure" sub-category).
// ---------------------------------------------------------------------------

// Resolves the label for a fully-qualified doc id (one that lives outside
// the section currently being built, e.g. an Agents doc nested under
// Administration Guide → Configure) by reading its own frontmatter
// directly, since it won't be present in that section's `leafLabels` map.
function docLabelById(id) {
  for (const ext of ['.mdx', '.md']) {
    const abs = join(SRC, `${id}${ext}`);
    if (existsSync(abs)) {
      return readFm(abs, 'sidebar_label') || readFm(abs, 'title') || humanize(id.split('/').pop());
    }
  }
  throw new Error(`doc id not found on disk: ${id}`);
}

function buildAdminConfigureItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `administration-guide/configure/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec)};
  }
  if (spec.doc) {
    return {type: 'doc', id: spec.doc, label: spec.label || docLabelById(spec.doc)};
  }
  const g = ADMIN_CONFIGURE_GROUPS[spec.group];
  if (!g) throw new Error(`unknown admin configure group: ${spec.group}`);
  const items = g.items.map((it) => buildAdminConfigureItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landingDoc) cat.link = {type: 'doc', id: g.landingDoc};
  else if (g.landing) cat.link = {type: 'doc', id: `administration-guide/configure/${g.landing}`};
  return cat;
}

// Replace the auto-generated "Configure" sub-category's items (in place,
// preserving its position among Administration Guide's other sub-categories
// like Onboard/Manage/Upgrade/Scale/Comply) with the manual grouping above.
function regroupAdminConfigure(configureCat) {
  const leafLabels = collectLeafLabels(configureCat);
  const items = ADMIN_CONFIGURE_ORDER.map((spec) => buildAdminConfigureItem(spec, leafLabels));

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of ADMIN_CONFIGURE_HIDDEN) hiddenIds.add(`administration-guide/configure/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id) && id !== 'administration-guide/configure/configuration-settings') {
      orphans.push(id);
    }
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Configure file(s) missing from ADMIN_CONFIGURE_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  configureCat.items = items;
  return configureCat;
}

function buildAdminManageItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `administration-guide/manage/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec.split('/').pop())};
  }
  if (spec.doc) {
    return {type: 'doc', id: spec.doc, label: spec.label || docLabelById(spec.doc)};
  }
  if (spec.group) {
    const g = ADMIN_MANAGE_GROUPS[spec.group];
    if (!g) throw new Error(`unknown admin manage group: ${spec.group}`);
    return buildAdminManageGroup(g, leafLabels);
  }
  return buildAdminManageGroup(spec, leafLabels);
}

function buildAdminManageGroup(g, leafLabels) {
  const items = g.items.map((it) => buildAdminManageItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landingDoc) cat.link = {type: 'doc', id: g.landingDoc};
  else if (g.landing) cat.link = {type: 'doc', id: `administration-guide/manage/${g.landing}`};
  return cat;
}

// Replace the auto-generated "Manage" sub-category's items (in place,
// flattening the manage/admin/ filesystem nesting into the task-based
// groups above) with the manual grouping.
function regroupAdminManage(manageCat) {
  const leafLabels = collectLeafLabels(manageCat);
  const items = ADMIN_MANAGE_ORDER.map((spec) => buildAdminManageItem(spec, leafLabels));
  // manage/ has no index file; server-maintenance is the hub Sphinx uses.
  manageCat.link = {type: 'doc', id: 'administration-guide/manage/admin/server-maintenance'};

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of ADMIN_MANAGE_HIDDEN) hiddenIds.add(`administration-guide/manage/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Manage file(s) missing from ADMIN_MANAGE_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  manageCat.items = items;
  return manageCat;
}

function buildAdminOnboardItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `administration-guide/onboard/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec.split('/').pop())};
  }
  if (spec.doc) {
    return {type: 'doc', id: spec.doc, label: spec.label || docLabelById(spec.doc)};
  }
  if (spec.group) {
    const g = ADMIN_ONBOARD_GROUPS[spec.group];
    if (!g) throw new Error(`unknown admin onboard group: ${spec.group}`);
    return buildAdminOnboardGroup(g, leafLabels);
  }
  return buildAdminOnboardGroup(spec, leafLabels);
}

function buildAdminOnboardGroup(g, leafLabels) {
  const items = g.items.map((it) => buildAdminOnboardItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landingDoc) cat.link = {type: 'doc', id: g.landingDoc};
  else if (g.landing) cat.link = {type: 'doc', id: `administration-guide/onboard/${g.landing}`};
  return cat;
}

// Replace the auto-generated "Onboard" sub-category's items (in place,
// preserving its position among Administration Guide's other sub-categories)
// with the manual grouping above.
function regroupAdminOnboard(onboardCat) {
  const leafLabels = collectLeafLabels(onboardCat);
  const items = ADMIN_ONBOARD_ORDER.map((spec) => buildAdminOnboardItem(spec, leafLabels));

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of ADMIN_ONBOARD_HIDDEN) hiddenIds.add(`administration-guide/onboard/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Onboard file(s) missing from ADMIN_ONBOARD_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  onboardCat.items = items;
  return onboardCat;
}

function buildAdminScaleItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `administration-guide/scale/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec.split('/').pop())};
  }
  if (spec.doc) {
    return {type: 'doc', id: spec.doc, label: spec.label || docLabelById(spec.doc)};
  }
  if (spec.group) {
    const g = ADMIN_SCALE_GROUPS[spec.group];
    if (!g) throw new Error(`unknown admin scale group: ${spec.group}`);
    return buildAdminScaleGroup(g, leafLabels);
  }
  return buildAdminScaleGroup(spec, leafLabels);
}

function buildAdminScaleGroup(g, leafLabels) {
  const items = g.items.map((it) => buildAdminScaleItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landingDoc) cat.link = {type: 'doc', id: g.landingDoc};
  else if (g.landing) cat.link = {type: 'doc', id: `administration-guide/scale/${g.landing}`};
  return cat;
}

// Replace the auto-generated "Scale" sub-category's items (in place,
// preserving its position among Administration Guide's other sub-categories)
// with the manual grouping above, and re-label it: the eight monitoring pages
// pulled in from manage/ make "Scale" an inaccurate name for what's here.
function regroupAdminScale(scaleCat) {
  const leafLabels = collectLeafLabels(scaleCat);
  const items = ADMIN_SCALE_ORDER.map((spec) => buildAdminScaleItem(spec, leafLabels));
  scaleCat.label = 'Monitor and troubleshoot';
  scaleCat.link = {type: 'doc', id: 'administration-guide/manage/admin/monitoring-and-performance'};

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of ADMIN_SCALE_HIDDEN) hiddenIds.add(`administration-guide/scale/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Scale file(s) missing from ADMIN_SCALE_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  scaleCat.items = items;
  return scaleCat;
}

function buildAdminComplyItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `administration-guide/comply/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec.split('/').pop())};
  }
  if (spec.doc) {
    return {type: 'doc', id: spec.doc, label: spec.label || docLabelById(spec.doc)};
  }
  if (spec.group) {
    const g = ADMIN_COMPLY_GROUPS[spec.group];
    if (!g) throw new Error(`unknown admin comply group: ${spec.group}`);
    return buildAdminComplyGroup(g, leafLabels);
  }
  return buildAdminComplyGroup(spec, leafLabels);
}

function buildAdminComplyGroup(g, leafLabels) {
  const items = g.items.map((it) => buildAdminComplyItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landingDoc) cat.link = {type: 'doc', id: g.landingDoc};
  else if (g.landing) cat.link = {type: 'doc', id: `administration-guide/comply/${g.landing}`};
  return cat;
}

// Re-order the auto-generated "Comply" sub-category (in place) — no
// regrouping, just the reading order from ADMIN_COMPLY_ORDER.
function regroupAdminComply(complyCat) {
  const leafLabels = collectLeafLabels(complyCat);
  const items = ADMIN_COMPLY_ORDER.map((spec) => buildAdminComplyItem(spec, leafLabels));

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of ADMIN_COMPLY_HIDDEN) hiddenIds.add(`administration-guide/comply/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Comply file(s) missing from ADMIN_COMPLY_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  complyCat.items = items;
  return complyCat;
}

function buildAdminUpgradeItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `administration-guide/upgrade/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec.split('/').pop())};
  }
  if (spec.doc) {
    return {type: 'doc', id: spec.doc, label: spec.label || docLabelById(spec.doc)};
  }
  if (spec.group) {
    const g = ADMIN_UPGRADE_GROUPS[spec.group];
    if (!g) throw new Error(`unknown admin upgrade group: ${spec.group}`);
    return buildAdminUpgradeGroup(g, leafLabels);
  }
  return buildAdminUpgradeGroup(spec, leafLabels);
}

function buildAdminUpgradeGroup(g, leafLabels) {
  const items = g.items.map((it) => buildAdminUpgradeItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landingDoc) cat.link = {type: 'doc', id: g.landingDoc};
  else if (g.landing) cat.link = {type: 'doc', id: `administration-guide/upgrade/${g.landing}`};
  return cat;
}

// Replace the auto-generated "Upgrade" sub-category's items (in place) with
// the procedural order above.
function regroupAdminUpgrade(upgradeCat) {
  const leafLabels = collectLeafLabels(upgradeCat);
  const items = ADMIN_UPGRADE_ORDER.map((spec) => buildAdminUpgradeItem(spec, leafLabels));

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of ADMIN_UPGRADE_HIDDEN) hiddenIds.add(`administration-guide/upgrade/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Upgrade file(s) missing from ADMIN_UPGRADE_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  upgradeCat.items = items;
  return upgradeCat;
}

function buildAdminGuideSidebar(autoCat) {
  const regroupers = {
    configure: regroupAdminConfigure,
    manage: regroupAdminManage,
    onboard: regroupAdminOnboard,
    scale: regroupAdminScale,
    comply: regroupAdminComply,
    upgrade: regroupAdminUpgrade,
  };
  const found = new Set();
  for (const it of autoCat.items) {
    if (it.type !== 'category') continue;
    const dirName = categoryDirName(it);
    const regroup = regroupers[dirName];
    if (!regroup) continue;
    regroup(it);
    found.add(dirName);
  }
  for (const dirName of Object.keys(regroupers)) {
    if (!found.has(dirName)) {
      console.warn(`[sidebar] WARN: Administration Guide "${dirName}" sub-category not found — its ordering override was not applied.`);
    }
  }

  orderRootCategories(autoCat, ADMIN_ROOT_ORDER, 'Administration Guide');
  return autoCat;
}

// ---------------------------------------------------------------------------
// End User Guide — builder (regroups the "Collaborate" sub-category).
// ---------------------------------------------------------------------------

function buildCollaborateItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `end-user-guide/collaborate/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec)};
  }
  if (spec.items) {
    // Inline subgroup (no COLLABORATE_GROUPS lookup) — mirrors
    // buildAdminManageItem/buildAdminManageGroup, so a group's items can
    // nest a further {label, items} sub-group for a 4th nesting level.
    return buildCollaborateGroup(spec, leafLabels);
  }
  const g = COLLABORATE_GROUPS[spec.group];
  if (!g) throw new Error(`unknown collaborate group: ${spec.group}`);
  return buildCollaborateGroup(g, leafLabels);
}

function buildCollaborateGroup(g, leafLabels) {
  const items = g.items.map((it) => buildCollaborateItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landing) cat.link = {type: 'doc', id: `end-user-guide/collaborate/${g.landing}`};
  return cat;
}

// Replace the auto-generated "Collaborate" sub-category's items (in place,
// preserving its position among End User Guide's other sub-categories) with
// the manual grouping above — same pattern as regroupAdminConfigure/Manage.
function regroupCollaborate(collaborateCat) {
  const leafLabels = collectLeafLabels(collaborateCat);
  const items = COLLABORATE_ORDER.map((spec) => buildCollaborateItem(spec, leafLabels));

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of COLLABORATE_HIDDEN) hiddenIds.add(`end-user-guide/collaborate/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id)) orphans.push(id);
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Collaborate file(s) missing from COLLABORATE_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  collaborateCat.items = items;
  return collaborateCat;
}

// ---------------------------------------------------------------------------
// Integrations Guide — builder.
// ---------------------------------------------------------------------------

function buildIntegrationsItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `integrations-guide/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec)};
  }
  if (spec.group) {
    const g = INTEGRATIONS_GROUPS[spec.group];
    if (!g) throw new Error(`unknown integrations group: ${spec.group}`);
    return buildIntegrationsGroup(g, leafLabels);
  }
  return buildIntegrationsGroup(spec, leafLabels);
}

function buildIntegrationsGroup(g, leafLabels) {
  const items = g.items.map((it) => buildIntegrationsItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landing) cat.link = {type: 'doc', id: `integrations-guide/${g.landing}`};
  return cat;
}

function buildIntegrationsSidebar(autoCat) {
  const leafLabels = collectLeafLabels(autoCat);
  const items = INTEGRATIONS_ROOT_ORDER.map((spec) => buildIntegrationsItem(spec, leafLabels));

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of INTEGRATIONS_HIDDEN) hiddenIds.add(`integrations-guide/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id) && id !== 'integrations-guide/integrations-guide-index') {
      orphans.push(id);
    }
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Integrations Guide file(s) missing from INTEGRATIONS_ROOT_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  return {
    type: 'category',
    label: 'Integrations Guide',
    collapsed: true,
    link: {type: 'doc', id: 'integrations-guide/integrations-guide-index'},
    items,
  };
}

// ---------------------------------------------------------------------------
// Security Guide — builder.
// ---------------------------------------------------------------------------

function buildSecurityItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `security-guide/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec)};
  }
  if (spec.group) {
    const g = SECURITY_GROUPS[spec.group];
    if (!g) throw new Error(`unknown security group: ${spec.group}`);
    return buildSecurityGroup(g, leafLabels);
  }
  return buildSecurityGroup(spec, leafLabels);
}

function buildSecurityGroup(g, leafLabels) {
  const items = g.items.map((it) => buildSecurityItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landing) cat.link = {type: 'doc', id: `security-guide/${g.landing}`};
  return cat;
}

function buildSecuritySidebar(autoCat) {
  const leafLabels = collectLeafLabels(autoCat);
  const items = SECURITY_ROOT_ORDER.map((spec) => buildSecurityItem(spec, leafLabels));

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })(items);
  const hiddenIds = new Set();
  for (const h of SECURITY_HIDDEN) hiddenIds.add(`security-guide/${h}`);
  const orphans = [];
  for (const id of Object.keys(leafLabels)) {
    if (!known.has(id) && !hiddenIds.has(id) && id !== 'security-guide/security-guide-index') {
      orphans.push(id);
    }
  }
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} Security Guide file(s) missing from SECURITY_ROOT_ORDER — falling through to root:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  autoCat.items = items;
  return autoCat;
}

// ---------------------------------------------------------------------------
// End User Guide — builder. Two independent overrides on top of the
// otherwise filesystem-driven auto-generated sidebar:
//   1. Nests the Agents plugin's usage-tips page under the existing "AI
//      Agents" doc, the same way Configure nests Agents' admin-side pages
//      (see ADMIN_CONFIGURE_GROUPS.agents above) — a narrow, targeted
//      promotion rather than a full manual-grouping override.
//   2. Regroups the "Collaborate" sub-category (49 files) into the topic
//      groups defined in COLLABORATE_GROUPS above, the same
//      manual-grouping-override pattern used for Administration Guide's
//      Configure/Manage/Onboard/Scale sections.
// ---------------------------------------------------------------------------

// Finds the {type: 'doc', id: docId} leaf anywhere in `items` and replaces
// it in place with a category that links to that same doc and nests
// `children` (each a fully-qualified doc id) underneath it. Returns true if
// the promotion was applied, so callers can warn when it wasn't.
function promoteDocToCategory(items, docId, children) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.type === 'doc' && it.id === docId) {
      items[i] = {
        type: 'category',
        label: it.label,
        collapsed: true,
        link: {type: 'doc', id: docId},
        items: children.map((childId) => ({type: 'doc', id: childId, label: docLabelById(childId)})),
      };
      return true;
    }
    if (it.type === 'category' && it.items && promoteDocToCategory(it.items, docId, children)) {
      return true;
    }
  }
  return false;
}

function buildEndUserGuideSidebar(autoCat) {
  const promoted = promoteDocToCategory(autoCat.items, 'end-user-guide/agents', ['agents/docs/usage_tips']);
  if (!promoted) {
    console.warn('[sidebar] WARN: End User Guide "agents" doc not found — Agents usage-tips nesting was not applied.');
  }

  let foundCollaborate = false;
  for (const it of autoCat.items) {
    if (it.type !== 'category') continue;
    if (categoryDirName(it) === 'collaborate') {
      regroupCollaborate(it);
      foundCollaborate = true;
    }
  }
  if (!foundCollaborate) {
    console.warn('[sidebar] WARN: End User Guide "Collaborate" sub-category not found — COLLABORATE_GROUPS override was not applied.');
  }

  orderRootCategories(autoCat, ENDUSER_ROOT_ORDER, 'End User Guide');
  return autoCat;
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------

function main() {
  if (!existsSync(SRC)) { console.error(`SRC not found at ${SRC}`); process.exit(1); }

  const sidebar = [];
  for (const {dir, label} of TOP_LEVEL) {
    const abs = join(SRC, dir);
    if (!existsSync(abs)) continue;
    let cat = buildCategory(abs, dir);
    if (!cat) continue;
    cat.label = label;
    cat.collapsed = true;
    if (dir === 'product-overview') {
      cat = buildOverviewSidebar(cat);
    } else if (dir === 'deployment-guide') {
      cat = buildDeploymentSidebar(cat);
    } else if (dir === 'administration-guide') {
      cat = buildAdminGuideSidebar(cat);
    } else if (dir === 'end-user-guide') {
      cat = buildEndUserGuideSidebar(cat);
    } else if (dir === 'integrations-guide') {
      cat = buildIntegrationsSidebar(cat);
    } else if (dir === 'security-guide') {
      cat = buildSecuritySidebar(cat);
    }
    sidebar.push(cat);
  }
  writeFileSync(OUT, JSON.stringify(sidebar, null, 2));

  let cats = 0, docs = 0;
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'category') cats++;
      if (n.type === 'doc') docs++;
      if (n.items) walk(n.items);
    }
  })(sidebar);
  console.log(`[sidebar] wrote ${OUT}: ${cats} categories, ${docs} docs`);
}

main();
