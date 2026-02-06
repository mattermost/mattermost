# Phase 1: E2E Testing Framework Refactoring - Context

**Gathered:** 2026-02-07
**Status:** Ready for implementation

<domain>
## Phase Boundary

Extract and restructure the E2E testing framework to:
1. Update documentation examples to use Mattermost-specific scenarios (not generic "add to cart")
2. Create an npm package for LLM providers (`@mattermost/llm-testing-providers`) as a reusable, framework-agnostic library
3. Expand test scenarios documentation with auto-translation MVP and critical E2E workflows
4. Maintain backward compatibility with existing Playwright tests

</domain>

<decisions>
## Implementation Decisions

### Documentation Examples
- Update `e2e-tests/playwright/.claude/agents/playwright-test-generator.md` with Mattermost-specific scenarios
- Update `e2e-tests/playwright/.claude/prompts/playwright-test-plan.md` with Mattermost-specific examples (e.g., "Post message to channel" instead of "Add item to cart")
- Cover various Mattermost user journeys: channels, DMs, threads, message reactions, auto-translation, channel settings, permissions

### LLM Provider Extraction
- **Package name:** `@mattermost/llm-testing-providers`
- **Location:** `packages/llm-testing-providers/` in monorepo
- **Scope:** Provider interface + Anthropic provider implementation (extensible for future providers like OpenAI)
- **Dependencies:** Zero Playwright dependencies — pure LLM library, completely framework-agnostic
- **Extraction method:** Move (clean extraction), not copy — update playwright-lib to import from the new package

### Test Scenarios Documentation
- Keep `e2e-tests/playwright/.claude/scenarios.md` focused on auto-translation MVP as primary feature
- Add 2-3 critical E2E scenarios for other Mattermost features (e.g., channel creation, posting messages, thread replies)
- Format: Base scenarios with acceptance criteria, framework conventions, and instructions for test planning

### Package Structure
```
packages/llm-testing-providers/
├── src/
│   ├── provider_interface.ts      (LLMProvider interface, types, base classes)
│   ├── providers/
│   │   ├── anthropic_provider.ts  (moved from playwright-lib)
│   │   └── openai_provider.ts     (optional future implementation)
│   └── index.ts                   (exports)
├── package.json
├── tsconfig.json
├── README.md
└── tests/
```

### Backward Compatibility
- `e2e-tests/playwright/lib/src/autonomous/llm/anthropic_provider.ts` will be removed
- `e2e-tests/playwright/lib/src/autonomous/llm/` imports will be updated to use `@mattermost/llm-testing-providers`
- No breaking changes to existing test code

### Claude's Discretion
- Exact package.json dependencies and publishing strategy
- TypeScript configuration details
- Additional test providers beyond Anthropic (if added)
- Specific Mattermost scenarios to include (user provides high-level categories, Claude expands)

</decisions>

<specifics>
## Specific Ideas

- The LLM provider library should be truly framework-agnostic — usable in CLI tools, mobile test frameworks, or any other testing infrastructure
- Document should reference the existing auto-translation test scenarios.md heavily (it's well-structured)
- Maintain the cost tracking and usage stats that were in the original Anthropic provider — they're valuable
- Examples in docs should show realistic Mattermost workflows (permissions checks, team creation, channel discovery)

</specifics>

<deferred>
## Deferred Ideas

- Phase 2: Separate repo extraction — Move `@mattermost/llm-testing-providers` to its own repository with independent release cycle (future phase)
- Multi-provider support (OpenAI, Gemini, local LLMs) — Roadmap items after Phase 1
- Publishing to npm public registry — Requires license/publishing decisions (Phase 2)

</deferred>

---

*Phase: 01-e2e-testing-refactoring*
*Context gathered: 2026-02-07*
