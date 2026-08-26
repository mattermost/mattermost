# Mattermost docs conventions

These are the house rules for content under `docs/`. They do not vary by audience.
Every AI authoring and review call in `.github/scripts/docs-ai/` receives this file.

## Version anchoring

Readers need to know whether a page applies to their deployment.

When a page documents new or changed capability, it must state the release it applies
to, in this form:

> From Mattermost v11.5, auto-translation automatically translates channel messages…

Rules:

- The version comes from the PR or issue milestone. Never infer one from a branch name,
  a date, or prior knowledge. A wrong version reference is worse than a missing one,
  because a reader believes it.
- When no milestone is available, write `[NOT PRESENT — REQUIRES HUMAN JUDGMENT]` in
  place of the version rather than guessing.
- Deprecations follow the same rule and additionally never delete content: mark it
  deprecated from a specific release forward.
- Pure copy edits, restructures, and typo fixes do not need a version anchor.

## Frontmatter

`title` is the only key required on every page. Do not add `description`,
`sidebar_label`, `sidebar_position` or `slug` unless the page genuinely needs them —
fewer than 5% of existing pages set them, and adding them by default creates diff noise.

```mdx
---
title: "Set up auto-translation"
---
```

## Plan availability

Pages gated to a plan open with `<PlanAvailability>` directly under the frontmatter.
Valid slugs, and nothing else:

| slug | Meaning |
| --- | --- |
| `all-commercial` | Entry, Professional, Enterprise, Enterprise Advanced |
| `entry-ent` | Entry, Enterprise, Enterprise Advanced (not Professional) |
| `entry-adv` | Entry and Enterprise Advanced |
| `pro-plus` | Professional and above |
| `ent-plus` | Enterprise and Enterprise Advanced |
| `ent-adv` | Enterprise Advanced only |
| `ent-cloud-dedicated` | Cloud Dedicated |

```mdx
<PlanAvailability slug="ent-adv" />
```

`<PlanBadge plan="enterprise" />` exists for inline use inside tables and lists. It is
not the page-level convention — do not use it in place of `<PlanAvailability>`.

## Callouts

Five components, globally available, each taking an optional `title`. Leave a blank line
after the opening tag so the body is parsed as Markdown.

```mdx
<Note>

Body text with **Markdown** and [links](/administration-guide/configure/configuration-settings).

</Note>
```

Pick by consequence, not by emphasis:

| Component | Use for |
| --- | --- |
| `<Note>` | Clarifications, exceptions, non-blocking caveats |
| `<Tip>` | Shortcuts, optional best practice, advice that speeds the reader up |
| `<Important>` | Prerequisites and constraints that materially affect success, supportability or compliance |
| `<Warning>` | Real risk: broken behaviour, data loss, security exposure, likely mistakes with bad consequences |
| `<Security>` | Security-specific guidance and hardening requirements |

A `<Warning>` used for a minor tip, or a `<Note>` used for a security-sensitive
constraint, is a defect even though the syntax is valid.

## Links

Internal links use absolute site paths, with no `.mdx` extension:

```mdx
[mmctl command line tool](/administration-guide/manage/mmctl-command-line-tool)
[File storage](/administration-guide/configure/environment-configuration-settings#file-storage)
```

- Never hardcode `https://docs.mattermost.com/...` for a page in this repo.
- Never use relative `.mdx` paths — the site resolves absolute routes.
- External links are ordinary Markdown links.

## Other globally available components

No import needed: `<Eyebrow>`, `<Hero>`, `<StatStrip>`, `<CardGrid>`, `<CompassIcon>`,
`<MethodLegend>`, `<Tabs>` / `<TabItem>`, `<EditionAvailability>`,
`<DeploymentAvailability>`, `<DeploymentOnly>`, `<AttestationStatus>`,
`<UpgradeNotesFilter>`, `<DeploymentArchitectureBuilder>`, `<IMEDiagram>`,
`<PluginGoDocs>`, `<PluginGoExample>`, `<PluginJsDocs>`, `<PluginManifestDocs>`.

Anything else must be imported explicitly in the page.

## MDX syntax

- Escape `>` and `<` in prose and bold text: `**Settings \> Display \> Language**`.
  Unescaped, MDX reads them as JSX and the build fails.
- Fenced code blocks must declare a language.
- Keep heading levels sequential. The `title` frontmatter renders the H1, so page body
  headings start at `##`.

## Generated content — never hand-edit

- `docs/api/reference/**` is generated from the OpenAPI spec by `npm run build:openapi`.
- Sidebars are generated from the filesystem by `npm run build:sidebars`.
- `docs/vendor/**` is synced from other repositories.

## Terminology

Prefer the right-hand form:

- `TLS`, not SSL
- `PostgreSQL`, not postgres · `MySQL` · `LDAP` · `SAML` · `OAuth` · `API` / `APIs`
- `GitHub` · `GitLab` · `Kubernetes` · `JSON` · `YAML` · `URL` / `URLs` · `SSH`
- `email`, not e-mail
- `log in` / `sign in` as verbs; `login` as a noun only
- Product and feature names are proper-cased when naming the product: Mattermost,
  Mattermost Server, Mattermost Cloud, Channels, Playbooks, Boards, Copilot, Calls.
  The common nouns are not: "public channels", "recent calls", "three boards".

## Heading case

Sentence case: capitalise the first word and proper nouns only.

```
Configure the retention policy        not  Configure the Retention Policy
Enable OpenID Connect with Google     proper nouns keep their casing
mmctl token                           command names and code identifiers keep theirs
```

Existing pages are inconsistent on this. Sentence case is the standard; match it in new
and edited content rather than matching a neighbouring page that gets it wrong.

## Voice

Mattermost documentation is written for operators: defense, intelligence, security and
critical infrastructure. Serious, direct, instructional. Command-style verbs. No
marketing language, no filler, no speculation.

Avoid: "easy peasy", "super easy", "no worries", "fun", "awesome", "cool", "magical".

Keep sentences short enough to follow on one read. Beyond about 35 words, split.
