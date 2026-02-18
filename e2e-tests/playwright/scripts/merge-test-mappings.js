#!/usr/bin/env node

/**
 * Merge Test Mappings into flows.json
 *
 * Non-destructive merge:
 * - Keep existing valid test paths
 * - Add newly discovered mappings above confidence threshold
 * - Remove only missing-file paths
 * - Normalize to specs/... paths
 * - Sort + dedupe
 */

const fs = require('fs');
const path = require('path');

const FLOWS_JSON_PATH = path.join(__dirname, '../.e2e-ai-agents/flows.json');
const MAPPINGS_PATH = path.join(__dirname, '../.e2e-ai-agents/test-mappings.json');

const MIN_CONFIDENCE = 0.7;  // Only merge mappings with >= 70% confidence
const SPECS_DIR = path.join(__dirname, '..');

/**
 * Check if a test file exists
 */
function testExists(testPath) {
  const fullPath = path.join(SPECS_DIR, testPath);
  return fs.existsSync(fullPath);
}

/**
 * Normalize path to specs/... format
 */
function normalizePath(testPath) {
  // Remove 'e2e-tests/playwright/' prefix if present
  return testPath.replace(/^e2e-tests\/playwright\//, '');
}

/**
 * Main merge logic
 */
function mergeTestMappings() {
  if (!fs.existsSync(MAPPINGS_PATH)) {
    console.warn('⚠️  test-mappings.json not found. Run: npm run test:manifest:discover');
    return false;
  }

  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const mappings = JSON.parse(fs.readFileSync(MAPPINGS_PATH, 'utf8'));

  let mergedFlows = 0;
  let addedTests = 0;
  let removedTests = 0;

  for (const flow of catalog.flows) {
    const flowId = flow.id;
    const existingTests = flow.tests || [];
    const discoveredTests = mappings[flowId] || [];

    // Step 1: Keep existing valid paths
    const validExisting = existingTests
      .map(t => normalizePath(t))
      .filter(t => {
        if (!testExists(t)) {
          console.log(`  Removing missing: ${flowId} → ${t}`);
          removedTests++;
          return false;
        }
        return true;
      });

    // Step 2: Add newly discovered mappings (high confidence only)
    const newMappings = discoveredTests
      .filter(d => d.confidence >= MIN_CONFIDENCE)
      .map(d => normalizePath(d.path));

    // Step 3: Merge: existing + new, dedupe, sort
    const merged = [...new Set([...validExisting, ...newMappings])].sort();

    // Step 4: Track changes
    if (merged.length > validExisting.length) {
      addedTests += merged.length - validExisting.length;
      console.log(`  Updated: ${flowId} (added ${merged.length - validExisting.length} tests)`);
      mergedFlows++;
    } else if (merged.length < validExisting.length) {
      console.log(`  Cleaned: ${flowId} (removed ${validExisting.length - merged.length} missing tests)`);
      mergedFlows++;
    }

    flow.tests = merged.length > 0 ? merged : [];
  }

  // Write updated flows.json
  fs.writeFileSync(FLOWS_JSON_PATH, JSON.stringify(catalog, null, 2) + '\n');

  return { success: true, mergedFlows, addedTests, removedTests };
}

/**
 * Main execution
 */
function main() {
  console.log('🔗 Merging test mappings into flows.json...\n');

  const result = mergeTestMappings();

  if (!result.success) {
    process.exit(1);
  }

  console.log(`\n✅ Merge complete:`);
  console.log(`   Flows updated: ${result.mergedFlows}`);
  console.log(`   Tests added: ${result.addedTests}`);
  console.log(`   Tests removed: ${result.removedTests}`);
  console.log(`   Min confidence threshold: ${MIN_CONFIDENCE}\n`);
}

main();
