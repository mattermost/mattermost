# Test Discovery & Mapping System

Deterministic, non-destructive test→flow discovery for E2E testing.

## Overview

The system automatically discovers which test files cover which user flows **without requiring annotations**. It uses deterministic signals (file paths, test titles, imports, keywords) to match tests to flows with confidence scoring.

### Key Features

✅ **No annotations required** - No `@flow` or `@priority` comments needed
✅ **Non-destructive** - Never deletes existing mappings unless file is gone
✅ **Self-maintaining** - Scales automatically as tests are added
✅ **Accurate** - Confidence scoring prevents false mappings
✅ **Transparent** - All ambiguities and low-confidence mappings reported

## Architecture

### flows.json (Human-Curated)

```json
{
  "id": "messaging.send",
  "name": "Send Message",
  "priority": "P0",
  "keywords": ["message", "post", "send"],
  "paths": ["channels/src/components/post/**"],
  // tests array is auto-populated - don't edit manually
}
```

Keep these fields **human-curated**:
- `id`, `name` - Flow identifier and display name
- `priority` - P0/P1/P2 importance
- `keywords` - Search terms for matching
- `paths` - Webapp code paths this flow touches
- `audience`, `flags` - Feature flags and audience

The `tests` array is **auto-generated** from test discovery.

### test-mappings.json (Diagnostics)

Raw discovery results with confidence scores:

```json
{
  "messaging.send": [
    {
      "path": "specs/functional/ai-assisted/messaging.send/messaging.send.spec.ts",
      "confidence": 0.95,
      "signals": ["path_token_match", "flow_id_match"]
    }
  ]
}
```

### manifest-diagnostics.json (Analysis Report)

```json
{
  "totalTests": 74,
  "mappedTests": 3,
  "ambiguousMappings": [...],
  "lowConfidenceMappings": [...],
  "unmappedTests": [...]
}
```

## Usage

### Local Development

**Step 1: Discover test mappings**
```bash
npm run test:manifest:discover
```

Outputs:
- `.e2e-ai-agents/test-mappings.json` - Raw mappings with confidence
- `.e2e-ai-agents/manifest-diagnostics.json` - Analysis report

Review the diagnostics to see:
- Which tests map to which flows
- Ambiguous matches (multiple flow candidates)
- Low-confidence matches (user review recommended)
- Unmapped tests (coverage awareness)

**Step 2: Merge into flows.json**
```bash
npm run test:manifest:merge
```

Rules:
- Keeps existing valid test paths
- Adds new mappings with confidence ≥ 0.7
- Removes only missing-file paths
- Normalizes to `specs/...` format
- Dedupes and sorts

**Step 3: Validate**
```bash
npm run test:manifest:validate
```

Checks:
- All test paths exist
- No malformed paths
- P0 flows have coverage (unless allowlisted)
- Reports ambiguities and low-confidence mappings

**All-in-one sync**
```bash
npm run test:manifest:sync
```

Runs: discover → merge → validate

### CI/CD Integration

All E2E AI workflows automatically sync before running:

```yaml
- name: Sync test mappings
  run: npm run test:manifest:sync

- name: Run gap analysis
  run: npm run test:ai:gap
```

**Workflow sequence:**
1. `npm run test:manifest:discover` - Find tests
2. `npm run test:manifest:merge` - Update flows.json
3. `npm run test:manifest:validate:strict` - Fail on issues (CI only)
4. `npm run test:ai:gap` - Analyze coverage
5. `npm run test:ai:impact` - PR-specific impact
6. `npm run test:ai:generate` - Generate missing tests

## Signal Matching

The discovery system uses **deterministic signals** to match tests to flows:

### 1. Path Tokens (Strongest)
Extracts tokens from file path and matches against flow paths and keywords.

Example: `specs/functional/messaging.send/messaging.send.spec.ts`
- Tokens: `messaging`, `send`
- Matches flow `messaging.send` (path token match: +0.4)

### 2. Flow ID Match
Extracts tokens from flow.id and matches against test path.

Example: Flow `channels.switch` → matches `specs/.../channel_switching/...`
- Signals: `channels`, `switch` match
- Score: +0.35

### 3. Test Title Keywords
Extracts keywords from test descriptions (describe/test blocks).

Example: `describe("send message and display correctly")`
- Keywords: `send`, `message`
- Matches flow keywords (+0.15)

### 4. Import Path Overlap
Checks if test imports from same code paths as flow.

