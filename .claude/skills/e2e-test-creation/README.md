# E2E Test Creation Skill

## Overview

The E2E Test Creation skill provides automated generation of Playwright end-to-end tests for Mattermost frontend changes. This skill integrates comprehensive guidelines, patterns, and examples to create robust, maintainable tests following Mattermost conventions.

## Directory Structure

```
.claude/skills/e2e-test-creation/
├── SKILL.md                      # Main skill definition with YAML frontmatter
├── guidelines.md                 # Complete test creation guidelines
├── examples.md                   # Real-world test examples
├── mattermost-patterns.md        # Mattermost-specific patterns
├── README.md                     # This file
└── agents/
    ├── planner.md                # Test planning guidance
    ├── generator.md              # Test generation patterns
    └── healer.md                 # Test healing strategies
```

## Skill Configuration

**Name:** `e2e-test-creation`

**Type:** Project skill (managed)

**Description:** Automatically generates E2E Playwright tests for Mattermost frontend changes with comprehensive guidelines, patterns, and examples.

**Activation Triggers:**
- Modifications to files in `webapp/` directory
- Creation or updates to React components
- Addition of new user-facing features

## Activation

### Automatic Activation
The skill activates automatically when:
- Files in the `webapp/` directory are modified
- React components are created or updated
- New user-facing features are added

### Manual Activation
Invoke the skill explicitly using the Skill tool:
```typescript
Skill({skill: "e2e-test-creation"})
```

Or reference it in conversation:
```
"Create E2E tests for the channel sidebar feature"
```

## Features

### Three-Phase Workflow

1. **Planning Phase**: Analyzes features and creates focused test plans (1-3 core scenarios)
2. **Generation Phase**: Transforms plans into executable Playwright tests
3. **Healing Phase**: Automatically fixes flaky or broken tests

### Test Quality Standards

- Utilizes Mattermost's custom `pw` fixture
- Implements page object patterns
- Uses semantic selectors (data-testid, ARIA roles)
- Handles async operations properly
- Ensures test isolation and cleanup
- Follows Mattermost documentation requirements (JSDoc, comment prefixes)

### Documentation Coverage

The skill includes comprehensive documentation covering:
- Test creation guidelines and best practices
- Mattermost-specific E2E patterns
- Real-world test examples
- Selector strategies and wait patterns
- Multi-user and real-time testing
- Visual regression testing
- Test healing strategies

## Integration

This skill integrates with the project's root `CLAUDE.md` file, which contains:
- Automatic test generation workflow
- When to create E2E tests
- Quality standards and requirements
- CI/CD integration details

## Test Generation Defaults

**Default Mode (Cost-Efficient):**
- Generates 1-3 tests maximum
- Focuses on core business logic only
- Tests happy path + critical error scenarios

**Comprehensive Mode (Explicit Request Only):**
- Generates 5+ tests with full coverage
- Includes edge cases and multi-user scenarios
- Activated only when explicitly requested by user

## Documentation Files

| File | Purpose | Size |
|------|---------|------|
| `SKILL.md` | Main skill definition | Primary |
| `guidelines.md` | Complete test creation guidelines | ~25KB |
| `examples.md` | Real-world test examples | ~25KB |
| `mattermost-patterns.md` | Mattermost-specific patterns | ~19KB |
| `agents/planner.md` | Test planning guidance | Agent |
| `agents/generator.md` | Test generation patterns | Agent |
| `agents/healer.md` | Test healing strategies | Agent |

## Usage Example

When modifying `webapp/components/post/reactions/`, the skill:

1. **Plans**: Creates test plan for core reaction functionality (2 tests)
   - Happy path: Adding a reaction
   - Critical error: API failure handling

2. **Generates**: Creates tests in `e2e-tests/playwright/specs/functional/messaging/post_reactions.spec.ts`

3. **Runs**: Executes tests with `npx playwright test`

4. **Heals**: Fixes any failures automatically
