# AI-Powered Development Process

Longshot operates under Mattermost's AI-Powered Development Process. Rather than duplicating it here, follow the canonical source:

- **[PE: AI-Powered Development Process](https://mattermost.atlassian.net/wiki/spaces/pde/pages/4364763143/AI-Powered+Development+Process)** — governing document for design artifacts, development practices, PR submission/review, and ticket verification

Longshot operationalizes these principles in [rules.md §8](rules.md#8-principle-applications) — which cites the specific principle that is load-bearing at each phase. The table below is an index back to the source; read the Confluence page for the full guidance.

| Section | Summary | Applies to |
|---------|---------|-----------|
| Design | PRFAQ, UX Spec, Technical Spec, Jira Epic for capabilities >~2 weeks | Phase 1 (Epic/PRD audit), Phase 2 (plan drafting) |
| Development | Feature flags by default; AGENTS.md for shared context; use AI extensively but not carelessly | Phase 3 (implement) |
| Submitting PRs | Self-review first; tests required; AI review before human; strong description; keep scoped and small; rebase before submitting | Phase 6 (self-review), Phase 7 (ship) |
| Reviewing PRs | One required human reviewer; submitter owns quality; merged = ready to ship; acknowledge within 2 business days; focus on high-impact feedback | Context for reviewers (external to longshot run) |
| Verifying Tickets | Drink own champagne on community/hub; engineers close their own tickets; every capability needs a lighthouse customer | Phase 8 (release) |

Related references:
- [Feature Flags Guidelines](https://mattermost.atlassian.net/wiki/spaces/pde/pages/4364795905/Feature+Flags+Guidelines)
- [Token Optimization Guide for AI Coding Tools](https://mattermost.atlassian.net/wiki/spaces/pde/pages/4367024153/Token+Optimization+Guide+for+AI+Coding+Tools)
- [Jira Epic Guidelines](https://mattermost.atlassian.net/wiki/spaces/pde/pages/2906488838/Jira+Epic+Guidelines)
- [Sensitive PRs Handbook](https://handbook.mattermost.com/operations/security/product-security/working-on-sensitive-prs) — cited by [rules.md §3](rules.md#3-security-handling)
