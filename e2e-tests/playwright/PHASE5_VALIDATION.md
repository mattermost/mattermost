# Phase 5: Polish & Validation Checklist

This document provides validation criteria for the complete 5-phase test generation workflow.

## Pre-Generation Checklist

- [ ] Mattermost server running at configured URL
- [ ] `MM_USERNAME` and `MM_PASSWORD` set (or use defaults)
- [ ] `ANTHROPIC_API_KEY` configured
- [ ] Feature description or spec file prepared
- [ ] Browser Chrome installed (default)

## Generation Phase Validation

### Phase 1: UI Map Infrastructure

**Expected outputs**:
- [ ] Console shows "Built UI map with X selectors"
- [ ] Average confidence logged (target: >65%)
- [ ] File: `docs/ui-map.json` created with:
  - [ ] `pages` object with discovered pages
  - [ ] `globalSelectors` with semantic grouping
  - [ ] `stats` with totalPages, totalSelectors, avgConfidence
  - [ ] Timestamp recorded

**Validation commands**:
```bash
# Check UI map was created
ls -la specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json

# Inspect selector count and confidence
jq '.stats' specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json
jq '.globalSelectors | keys | length' specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json
```

### Phase 2: Signal Gating

**Expected behavior**:

| Coverage | Output | Action |
|----------|--------|--------|
| <25% | `❌ Insufficient UI signal` | Process exits with code 1 |
| 25-50% | `⚠️ Weak signal detected` | `FEATURE_SPEC.md.draft` created |
| 50-75% | `✓ Moderate signal` | Warning logged, continues |
| ≥75% | `✅ Strong signal` | Proceeds to generation |

**Validation**:
- [ ] Coverage percentage displayed
- [ ] Guidance message matches coverage level
- [ ] Process exits appropriately or continues

### Phase 3: Selector Enforcement

**Expected outputs**:
- [ ] Console shows "Validating selectors against whitelist"
- [ ] Summary: `Checked X selectors: Y/X whitelisted (Z%)`
- [ ] Unobserved selectors logged (if any)
- [ ] Commented lines in generated test file for unobserved selectors

**Validation**:
```bash
# Check selector coverage in generated test
grep -c "UNOBSERVED SELECTOR" specs/functional/ai-assisted/YOUR_FEATURE/YOUR_FEATURE.spec.ts

# All commented selectors should have clear comment
grep "// UNOBSERVED" specs/functional/ai-assisted/YOUR_FEATURE/YOUR_FEATURE.spec.ts
```

**Expected**: <10% of selectors commented out (for strong signal)

### Phase 4: Healing Infrastructure Ready

**Expected state**:
- [ ] UI map saved for healing iterations
- [ ] Directory structure ready:
  ```
  specs/functional/ai-assisted/YOUR_FEATURE/
  ├── YOUR_FEATURE.spec.ts (committed)
  ├── docs/
  │   ├── ui-map.json (healer will use/merge this)
  │   ├── FEATURE_SPEC.md.draft (if weak signal)
  │   └── generation-context.md
  ├── README.md (gitignored)
  ```

## Post-Generation Validation

### 1. Test File Quality

```bash
# Run the generated tests
npm test -- specs/functional/ai-assisted/YOUR_FEATURE/

# Expected: All tests pass or have clear failure reasons
# Tests may have test.fixme() for unobserved selectors - this is expected
```

### 2. UI Map Quality

```bash
# Analyze selector distribution
jq '.globalSelectors | to_entries | map({semantic: .key, count: (.value | length)}) | sort_by(.count) | reverse' \
  specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json

# Expected: Good distribution across semantic types
```

### 3. Semantic Richness

```bash
# Count unique semantic types
jq '.globalSelectors | keys | length' specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json

# Expected: >= 3 semantic types
```

### 4. Confidence Distribution

```bash
# Analyze confidence levels
jq '[.globalSelectors[].[] | .confidence] | group_by(.) | map({confidence: .[0], count: length})' \
  specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json

# Expected: Majority >= 70%
```

## Healing Validation

### Running Healing

```bash
npx tsx autonomous-cli.ts heal specs/functional/ai-assisted/YOUR_FEATURE/
```

### Expected Behavior During Healing

