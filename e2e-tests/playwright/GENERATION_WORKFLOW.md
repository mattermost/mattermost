# AI-Assisted Test Generation Workflow

This document describes the complete 5-phase E2E test generation pipeline using the autonomous CLI.

## Overview

The workflow transforms vague feature descriptions into robust, maintainable test suites through intelligent UI exploration, LLM-assisted code generation, and data-driven healing.

```
Phase 1: UI Map Infrastructure
↓
Phase 2: Signal Gating
↓
Phase 3: Selector Enforcement
↓
Phase 4: Healing with Re-discovery
↓
Phase 5: Polish & Validation
```

## Phase 1: UI Map Infrastructure

**What**: Build indexed UI map from exploration
**When**: During test generation
**Output**: `ui-map.json` with selectors + confidence scores

```bash
npx tsx autonomous-cli.ts generate "user profile" --scenarios 3
```

The UI map captures:
- Every discoverable UI element (selector, role, text, testId)
- Confidence scoring (testId=100%, ariaLabel=85%, text=70%, class=50%)
- Semantic grouping (login_form, post_button, channel_link, etc.)
- Page-level semantics (hasLoginForm, hasPostForm, hasNavMenu)

**Confidence calculation**:
- **testId**: Most reliable (100%) - explicitly added by developers
- **ariaLabel**: Very reliable (85%) - accessibility standard
- **Text matching**: Moderate (70%) - prone to text changes
- **Class selectors**: Low (50%) - fragile to CSS changes

## Phase 2: Signal Gating

**What**: Gate generation based on UI map coverage
**When**: After UI map is built
**Behavior**:

| Coverage | Action | Guidance |
|----------|--------|----------|
| <25% | Exit 1 | "Provide FEATURE_SPEC.md or explore more pages" |
| 25-50% | Draft spec | Create FEATURE_SPEC.md.draft for review |
| 50-75% | Warn | Log warning, continue with caution |
| ≥75% | Proceed | Ready for robust test generation |

Example:
```
❌ Insufficient UI signal for test generation.
   Please explore more pages or provide better feature hints.
   Current coverage: 15% (need >25%)
```

## Phase 3: Selector Enforcement

**What**: Whitelist generated selectors against UI map
**When**: After LLM generates test code
**Behavior**: Comment out selectors not found in whitelist

```typescript
// Before validation:
await page.getByTestId('unknown-button').click();
await page.getByRole('button', {name: /submit/i}).click();

// After validation (if only second is whitelisted):
// UNOBSERVED SELECTOR - Not found in UI map. Use test.fixme() if needed.
// await page.getByTestId('unknown-button').click();
await page.getByRole('button', {name: /submit/i}).click();
```

The validator provides coverage metrics:
```
✓ Checked 12 selectors: 10/12 whitelisted (83%)
⚠️ 2 selectors commented out (unobserved)
   Unobserved: [data-testid="foo"], [aria-label="bar"]
```

## Phase 4: Healing with Re-discovery

**What**: Re-explore UI on test failure, merge discoveries
**When**: During test healing loop
**Process**:

1. Test fails
2. Re-explore UI (get current state)
3. Load existing UI map
4. Build new map from discoveries
5. Merge maps (boost confidence on repeated selectors)
6. Generate healing prompt with merged selectors
7. LLM fixes test using discovered selectors
8. Save merged map for next healing iteration

**Confidence boosting example**:
```
Initial map: [data-testid="submit"] confidence=100
After 1st healing re-discovery: confidence=100 (seen again)
After 2nd healing re-discovery: confidence=110 (capped at 100)
```

This creates **observable evidence** of selector stability across iterations.

## Phase 5: Polish & Validation

**What**: Final checks and documentation
**When**: After all phases complete
**Includes**:

- ✓ Selector coverage report
- ✓ Confidence distribution metrics
- ✓ Configuration validation
- ✓ Semantic richness analysis
- ✓ Generated test review guide

## Usage Examples

### Basic generation with UI exploration

```bash
npx tsx autonomous-cli.ts generate "user profile settings" \
  --scenarios 3 \
  --headless
```

**What happens**:
1. ✅ Phase 1: Explores UI, builds ui-map.json
2. ✅ Phase 2: Validates signal coverage
3. ✅ Phase 3: LLM generates tests, validates selectors
4. ✅ Phase 4: Infrastructure ready for healing
5. ✅ Phase 5: Generates reports

### Generation with feature spec

