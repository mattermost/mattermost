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
// Overview, Deployment Guide, Administration Guide > Configure, and
// Integrations Guide are flat piles of 15-40 files that read badly as one
// long alphabetical list, so each gets a manual grouping override applied
// at sidebar-render time only — the files themselves stay flat on disk, so
// URLs don't move.
//
// Each override is a `*_GROUPS` map (group key -> {label, landing?, items})
// plus a `*_ROOT_ORDER`/`*_ORDER` array giving the top-level order (plain
// strings for standalone docs, `{group: 'key'}` for a group from the map).
// A `*_HIDDEN` set lists files that got re-parented into a group so the
// orphan check below doesn't re-append them at the section root.
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
  {dir: 'security-guide',       label: 'Security & Compliance'},
  {dir: 'end-user-guide',       label: 'End User Guide'},
  {dir: 'integrations-guide',   label: 'Integrations Guide'},
  {dir: 'get-help',             label: 'Get Help'},
  {dir: 'agents',               label: 'Agents'},
];

// ---------------------------------------------------------------------------
// Overview — manual grouping override.
// ---------------------------------------------------------------------------
//
// The Overview directory is flat (~40 .mdx files at one level) for URL-
// stability reasons — moving files into sub-directories would break the
// redirect table. Mirrors the live docs.mattermost.com Overview structure.

// Files in docs/product-overview/ that are MDX snippet/partial includes,
// not standalone pages. Excluded from the auto-generated sidebar so they
// don't appear as orphan entries. They remain importable from other MDX.
const OVERVIEW_HIDDEN = new Set([
  'common-esr-support',
  'common-esr-support-upgrade',
  'common-esr-support-rst',
]);

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
        'cloud-supported-integrations',
        'corporate-directory-integration',
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
      'faq-license',
      'faq-mattermost-source-available-license',
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
  // Locally-added pages not present on live:
  'whats-new-in-v11',
];

// ---------------------------------------------------------------------------
// Deployment Guide — manual grouping override.
// ---------------------------------------------------------------------------
//
// The Deployment Guide directory has loose top-level files mixed with sub-
// directories (server/, desktop/, mobile/, air-gapped-operations/, reference-
// architecture/). The auto-generated sidebar ends up as 16 mostly-alphabetical
// items at the top level, with a 16-item kitchen-sink under Server.
//
// This override applies a progression-ordered grouping (Try → Plan → Install
// → Operate → Security → Troubleshoot). Server's internal structure is also
// restructured into Plan / Install-by-platform / Configure-at-install sub-
// groups, and the four troubleshooting pages that live under server/ are
// pulled up into the top-level "Deployment Troubleshooting" category.

