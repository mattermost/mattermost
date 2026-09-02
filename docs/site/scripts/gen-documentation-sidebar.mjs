#!/usr/bin/env node
// Generate the Documentation sidebar from the content tree under main/.
// Output: docs-site/sidebars/documentation.generated.json
//
// Mirrors gen-developer-sidebar.mjs in structure. Grouping config lives at
// the top of the file — that's what you touch to add or move a page. The
// builder functions below it rarely change for a content-only edit.
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
// By default a section's sidebar is built straight from the filesystem: each
// subdirectory becomes a category, each file a doc, sorted by
// `sidebar_position` frontmatter then filename. Sections that are flat piles
// of 15-49 files get a manual override instead, applied at render time only —
// the files stay where they are on disk, so URLs don't move.
//
// An override is a `*_GROUPS` map (key -> {label, landing?, items}) plus a
// `*_ORDER` array for the top level: strings for standalone docs,
// `{group: 'key'}` for a group. Group `items` can nest `{label, items}`
// sub-groups for deeper levels. A `*_HIDDEN` set lists files re-parented into
// a group so the orphan check doesn't re-append them at the section root; a
// page that belongs in no sidebar at all carries `unlisted: true` instead.
//
// Adding a file: add its basename to a group's `items`, or to the root order
// if it's standalone. Forgetting logs `WARN: N file(s) missing from *_ORDER`
// and appends it at the section root, so it surfaces as a build warning
// rather than disappearing.

const TOP_LEVEL = [
  {dir: 'product-overview',     label: 'Overview'},
  {dir: 'use-case-guide',       label: 'Use Case Guide'},
  {dir: 'deployment-guide',     label: 'Deployment Guide'},
  {dir: 'administration-guide', label: 'Administration Guide'},
  {dir: 'security-guide',       label: 'Security Guide'},
  {dir: 'end-user-guide',       label: 'End User Guide'},
  {dir: 'integrations-guide',   label: 'Integrations Guide'},
  {dir: 'get-help',             label: 'Support and Community'},
];

// ---------------------------------------------------------------------------
// Overview — manual grouping override.
// ---------------------------------------------------------------------------
//
// The Overview directory stays flat (~40 .mdx files at one level) for URL
// stability — moving files into sub-directories would break the redirect
// table. Grouping here mirrors the live docs.mattermost.com structure.