Example: Test imports from `channels/components/post/**`
- Matches flow.paths (+0.1)

### Confidence Scoring

```
Max confidence: 1.0

Example scoring for specs/messaging.send/messaging.send.spec.ts vs messaging.send:
- path_token_match: +0.4  (send, messaging in path)
- flow_id_match: +0.35    (matches messaging.send)
- title_keyword_match: +0.15 (test title has "send message")
───────────────────────────
Total confidence: 0.90 ✓ (above 0.7 threshold, will be merged)
```

## Handling Ambiguities

### Low-Confidence Mappings (< 0.8)

```
⚠️  Low-confidence mappings:
    specs/channels/settings/notifications.spec.ts → channels.settings (0.75)
```

These are still merged if ≥ 0.7, but worth reviewing. Consider adding to test path or updating flow keywords for better matching.

### Ambiguous Mappings (Multiple Candidates)

```
⚠️  Ambiguous mapping:
    specs/accessibility/channels/account_menu.spec.ts
      → channels.settings (0.9)
      → accessibility.core (0.9)
      → channels.list (0.75)
```

When multiple flows score equally high, the test is **not automatically mapped**. User must decide or improve flow definitions.

To resolve:
1. Review test content and decide which flow it covers
2. Update flow `keywords` to disambiguate
3. Re-run discovery after changes

### Unmapped Tests

```
📋  Unmapped tests (no flow matched):
    specs/client/upload_file.spec.ts
    specs/functional/plugins/demo_plugin_installation.spec.ts
```

Tests that don't match any flow with ≥ 0.5 confidence. Either:
1. Test covers uncatalogued flow (add to flows.json)
2. Test doesn't fit existing flows (intentional, log it)
3. Test discovery scoring needs improvement (adjust signals)

## Validation Rules

### CI Validation (`npm run test:manifest:validate:strict`)

