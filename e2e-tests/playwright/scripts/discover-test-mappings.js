#!/usr/bin/env node

/**
 * Discover Test→Flow Mappings
 *
 * Deterministic signal matching to map test files to flows.
 * No annotations required. Uses:
 * - File path tokens
 * - Test titles/descriptions
 * - Imported modules
 * - Keyword overlap
 *
 * Outputs:
 * - .e2e-ai-agents/test-mappings.json (diagnostics)
 * - .e2e-ai-agents/manifest-diagnostics.json (confidence/ambiguity report)
 */

const fs = require('fs');
const path = require('path');

const FLOWS_JSON_PATH = path.join(__dirname, '../.e2e-ai-agents/flows.json');
const SPECS_DIR = path.join(__dirname, '../specs');
const MAPPINGS_PATH = path.join(__dirname, '../.e2e-ai-agents/test-mappings.json');
const DIAGNOSTICS_PATH = path.join(__dirname, '../.e2e-ai-agents/manifest-diagnostics.json');

/**
 * Extract tokens from a file path
 * e.g., specs/functional/messaging.send/messaging.send.spec.ts
 *    → ['messaging', 'send', 'messaging', 'send']
 */
function extractPathTokens(filePath) {
  return filePath
    .split(/[/-]/)
    .flatMap(segment => {
      // Further split on dots and underscores
      return segment.split(/[._]/);

    })
    .filter(token => token && token !== 'specs' && token !== 'spec' && token !== 'ts' && token !== 'js')
    .map(token => token.toLowerCase());
}

/**
 * Extract test description from file content
 */