const OVERVIEW_GROUPS = {
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
// The operator's end-to-end path is one group, `serverDeployment`, ordered as
// a progression: Plan → Prepare → choose a method → make it highly available →
// secure it → back it up. That keeps the guide's top level to five entries —
// evaluate, pick a scenario, deploy the server, then the three client-side
// sections — instead of thirteen. The `server/` directory is dissolved into
// the Plan / Prepare / Deploy groups.
//
// There is no `scaling` group. Sizing is a planning question and lives in
// Plan; the search and cache pages are setup steps against real infrastructure
// and live in Prepare. What survives of the old Scale section is the
// `referenceArch` group, a holding pen for the nine `scale-to-*` pages pending
// the consolidation gated in docs/PARITY-reference-architectures.md.
//
// Troubleshooting is deliberately NOT one category. Each surface-specific page
// sits next to the step that produces its errors — the database pages under
// Prepare, Docker under Containers, and the app pages at the end of their own
// sections — because that is where the reader already is when it breaks. Only
// the cross-cutting page (logs, environment review, support-ticket data) has
// no section home, so it closes Server deployment as the single entry point
// for a reader who can't yet tell which layer failed.

const DEPLOYMENT_GROUPS = {
  // Near the top rather than buried: these are the patterns regulated and
  // disconnected deployments start from.
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

  // What you decide before touching a server. Deployment Solution Programs
  // deliberately isn't here — most of that page is a compliance spec for
  // third parties building installers, so it lives under Support and
  // Community, linked from the Plan and Deploy landing pages.
  //
  // Software and hardware requirements sorts last: it states minimums for
  // components the reader has already chosen and sized.
  plan: {
    label: 'Plan',
    landing: 'server/server-deployment-planning',
    items: [
      'application-architecture',
      'deployment-architecture',
      {group: 'referenceArch'},
      'software-hardware-requirements',
    ],
  },

  // The tested reference architectures, which "Size your deployment" is meant
  // to replace. They are still here because the two disagree on the numbers
  // they both publish — see docs/PARITY-reference-architectures.md. This group
  // disappears when that report is signed off and the pages are deleted.
  referenceArch: {
    label: 'Reference architectures',
    landing: 'scale/scaling-for-enterprise',
    items: [
      'scale/scale-to-200-users',
      'scale/scale-to-2000-users',
      'scale/scale-to-15000-users',
      'scale/scale-to-30000-users',
      'scale/scale-to-50000-users',
      'scale/scale-to-80000-users',
      'scale/scale-to-90000-users',
      'scale/scale-to-100000-users',
      'scale/scale-to-200000-users',
      'scale/server-architecture',
      'scale/backing-storage-benchmarks',
    ],
  },

  // Prerequisites that must exist before the install runs. Sits BEFORE Deploy
  // deliberately: a reader following the sidebar top to bottom must not finish
  // installing before reaching NGINX and TLS. The hard prerequisites lead, the
  // production hardening follows, and search and cache close the group: they
  // are setup steps against real infrastructure, but only large deployments
  // provision them.
  //
  // The two MySQL pages are `unlisted: true` rather than listed here. MySQL is
  // removed in v11, so they are no longer part of any supported install path,
  // but they stay published because a reader mid-migration still needs them.
  prepare: {
    label: 'Prepare',
    landing: 'server/preparations',
    items: [
      'server/prepare-database',
      'server/prepare-file-storage',
      'server/prepare-network',
      'server/setup-nginx-proxy',
      'server/setup-tls',
      'server/image-proxy',
      'server/pre-authentication-secrets',
      'server/high-availability-cluster-based-deployment',
      {label: 'Search infrastructure', landing: 'scale/enterprise-search', items: [
        'scale/elasticsearch-setup',
        'scale/opensearch-setup',
      ]},
      {doc: 'scale/redis', label: 'Caching with Redis'},
    ],
  },

  // One sub-group per deployment method, with a landing page comparing them so
  // the trade-offs sit next to the pages they describe. Named for the choice
  // the reader is making here — Linux, Kubernetes, or containers — rather than
  // for the act of deploying, which is what the whole parent group is about.
  install: {
    label: 'Choose a deployment method',
    landing: 'server/deploy-server',
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
        'server/docker-troubleshooting',
      ]},
    ],
  },

  // Encryption at rest and in transit depend on both the proxy from Prepare
  // and a running server from Deploy, so this is its own step after both
  // rather than a child of either.
  secure: {
    label: 'Secure your deployment',
    landing: 'encryption-options',
    items: [
      'transport-encryption',
    ],
  },

  // Deployment-time architecture (HA-vs-DR, active/passive across two sites),
  // not routine administration.
  backupDr: {
    label: 'Back up and recover',
    landing: 'backup-disaster-recovery',
    items: [
      'disaster-recovery-aws',
    ],
  },

  // The operator's path, start to finish. Every child is a step in it, which
  // is why the securing and backup steps are siblings of the install methods
  // rather than children: each depends on a running server, not on which
  // method produced it.
  serverDeployment: {
    label: 'Server deployment',
    items: [
      {group: 'plan'},
      {group: 'prepare'},
      {group: 'install'},
      {group: 'secure'},
      {group: 'backupDr'},
      // Keeps its auto-generated tree: it has an index file and its children
      // already set sidebar_position.
      {auto: 'air-gapped-operations'},
      {doc: 'server/troubleshooting', label: 'General deployment troubleshooting'},
    ],
  },

  // Moved here from Administration Guide → Configure: RTCD, Offloader, and
  // the rest are deployment concerns, not settings-reference material.
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

  // Explicit rather than auto-generated, so the section overview is the
  // landing page and the children run in procedural order. Troubleshooting
  // closes the section: symptom triage is what a reader reaches for after
  // working through the rollout pages above it.
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
      'desktop/desktop-troubleshooting',
    ],
  },

  // Same treatment as Desktop. The FAQ and troubleshooting pages pair up at
  // the end — both are question-shaped rather than procedural.
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
      'mobile/mobile-troubleshooting',
    ],
  },
};