- [ ] Phase 4 message: "Extracted discoveries from re-exploration"
- [ ] Existing map loaded or created
- [ ] Maps merged with confidence boosting
- [ ] Merged map saved to ui-map.json
- [ ] Healing prompt includes re-discovered selectors
- [ ] Test fixes applied by LLM

### Post-Healing Validation

```bash
# Check merged map has more selectors
jq '.stats' specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json

# Compare before/after confidence
# Expected: Same or higher confidence on repeatedly seen selectors
```

## Success Criteria

### Minimum Viable (MVP)

- [x] All 5 phases operational
- [x] UI map generated with >10 selectors
- [x] Signal gating working (correct exit/continue)
- [x] Selector validation reducing unobserved count
- [x] Healing re-discovers selectors

### Good Quality

- [x] Signal coverage >75%
- [x] Confidence average >70%
- [x] Semantic types >5
- [x] <5% selectors unobserved
- [x] Healing iteration improves coverage

### Excellent Quality

- [x] Signal coverage >85%
- [x] Confidence average >80%
- [x] Semantic types >10
- [x] <2% selectors unobserved
- [x] 3+ healing iterations improve test stability
- [x] Tests pass without healing

## Troubleshooting Guide

### Issue: "Insufficient UI signal"

**Diagnostics**:
```bash
# Check coverage in error message
# Coverage <25% means not enough UI elements discovered

# Check what was discovered
jq '.stats.totalSelectors' specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json
jq '.stats.avgConfidence' specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json
```

**Solutions**:
1. Increase exploration depth: `--max-depth 4`
2. Provide feature spec: `--spec FEATURE_SPEC.md`
3. Add more feature hints: `"feature_name AND sub_feature"`

### Issue: Many selectors commented out (Phase 3)

**Diagnostics**:
```bash
# Count commented selectors
grep -c "// UNOBSERVED" specs/functional/ai-assisted/YOUR_FEATURE/YOUR_FEATURE.spec.ts

# Check which selectors were commented
grep "UNOBSERVED" specs/functional/ai-assisted/YOUR_FEATURE/YOUR_FEATURE.spec.ts
```

**Solutions**:
1. Run healing to re-discover selectors
2. Check if page structure changed
3. Verify UI map confidence scores in `docs/ui-map.json`

### Issue: Healing doesn't improve coverage

**Diagnostics**:
```bash
# Compare maps before/after healing
ls -la specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json.bak
jq '.stats' specs/functional/ai-assisted/YOUR_FEATURE/docs/ui-map.json

# Check healing prompt in cli output
# Verify re-discovered selectors included
```

**Solutions**:
1. Check if UI actually has the selectors (manual browser check)
2. Verify feature hints are accurate
3. Check if selector text/attributes changed

## Configuration Tuning

### For Better Signal Coverage

```typescript
// Lower confidence threshold to accept more selectors
generation: {
    minConfidenceThreshold: 30,  // From 50 (more permissive)
    // ...
}
```

**Trade-off**: More selectors but lower reliability

### For Stricter Quality

```typescript
// Higher coverage threshold
generation: {
    minCoveragePercent: 85,  // From 75 (stricter)
    // ...
}
```

**Trade-off**: Only generate when UI signals are very strong

## Metrics Dashboard

Create a dashboard tracking generation quality:

```bash
#!/bin/bash
echo "=== Test Generation Quality Dashboard ==="
echo ""

for feature_dir in specs/functional/ai-assisted/*/; do
    feature=$(basename "$feature_dir")
    map="$feature_dir/docs/ui-map.json"

    if [ -f "$map" ]; then
        coverage=$(jq '.stats.avgConfidence' "$map")
        selectors=$(jq '.stats.totalSelectors' "$map")
        semantics=$(jq '.globalSelectors | keys | length' "$map")

        echo "📊 $feature"
        echo "   Selectors: $selectors | Confidence: $coverage% | Semantics: $semantics"
    fi
done
```

## Next Steps

After successful generation and validation:

1. **Run tests**: `npm test -- specs/functional/ai-assisted/YOUR_FEATURE/`
2. **Review coverage**: Check which selectors failed
3. **Heal if needed**: `npx tsx autonomous-cli.ts heal specs/functional/ai-assisted/YOUR_FEATURE/`
4. **Iterate**: Repeat until tests pass
5. **Commit**: `git add specs/functional/ai-assisted/YOUR_FEATURE/*.spec.ts && git commit`

Remember: Spec files (.spec.ts) are committed, docs are gitignored.
