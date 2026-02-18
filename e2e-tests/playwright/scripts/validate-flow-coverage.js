#!/usr/bin/env node

/**
 * Validate Flow Coverage
 *
 * Ensures flows.json stays aligned with reality:
 * - All test paths point to actual files
 * - P0 flows have test coverage (or are explicitly in a gap-acceptance list)
 * - No orphaned tests pointing to missing files
 *
 * Run in CI to gate on coverage requirements.
 */

const fs = require('fs');
const path = require('path');

const FLOWS_JSON_PATH = path.join(__dirname, '../.e2e-ai-agents/flows.json');

// Flows that are known/acceptable gaps (explicitly allowed to have no tests)
const ACCEPTABLE_GAPS = new Set([
  'channels.switch',
  'threads.popout',
]);

/**
 * Check all test paths exist
 */
function validateTestPathsExist() {
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const baseDir = path.join(__dirname, '..');
  const errors = [];

  for (const flow of catalog.flows) {
    for (const testPath of flow.tests || []) {
      const fullPath = path.join(baseDir, testPath);
      if (!fs.existsSync(fullPath)) {
        errors.push(
          `❌ Flow "${flow.id}" references non-existent test:\n    ${testPath}`
        );
      }
    }
  }

  return errors;
}

/**
 * Check P0 flows have test coverage
 */
function validateP0Coverage() {
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const errors = [];

  for (const flow of catalog.flows) {
    if (flow.priority === 'P0') {
      const hasTests = (flow.tests || []).length > 0;
      const isAcceptableGap = ACCEPTABLE_GAPS.has(flow.id);

      if (!hasTests && !isAcceptableGap) {
        errors.push(
          `❌ P0 flow "${flow.id}" (${flow.name}) has no test coverage.\n` +
          `   Either add tests or add to ACCEPTABLE_GAPS in validate-flow-coverage.js`
        );
      }
    }
  }

  return errors;
}

/**
 * Check that flows.json hasn't diverged from manifest
 * (optional warning, not a hard failure)
 */
function checkManifestSync() {
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const baseDir = path.join(__dirname, '..');
  let driftDetected = false;

  // Look for test files that aren't referenced in flows.json
  const allReferencedFiles = new Set();
  for (const flow of catalog.flows) {
    for (const testPath of flow.tests || []) {
      allReferencedFiles.add(testPath);
    }
  }

  // Warn if new test files exist but aren't in flows.json
  const specsDir = path.join(baseDir, 'specs');
  let newFilesFound = 0;

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.match(/\.spec\.(ts|js)$/)) {
        const normalizedPath = `e2e-tests/playwright/${relativePath}`;
        if (!allReferencedFiles.has(normalizedPath)) {
          console.warn(`⚠️  Test file not in flows.json: ${relativePath}`);
          driftDetected = true;
          newFilesFound++;
        }
      }
    }
  }

  walkDir(specsDir);

  if (driftDetected) {
    console.log(
      `\n💡 Found ${newFilesFound} test files not in flows.json.\n` +
      `   Run: npm run test:manifest:generate\n`
    );
  }

  return driftDetected;
}

/**
 * Main execution
 */
function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');

  console.log('🔍 Validating flow coverage...\n');

  const pathErrors = validateTestPathsExist();
  const p0Errors = validateP0Coverage();
  const driftDetected = checkManifestSync();

  if (pathErrors.length > 0) {
    console.error('Path Validation Errors:');
    pathErrors.forEach(err => console.error(`\n${err}`));
    process.exit(1);
  }

  if (p0Errors.length > 0) {
    console.error('P0 Coverage Errors:');
    p0Errors.forEach(err => console.error(`\n${err}`));
    process.exit(1);
  }

  if (driftDetected && strict) {
    console.error(
      '\n❌ Coverage drift detected. Run manifest generator and commit.\n'
    );
    process.exit(1);
  }

  console.log('✅ Flow coverage validation passed!');
  console.log(`   P0 flows: ${
    JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8')).flows
      .filter(f => f.priority === 'P0' && (f.tests || []).length > 0).length
  } with test coverage`);
}

main();
