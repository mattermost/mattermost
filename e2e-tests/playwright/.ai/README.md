# Mattermost E2E Test Automation with Claude

This directory contains the configuration for automatic E2E test generation using Claude Skills and Playwright agents.

## Overview

This system enables **automatic E2E test generation** for Mattermost. When you modify frontend code, Claude will:
1. Detect the changes
2. Create comprehensive test plans
3. Generate executable Playwright tests
4. Automatically heal flaky or broken tests

## Directory Structure

```
.ai/
├── agents/
│   ├── playwright-planner.md      # Plans comprehensive test scenarios
│   ├── playwright-generator.md    # Generates executable test code
│   └── playwright-healer.md       # Fixes flaky and broken tests
├── skills/
│   └── e2e-test-creation/
│       ├── skills.json            # Skill configuration
│       ├── guidelines.md          # Comprehensive test creation guidelines
│       ├── example.md             # Real-world test examples
│       └── mattermost-patterns.md # Mattermost-specific patterns
└── README.md                      # This file
```

## The Three Playwright Agents

### 1. Planner Agent (`@playwright-planner`)
**Purpose**: Explores the application and creates detailed test plans

**When to use**:
- After making webapp changes
- When adding new features
- When updating existing features

**What it does**:
- Analyzes user-facing functionality
- Identifies user interactions and edge cases
- Maps out test scenarios with expected results
- Creates markdown test plans

**Example**:
```
@playwright-planner "Create test plan for channel creation feature"
```

**Output**: Comprehensive test plan with scenarios, prerequisites, and potential flakiness areas

### 2. Generator Agent (`@playwright-generator`)
**Purpose**: Transforms test plans into executable Playwright tests

**When to use**:
- After Planner creates a test plan
- When you have a manual test plan

**What it does**:
- Converts plans to TypeScript test code
- Uses Mattermost-specific patterns (pw fixture, page objects)
- Includes proper setup, assertions, and cleanup
- Adds appropriate tags and comments

**Example**:
```
@playwright-generator "Generate tests from the channel creation test plan"
```

**Output**: Complete `.spec.ts` files ready to run

### 3. Healer Agent (`@playwright-healer`)
**Purpose**: Automatically fixes flaky or broken tests

**When to use**:
- When tests fail intermittently
- When selector changes break tests
- When timing issues occur
- After application updates

**What it does**:
- Analyzes test failures
- Diagnoses root causes (selectors, timing, state, assertions)
- Applies targeted fixes
- Improves test robustness

**Example**:
```
@playwright-healer "Fix the failing message posting test"
```

**Output**: Healed test with explanation of changes and prevention recommendations

## The E2E Test Creation Skill

### What is it?
A Claude Skill that provides just-in-time context about Mattermost's E2E testing conventions and patterns.

### When is it loaded?
Claude automatically loads this skill when:
- Webapp files are modified
- You explicitly invoke test-related agents
- Test generation or healing is needed

### What does it contain?

#### 1. guidelines.md
Comprehensive guide covering:
- When to create E2E tests (and when not to)
- Test organization and file structure
- The three-agent workflow
- Mattermost E2E framework (pw fixture)
- Best practices for selectors, waiting, assertions
- Common patterns (real-time, modals, error handling)

#### 2. example.md
Real-world examples showing:
- Complete workflow from planning to implementation
- Channel creation tests
- Message posting with real-time updates
- User search in System Console
- Visual regression tests
- Test healing scenarios

#### 3. mattermost-patterns.md
Mattermost-specific patterns:
- The pw fixture and its methods
- Common test setup patterns
- Page objects and navigation
- API test data management
- Real-time and WebSocket patterns
- Authentication patterns
- System Console testing
- Visual testing patterns

## How It Works

### Automatic Workflow

```mermaid
graph TD
    A[Developer modifies webapp code] --> B[Claude detects changes]
    B --> C[Claude loads e2e-test-creation skill]
    C --> D[@playwright-planner creates test plan]
    D --> E[@playwright-generator creates tests]
    E --> F[Run tests: npx playwright test]
    F --> G{Tests pass?}
    G -->|Yes| H[Done ✓]
    G -->|No| I[@playwright-healer fixes tests]
    I --> F
```

### Example Scenario

1. **Developer** adds a new "Post Reactions" feature to `webapp/components/post/reactions/`

2. **Claude detects** the webapp change

3. **@playwright-planner** is invoked:
   ```
   Creates test plan covering:
   - Adding reactions to posts
   - Removing reactions
   - Multiple users reacting in real-time
   - Reaction counts updating
   - Edge cases and error handling
   ```

4. **@playwright-generator** is invoked:
   ```typescript
   Generates e2e-tests/playwright/specs/functional/messaging/post_reactions.spec.ts
   with:
   - Proper imports and setup
   - Test scenarios from plan
   - Mattermost patterns (pw fixture, API cleanup)
   - Descriptive comments
   - Appropriate tags
   ```

5. **Tests are run**:
   ```bash
   npx playwright test post_reactions
   ```

6. **If tests fail**, **@playwright-healer** is invoked:
   ```
   Analyzes failure:
   - Selector not found? Replace with data-testid
   - Timing issue? Add proper wait
   - Assertion fails? Use flexible matcher

   Applies fix and explains changes
   ```

## Key Features

### 1. Automatic Test Generation
- No manual test writing required
- Tests generated when you code
- Follows Mattermost conventions automatically

### 2. Comprehensive Test Plans
- Planner agent explores all user scenarios
- Identifies edge cases and error conditions
- Considers real-time and WebSocket behavior
- Flags potential flakiness areas

### 3. Self-Healing Tests
- Healer agent fixes broken tests automatically
- Diagnoses root causes (selectors, timing, assertions)
- Makes tests more robust, not just passing
- Provides explanations and preventive recommendations

