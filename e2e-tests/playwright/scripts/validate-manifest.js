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
 * Categorize diagnostics into blocking vs non-blocking
 * Blocking: issues that prevent correct operation or indicate misconfiguration
 * Non-blocking: informational or advisory
 */
function categorizeDiagnostics() {
  if (!fs.existsSync(DIAGNOSTICS_PATH)) {
    return { blocking: 0, warnings: 0, info: 0, items: { blocking: [], warnings: [], info: [] } };
  }

  const diagnostics = JSON.parse(fs.readFileSync(DIAGNOSTICS_PATH, 'utf8'));
  const items = { blocking: [], warnings: [], info: [] };

  // Low-confidence mappings (< 0.8) are warnings - not high confidence
  // These are still mapped and used, but worth noting
  if (diagnostics.lowConfidenceMappings?.length > 0) {
    items.warnings.push(`⚠️  Low-confidence mappings (${diagnostics.lowConfidenceMappings.length}, < 0.8):`);
    diagnostics.lowConfidenceMappings.slice(0, 3).forEach(m => {
      items.warnings.push(`   ${m.test} → ${m.flow} (${m.confidence})`);
    });
    if (diagnostics.lowConfidenceMappings.length > 3) {
      items.warnings.push(`   ... and ${diagnostics.lowConfidenceMappings.length - 3} more`);
    }
  }

  // Ambiguous mappings: informational - indicate tests that could map to multiple flows
  // These are either unresolved or flagged for review
  if (diagnostics.ambiguousMappings?.length > 0) {
    items.info.push(`📌 Ambiguous mappings (${diagnostics.ambiguousMappings.length}):`);
    diagnostics.ambiguousMappings.slice(0, 3).forEach(m => {
      items.info.push(`   ${m.testPath}`);
      // Handle both old format (candidates) and new format (selected + otherCandidates)
      if (m.candidates) {
        m.candidates.forEach(c => items.info.push(`     → ${c.flow} (${c.score})`));
      } else if (m.selected) {
        items.info.push(`     ✓ ${m.selected.flow} (${m.selected.score})`);
        m.otherCandidates?.forEach(c => items.info.push(`     → ${c.flow} (${c.score})`));
      }
    });
    if (diagnostics.ambiguousMappings.length > 3) {
      items.info.push(`   ... and ${diagnostics.ambiguousMappings.length - 3} more`);
    }
  }

  // Unmapped tests: informational - help with gap analysis awareness
  if (diagnostics.unmappedTests?.length > 0) {
    items.info.push(`📋 Unmapped tests (${diagnostics.unmappedTests.length}):`);
    diagnostics.unmappedTests.slice(0, 3).forEach(t => {
      items.info.push(`   ${t}`);
    });
    if (diagnostics.unmappedTests.length > 3) {
      items.info.push(`   ... and ${diagnostics.unmappedTests.length - 3} more`);
    }
  }

  return {
    blocking: items.blocking.length,
    warnings: items.warnings.length,
    info: items.info.length,
    items
  };
}

/**
 * Main execution
 */
function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const preGap = argv.includes('--pre-gap');

  console.log('✅ Validating manifest...\n');

  // Check paths exist (always blocking)
  const pathErrors = validateTestPathsExist();
  if (pathErrors.length > 0) {
    console.error('❌ Path Validation Failed:\n');
    pathErrors.forEach(err => console.error(err));
    process.exit(1);
  }

  // Check P0 coverage (with mode handling)
  const p0Errors = validateP0Coverage();
  let p0BlockingErrors = p0Errors.length;

  if (p0Errors.length > 0) {
    if (preGap) {
      // Pre-gap mode: warn only, don't fail
      // Gap analysis is supposed to FIND these gaps, so validation shouldn't block it
      console.warn('⚠️  P0 Coverage Warnings (pre-gap mode):\n');
      p0Errors.forEach(err => console.warn(err));
      console.log('(Not failing in pre-gap mode - gap analysis will address these)\n');
      p0BlockingErrors = 0;  // Not blocking in pre-gap mode
    } else {
      // Normal mode: fail if P0 gaps still exist after gap analysis
      console.error('❌ P0 Coverage Validation Failed:\n');
      p0Errors.forEach(err => console.error(err));
      process.exit(1);
    }
  } else {
    console.log('✅ All test paths exist');
    console.log('✅ P0 flows have coverage\n');
  }

  // Categorize and report diagnostics
  const diagResult = categorizeDiagnostics();

  // Print blocking issues (always fail)
  if (diagResult.items.blocking.length > 0) {
    console.error('❌ Blocking Issues:\n');
    diagResult.items.blocking.forEach(item => console.error(item));
    console.error();
  }

  // Print warnings
  if (diagResult.items.warnings.length > 0) {
    diagResult.items.warnings.forEach(item => console.log(item));
    console.log();
  }

  // Print informational items
  if (diagResult.items.info.length > 0) {
    diagResult.items.info.forEach(item => console.log(item));
    console.log();
  }

  // Summary
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const p0WithTests = catalog.flows.filter(f => f.priority === 'P0' && (f.tests || []).length > 0).length;
  const p0Total = catalog.flows.filter(f => f.priority === 'P0').length;

  console.log(`📊 Summary:`);
  console.log(`   P0 flows with coverage: ${p0WithTests}/${p0Total}`);
  console.log(`   Total flows: ${catalog.flows.length}`);

  // Strict validation gate status
  console.log(`\n🚪 Strict gate status:`);
  console.log(`   Blocking issues: ${diagResult.blocking + p0BlockingErrors}`);
  console.log(`   Warnings: ${diagResult.warnings}`);
  console.log(`   Informational: ${diagResult.info}`);

  // Determine exit code
  const totalBlocking = diagResult.blocking + p0BlockingErrors;

  if (totalBlocking > 0) {
    // Blocking issues always fail (regardless of strict mode)
    console.error(`\n❌ Validation failed: ${totalBlocking} blocking issue(s)\n`);
    process.exit(1);
  }

  if (strict && diagResult.warnings > 0) {
    // In strict mode, warnings also fail
    console.error(`\n❌ Strict mode enabled: ${diagResult.warnings} warning(s) detected\n`);
    process.exit(1);
  }

  // Success
  console.log('\n✨ Validation complete!');
}

main();
