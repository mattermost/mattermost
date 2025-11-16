# Gap Analysis Guide

This guide explains how to analyze the gap between manual test cases and automated E2E test coverage in Mattermost.

## Overview

Gap analysis helps identify which manual test cases lack E2E automation, enabling teams to:
- Prioritize automation efforts
- Track coverage improvements
- Reduce regression risk
- Make data-driven testing decisions

## Data Sources

### Manual Test Repository
**Location:** `/Users/yasserkhan/Documents/mattermost/mattermost-test-management/`

Contains manual test cases written by QA team in markdown format.

**Key files:**
```
data/
├── test-cases/           # Test case markdown files
│   ├── calls/
│   │   ├── MM-T5382.md
│   │   ├── MM-T4841.md
│   │   └── ...
│   ├── channels/
│   ├── messaging/
│   └── ...
├── key-and-path.json     # Maps test keys to feature paths
├── folders.json          # Feature folder structure
├── priorities.json       # Priority definitions
└── statuses.json         # Test status values
```

**Manual test structure:**
```markdown
---
name: "Test name"
status: Active|Deprecated
priority: Normal|Low|High|Critical
folder: Feature Area
priority_p1_to_p4: P1|P2|P3|P4
playwright: null|Automated|In Progress
key: MM-TXXX
---

## MM-TXXX: Test Title

**Step 1**
...
```

### E2E Test Repository
**Location:** `/Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/`

Contains automated Playwright tests written by developers.

**Key locations:**
```
specs/
├── functional/           # Functional E2E tests
│   ├── channels/
│   ├── messaging/
│   ├── system_console/
│   └── ...
├── visual/              # Visual regression tests
├── accessibility/       # Accessibility tests
└── client/             # Client API tests
```

**E2E test format:**
```typescript
test('MM-T1234 descriptive test title', {tag: '@feature'}, async ({pw}) => {
  // Test implementation
});
```

## Gap Detection Algorithm

### Step 1: Load Manual Tests
```typescript
// Read all active manual test cases
const manualTests = new Map<string, ManualTest>();

for (const file of findFiles('data/test-cases/**/*.md')) {
  const content = readFile(file);
  const test = parseManualTest(content);

  // Only include active tests
  if (test.status === 'Active') {
    manualTests.set(test.key, test);
  }
}

console.log(`Loaded ${manualTests.size} active manual tests`);
```

### Step 2: Scan E2E Tests
```typescript
// Find all E2E tests with MM-T keys
const automatedTests = new Map<string, AutomatedTest>();

for (const file of findFiles('specs/**/*.spec.ts')) {
  const content = readFile(file);
  const keys = extractTestKeys(content); // Find MM-T\d+ pattern

  for (const key of keys) {
    automatedTests.set(key, {
      key,
      file,
      testTitle: extractTestTitle(content, key)
    });
  }
}

console.log(`Found ${automatedTests.size} automated tests`);
```

### Step 3: Compute Gaps
```typescript
// Find manual tests without E2E coverage
const gaps = [];

for (const [key, manual] of manualTests) {
  // Check if manual test is already marked as automated
  if (manual.playwright === 'Automated') {
    continue; // Skip, already covered
  }

  // Check if E2E test exists
  if (!automatedTests.has(key)) {
    gaps.push({
      key,
      name: manual.name,
      priority: manual.priority_p1_to_p4,
      feature: manual.folder,
      complexity: estimateComplexity(manual)
    });
  }
}

console.log(`Found ${gaps.length} gaps (${(gaps.length/manualTests.size*100).toFixed(1)}%)`);
```

### Step 4: Categorize and Prioritize
```typescript
// Group gaps by various dimensions
const byFeature = groupBy(gaps, 'feature');
const byPriority = groupBy(gaps, 'priority');
const byComplexity = groupBy(gaps, 'complexity');

// Sort by priority (P1 first, then P2, etc.)
const priorityOrder = {P1: 1, P2: 2, P3: 3, P4: 4};
gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
```

## Coverage Metrics

### Overall Coverage
```typescript
const coverage = {
  total: manualTests.size,
  automated: automatedTests.size,
  percentage: (automatedTests.size / manualTests.size * 100).toFixed(1)
};

console.log(`Coverage: ${coverage.automated}/${coverage.total} (${coverage.percentage}%)`);
```

### Feature-Level Coverage
```typescript
const featureCoverage = {};

for (const feature of getUniqueFeatures(manualTests)) {
  const featureManual = countTestsInFeature(manualTests, feature);
  const featureAuto = countTestsInFeature(automatedTests, feature);

  featureCoverage[feature] = {
    total: featureManual,
    automated: featureAuto,
    percentage: (featureAuto / featureManual * 100).toFixed(1),
    gaps: featureManual - featureAuto
  };
}
```

### Priority-Based Coverage
```typescript
const priorityCoverage = {};

for (const priority of ['P1', 'P2', 'P3', 'P4']) {
  const priorityManual = countTestsWithPriority(manualTests, priority);
  const priorityAuto = countTestsWithPriority(automatedTests, priority);

  priorityCoverage[priority] = {
    total: priorityManual,
    automated: priorityAuto,
    percentage: (priorityAuto / priorityManual * 100).toFixed(1)
  };
}
```