const DEPLOYMENT_GROUPS = {
  // 'Deployment Scenarios' — promoted from inside Reference Architecture
  // to a top-level group. DISC-relevant patterns (Air-Gapped, DDIL, Mission
  // Partner, OOB, Sovereign-on-Microsoft) deserve prominence, not burial.
  deploymentScenarios: {
    label: 'Deployment Scenarios',
    landing: 'reference-architecture/deployment-scenarios/deployment-scenarios-index',
    items: [
      'reference-architecture/deployment-scenarios/air-gapped-deployment',
      'reference-architecture/deployment-scenarios/deploy-ddil-operations',
      'reference-architecture/deployment-scenarios/deploy-mission-partner',
      'reference-architecture/deployment-scenarios/deploy-oob',
      'reference-architecture/deployment-scenarios/deploy-sovereign-collaboration',
    ],
  },

  // Server — fully restructured. Reference Architecture's remaining pages
  // (Application Architecture + Software & Hardware Requirements) fold in
  // here as the "Plan" sub-group, alongside Preparations + Solution Programs.
  // The standalone Reference Architecture top-level category is eliminated;
  // its index page (reference-architecture-index) is hidden from the sidebar
  // (URL still resolves directly).
  server: {
    label: 'Server',
    landing: 'server/server-deployment-planning',
    items: [
      {label: 'Plan', items: [
        'reference-architecture/application-architecture',
        'software-hardware-requirements',
        'server/preparations',
        'server/orchestration',
      ]},
      // Install methods, each with their sub-pages.
      {label: 'Install on Linux', landing: 'server/deploy-linux', items: [
        'server/linux/deploy-ubuntu',
        'server/linux/deploy-rhel',
        'server/linux/deploy-tar',
        'server/linux/deploy-azure-native-vm',
      ]},
      {label: 'Install on Kubernetes', landing: 'server/deploy-kubernetes', items: [
        'server/kubernetes/deploy-k8s',
        'server/kubernetes/deploy-k8s-oke',
      ]},
      {label: 'Install with Containers', landing: 'server/deploy-containers', items: [
        'server/containers/fips-stig',
      ]},
      // Configure at install time — install-blocking decisions like TLS,
      // NGINX reverse proxy, image proxy, MySQL setup, pre-auth secrets.
      {label: 'Configure at install time', items: [
        'server/setup-nginx-proxy',
        'server/setup-tls',
        'server/pre-authentication-secrets',
        'server/image-proxy',
        'server/prepare-mattermost-mysql-database',
      ]},
    ],
  },

  // Backup & Disaster Recovery — group the two related pages.
  backupDr: {
    label: 'Backup & Disaster Recovery',
    landing: 'backup-disaster-recovery',
    items: [
      'disaster-recovery-aws',
    ],
  },

  // PostgreSQL Migration — group the three migration pages.
  postgresMig: {
    label: 'PostgreSQL Migration',
    landing: 'postgres-migration',
    items: [
      'postgres-migration-assist-tool',
      'manual-postgres-migration',
    ],
  },

  // Encryption — at-rest + in-transit.
  encryption: {
    label: 'Encryption',
    landing: 'encryption-options',
    items: [
      'transport-encryption',
    ],
  },

  // Deployment Troubleshooting — pulls in the four troubleshooting pages
  // currently scattered inside server/, plus the existing top-level page.
  troubleshooting: {
    label: 'Deployment Troubleshooting',
    landing: 'deployment-troubleshooting',
    items: [
      'server/troubleshooting',
      'server/docker-troubleshooting',
      'server/trouble_mysql',
      'server/trouble-postgres',
    ],
  },
};

// Top-level Deployment Guide order — Try → Plan → Install → Operate → Security
// → Troubleshoot. Strings are paths relative to docs/deployment-guide/; objects
// reference DEPLOYMENT_GROUPS keys or are inline sub-directories handled
// by the auto-generator (Desktop, Mobile, Air-Gapped Operations).
const DEPLOYMENT_ROOT_ORDER = [
  'quick-start-evaluation',
  {group: 'deploymentScenarios'},
  'deployment-architecture',
  {group: 'server'},
  // Desktop, Mobile, Air-Gapped Operations keep their auto-generated trees
  // (each has its own index file + sub-pages). Referenced by the `__auto__`
  // sentinel so we slot them in here, in the order we want.
  {auto: 'desktop'},
  {auto: 'mobile'},
  {auto: 'air-gapped-operations'},
  {group: 'backupDr'},
  {group: 'postgresMig'},
  {group: 'encryption'},
  {group: 'troubleshooting'},
];

// Files re-parented into other groups — exclude from the orphan check so they
// don't get re-appended at root level.
const DEPLOYMENT_HIDDEN = new Set([
  'software-hardware-requirements',                       // → server Plan
  'reference-architecture/application-architecture',      // → server Plan
  'reference-architecture/reference-architecture-index',  // orphan after RA removal — URL still resolves directly
  'backup-disaster-recovery',                             // → backupDr (as landing)
  'disaster-recovery-aws',                                // → backupDr
  'postgres-migration',                                   // → postgresMig (as landing)
  'postgres-migration-assist-tool',                        // → postgresMig
  'manual-postgres-migration',                             // → postgresMig
  'encryption-options',                                    // → encryption (as landing)
  'transport-encryption',                                  // → encryption
  'deployment-troubleshooting',                            // → troubleshooting (as landing)
  'server/troubleshooting',                                // → troubleshooting
  'server/docker-troubleshooting',                         // → troubleshooting
  'server/trouble_mysql',                                  // → troubleshooting
  'server/trouble-postgres',                               // → troubleshooting
]);

// ---------------------------------------------------------------------------
// Administration Guide — Configure — manual grouping override.
// ---------------------------------------------------------------------------
//
// Configure is a flat 34-file settings-reference dump. This override groups
// it by task/subsystem so the ~12 "*-configuration-settings" reference pages
// don't drown the handful of task-oriented pages (Search, Calls, Storage,
// Email, Billing, Branding) sitting alongside them at the same level.
//
// AI Agents Configuration is deliberately kept as its own standalone,
// un-grouped top-level entry (not folded into a "misc/optional" bucket) —
// Agents is a first-class platform capability, not an afterthought.