function extractTestDescription(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Look for describe() or test() blocks
    const describeMatch = content.match(/describe\(['"`]([^'"`]+)/);
    const testMatch = content.match(/test\(['"`]([^'"`]+)/);

    const description = (describeMatch || testMatch)?.[1] || '';
    return description.toLowerCase().split(/\s+/);
  } catch {
    return [];
  }
}

/**
 * Extract imports from test file
 */
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const importMatches = content.match(/from\s+['"`]([^'"`]+)['"`]/g) || [];

    return importMatches
      .map(imp => imp.match(/from\s+['"`]([^'"`]+)['"`]/)[1])
      .filter(imp => !imp.startsWith('.'))
      .map(imp => imp.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Score match between test and flow
 * Returns: { score: 0-1, signals: string[] }
 */
function scoreMatch(testPath, testTokens, testTitle, testImports, flow) {
  const signals = [];
  let score = 0;

  const flowKeywords = (flow.keywords || []).map(k => k.toLowerCase());
  const flowPathTokens = (flow.paths || [])
    .flatMap(p => extractPathTokens(p));

  // Signal 1: Path token match (strongest)
  const pathOverlap = testTokens.filter(t => flowPathTokens.includes(t) || flowKeywords.includes(t));
  if (pathOverlap.length > 0) {
    score += 0.4;
    signals.push('path_token_match');
  }

  // Signal 2: Flow ID token match
  const flowIdTokens = flow.id.split('.').flatMap(t => t.split(/[-_]/)).map(t => t.toLowerCase());
  const idOverlap = testTokens.filter(t => flowIdTokens.includes(t));
  if (idOverlap.length > 0) {
    score += 0.35;
    signals.push('flow_id_match');
  }

  // Signal 3: Keyword overlap in test title
  const titleKeywordMatch = testTitle.filter(word => flowKeywords.includes(word));
  if (titleKeywordMatch.length > 0) {
    score += 0.15;
    signals.push('title_keyword_match');
  }

  // Signal 4: Import path overlap
  const importOverlap = testImports.filter(imp => {
    return flow.paths?.some(flowPath => {
      // Normalize both paths consistently: remove wildcards, lowercase, split on / . and _
      const normalizedFlow = flowPath
        .replace(/\*\*?\/?$/, '')
        .toLowerCase()
        .split(/[/._]/)
        .filter(t => t);

      const normalizedImp = imp
        .toLowerCase()
        .split(/[/._]/)
        .filter(t => t);

      // Check for meaningful overlap (at least one token in common)
      return normalizedFlow.some(token => normalizedImp.includes(token));
    });
  });
  if (importOverlap.length > 0) {
    score += 0.1;
    signals.push('import_match');
  }

  // Penalty: Very weak signals
  if (signals.length === 0) score = 0;

  return { score: Math.min(score, 1), signals };
}

/**
 * Discover all test→flow mappings
 */
function discoverMappings(minConfidence = 0.5) {
  const catalog = JSON.parse(fs.readFileSync(FLOWS_JSON_PATH, 'utf8'));
  const mappings = {};
  const diagnostics = {
    totalTests: 0,
    mappedTests: 0,
    ambiguousMappings: [],
    lowConfidenceMappings: [],
    unmappedTests: [],
    generatedAt: new Date().toISOString(),
  };

  // Collect all test files
  const testFiles = [];
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.match(/\.spec\.(ts|js)$/)) {
        const relPath = path.relative(path.join(__dirname, '..'), fullPath);
        testFiles.push({ path: relPath, fullPath });
      }
    }
  }
  walkDir(SPECS_DIR);

  diagnostics.totalTests = testFiles.length;

  // Score each test against each flow
  for (const testFile of testFiles) {
    const tokens = extractPathTokens(testFile.path);
    const title = extractTestDescription(testFile.fullPath);
    const imports = extractImports(testFile.fullPath);

    const candidates = [];

    for (const flow of catalog.flows) {
      const match = scoreMatch(testFile.path, tokens, title, imports, flow);
      if (match.score >= minConfidence) {
        candidates.push({ flow: flow.id, ...match });
      }
    }

    if (candidates.length === 0) {
      diagnostics.unmappedTests.push(testFile.path);
    } else {
      // Sort by score descending
      candidates.sort((a, b) => b.score - a.score);
      const bestCandidate = candidates[0];

      if (candidates.length === 1 || bestCandidate.score > candidates[1].score + 0.15) {
        // Single candidate or clear winner (> 0.15 ahead of second place)
        const flowId = bestCandidate.flow;
        if (!mappings[flowId]) {
          mappings[flowId] = [];
        }
        mappings[flowId].push({
          path: testFile.path,
          confidence: Number(bestCandidate.score.toFixed(2)),
          signals: bestCandidate.signals,
        });
        diagnostics.mappedTests++;

        // If not a clear winner, still log as ambiguous for review
        if (candidates.length > 1 && bestCandidate.score <= candidates[1].score + 0.15) {
          diagnostics.ambiguousMappings.push({
            testPath: testFile.path,
            selected: { flow: bestCandidate.flow, score: Number(bestCandidate.score.toFixed(2)) },
            otherCandidates: candidates.slice(1).map(c => ({ flow: c.flow, score: Number(c.score.toFixed(2)) })),
            reason: 'Best candidate selected, but others were close',
          });
        }
      } else {
        // Multiple candidates with similar scores: select best candidate if margin is not too small
        // Prefer assigning the top candidate to get coverage rather than leaving test unmapped
        const flowId = bestCandidate.flow;
        if (!mappings[flowId]) {
          mappings[flowId] = [];
        }
        mappings[flowId].push({
          path: testFile.path,
          confidence: Number(bestCandidate.score.toFixed(2)),
          signals: bestCandidate.signals,
        });
        diagnostics.mappedTests++;

        // Log as ambiguous for review
        diagnostics.ambiguousMappings.push({
          testPath: testFile.path,
          selected: { flow: bestCandidate.flow, score: Number(bestCandidate.score.toFixed(2)) },
          otherCandidates: candidates.slice(1).map(c => ({ flow: c.flow, score: Number(c.score.toFixed(2)) })),
          reason: 'Multiple candidates with similar scores - best candidate selected',
        });
      }
    }
  }

  // Track low-confidence mappings (below 0.8)
  for (const [flowId, tests] of Object.entries(mappings)) {
    for (const test of tests) {
      if (test.confidence < 0.8) {
        diagnostics.lowConfidenceMappings.push({
          flow: flowId,
          test: test.path,
          confidence: test.confidence,
        });
      }
    }
  }

  return { mappings, diagnostics };
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Discovering test→flow mappings...\n');

  const { mappings, diagnostics } = discoverMappings(0.5);

  console.log(`📊 Discovery Results:`);
  console.log(`   Total tests: ${diagnostics.totalTests}`);
  console.log(`   Mapped: ${diagnostics.mappedTests}`);
  console.log(`   Ambiguous: ${diagnostics.ambiguousMappings.length}`);
  console.log(`   Unmapped: ${diagnostics.unmappedTests.length}`);
  console.log(`   Low confidence: ${diagnostics.lowConfidenceMappings.length}\n`);

  // Write mappings
  fs.mkdirSync(path.dirname(MAPPINGS_PATH), { recursive: true });
  fs.writeFileSync(MAPPINGS_PATH, JSON.stringify(mappings, null, 2) + '\n');
  console.log(`✅ Mappings saved to: .e2e-ai-agents/test-mappings.json\n`);

  // Write diagnostics
  fs.writeFileSync(DIAGNOSTICS_PATH, JSON.stringify(diagnostics, null, 2) + '\n');
  console.log(`📋 Diagnostics saved to: .e2e-ai-agents/manifest-diagnostics.json\n`);

  // Show low-confidence warnings
  if (diagnostics.lowConfidenceMappings.length > 0) {
    console.log('⚠️  Low confidence mappings (< 0.8):');
    diagnostics.lowConfidenceMappings.slice(0, 5).forEach(m => {
      console.log(`   ${m.test} → ${m.flow} (${m.confidence})`);
    });
    if (diagnostics.lowConfidenceMappings.length > 5) {
      console.log(`   ... and ${diagnostics.lowConfidenceMappings.length - 5} more\n`);
    }
  }

  // Show ambiguous warnings
  if (diagnostics.ambiguousMappings.length > 0) {
    console.log('⚠️  Ambiguous mappings (multiple candidates):');
    diagnostics.ambiguousMappings.slice(0, 3).forEach(m => {
      console.log(`   ${m.testPath}`);
      // Handle both old format (candidates) and new format (selected + otherCandidates)
      if (m.candidates) {
        m.candidates.forEach(c => console.log(`     → ${c.flow} (${c.score})`));
      } else if (m.selected) {
        console.log(`     ✓ ${m.selected.flow} (${m.selected.score})`);
        m.otherCandidates.forEach(c => console.log(`     → ${c.flow} (${c.score})`));
      }
    });
    if (diagnostics.ambiguousMappings.length > 3) {
      console.log(`   ... and ${diagnostics.ambiguousMappings.length - 3} more\n`);
    }
  }

  console.log('✨ Discovery complete!');
}

main();
