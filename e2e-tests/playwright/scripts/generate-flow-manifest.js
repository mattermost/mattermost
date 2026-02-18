#!/usr/bin/env node

/**
 * Generate Flow Test Manifest
 *
 * Scans spec files for @flow metadata and auto-generates test coverage mappings.
 * Updates flows.json with discovered test paths while preserving manual curation
 * (paths, priority, audience, flags, keywords).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FLOWS_JSON_PATH = path.join(__dirname, '../.e2e-ai-agents/flows.json');
const SPECS_DIR = path.join(__dirname, '../specs');

/**
 * Extract flow metadata from test file headers
 * Looks for patterns like:
 *   // @flow messaging.send
 *   // @priority P0
 */
function extractFlowMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const flowMatch = content.match(/@flow\s+([\w.]+)/);
    const priorityMatch = content.match(/@priority\s+(P[0-2])/);

    return {
      flow: flowMatch ? flowMatch[1] : null,
      priority: priorityMatch ? priorityMatch[1] : null,
    };
  } catch (err) {
    return { flow: null, priority: null };
  }
}

/**
 * Scan all spec files and build flow->tests mapping
 */
function buildTestMapping() {
  const mapping = {};

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(
        path.join(__dirname, '..'),
        fullPath
      );

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.match(/\.spec\.(ts|js)$/)) {
        const metadata = extractFlowMetadata(fullPath);

        if (metadata.flow) {
          if (!mapping[metadata.flow]) {
            mapping[metadata.flow] = [];
          }
          // Normalize path for flows.json - relative to e2e-tests/playwright dir
          mapping[metadata.flow].push(relativePath);
        }
      }
    }
  }

  walkDir(SPECS_DIR);
  return mapping;
}

/**
 * Update flows.json with discovered test mappings
 * Preserves all manual curation (paths, priority, audience, flags, keywords)
 */
function updateFlowsJson(mapping) {
  if (!fs.existsSync(FLOWS_JSON_PATH)) {
    console.error(`❌ flows.json not found at ${FLOWS_JSON_PATH}`);
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  let updated = 0;

  for (const flow of catalog.flows) {
    const discoveredTests = mapping[flow.id] || [];
    const oldTests = flow.tests || [];

    // Only update if tests changed
    if (JSON.stringify(oldTests.sort()) !== JSON.stringify(discoveredTests.sort())) {
      flow.tests = discoveredTests;
      updated++;
    }
  }

  // Write back with 2-space indent (matching original)
  fs.writeFileSync(FLOWS_JSON_PATH, JSON.stringify(catalog, null, 2) + '\n');

  return { updated, total: catalog.flows.length };
}

/**
 * Validate that all test paths exist
 */
function validateTestPaths() {
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const baseDir = path.join(__dirname, '..');
  const errors = [];

  for (const flow of catalog.flows) {
    for (const testPath of flow.tests || []) {
      const fullPath = path.join(baseDir, testPath);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Flow "${flow.id}": test path does not exist: ${testPath}`);
      }
    }
  }

  return errors;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning spec files for @flow metadata...');

  const mapping = buildTestMapping();
  const flowsWithTests = Object.keys(mapping).length;
  const totalTests = Object.values(mapping).reduce((sum, tests) => sum + tests.length, 0);

  console.log(`  Found: ${flowsWithTests} flows with ${totalTests} test mappings\n`);

  console.log('📝 Updating flows.json with discovered tests...');
  const { updated, total } = updateFlowsJson(mapping);
  console.log(`  Updated: ${updated}/${total} flows\n`);

  console.log('✅ Validating test paths...');
  const errors = validateTestPaths();

  if (errors.length > 0) {
    console.error('❌ Validation failed:\n');
    errors.forEach(err => console.error(`  ${err}`));
    process.exit(1);
  }

  console.log('  All test paths exist ✓\n');
  console.log('✨ Manifest generation complete!');
}

main();