### 4. Mattermost-Specific
- Uses `pw` fixture and Mattermost patterns
- Follows existing code conventions
- Integrates with page objects
- Handles real-time updates properly

## Using the Agents

### Manual Invocation

You can manually invoke agents when needed:

```bash
# Plan tests for a feature
@playwright-planner "Create test plan for user profile editing"

# Generate tests from a plan
@playwright-generator "Generate tests for user profile editing"

# Heal a failing test
@playwright-healer "Fix the failing test in user_profile.spec.ts"
```

### Automatic Invocation

Claude will automatically invoke agents when:
- You modify webapp files
- Tests are generated and need to run
- Tests fail and need healing

## Configuration

### skills.json
Defines the skill:
- **name**: `e2e-test-creation`
- **description**: Automatically generates E2E tests for Mattermost
- **trigger_patterns**: Patterns that auto-load the skill
  - "webapp changes"
  - "frontend component"
  - "UI modification"
  - "new feature"
  - "React component"
- **files**: Documentation files loaded with the skill

### Root CLAUDE.md
The repository root contains `CLAUDE.md` with instructions that tell Claude:
- When to generate E2E tests
- How to use the three-agent workflow
- Test quality standards
- Best practices
- Automatic test review process

## Benefits

### For Developers
- ✅ No manual E2E test writing
- ✅ Tests generated as you code
- ✅ Automatic test healing
- ✅ Better test coverage
- ✅ Consistent test patterns

### For QA
- ✅ Comprehensive test plans
- ✅ Reduced flakiness
- ✅ Self-documenting test scenarios
- ✅ Consistent test structure

### For the Team
- ✅ Faster PR cycles
- ✅ Higher confidence in changes
- ✅ Reduced regression bugs
- ✅ Better documentation through tests
- ✅ Lower maintenance burden

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run Specific Feature Tests
```bash
npx playwright test channels/
npx playwright test messaging/
```

### Run with Specific Tags
```bash
npx playwright test --grep @smoke
npx playwright test --grep @channels
```

### Run in UI Mode (Debugging)
```bash
npx playwright test --ui
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test --headed
```

### Run Specific Test File
```bash
npx playwright test specs/functional/channels/channel_creation.spec.ts
```

## Best Practices

### 1. Let Claude Generate Tests
Don't manually write E2E tests - let Claude's agents do it:
- More comprehensive scenarios
- Follows patterns consistently
- Less human error
- Self-documenting

### 2. Review Generated Tests
Claude will present tests before running:
- Verify test scenarios make sense
- Check that edge cases are covered
- Ensure proper cleanup is included

### 3. Run Tests Locally
Before pushing:
```bash
# Run tests for affected areas
npx playwright test <feature-area>/
```

### 4. Let Healer Fix Failures
If tests fail:
- Don't manually fix immediately
- Let @playwright-healer diagnose
- Review healer's explanation
- Learn from the fix

### 5. Keep Tests Isolated
- Each test should be independent
- Use proper setup/cleanup
- Don't rely on test execution order
- Use dynamic test data

## Troubleshooting

### Tests Not Being Generated?
1. Check if webapp files were modified
2. Verify CLAUDE.md exists at repo root
3. Manually invoke @playwright-planner

### Tests Failing Consistently?
1. Invoke @playwright-healer
2. Review healer's diagnosis
3. Check if selectors need data-testid attributes
4. Verify proper waits are in place

### Tests Are Flaky?
1. Use @playwright-healer
2. Common fixes:
   - Replace CSS selectors with data-testid
   - Add proper waits (not arbitrary timeouts)
   - Use longer timeouts for WebSocket updates
   - Improve assertions to be more flexible

### Need More Examples?
- Read `.ai/skills/e2e-test-creation/example.md`
- Check existing tests in `specs/functional/`
- Review `.ai/skills/e2e-test-creation/mattermost-patterns.md`

## Resources

### Documentation Files
- **guidelines.md**: Comprehensive test creation guide (692 lines)
- **example.md**: Real-world examples (760 lines)
- **mattermost-patterns.md**: Mattermost-specific patterns (700 lines)

### Agent Definitions
- **playwright-planner.md**: Test planning agent (200+ lines)
- **playwright-generator.md**: Test generation agent (400+ lines)
- **playwright-healer.md**: Test healing agent (400+ lines)

### Key Concepts
- **pw fixture**: Mattermost's custom Playwright extension
- **Page objects**: Built-in page objects (loginPage, systemConsolePage)
- **Test tags**: Organize tests (@functional, @visual, @smoke)
- **Real-time testing**: Multi-user WebSocket patterns
- **Visual regression**: Snapshot testing patterns

## Contributing

### Adding New Patterns
If you discover new Mattermost testing patterns:
1. Document them in `mattermost-patterns.md`
2. Add examples to `example.md`
3. Update guidelines if needed

### Improving Agents
Agent definitions can be enhanced:
1. Edit agent markdown files in `.ai/agents/`
2. Add new capabilities or patterns
3. Update examples

### Expanding Skills
The skill can grow:
1. Add new documentation files
2. Update `skills.json` to include them
3. Keep documentation focused and practical

## Summary

This E2E test automation system:
- **Automates** test creation completely
- **Plans** comprehensive test scenarios
- **Generates** executable Playwright tests
- **Heals** flaky and broken tests
- **Follows** Mattermost patterns automatically
- **Improves** test quality and coverage
- **Reduces** developer burden

Result: **Developers contribute high-quality E2E tests automatically, without even realizing it!**

---

For questions or issues, refer to:
- This README
- Skill documentation in `.ai/skills/e2e-test-creation/`
- Agent definitions in `.ai/agents/`
- Root `CLAUDE.md` for high-level workflow