const ADMIN_CONFIGURE_GROUPS = {
  settingsReference: {
    label: 'System Console Settings Reference',
    landing: 'configuration-settings',
    items: [
      'site-configuration-settings',
      'authentication-configuration-settings',
      'integrations-configuration-settings',
      'plugins-configuration-settings',
      'compliance-configuration-settings',
      'reporting-configuration-settings',
      'user-management-configuration-settings',
      'environment-configuration-settings',
      'rate-limiting-configuration-settings',
      'push-notification-server-configuration-settings',
      'experimental-configuration-settings',
      'deprecated-configuration-settings',
    ],
  },
  search: {
    label: 'Search Configuration',
    items: [
      'bleve-search',
      'enabling-chinese-japanese-korean-search',
    ],
  },
  calls: {
    label: 'Calls Deployment & Configuration',
    landing: 'calls-deployment-guide',
    items: [
      'calls-rtcd-setup',
      'calls-offloader-setup',
      'calls-kubernetes',
      'calls-logging',
      'calls-metrics-monitoring',
    ],
  },
  storage: {
    label: 'Storage & Database',
    items: [
      'configuration-in-your-database',
      'azure-blob-storage',
      'environment-variables',
    ],
  },
  email: {
    label: 'Email & Notifications',
    items: [
      'smtp-email',
      'email-templates',
    ],
  },
  billing: {
    label: 'Billing & Account',
    items: [
      'self-hosted-account-settings',
      'cloud-billing-account-settings',
    ],
  },
  branding: {
    label: 'Branding & Workspace Customization',
    items: [
      'custom-branding-tools',
      'customize-mattermost',
      'optimize-your-workspace',
    ],
  },
};

// Top-level Configure order. Strings are doc basenames relative to
// administration-guide/configure/; objects reference ADMIN_CONFIGURE_GROUPS
// keys. System Console Settings and Search come first (the settings most
// admins land on); AI Agents Configuration is 3rd, standalone.
const ADMIN_CONFIGURE_ORDER = [
  {group: 'settingsReference'},
  {group: 'search'},
  'agents-admin-guide',
  {group: 'calls'},
  {group: 'storage'},
  {group: 'email'},
  {group: 'billing'},
  {group: 'branding'},
  'install-boards',
  'manage-plugins',
  'manage-user-surveys',
  'system-attributes',
];

// Files re-parented into groups — exclude from the orphan check.
const ADMIN_CONFIGURE_HIDDEN = new Set([
  'site-configuration-settings', 'authentication-configuration-settings',
  'integrations-configuration-settings', 'plugins-configuration-settings',
  'compliance-configuration-settings', 'reporting-configuration-settings',
  'user-management-configuration-settings', 'environment-configuration-settings',
  'rate-limiting-configuration-settings', 'push-notification-server-configuration-settings',
  'experimental-configuration-settings', 'deprecated-configuration-settings',
  'bleve-search', 'enabling-chinese-japanese-korean-search',
  'calls-rtcd-setup', 'calls-offloader-setup', 'calls-kubernetes',
  'calls-logging', 'calls-metrics-monitoring',
  'configuration-in-your-database', 'azure-blob-storage', 'environment-variables',
  'smtp-email', 'email-templates',
  'self-hosted-account-settings', 'cloud-billing-account-settings',
  'custom-branding-tools', 'customize-mattermost', 'optimize-your-workspace',
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
    label: 'User & Access Management',
    items: [
      'admin/user-management',
      'admin/user-provisioning',
      'admin/user-attributes',
      'team-channel-members',
      {label: 'Attribute-Based Access Control', landing: 'admin/attribute-based-access-control', items: [
        'admin/abac-system-wide-policies',
        'admin/abac-team-channel-policies',
        'admin/abac-channel-access-rules',
      ]},
    ],
  },
  serverMaintenance: {
    label: 'Server Configuration & Maintenance',
    items: [
      'admin/server-configuration',
      'admin/server-maintenance',
      'code-signing-custom-builds',
      'command-line-tools',
      'mmctl-command-line-tool',
    ],
  },
  monitoring: {
    label: 'Monitoring & Diagnostics',
    items: [
      'admin/monitoring-and-performance',
      'statistics',
      'telemetry',
      'configure-health-check-probes',
      'request-server-health-check',
      'logging',
      'admin/error-codes',
      'admin/generating-support-packet',
    ],
  },
  billing: {
    label: 'Billing & Licensing',
    items: [
      'admin/self-hosted-billing',
      'cloud-byok',
      'admin/installing-license-key',
    ],
  },
  cloudWorkspace: {
    label: 'Cloud Workspace Management',
    items: [
      'cloud-data-export',
      'cloud-data-residency',
      'cloud-ip-filtering',
    ],
  },
  notifications: {
    label: 'Notifications & Surveys',
    items: [
      'in-product-notices',
      'system-wide-notifications',
      'user-satisfaction-surveys',
      'feature-labels',
    ],
  },
  governance: {
    label: 'Content & Product Governance',
    items: [
      'admin/content-flagging',
      'admin/autotranslation',
      'product-limits',
    ],
  },
  dataMigration: {
    label: 'Data Export & Migration',
    items: [
      'bulk-export-tool',
      'admin/migration',
    ],
  },
};