// Deployment Scenarios stays a sibling of Server deployment rather than a
// child of Plan: it addresses evaluation, DNS failover, and zero-trust access
// constraints that shape the whole deployment, above the level of the
// server-specific planning pages.
const DEPLOYMENT_ROOT_ORDER = [
  'quick-start-evaluation',
  {group: 'deploymentScenarios'},
  {group: 'serverDeployment'},
  {group: 'calls'},
  {group: 'desktop'},
  {group: 'mobile'},
];

// Empty because every Deployment Guide page is placed explicitly above. An
// empty hidden list is the signal that nothing here is unreachable — keep it
// that way.
const DEPLOYMENT_HIDDEN = new Set([]);

// ---------------------------------------------------------------------------
// Administration Guide — Configure — manual grouping override.
// ---------------------------------------------------------------------------
//
// Grouped by task/subsystem so the ~13 "*-configuration-settings" reference
// pages don't drown the task-oriented pages sitting alongside them.

const ADMIN_CONFIGURE_GROUPS = {
  settingsReference: {
    // Ordered to follow the System Console's own left-hand nav.
    label: 'System Console settings reference',
    landing: 'configuration-settings',
    items: [
      'site-configuration-settings',
      'authentication-configuration-settings',
      'user-management-configuration-settings',
      'system-attributes',
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
    label: 'Branding and customization',
    landingDoc: 'administration-guide/manage/admin/customize-branding',
    items: [
      'customize-mattermost',
      'custom-branding-tools',
      {doc: 'administration-guide/manage/code-signing-custom-builds'},
    ],
  },
  // The Agents plugin's own provider/setup pages, staged into main/agents/docs/
  // from the mattermost-plugin-agents submodule by stage-agents-docs.mjs. They
  // nest under the admin guide landing page rather than getting a top-level
  // section, and use the {doc: '<full id>'} form since they live outside
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

// Settings reference first, then the subsystems you configure at setup time,
// then the capabilities you turn on afterwards.
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
  // Listed under Monitor and troubleshoot / Manage.
  'optimize-your-workspace', 'manage-user-surveys',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Manage — manual grouping override.
// ---------------------------------------------------------------------------
//
// The flat top level (19 files) vs. nested manage/admin/ (18) split on disk is
// a filesystem artifact, and an inconsistent one — monitoring and billing
// pages are each scattered across both. Replaced here with task-based groups.

const ADMIN_MANAGE_GROUPS = {
  // "Access control" rather than "Users and access": every page here is about
  // what a user is allowed to do, not about the user records themselves.
  //
  // User attributes nests under ABAC as its first child. Custom profile
  // attributes are usable on their own, and the page stays directly linkable,
  // but they are a prerequisite of the access rules that follow — you define
  // the attributes before you can write a policy against them.
  //
  // Advanced permissions is a two-page topic, so the main page is the group's
  // landing and the backend-infrastructure page is its child.
  accessControl: {
    label: 'Access control',
    landing: 'admin/user-management',
    items: [
      'team-channel-members',
      {label: 'Advanced permissions', landingDoc: 'administration-guide/onboard/advanced-permissions', items: [
        {doc: 'administration-guide/onboard/advanced-permissions-backend-infrastructure'},
      ]},
      {doc: 'administration-guide/onboard/delegated-granular-administration'},
      {label: 'Attribute-based access control', landing: 'admin/attribute-based-access-control', items: [
        'admin/user-attributes',
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
  reference: {
    label: 'Reference',
    items: [
      'product-limits',
      'feature-labels',
    ],
  },
};

// `admin/`-prefixed basenames live in the nested sub-folder.
const ADMIN_MANAGE_ORDER = [
  {group: 'accessControl'},
  {group: 'serverOps'},
  {group: 'licensing'},
  {group: 'cloudWorkspace'},
  {group: 'notices'},
  {group: 'reference'},
];

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
  'product-limits', 'feature-labels',
  // Listed under Migration.
  'bulk-export-tool', 'admin/migration', 'admin/postgres-migration',
  'admin/postgres-migration-assist-tool', 'admin/manual-postgres-migration',
  'admin/fips-migration',
  // Listed under Configure.
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
// 48 files with Channels, Messaging, Calls, Teams, and Accessibility topics
// interleaved alphabetically, grouped here by topic. Item order within a group
// is the reader's task sequence, not alphabetical — joining a channel comes
// before creating one, archiving last.

const COLLABORATE_GROUPS = {
  channels: {
    label: 'Channels',
    landing: 'collaborate-within-channels',
    items: [
      'channel-types',
      'browse-channels',
      'join-leave-channels',
      'create-channels',
      'channel-naming-conventions',
      'channel-header-purpose',
      'rename-channels',
      'navigate-between-channels',
      'favorite-channels',
      'mark-channels-unread',
      'manage-channel-members',
      'manage-channel-bookmarks',
      'display-channel-banners',
      'convert-public-channels',
      'convert-group-messages',
      'archive-unarchive-channels',
    ],
  },
  messaging: {
    label: 'Messages and threads',
    landing: 'communicate-with-messages',
    items: [
      'send-messages',
      'reply-to-messages',
      'organize-conversations',
      'format-messages',
      'mention-people',
      'react-with-emojis-gifs',
      'share-files-in-messages',
      'share-links',
      'message-priority',
      'schedule-messages',
      'message-reminders',
      'mark-messages-unread',
      'save-pin-messages',
      'forward-messages',
      'search-for-messages',
      'autotranslate-messages',
      'flag-messages',
    ],
  },
  calls: {
    label: 'Calls and screen sharing',
    landing: 'audio-and-screensharing',
    items: [
      'make-calls',
    ],
  },
  teamsAndRoles: {
    label: 'Teams, groups, and roles',
    items: [
      'learn-about-roles',
      'organize-using-teams',
      'team-settings',
      'organize-using-custom-user-groups',
    ],
  },
  integrations: {
    label: 'Integrations and connected apps',
    items: [
      'extend-mattermost-with-integrations',
      'collaborate-within-connected-microsoft-teams',
    ],
  },
  accessibility: {
    label: 'Keyboard shortcuts and accessibility',
    items: [
      'keyboard-shortcuts',
      'team-keyboard-shortcuts',
      'keyboard-accessibility',
    ],
  },
};

const COLLABORATE_ORDER = [
  'invite-people',
  {group: 'channels'},
  {group: 'messaging'},
  {group: 'calls'},
  {group: 'teamsAndRoles'},
  {group: 'integrations'},
  {group: 'accessibility'},
];

// agents-context-management leaves Collaborate entirely — it sits under AI
// Agents.
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
]);

// ---------------------------------------------------------------------------
// Administration Guide — Onboard — manual grouping override.
// ---------------------------------------------------------------------------
//
// SAML nests inside the single sign-on group since it alone accounts for 8
// files. AD/LDAP is a sibling group, not an SSO child — an admin can run
// directory synchronization without SSO.

const ADMIN_ONBOARD_GROUPS = {
  sso: {
    label: 'Single sign-on',
    landing: 'corporate-directory-integration',
    items: [
      {
        label: 'SAML',
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
};

// Identity setup first, then getting accounts in. Platform migration moved out
// to the Migration section — arriving from another platform is a one-time
// project, not part of standing up authentication.
//
// Multi-factor authentication and SSL client certificates are sibling leaves
// rather than a "Multi-factor and certificate authentication" group. That
// group existed to hold experimental certificate-based authentication, which
// is deprecated from v11 and now `unlisted: true`; grouping the two survivors
// under a joint heading buries MFA, which is the one most admins want.
const ADMIN_ONBOARD_ORDER = [
  {group: 'sso'},
  {group: 'adldap'},
  'multi-factor-authentication',
  'ssl-client-certificate',
  'user-provisioning-workflows',
  'guest-accounts',
];

const ADMIN_ONBOARD_HIDDEN = new Set([
  'sso-saml', 'sso-saml-adfs', 'sso-saml-adfs-msws2016',
  'sso-saml-entraid', 'sso-saml-keycloak', 'sso-saml-okta',
  'sso-saml-onelogin', 'sso-saml-technical',
  'sso-openidconnect', 'sso-google', 'sso-gitlab', 'sso-entraid',
  'convert-oauth20-service-providers-to-openidconnect',
  'corporate-directory-integration',
  'ad-ldap', 'ad-ldap-groups-synchronization', 'managing-team-channel-membership-using-ad-ldap-sync-groups',
  // Listed under Manage > Access control.
  'advanced-permissions', 'advanced-permissions-backend-infrastructure',
  'delegated-granular-administration',
  // Listed under Configure.
  'connected-workspaces',
  // Listed under Migration.
  'migrating-to-mattermost', 'migrate-from-slack', 'migrate-from-rocketchat', 'migrate-gitlab-omnibus',
  'migration-announcement-email', 'bulk-loading-data',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Scale — manual grouping override.
// ---------------------------------------------------------------------------
//
// The capacity planning, HA, search, and caching pages that used to live here
// were physically moved to `deployment-guide/scale/` (see the `scaling` group
// in DEPLOYMENT_GROUPS). What's left is monitoring, so regroupAdminScale
// re-labels the category "Monitor and troubleshoot" and pulls in the
// monitoring pages that live in manage/ on disk, by full doc id.

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

const ADMIN_SCALE_HIDDEN = new Set([
  'collect-performance-metrics', 'deploy-prometheus-grafana-for-performance-monitoring',
  'performance-monitoring-metrics', 'performance-alerting', 'push-notification-health-targets',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Comply and Upgrade — manual ordering overrides.
// ---------------------------------------------------------------------------
//
// Both are small enough not to need groups, but read badly in filename order.
// Comply runs by how widely each capability is used, reference material last;
// Upgrade follows the upgrade procedure.

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

const ADMIN_UPGRADE_HIDDEN = new Set([
  'admin-onboarding-tasks', 'enterprise-roll-out-checklist', 'welcome-email-to-end-users',
  // Listed under Manage > Notices and surveys.
  'notify-admin',
]);

// ---------------------------------------------------------------------------
// Administration Guide — Migration — synthetic top-level section.
// ---------------------------------------------------------------------------
//
// Not built from a directory: these pages live in manage/ and onboard/ on
// disk. They are one section because bulk import and export exist for the same
// reason a database or FIPS migration does — someone is moving a deployment
// in, out, or between configurations. Splitting import/export away from
// migration would separate things that serve one job.
//
// Full doc ids throughout, since the pages come from two directories.

const ADMIN_MIGRATION = {
  label: 'Migrate',
  landing: 'administration-guide/manage/admin/migration',
  items: [
    'administration-guide/onboard/bulk-loading-data',
    'administration-guide/manage/bulk-export-tool',
    {label: 'Migrate from MySQL to PostgreSQL', landing: 'administration-guide/manage/admin/postgres-migration', items: [
      'administration-guide/manage/admin/postgres-migration-assist-tool',
      'administration-guide/manage/admin/manual-postgres-migration',
    ]},
    'administration-guide/manage/admin/fips-migration',
    {label: 'Migrate from another platform', landing: 'administration-guide/onboard/migrating-to-mattermost', items: [
      'administration-guide/onboard/migrate-from-slack',
      'administration-guide/onboard/migrate-from-rocketchat',
      'administration-guide/onboard/migrate-gitlab-omnibus',
      'administration-guide/onboard/migration-announcement-email',
    ]},
  ],
};

// Migrate sits last, after Upgrade: a customer builds the infrastructure,
// upgrades it, and then moves data into it.
const ADMIN_ROOT_ORDER = [
  'Configure', 'Onboard users', 'Manage', 'Monitor and troubleshoot', 'Comply', 'Upgrade',
  'Migrate',
];

// AI Agents above Project Management: Boards is in maintenance mode (see
// administration-guide/configure/install-boards), Agents is not.
const ENDUSER_ROOT_ORDER = [
  'Access your workspace', 'Collaborate', 'Workflow Automation', 'AI Agents',
  'Project Management', 'Preferences',
];

// ---------------------------------------------------------------------------
// End User Guide — Access / Workflow Automation / Project Management /
// Preferences ordering overrides.
// ---------------------------------------------------------------------------
//
// None of the pages in these four sections set `sidebar_position`, so without
// an override they'd fall through to alphabetical order.

const ENDUSER_SECTION_OVERRIDES = {
  access: {
    // access/ has no landing file for the auto-generated label to come from.
    label: 'Access your workspace',
    landing: 'access-your-workspace',
    order: [
      'install-desktop-app',
      'install-ios-app',
      'install-android-app',
      'client-availability',
      'log-out',
    ],
  },
  'workflow-automation': {
    order: [
      'learn-about-playbooks',
      'work-with-playbooks',
      'work-with-runs',
      'work-with-tasks',
      'notifications-and-updates',
      'metrics-and-goals',
      'share-and-collaborate',
      'interact-with-playbooks',
    ],
  },
  'project-management': {
    order: [
      'navigate-boards',
      'work-with-boards',
      'work-with-cards',
      'work-with-views',
      'groups-filter-sort',
      'calculations',
      'share-and-collaborate',
      'migrate-to-boards',
      'boards-settings',
    ],
  },
  preferences: {
    order: [
      'manage-your-profile',
      'set-your-status-availability',
      'manage-your-security-preferences',
      {
        label: 'Notifications',
        landing: 'manage-your-notifications',
        items: [
          'manage-your-mentions-keywords-notifications',
          'manage-your-thread-reply-notifications',
          'manage-your-channel-specific-notifications',
          'manage-your-desktop-notifications',
          'manage-your-mobile-notifications',
          'manage-your-web-notifications',
          'troubleshoot-notifications',
        ],
      },
      'customize-your-theme',
      'manage-your-display-options',
      'customize-your-channel-sidebar',
      'manage-your-sidebar-options',
      'manage-advanced-options',
      'manage-your-plugin-preferences',
      'customize-desktop-app-experience',
      'connect-multiple-workspaces',
    ],
  },
};

// ---------------------------------------------------------------------------
// Integrations Guide — manual grouping override.
// ---------------------------------------------------------------------------
//
// Pre-built integrations open the guide: a reader arriving here should first
// see what already exists, then how the delivery mechanism works (Plugins),
// and only then how to build their own (webhooks, slash commands, the API).
//
// Vendor pages nest under their catalogue and mirror the tables on
// popular-integrations, split Microsoft / third-party. Microsoft stays its own
// group even though Microsoft is a third party: it reflects the partnership,
// and a reader looking for Teams looks under Microsoft before looking under a
// capability heading. Alphabetical within each group so a reader scanning for
// a vendor name can predict where to look.

const INTEGRATIONS_GROUPS = {
  prebuilt: {
    label: 'Pre-built integrations',
    landing: 'popular-integrations',
    items: [
      {label: 'Microsoft integrations', items: [
        'mattermost-mission-collaboration-for-m365',
        'microsoft-calendar',
        'microsoft-teams-meetings',
        'microsoft-teams-sync',
      ]},
      {label: 'Third-party integrations', items: [
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

const INTEGRATIONS_ROOT_ORDER = [
  {group: 'prebuilt'},
  'plugins',
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
// Ordered by reader intent: harden the deployment, then the architectural
// posture model, then the platform-specific surface, then "prove it to an
// auditor" last. Flat filename order put the regulatory pages ahead of the
// hardening guidance most readers arrive for.

const SECURITY_GROUPS = {
  frameworks: {
    // Grouped so the section reads as "secure it" then "certify it" rather
    // than interleaving the two.
    label: 'Compliance Frameworks',
    items: [
      'cmmc-compliance',
      'finra-compliance',
      'hipaa-compliance',
    ],
  },
};

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

// Docusaurus already drops `draft` and `unlisted` pages from the production
// sidebar, so the generator has to agree or dev and prod disagree. MDX snippet
// includes use `unlisted: true` to keep their URL while leaving the sidebar.
function isHidden(filePath) {
  return readFm(filePath, 'draft') === 'true' || readFm(filePath, 'unlisted') === 'true';
}

function pathToDocId(relPath) { return relPath.replace(/\.(md|mdx)$/, ''); }

// Landing pages are named either `index.md(x)` or `<something>-index.md(x)`;
// the latter avoids filename collisions when files are flattened for URL
// stability, and doesn't always match its directory name. Both forms have to
// resolve, or category headers, sorting, and labels disagree.
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
// administration-guide/comply/), read off its landing page or first doc. Lets
// the section builders below find a sub-category to regroup without depending
// on its display label.
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
// keeps the frontmatter-derived titles.
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
    // Merged with the site landing: clicking "Overview" opens main/index.mdx
    // (slug: /), the unified welcome page.
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
    const id = `deployment-guide/${spec.doc}`;
    return {type: 'doc', id, label: spec.label || leafLabels[id] || humanize(spec.doc.split('/').pop())};
  }
  if (spec.auto) {
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
  // Index the auto-generated sub-categories by directory name so the manual
  // ordering can hand them off intact. Falls back to the first doc child for
  // directories with no index file (desktop/, mobile/).
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

// Label for a doc that lives outside the section being built, so it won't be
// in that section's `leafLabels` map. Read from its frontmatter directly.
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

// Every regroup* function below replaces a sub-category's items in place, so
// the sub-category keeps its position until orderRootCategories runs.
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

// Also flattens the manage/admin/ filesystem nesting into the task-based
// groups above.
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

// Re-labelled because the `scale/` directory name no longer describes what's
// listed here.
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

// Migration takes fully-qualified doc ids rather than basenames, so it needs
// no section prefix and reads labels straight off each file.
function buildAdminMigrationItem(spec) {
  if (typeof spec === 'string') {
    return {type: 'doc', id: spec, label: docLabelById(spec)};
  }
  if (spec.doc) {
    return {type: 'doc', id: spec.doc, label: spec.label || docLabelById(spec.doc)};
  }
  return buildAdminMigrationGroup(spec);
}

function buildAdminMigrationGroup(g) {
  const items = g.items.map(buildAdminMigrationItem);
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landing) cat.link = {type: 'doc', id: g.landing};
  return cat;
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

  autoCat.items.push(buildAdminMigrationGroup(ADMIN_MIGRATION));

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
    // Inline sub-group, no COLLABORATE_GROUPS lookup.
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
// End User Guide — builder.
// ---------------------------------------------------------------------------

// Replaces the `docId` leaf anywhere in `items` with a category that links to
// that same doc and nests `children` (doc ids, or {doc, label} pairs) under it.
// Returns false if the leaf wasn't found, so callers can warn.
function promoteDocToCategory(items, docId, children) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.type === 'doc' && it.id === docId) {
      items[i] = {
        type: 'category',
        label: it.label,
        collapsed: true,
        link: {type: 'doc', id: docId},
        items: children.map((child) => {
          const id = typeof child === 'string' ? child : child.doc;
          const label = (typeof child === 'string' ? null : child.label) || docLabelById(id);
          return {type: 'doc', id, label};
        }),
      };
      return true;
    }
    if (it.type === 'category' && it.items && promoteDocToCategory(it.items, docId, children)) {
      return true;
    }
  }
  return false;
}

function regroupEndUserSection(sectionCat, dirName, override) {
  const leafLabels = collectLeafLabels(sectionCat);
  const prefix = `end-user-guide/${dirName}/`;

  function buildItem(spec) {
    if (typeof spec === 'string') {
      const id = prefix + spec;
      return {type: 'doc', id, label: leafLabels[id] || humanize(spec)};
    }
    const cat = {type: 'category', label: spec.label, collapsed: true, items: spec.items.map(buildItem)};
    if (spec.landing) cat.link = {type: 'doc', id: prefix + spec.landing};
    return cat;
  }

  const items = override.order.map(buildItem);
  if (override.label) sectionCat.label = override.label;
  if (override.landing) sectionCat.link = {type: 'doc', id: prefix + override.landing};

  const known = new Set();
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (n.type === 'doc' && n.id) known.add(n.id);
      if (n.link && n.link.id) known.add(n.link.id);
      if (n.items) walk(n.items);
    }
  })([...items, sectionCat.link].filter(Boolean));
  const orphans = Object.keys(leafLabels).filter((id) => !known.has(id));
  if (orphans.length > 0) {
    console.warn(`[sidebar] WARN: ${orphans.length} ${dirName} file(s) missing from ENDUSER_SECTION_OVERRIDES — falling through to the end of the section:`);
    for (const id of orphans) console.warn(`  - ${id}`);
    for (const id of orphans) items.push({type: 'doc', id, label: leafLabels[id]});
  }

  sectionCat.items = items;
  return sectionCat;
}

function buildEndUserGuideSidebar(autoCat) {
  // usage_tips' label is overridden here because agents/docs/ is staged from
  // the plugin submodule and gitignored, so its frontmatter title can't be
  // corrected in this repo.
  const promoted = promoteDocToCategory(autoCat.items, 'end-user-guide/agents', [
    {doc: 'agents/docs/usage_tips', label: 'Agents usage tips and best practices'},
    'end-user-guide/collaborate/agents-context-management',
  ]);
  if (!promoted) {
    console.warn('[sidebar] WARN: End User Guide "agents" doc not found — Agents child pages were not nested.');
  }

  let foundCollaborate = false;
  const foundSections = new Set();
  for (const it of autoCat.items) {
    if (it.type !== 'category') continue;
    const dirName = categoryDirName(it);
    if (dirName === 'collaborate') {
      regroupCollaborate(it);
      foundCollaborate = true;
    } else if (ENDUSER_SECTION_OVERRIDES[dirName]) {
      regroupEndUserSection(it, dirName, ENDUSER_SECTION_OVERRIDES[dirName]);
      foundSections.add(dirName);
    }
  }
  if (!foundCollaborate) {
    console.warn('[sidebar] WARN: End User Guide "Collaborate" sub-category not found — COLLABORATE_GROUPS override was not applied.');
  }
  for (const dirName of Object.keys(ENDUSER_SECTION_OVERRIDES)) {
    if (!foundSections.has(dirName)) {
      console.warn(`[sidebar] WARN: End User Guide "${dirName}" sub-category not found — its ordering override was not applied.`);
    }
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