**Fails on:**
- ❌ Missing test file (path in flows.json doesn't exist)
- ❌ Malformed path (doesn't start with `specs/`)
- ❌ P0 flow without coverage (unless in ACCEPTABLE_P0_GAPS)
- ❌ Ambiguous mappings in strict mode

**Warns on:**
- ⚠️ Low-confidence mappings (< 0.8)
- ⚠️ Unmapped tests (informational)

### Local Validation (`npm run test:manifest:validate`)

Same checks as above, but ambiguities only warn (don't fail).

### P0 Coverage Requirements

P0 flows **must** have test coverage unless explicitly allowlisted.

Current allowlist (in `validate-manifest.js`):
```javascript
const ACCEPTABLE_P0_GAPS = new Set([
  'channels.switch',
  'threads.popout',
]);
```

To add gaps:
```bash
# 1. Edit scripts/validate-manifest.js
# 2. Add to ACCEPTABLE_P0_GAPS set
# 3. Commit and push

# Then validation will allow these to be gapless
npm run test:manifest:validate
```

## Merging Behavior (Non-Destructive)

### Merge Algorithm

```
For each flow in flows.json:
  1. Get existing test paths from flows.json
  2. For each existing path:
     - If file exists → keep it
     - If file missing → remove it
  3. For each discovered mapping:
     - If confidence ≥ 0.7 AND not already present → add it
  4. Dedupe, sort, write back
```

### Examples

**Example 1: Adding new test**
```
Before merge:
  messaging.send.tests = []

Discovered:
  messaging.send → specs/functional/.../messaging.send.spec.ts (0.95)

After merge:
  messaging.send.tests = ["specs/functional/.../messaging.send.spec.ts"]
```

**Example 2: Keeping existing, adding new**
```
Before merge:
  channels.list.tests = ["specs/accessibility/channels/intro_channel.spec.ts"]

Discovered:
  channels.list → specs/visual/channels/intro_channel.spec.ts (0.88)

After merge:
  channels.list.tests = [
    "specs/accessibility/channels/intro_channel.spec.ts",  // existing, valid
    "specs/visual/channels/intro_channel.spec.ts"          // newly discovered
  ]
```

**Example 3: Removing missing file**
```
Before merge:
  messaging.realtime.tests = [
    "specs/functional/ai-assisted/messaging.realtime/realtime.spec.ts",  // MISSING
    "specs/functional/channels/websocket.spec.ts"                        // exists
  ]

After merge:
  messaging.realtime.tests = [
    "specs/functional/channels/websocket.spec.ts"  // kept (exists)
  ]
  // Missing file automatically removed
```

## Gap Analysis Accuracy

### Before (Outdated)

```
Gap Report:
- [P0] messaging.send (no tests)
- [P0] channels.switch (no tests)
- [P0] messaging.realtime (no tests)

Problem: Flows marked as gaps even though tests exist
```

### After (Auto-synced)

```
Gap Report:
- [P0] messaging.send (✅ has tests)
- [P0] channels.switch (⚠️ legitimate gap, no tests)
- [P0] messaging.realtime (⚠️ legitimate gap, no tests)

Benefit: Only real gaps reported
```

## Troubleshooting

### "Test file not in flows.json" warning

Your test doesn't match any flow with sufficient confidence.

**Solutions:**
1. Check test file path - should match flow keywords or paths
2. Update flow `keywords` to help matcher
3. Run discovery again: `npm run test:manifest:discover`
4. Check manifest-diagnostics.json for ambiguous/low-confidence matches

### "P0 flow has no test coverage" - CI fails

Flow is marked P0 but has no mapped tests.

**Solutions:**
1. Create tests for the flow
2. Or allowlist the gap: add to ACCEPTABLE_P0_GAPS in validate-manifest.js
3. Verify existing tests actually cover this flow (check keywords/paths)

### Ambiguous mapping - test maps to multiple flows

Test could match multiple flows equally well.

**Solutions:**
1. Review test and decide which flow it actually covers
2. Improve flow disambiguation:
   - Add more specific keywords to flows
   - Update path patterns to be more distinct
   - Add test titles that clearly indicate flow
3. Re-run discovery

## Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run test:manifest:discover` | Find test→flow mappings |
| `npm run test:manifest:merge` | Update flows.json (non-destructive) |
| `npm run test:manifest:validate` | Check (warnings only) |
| `npm run test:manifest:validate:strict` | Check (fail on issues, for CI) |
| `npm run test:manifest:sync` | discover + merge + validate (all-in-one) |
| `npm run test:ai:gap` | Analyze coverage gaps |
| `npm run test:ai:impact` | PR-specific impact analysis |
| `npm run test:ai:generate` | Generate tests for gaps |
| `npm run test:ai:heal` | Auto-fix failing tests |

## Files

| File | Purpose | Type |
|------|---------|------|
| `flows.json` | Flow catalog with test mappings | Runtime (curate metadata) |
| `test-mappings.json` | Raw discovery results | Diagnostics (auto-generated) |
| `manifest-diagnostics.json` | Analysis report | Diagnostics (auto-generated) |
| `scripts/discover-test-mappings.js` | Find tests | Tool (261 lines) |
| `scripts/merge-test-mappings.js` | Merge into flows.json | Tool (118 lines) |
| `scripts/validate-manifest.js` | Validate | Tool (181 lines) |

## Integration Examples

### GitHub Actions (All E2E Workflows)

```yaml
- name: Setup environment
  uses: ./.github/actions/setup-e2e-ai-agents
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}

# Auto-sync before any AI command
- name: Sync test mappings
  working-directory: e2e-tests/playwright
  run: npm run test:manifest:sync

# Now run AI commands with accurate flows.json
- name: Run gap analysis
  run: npm run test:ai:gap
```

### Local Development

```bash
# Start working on a feature
git checkout -b feature/messaging-enhancements

# After adding tests
npm run test:manifest:sync

# Check what got mapped
cat .e2e-ai-agents/manifest-diagnostics.json | jq .

# Generate tests for remaining gaps
npm run test:ai:generate

# Validate before committing
npm run test:manifest:validate
```

## Best Practices

1. **Keep flows.json metadata accurate** - Keywords and paths drive matching quality
2. **Review diagnostics after sync** - Check ambiguous/low-confidence matches
3. **Use `test:manifest:validate:strict` in CI** - Prevents stale mappings
4. **Run `test:manifest:sync` before gap/impact analysis** - Ensures accuracy
5. **Test descriptive names help** - Good test titles improve signal matching
6. **Consistent file structure helps** - Paths with flow-relevant tokens match better

## Next Steps

1. ✅ Current state: System running, auto-syncing in all workflows
2. Run `npm run test:manifest:discover` locally to see mappings
3. Review `manifest-diagnostics.json` for ambiguous/unmapped tests
4. Add tests for legitimate P0 gaps (messaging.realtime, messaging.persistence, etc.)
5. Re-run sync after adding tests to see automatic mapping
