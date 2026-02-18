#!/usr/bin/env node

/**
 * Merge Test Mappings into flows.json
 *
 * Self-correcting non-destructive merge:
 * - Keep existing test paths only if re-discovered with sufficient confidence OR allowlisted
 * - Add newly discovered mappings above confidence threshold
 * - Remove stale mappings no longer supported by rediscovery
 * - Remove missing-file paths
 * - Normalize to specs/... paths
 * - Sort + dedupe
 *
 * This prevents false-positive mappings from persisting indefinitely.
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
 * Main merge logic with self-correction
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
  let staleMappings = 0;
  const staleRemovals = [];

  for (const flow of catalog.flows) {
    const flowId = flow.id;
    const existingTests = flow.tests || [];
    const discoveredTests = mappings[flowId] || [];
    const allowlist = flow.manualPreservePaths || [];  // Optional allowlist field in flows.json

    // Build set of re-discovered paths for quick lookup
    const rediscoveredSet = new Set(
      discoveredTests
        .filter(d => d.confidence >= MIN_CONFIDENCE)
        .map(d => normalizePath(d.path))
    );

    // Step 1: Filter existing tests - keep only if re-discovered, allowlisted, or file missing (will handle separately)
    const validExisting = existingTests
      .map(t => normalizePath(t))
      .filter(t => {
        if (!testExists(t)) {
          // Missing file: always remove
          console.log(`  Removing missing: ${flowId} → ${t}`);
          removedTests++;
          staleMappings++;
          staleRemovals.push({ flow: flowId, test: t, reason: 'file missing' });
          return false;
        }

        if (rediscoveredSet.has(t)) {
          // Re-discovered in this cycle: keep
          return true;
        }

        if (allowlist.includes(t)) {
          // On allowlist: keep
          return true;
        }

        // Not re-discovered and not allowlisted: remove as stale
        console.log(`  Removing stale: ${flowId} → ${t}`);
        removedTests++;
        staleMappings++;
        staleRemovals.push({ flow: flowId, test: t, reason: 'no longer discovered in rediscovery' });
        return false;
      });

    // Step 2: Add newly discovered mappings (high confidence only)
    const newMappings = discoveredTests
      .filter(d => d.confidence >= MIN_CONFIDENCE)
      .map(d => normalizePath(d.path))
      .filter(d => !validExisting.includes(d));  // Avoid duplicates

    // Step 3: Merge: existing + new, dedupe, sort
    const merged = [...new Set([...validExisting, ...newMappings])].sort();

    // Step 4: Track changes
    if (newMappings.length > 0) {
      addedTests += newMappings.length;
      console.log(`  Updated: ${flowId} (added ${newMappings.length} tests)`);
      mergedFlows++;
    } else if (merged.length < existingTests.length) {
      console.log(`  Cleaned: ${flowId} (removed ${existingTests.length - merged.length} tests)`);
      mergedFlows++;
    }

    flow.tests = merged.length > 0 ? merged : [];
  }

  // Write updated flows.json
  fs.writeFileSync(FLOWS_JSON_PATH, JSON.stringify(catalog, null, 2) + '\n');

  return { success: true, mergedFlows, addedTests, removedTests, staleMappings, staleRemovals };
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
  if (result.staleMappings > 0) {
    console.log(`   Stale mappings removed: ${result.staleMappings}`);
  }
  console.log(`   Min confidence threshold: ${MIN_CONFIDENCE}\n`);

  if (result.staleRemovals.length > 0 && result.staleRemovals.length <= 5) {
    console.log('📋 Removed stale mappings:');
    result.staleRemovals.forEach(r => {
      console.log(`   ${r.flow}: ${r.test} (${r.reason})`);
    });
    console.log();
  }
}

main();
