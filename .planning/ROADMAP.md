# E2E Testing Framework Refactoring - Roadmap

**Project:** Mattermost E2E Testing Framework
**Current Status:** Phase 2 Active
**Last Updated:** 2026-02-07

---

## Phase 1: Framework Refactoring ✅ COMPLETE

**Goal:** Extract LLM providers to framework-agnostic package with Mattermost-specific examples

**Outcomes:**
- ✅ `@mattermost/llm-testing-providers` package created in `packages/`
- ✅ Documentation examples updated (Mattermost-specific scenarios)
- ✅ Test scenarios expanded (Core Messaging, Channel Management)
- ✅ Imports migrated in playwright-lib
- ✅ Package has zero Playwright dependencies

**Commit:** `1fa0890dd9`

---

## Phase 2: Repository Extraction & Publishing 🚀 ACTIVE

**Goal:** Move LLM provider library to standalone repository and publish to npm

**Scope:**
- Extract `@mattermost/llm-testing-providers` to separate git repository
- Establish independent versioning and release cycle
- Publish to npm public registry
- Set up CI/CD for standalone package
- Document standalone usage and contribution guidelines

**Success Criteria:**
- [ ] New repository created (`mattermost/llm-testing-providers`)
- [ ] All code migrated with full git history
- [ ] Published to npm with proper version (0.1.0)
- [ ] README updated for standalone usage
- [ ] CI/CD pipeline working (build, test, publish)
- [ ] Original monorepo imports updated to use npm package
- [ ] Documentation links established

**Timeline:** Current phase
**Owner:** Claude

---

## Phase 3: Multi-Provider Support (Backlog)

**Goal:** Extend provider support with OpenAI and custom providers

**Scope:**
- Implement OpenAI provider
- Add custom provider templates
- Expand vision capabilities
- Performance optimizations

**Timeline:** After Phase 2 complete

---

## Phase 4: Advanced Features (Backlog)

**Goal:** Add production-grade features

**Scope:**
- Caching strategies for LLM responses
- Rate limiting and quota management
- Advanced error recovery
- Provider fallback chains
- Observability/tracing integration

**Timeline:** Future

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│         Mattermost E2E Testing                  │
│  ─────────────────────────────────────────────  │
│  ┌─────────────────────────────────────────┐   │
│  │   playwright-lib (in monorepo)          │   │
│  │   - Test fixtures & components          │   │
│  │   - Page objects & helpers              │   │
│  └──────────┬──────────────────────────────┘   │
│             │ (imports via npm package)        │
└─────────────┼────────────────────────────────┘
              │
        ┌─────▼─────────────────────────┐
        │ @mattermost/llm-testing-      │
        │ providers (separate repo)      │
        │ ─────────────────────────────  │
        │ ✓ Anthropic Claude            │
        │ ✓ Ollama (free/local)         │
        │ ✓ Factory & hybrid provider   │
        │ ✓ Cost tracking               │
        │ ✓ Zero Playwright deps        │
        └───────────────────────────────┘
```

---

## Phase Dependencies

```
Phase 1: Framework Refactoring
    ↓
Phase 2: Repository Extraction & Publishing
    ↓
Phase 3: Multi-Provider Support
    ↓
Phase 4: Advanced Features
```

---

## Key Decisions

- **Separation:** LLM provider library is framework-agnostic (no Playwright deps)
- **Versioning:** Separate semver for provider package from monorepo
- **Publishing:** Public npm registry for community use
- **Location:** Standalone repository for independent development
- **Examples:** Mattermost-specific in main repo, generic in provider repo docs

---

## Review & Adjust

Each phase is reviewed before proceeding to the next. Scope adjustments happen at phase gates.