### Weighted Coverage
Gives more weight to high-priority tests:
```typescript
const weights = {P1: 4, P2: 3, P3: 2, P4: 1};

let totalWeighted = 0;
let automatedWeighted = 0;

for (const [key, test] of manualTests) {
  const weight = weights[test.priority_p1_to_p4] || 1;
  totalWeighted += weight;

  if (automatedTests.has(key)) {
    automatedWeighted += weight;
  }
}

const weightedCoverage = (automatedWeighted / totalWeighted * 100).toFixed(1);
console.log(`Weighted coverage: ${weightedCoverage}%`);
```

## Complexity Estimation

Estimate effort required to automate a manual test:

```typescript
function estimateComplexity(manualTest): {level: string, hours: number} {
  let complexity = 0;

  // Check test content for complexity indicators
  const content = manualTest.content.toLowerCase();

  // Multi-user scenarios
  if (content.includes('user a') && content.includes('user b')) {
    complexity += 3;
  }

  // Real-time/WebSocket
  if (content.includes('real-time') || content.includes('immediately')) {
    complexity += 2;
  }

  // System Console
  if (content.includes('system console') || content.includes('admin')) {
    complexity += 2;
  }

  // Plugins
  if (content.includes('plugin')) {
    complexity += 3;
  }

  // API setup
  if (content.includes('configure') || content.includes('enable')) {
    complexity += 1;
  }

  // Error handling
  if (content.includes('error') || content.includes('invalid')) {
    complexity += 1;
  }

  // Count steps
  const steps = countSteps(manualTest.content);
  complexity += Math.floor(steps / 3);

  // Categorize
  if (complexity <= 2) {
    return {level: 'Simple', hours: 2};
  } else if (complexity <= 5) {
    return {level: 'Moderate', hours: 4};
  } else if (complexity <= 8) {
    return {level: 'Complex', hours: 6};
  } else {
    return {level: 'Very Complex', hours: 8};
  }
}
```

## Report Generation

### Console Report
```typescript
function generateConsoleReport(data) {
  console.log('=== E2E Test Coverage Report ===\n');

  console.log(`Total Manual Tests: ${data.total}`);
  console.log(`Tests with E2E Coverage: ${data.automated} (${data.coverage}%)`);
  console.log(`Tests without E2E Coverage: ${data.gaps} (${100-data.coverage}%)\n`);

  console.log('Coverage by Feature Area:');
  for (const [feature, stats] of Object.entries(data.byFeature)) {
    console.log(`- ${feature}: ${stats.automated}/${stats.total} (${stats.percentage}%)`);
  }

  console.log('\nHigh Priority Gaps (P1-P2):');
  const highPriorityGaps = data.gaps.filter(g => g.priority === 'P1' || g.priority === 'P2');
  for (const gap of highPriorityGaps.slice(0, 10)) {
    console.log(`- ${gap.key}: ${gap.name} [${gap.feature}]`);
  }

  console.log('\nRecommendations:');
  generateRecommendations(data).forEach((rec, i) => {
    console.log(`${i+1}. ${rec}`);
  });
}
```

### Markdown Report
```typescript
function generateMarkdownReport(data) {
  let md = '# E2E Test Coverage Report\n\n';
  md += `*Generated: ${new Date().toISOString()}*\n\n`;

  md += '## Summary\n\n';
  md += `- **Total Manual Tests:** ${data.total}\n`;
  md += `- **Automated:** ${data.automated} (${data.coverage}%)\n`;
  md += `- **Gaps:** ${data.gaps}\n\n`;

  md += '## Coverage by Feature\n\n';
  md += '| Feature | Total | Automated | Coverage |\n';
  md += '|---------|-------|-----------|----------|\n';
  for (const [feature, stats] of Object.entries(data.byFeature)) {
    md += `| ${feature} | ${stats.total} | ${stats.automated} | ${stats.percentage}% |\n`;
  }

  // ... more sections

  return md;
}
```

### JSON Report
```typescript
function generateJSONReport(data) {
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    summary: {
      total_manual_tests: data.total,
      automated_tests: data.automated,
      coverage_percentage: data.coverage,
      gap_count: data.gaps
    },
    by_feature: data.byFeature,
    by_priority: data.byPriority,
    gaps: data.gapDetails.map(g => ({
      key: g.key,
      name: g.name,
      priority: g.priority,
      feature: g.feature,
      complexity: g.complexity,
      estimated_effort_hours: g.hours
    })),
    recommendations: generateRecommendations(data)
  }, null, 2);
}
```

## Recommendations Engine

Generate actionable recommendations based on gap analysis:

```typescript
function generateRecommendations(data) {
  const recommendations = [];

  // Recommendation 1: Quick wins
  const simpleGaps = data.gapDetails.filter(g => g.complexity === 'Simple');
  if (simpleGaps.length > 10) {
    const totalHours = simpleGaps.reduce((sum, g) => sum + g.hours, 0);
    recommendations.push(
      `${simpleGaps.length} simple tests can be automated in ~${totalHours}h. Quick wins!`
    );
  }

  // Recommendation 2: Low coverage areas
  const lowCoverageFeatures = Object.entries(data.byFeature)
    .filter(([_, stats]) => stats.percentage < 30)
    .sort((a, b) => a[1].percentage - b[1].percentage);

  if (lowCoverageFeatures.length > 0) {
    const [feature, stats] = lowCoverageFeatures[0];
    recommendations.push(
      `${feature} has lowest coverage (${stats.percentage}%). Focus efforts here.`
    );
  }

  // Recommendation 3: High-priority gaps
  const p1Gaps = data.gapDetails.filter(g => g.priority === 'P1');
  if (p1Gaps.length > 0) {
    recommendations.push(
      `${p1Gaps.length} P1 tests without automation pose regression risk. Prioritize these.`
    );
  }

  // Recommendation 4: Bulk conversion opportunity
  const largeFeatureGaps = Object.entries(data.byFeature)
    .filter(([_, stats]) => stats.gaps > 20)
    .sort((a, b) => b[1].gaps - a[1].gaps);

  if (largeFeatureGaps.length > 0) {
    const [feature, stats] = largeFeatureGaps[0];
    recommendations.push(
      `${feature} has ${stats.gaps} gaps. Consider bulk conversion approach.`
    );
  }

  return recommendations;
}
```

## Practical Examples

### Example 1: Quick Gap Check
```bash
# User wants to know current status
@gap-analyzer "What's our E2E test coverage?"

# Agent:
# 1. Loads manual tests (1,234 found)
# 2. Scans E2E tests (456 found)
# 3. Computes gap (778 missing = 63%)
# 4. Generates quick summary
```

**Output:**
```
E2E Coverage: 456/1,234 (37%)
Gaps: 778 tests (63%)

Top gaps by priority:
- 23 P1 tests without automation
- 145 P2 tests without automation

Recommendation: Focus on P1 tests first
```

### Example 2: Feature Analysis
```bash
@gap-analyzer "Analyze Calls feature coverage"

# Agent:
# 1. Filters manual tests for Calls folder
# 2. Finds E2E tests in specs/functional/calls/
# 3. Generates feature-specific report
```

**Output:**
```
Calls Feature Coverage Report

Total: 45 manual tests
Automated: 12 (27%)
Gaps: 33 (73%)

Priority breakdown:
- P1: 2/5 (40%)
- P2: 8/20 (40%)
- P3: 2/15 (13%)
- P4: 0/5 (0%)

Top gaps:
- MM-T4841: Screen sharing (P1, Complex)
- MM-T5382: Call from profile (P2, Moderate)
...

Estimated effort: 180 hours total
```

### Example 3: Priority Focus
```bash
@gap-analyzer "Show all P1 tests without E2E"

# Agent:
# 1. Loads all manual tests
# 2. Filters by priority_p1_to_p4 == "P1"
# 3. Checks E2E coverage
# 4. Lists gaps
```

**Output:**
```
Critical Tests Without E2E (P1)

Found 23 P1 tests without automation:

1. MM-T4841 - Screen sharing in calls [Calls] (Complex, 6h)
2. MM-T1234 - SSO login failure [Auth] (Moderate, 4h)
3. MM-T2345 - Channel create error [Channels] (Simple, 2h)
...

Total estimated effort: 98 hours
RECOMMENDATION: These are critical - automate ASAP
```

## Best Practices

1. **Run regularly** - Weekly or after each sprint
2. **Track trends** - Compare reports over time
3. **Filter deprecated** - Only analyze active tests
4. **Respect markers** - Check `playwright` field in manual tests
5. **Estimate effort** - Help teams plan automation work
6. **Prioritize** - Focus on P1/P2 first
7. **Group by feature** - Easier to batch convert
8. **Share results** - Post reports to team channels

## Troubleshooting

### Issue: No manual tests found
- Check path: `/Users/yasserkhan/Documents/mattermost/mattermost-test-management/`
- Verify directory structure
- Check file permissions

### Issue: No E2E tests found
- Verify working directory
- Check path: `e2e-tests/playwright/specs/`
- Ensure `.spec.ts` files exist

### Issue: Coverage seems wrong
- Verify only Active tests are counted
- Check if `playwright` field is respected
- Ensure MM-T key format is correct (MM-T\d+)
- Look for duplicate test keys

### Issue: Missing test keys
- Some E2E tests may not have MM-T keys (new tests)
- Some manual tests may have incorrect keys
- Check key-and-path.json for mismatches

## Summary

Gap analysis provides visibility into test automation coverage, enabling:
- **Data-driven decisions** about what to automate
- **Progress tracking** over time
- **Risk identification** (critical tests without automation)
- **Resource planning** (effort estimates)
- **Team alignment** (shared understanding of gaps)

Use gap analysis as the foundation for systematic test automation improvement.