// Top-level Manage order. Strings are doc basenames relative to
// administration-guide/manage/ (admin/-prefixed ones live in the nested
// sub-folder); objects reference ADMIN_MANAGE_GROUPS keys.
const ADMIN_MANAGE_ORDER = [
  {group: 'userAccess'},
  {group: 'serverMaintenance'},
  {group: 'monitoring'},
  {group: 'billing'},
  {group: 'cloudWorkspace'},
  {group: 'notifications'},
  {group: 'governance'},
  {group: 'dataMigration'},
  'admin/customize-branding',
];

// Files re-parented into groups — exclude from the orphan check.
const ADMIN_MANAGE_HIDDEN = new Set([
  'admin/user-management', 'admin/user-provisioning', 'admin/user-attributes', 'team-channel-members',
  'admin/attribute-based-access-control', 'admin/abac-system-wide-policies',
  'admin/abac-team-channel-policies', 'admin/abac-channel-access-rules',
  'admin/server-configuration', 'admin/server-maintenance', 'code-signing-custom-builds',
  'command-line-tools', 'mmctl-command-line-tool',
  'admin/monitoring-and-performance', 'statistics', 'telemetry',
  'configure-health-check-probes', 'request-server-health-check', 'logging',
  'admin/error-codes', 'admin/generating-support-packet',
  'admin/self-hosted-billing', 'cloud-byok', 'admin/installing-license-key',
  'cloud-data-export', 'cloud-data-residency', 'cloud-ip-filtering',
  'in-product-notices', 'system-wide-notifications', 'user-satisfaction-surveys', 'feature-labels',
  'admin/content-flagging', 'admin/autotranslation', 'product-limits',
  'bulk-export-tool', 'admin/migration',
]);

// ---------------------------------------------------------------------------
// Integrations Guide — manual grouping override.
// ---------------------------------------------------------------------------
//
// Integrations Guide is a genuinely flat 20-item list (not just a migration
// artifact — Sphinx has the same problem). Group by integration type so
// related pages sit together instead of an alphabetical-ish flat dump.

const INTEGRATIONS_GROUPS = {
  chatInterop: {
    label: 'Chat & Meeting Interop',
    items: [
      'microsoft-teams-sync',
      'microsoft-teams-meetings',
      'microsoft-calendar',
      'mattermost-mission-collaboration-for-m365',
      'zoom',
    ],
  },
  itsmDevTools: {
    label: 'ITSM & Dev Tools',
    items: [
      'jira',
      'servicenow',
      'github',
      'gitlab',
    ],
  },
  noCode: {
    label: 'No-Code Automation',
    items: [
      'no-code-automation',
    ],
  },
  builtIn: {
    label: 'Built-in Integrations',
    items: [
      {label: 'Webhooks', landing: 'webhook-integrations', items: [
        'incoming-webhooks',
        'outgoing-webhooks',
      ]},
      {label: 'Slash Commands', landing: 'slash-commands', items: [
        'built-in-slash-commands',
        'run-slash-commands',
      ]},
      'restful-api',
      'plugins',
    ],
  },
};

