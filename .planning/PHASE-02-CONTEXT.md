# Phase 2: Repository Extraction & Publishing - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the `@mattermost/llm-testing-providers` package from the monorepo to a standalone GitHub repository with:
1. Independent git history (cherry-picked from monorepo)
2. Published to npm under `@mattermost` scope
3. Standalone CI/CD pipeline (GitHub Actions)
4. Full migration strategy (remove from monorepo packages/, import from npm)
5. Documentation for standalone usage and contribution

Monorepo continues using provider library as npm dependency.

</domain>

<decisions>
## Implementation Decisions

### Repository Configuration
- **Repository name:** `mattermost-llm-testing-providers`
- **GitHub location:** `github.com/mattermost/mattermost-llm-testing-providers`
- **Scope on npm:** `@mattermost/llm-testing-providers`
- **Initial version:** `0.1.0` (experimental/early release)

### Migration Strategy
- **Approach:** Full migration (not dual maintenance)
- **Timeline:** Create standalone repo → Migrate code → Test imports → Remove from monorepo
- **Monorepo updates:** Remove `packages/llm-testing-providers/`, update to npm dependency
- **Backward compatibility:** Monorepo continues working with npm import

### CI/CD Setup
- **Platform:** GitHub Actions (native GitHub integration)
- **Workflows needed:**
  - Build & test on push
  - Publish to npm on release tag
  - Automated versioning (semver)
  - Security scanning (dependencies, SAST)

### Publishing
- **npm account:** `@mattermost` organization
- **Access:** Mattermost team account (request from org maintainer if needed)
- **Registry:** npm public
- **License:** Apache 2.0 (consistent with monorepo)

### Repository Structure

```
mattermost-llm-testing-providers/
├── src/
│   ├── provider_interface.ts
│   ├── anthropic_provider.ts
│   ├── ollama_provider.ts
│   ├── provider_factory.ts
│   └── index.ts
├── .github/workflows/
│   ├── test.yml
│   └── publish.yml
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE (Apache 2.0)
├── CONTRIBUTING.md
├── .gitignore
├── .npmignore
└── CHANGELOG.md
```

### Git History Strategy
- **Preferred:** Cherry-pick Phase 1 commit to new repo (clean history)
- **Alternative:** Full monorepo history with filter-branch (if needed for reference)
- **Initial commits:** Phase 1 work + setup commits (workflows, docs)

### Breaking Changes
- None initially (0.1.0 is experimental)
- Monorepo continues to work (imports npm package instead of local)
- No API changes needed in playwright-lib

### Documentation
- **Main README:** Standalone usage instructions (not Mattermost-specific)
- **CONTRIBUTING.md:** Development setup, testing, PR process
- **CHANGELOG.md:** Track versions and changes
- **Examples:** Provider usage examples (generic + Mattermost reference)

### Release & Versioning
- **Semver:** Major.Minor.Patch (independent from Mattermost releases)
- **Tags:** v0.1.0, v0.2.0, etc. (git tags for npm releases)
- **Changelog:** Maintain CHANGELOG.md for each release
- **Frequency:** Release as needed (not tied to Mattermost cycles)

### Claude's Discretion
- GitHub Actions workflow implementation details
- npm package metadata optimization
- README structure and examples (while keeping Mattermost reference)
- Security scanning configuration
- Test setup for standalone repo

</decisions>

<specifics>
## Specific Ideas

- The standalone repo should be easy for external developers to use (not just Mattermost)
- Keep Mattermost examples in separate file (e.g., `MATTERMOST_EXAMPLES.md`)
- Make it clear this is used in production by Mattermost E2E tests
- Setup publishing workflow to automatically push to npm on git tag (v0.x.x)
- Include "Getting Started" that covers both Ollama and Anthropic setups

</specifics>

<deferred>
## Deferred Ideas

- Publishing to other registries (jsr.io, etc.) — future phase
- Monorepo integration via npm workspace — future improvement
- Package bundling optimization — Phase 4
- Automated dependency updates (Dependabot) — Phase 3

</deferred>

---

*Phase: 02-repository-extraction-publishing*
*Context gathered: 2026-02-07*
