#!/usr/bin/env node

/**
 * Validate Manifest
 *
 * Strict CI validation:
 * - All test paths in flows.json must exist
 * - No malformed paths
 * - P0 flows must have coverage (or be in allowlist)
 * - Report ambiguities and low-confidence mappings
 */

const fs = require('fs');
const path = require('path');

const FLOWS_JSON_PATH = path.join(__dirname, '../.e2e-ai-agents/flows.json');
const DIAGNOSTICS_PATH = path.join(__dirname, '../.e2e-ai-agents/manifest-diagnostics.json');
const SPECS_DIR = path.join(__dirname, '..');

// Flows that are acceptable P0 gaps (explicitly allowlisted)
const ACCEPTABLE_P0_GAPS = new Set([
  'channels.switch',
  'threads.popout',
]);

/**
 * Validate that all test paths exist
 */
function validateTestPathsExist() {
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const errors = [];

  for (const flow of catalog.flows) {
    for (const testPath of flow.tests || []) {
      // Check path format
      if (!testPath.startsWith('specs/')) {
        errors.push(
          `❌ Flow "${flow.id}": malformed path (must start with "specs/"):\n` +
          `   ${testPath}`
        );
      }

      // Check path exists
      const fullPath = path.join(SPECS_DIR, testPath);
      if (!fs.existsSync(fullPath)) {
        errors.push(
          `❌ Flow "${flow.id}": test path does not exist:\n` +
          `   ${testPath}`
        );
      }
    }
  }

  return errors;
}

/**
 * Validate P0 coverage
 */
function validateP0Coverage() {
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const errors = [];

  for (const flow of catalog.flows) {
    if (flow.priority === 'P0') {
      const hasTests = (flow.tests || []).length > 0;
      const isAcceptableGap = ACCEPTABLE_P0_GAPS.has(flow.id);

      if (!hasTests && !isAcceptableGap) {
        errors.push(
          `❌ P0 flow "${flow.id}" (${flow.name}) has no test coverage.\n` +
          `   Add tests or allowlist in ACCEPTABLE_P0_GAPS`
        );
      }
    }
  }

  return errors;
}

/**
 * Report ambiguities and low-confidence mappings
 */
function reportDiagnostics() {
  if (!fs.existsSync(DIAGNOSTICS_PATH)) {
    return { count: 0, items: [] };
  }

  const diagnostics = JSON.parse(fs.readFileSync(DIAGNOSTICS_PATH, 'utf8'));
  const items = [];

  // Ambiguous mappings
  if (diagnostics.ambiguousMappings?.length > 0) {
    items.push(`⚠️  Ambiguous mappings (${diagnostics.ambiguousMappings.length}):`);
    diagnostics.ambiguousMappings.slice(0, 3).forEach(m => {
      items.push(`   ${m.testPath}`);
      m.candidates.forEach(c => items.push(`     → ${c.flow} (${c.score})`));
    });
    if (diagnostics.ambiguousMappings.length > 3) {
      items.push(`   ... and ${diagnostics.ambiguousMappings.length - 3} more`);
    }
  }

  // Low-confidence mappings
  if (diagnostics.lowConfidenceMappings?.length > 0) {
    items.push(`\n⚠️  Low-confidence mappings (${diagnostics.lowConfidenceMappings.length}, < 0.8):`);
    diagnostics.lowConfidenceMappings.slice(0, 3).forEach(m => {
      items.push(`   ${m.test} → ${m.flow} (${m.confidence})`);
    });
    if (diagnostics.lowConfidenceMappings.length > 3) {
      items.push(`   ... and ${diagnostics.lowConfidenceMappings.length - 3} more`);
    }
  }

  // Unmapped tests (informational only)
  if (diagnostics.unmappedTests?.length > 0) {
    items.push(`\n📋 Unmapped tests (${diagnostics.unmappedTests.length}):`);
    diagnostics.unmappedTests.slice(0, 3).forEach(t => {
      items.push(`   ${t}`);
    });
    if (diagnostics.unmappedTests.length > 3) {
      items.push(`   ... and ${diagnostics.unmappedTests.length - 3} more`);
    }
  }

  return { count: items.length, items };
}

/**
 * Main execution
 */
function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');

  console.log('✅ Validating manifest...\n');

  // Check paths exist
  const pathErrors = validateTestPathsExist();
  if (pathErrors.length > 0) {
    console.error('❌ Path Validation Failed:\n');
    pathErrors.forEach(err => console.error(err));
    process.exit(1);
  }

  // Check P0 coverage
  const p0Errors = validateP0Coverage();
  if (p0Errors.length > 0) {
    console.error('❌ P0 Coverage Validation Failed:\n');
    p0Errors.forEach(err => console.error(err));
    process.exit(1);
  }

  console.log('✅ All test paths exist');
  console.log('✅ P0 flows have coverage\n');

  // Report diagnostics
  const diagnostics = reportDiagnostics();
  if (diagnostics.items.length > 0) {
    diagnostics.items.forEach(item => console.log(item));
    console.log();
  }

  // Summary
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const p0WithTests = catalog.flows.filter(f => f.priority === 'P0' && (f.tests || []).length > 0).length;
  const p0Total = catalog.flows.filter(f => f.priority === 'P0').length;

  console.log(`📊 Summary:`);
  console.log(`   P0 flows with coverage: ${p0WithTests}/${p0Total}`);
  console.log(`   Total flows: ${catalog.flows.length}`);

  if (strict && diagnostics.count > 0) {
    console.error('\n❌ Ambiguities detected in strict mode.\n');
    process.exit(1);
  }

  console.log('\n✨ Validation complete!');
}

main();