// Top-level Integrations Guide order. Strings are doc basenames relative to
// integrations-guide/; objects reference INTEGRATIONS_GROUPS keys or are
// inline sub-groups (Webhooks, Slash Commands).
const INTEGRATIONS_ROOT_ORDER = [
  'popular-integrations',
  {group: 'chatInterop'},
  {group: 'itsmDevTools'},
  {group: 'noCode'},
  {group: 'builtIn'},
  'faq',
];

const INTEGRATIONS_HIDDEN = new Set([
  'microsoft-teams-sync', 'microsoft-teams-meetings', 'microsoft-calendar',
  'mattermost-mission-collaboration-for-m365', 'zoom',
  'jira', 'servicenow', 'github', 'gitlab',
  'no-code-automation',
  'webhook-integrations', 'incoming-webhooks', 'outgoing-webhooks',
  'slash-commands', 'built-in-slash-commands', 'run-slash-commands',
  'restful-api', 'plugins',
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

function isDraft(filePath) {
  return readFm(filePath, 'draft') === 'true';
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
  if (indexFile && !isDraft(join(absDir, indexFile))) {
    categoryLink = {type: 'doc', id: pathToDocId(join(docsRelDir, indexFile))};
  }

  const subDirs = [];
  const leafDocs = [];
  for (const name of entries) {
    if (name === indexFile) continue;
    const abs = join(absDir, name);
    const st = statSync(abs);
    if (st.isDirectory()) subDirs.push(name);
    else if (st.isFile() && /\.(md|mdx)$/.test(name) && !isDraft(abs)) leafDocs.push(name);
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
    (indexFile && readFm(join(absDir, indexFile), 'title')) ||
    humanize(basename(absDir));

  if (!categoryLink && items.length === 0) return null;

  return {type: 'category', label, collapsed: true, ...(categoryLink ? {link: categoryLink} : {}), items};
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
  // Drop hidden snippet-include partials from the label map up front.
  for (const hidden of OVERVIEW_HIDDEN) delete leafLabels[`product-overview/${hidden}`];

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

function buildAdminConfigureItem(spec, leafLabels) {
  if (typeof spec === 'string') {
    const id = `administration-guide/configure/${spec}`;
    return {type: 'doc', id, label: leafLabels[id] || humanize(spec)};
  }
  const g = ADMIN_CONFIGURE_GROUPS[spec.group];
  if (!g) throw new Error(`unknown admin configure group: ${spec.group}`);
  const items = g.items.map((it) => buildAdminConfigureItem(it, leafLabels));
  const cat = {type: 'category', label: g.label, collapsed: true, items};
  if (g.landing) cat.link = {type: 'doc', id: `administration-guide/configure/${g.landing}`};
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
  if (g.landing) cat.link = {type: 'doc', id: `administration-guide/manage/${g.landing}`};
  return cat;
}

// Replace the auto-generated "Manage" sub-category's items (in place,
// flattening the manage/admin/ filesystem nesting into the task-based
// groups above) with the manual grouping.
function regroupAdminManage(manageCat) {
  const leafLabels = collectLeafLabels(manageCat);
  const items = ADMIN_MANAGE_ORDER.map((spec) => buildAdminManageItem(spec, leafLabels));

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

function buildAdminGuideSidebar(autoCat) {
  let foundConfigure = false;
  let foundManage = false;
  for (const it of autoCat.items) {
    if (it.type !== 'category') continue;
    let dirName = null;
    if (it.link && it.link.id) {
      dirName = it.link.id.split('/')[1];
    }
    if (!dirName && it.items) {
      const firstDoc = it.items.find((c) => c.type === 'doc' && c.id);
      if (firstDoc) dirName = firstDoc.id.split('/')[1];
    }
    if (dirName === 'configure') {
      regroupAdminConfigure(it);
      foundConfigure = true;
    } else if (dirName === 'manage') {
      regroupAdminManage(it);
      foundManage = true;
    }
  }
  if (!foundConfigure) {
    console.warn('[sidebar] WARN: Administration Guide "Configure" sub-category not found — ADMIN_CONFIGURE_GROUPS override was not applied.');
  }
  if (!foundManage) {
    console.warn('[sidebar] WARN: Administration Guide "Manage" sub-category not found — ADMIN_MANAGE_GROUPS override was not applied.');
  }
  return autoCat;
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
    } else if (dir === 'integrations-guide') {
      cat = buildIntegrationsSidebar(cat);
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