```bash
npx tsx autonomous-cli.ts generate \
  --spec docs/FEATURE_SPEC.md \
  --scenarios 5
```

**Benefits**:
- Spec provides feature context
- UI exploration validates spec completeness
- Better selector targeting from detailed spec

### Healing with re-discovery

```bash
npx tsx autonomous-cli.ts heal specs/functional/ai-assisted/user_profile/
```

**What happens**:
1. ✅ Phase 1: Re-explores UI for current state
2. ✅ Phase 2: Validates new signal
3. ✅ Phase 3: Not applicable (healing phase)
4. ✅ Phase 4: Merges discoveries, generates healing prompt
5. ✅ Phase 5: Generates healing report

## Configuration

Key settings in `autonomous-config.ts`:

```typescript
generation: {
  minConfidenceThreshold: 50,  // Min confidence for selectors
  requiredSemantics: 3,         // Min semantic types needed
  minCoveragePercent: 75,       // Min % for valid signal
}
```

## Signal Quality Indicators

### Strong Signal (>75%)
- ✅ Most elements have testId or ariaLabel
- ✅ Diverse semantic types (buttons, inputs, links, etc.)
- ✅ Consistent element naming patterns
- ✅ Ready for robust test generation

### Moderate Signal (50-75%)
- ⚠️ Mix of reliable and unreliable selectors
- ⚠️ Some elements missing testId
- ⚠️ May need fallback to API testing
- ⚠️ Tests will include test.fixme() for unobserved elements

### Weak Signal (25-50%)
- ❌ Few reliable selectors
- ❌ Heavy reliance on text matching
- ❌ Requires explicit feature specification
- ❌ Should draft FEATURE_SPEC.md before generation

### Insufficient Signal (<25%)
- ❌ Unable to generate robust tests
- ❌ Must provide feature spec or explore more
- ❌ Generation exits with error

## Troubleshooting

### "Insufficient UI signal" error

**Cause**: Coverage <25% - not enough UI elements discovered

**Solutions**:
1. Explore more pages: `--max-depth 3` (default 2)
2. Provide feature spec: `--spec FEATURE_SPEC.md`
3. Add feature hints: `"user profile settings AND preferences"`

### "Weak signal detected" warning

**Cause**: Coverage 25-50% - borderline UI discovery

**Solution**:
1. Review generated `FEATURE_SPEC.md.draft`
2. Fill in missing details about UI elements
3. Run generation again with updated spec

### Selectors commented out after generation

**Cause**: Selectors don't match the whitelist

**Solution**:
1. Check `ui-map.json` in docs/ folder
2. Run tests - healing will re-discover missing selectors
3. Selectors will be uncommented after successful healing

## Best Practices

### 1. Provide detailed feature specs

```markdown
## Feature: User Profile Settings

### UI Elements
- Save button (role: button, aria-label: "Save changes")
- Name input (data-testid: "profile-name-input")
- Avatar upload (aria-label: "Upload profile picture")

### Workflows
1. User navigates to profile
2. Edits name field
3. Uploads new avatar
4. Clicks save
5. Sees success message
```

Better feature specs → stronger signals → more robust tests.

### 2. Review ui-map.json

After generation, check `docs/ui-map.json` to understand:
- Which selectors are high confidence
- What page semantics were detected
- Coverage metrics

### 3. Monitor healing iterations

Each healing run merges discoveries:
- Confidence scores increase on repeated runs
- New selectors added from re-exploration
- Selector stability becomes evident

### 4. Use --verbose for debugging

```bash
npx tsx autonomous-cli.ts generate "feature" --verbose
```

Shows:
- Each discovery during exploration
- All validation decisions
- Why selectors were commented out

## Metrics and Reports

After generation, check the output:

```
✓ Built UI map with 45 selectors (78% avg confidence)
✓ Checked 12 selectors: 10/12 whitelisted (83%)
✓ Generated 3 test scenarios
✓ Generated: specs/functional/ai-assisted/feature/feature.spec.ts
✓ Generated: specs/functional/ai-assisted/feature/docs/ui-map.json
```

**Interpretation**:
- **UI map quality**: 78% avg confidence (good)
- **Selector coverage**: 83% whitelisted (strong)
- **Ready for tests**: Yes ✅

## Future Enhancements

- [ ] API fallback for unobserved elements
- [ ] Selector drift detection
- [ ] Cross-test selector reuse
- [ ] Confidence-based test ordering (high confidence first)
- [ ] Selector change notifications (selector changed/removed)
