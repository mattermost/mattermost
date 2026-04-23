#!/usr/bin/env node
/**
 * shard-split.js — Test shard assignment solver
 *
 * Splits Go test packages across N parallel CI runners using timing data
 * from previous runs. Uses a two-tier strategy:
 *
 *   1. "Light" packages (< HEAVY_MS total runtime): assigned whole to a shard
 *   2. "Heavy" packages (>= HEAVY_MS): individual tests distributed across
 *      shards using -run regex filters
 *
 * Timing data sources (in priority order):
 *   - gotestsum.json (JSONL): per-test elapsed times from previous run
 *   - prev-report.xml (JUnit XML): package-level timing (fallback)
 *   - Round-robin: when no timing data exists at all
 *
 * Assignment algorithm: greedy bin-packing (sort by duration desc, assign
 * each item to the shard with lowest current load). Simple and effective
 * for our distribution where 2 packages dominate 84% of runtime.
 *
 * Environment variables:
 *   SHARD_INDEX  — this runner's index (0-based)
 *   SHARD_TOTAL  — total number of shards
 *
 * Input files (in working directory):
 *   all-packages.txt      — newline-separated list of all test packages
 *   prev-gotestsum.json   — (optional) JSONL timing data from previous run
 *   prev-report.xml       — (optional) JUnit XML from previous run
 *
 * Output files (in working directory):
 *   shard-te-packages.txt   — space-separated TE packages for this shard
 *   shard-ee-packages.txt   — space-separated EE packages for this shard
 *   shard-heavy-runs.txt    — heavy package runs, one per line: "pkg REGEX"
 */

const fs = require("node:fs");
const { execSync } = require("node:child_process");

const SHARD_INDEX = parseInt(process.env.SHARD_INDEX);
const SHARD_TOTAL = parseInt(process.env.SHARD_TOTAL);
const HEAVY_MS = 300000; // 5 min: packages above this get test-level splitting
// Only api4 (~38 min) and app (~15 min) exceed this threshold.
// Packages like sqlstore (~3 min) stay whole to preserve test isolation —
// their integrity tests scan the entire database and break if split across
// shards where other tests leave data behind.

if (isNaN(SHARD_INDEX) || isNaN(SHARD_TOTAL) || SHARD_TOTAL < 1) {
  console.error("ERROR: SHARD_INDEX and SHARD_TOTAL must be set");
  process.exit(1);
}

const allPkgs = fs.readFileSync("all-packages.txt", "utf8").trim().split("\n").filter(Boolean);
if (allPkgs.length === 0) {
  console.error("WARNING: No test packages found in all-packages.txt");
  process.exit(0);
}

const pkgTimes = {};
const testTimes = {}; // "pkg::TestName" -> ms

// ── Parse gotestsum.json (JSONL) for per-test timing ──
// Each line is a JSON event; we want "pass" events with Elapsed times.
if (fs.existsSync("prev-gotestsum.json")) {
  console.log("::group::Parsing gotestsum.json timing data");
  const lines = fs.readFileSync("prev-gotestsum.json", "utf8").split("\n");
  for (const line of lines) {
    if (!line.includes('"pass"')) continue;
    try {
      const d = JSON.parse(line);
      if (!d.Test || !d.Package) continue;
      const elapsed = Math.round((d.Elapsed || 0) * 1000);
      // Aggregate package time from test pass events
      pkgTimes[d.Package] = (pkgTimes[d.Package] || 0) + elapsed;
      // Top-level test name (use max elapsed for parent vs subtests)
      const top = d.Test.split("/")[0];
      const key = d.Package + "::" + top;
      testTimes[key] = Math.max(testTimes[key] || 0, elapsed);
    } catch (e) {
      // Skip malformed lines
    }
  }
  console.log(
    `gotestsum.json: ${Object.keys(pkgTimes).length} packages, ${Object.keys(testTimes).length} tests`
  );
  console.log("::endgroup::");
}

// ── Fallback: parse JUnit XML for package-level timing ──
if (Object.keys(pkgTimes).length === 0 && fs.existsSync("prev-report.xml")) {
  console.log("::group::Parsing JUnit XML timing data (fallback)");
  const xml = fs.readFileSync("prev-report.xml", "utf8");
  for (const m of xml.matchAll(/<testsuite[^>]*>/g)) {
    const name = m[0].match(/name="([^"]+)"/)?.[1];
    const time = m[0].match(/\btime="([^"]+)"/)?.[1];
    if (name && time) {
      pkgTimes[name] = (pkgTimes[name] || 0) + Math.round(parseFloat(time) * 1000);
    }
  }
  console.log(`JUnit XML: ${Object.keys(pkgTimes).length} packages (no per-test data)`);
  console.log("::endgroup::");
}

const hasTimingData = Object.keys(pkgTimes).length > 0;
const hasTestTiming = Object.keys(testTimes).length > 0;

// ── Identify heavy packages ──
// Only split at test level if we have per-test timing data
const heavyPkgs = new Set();
if (hasTestTiming) {
  for (const [pkg, ms] of Object.entries(pkgTimes)) {
    if (ms > HEAVY_MS) heavyPkgs.add(pkg);
  }
}
if (heavyPkgs.size > 0) {
  console.log("Heavy packages (test-level splitting):");
  for (const p of heavyPkgs) {
    console.log(`  ${(pkgTimes[p] / 1000).toFixed(0)}s  ${p.split("/").pop()}`);
  }
}

// ── Build work items ──
// Each item is either a whole package ("P") or a single test from a heavy package ("T")
const items = [];
for (const pkg of allPkgs) {
  if (heavyPkgs.has(pkg)) {
    // Split into individual test items
    const tests = Object.entries(testTimes)
      .filter(([k]) => k.startsWith(pkg + "::"))
      .map(([k, ms]) => ({ ms, type: "T", pkg, test: k.split("::")[1] }));
    if (tests.length > 0) {
      items.push(...tests);
    } else {
      // Shouldn't happen, but fall back to whole package
      items.push({ ms: pkgTimes[pkg] || 1, type: "P", pkg });
    }
  } else {
    items.push({ ms: pkgTimes[pkg] || 1, type: "P", pkg });
  }
}
// ── Discover new/renamed tests in heavy packages ──
// Tests not in the timing cache won't appear in any shard's -run regex,
// silently skipping them. Discover current test names at runtime and
// assign any cache-missing tests to the least-loaded shard.
if (heavyPkgs.size > 0) {
  console.log("::group::Discovering new tests in heavy packages");
  for (const pkg of heavyPkgs) {
    const cachedTests = new Set(
      Object.keys(testTimes)
        .filter((k) => k.startsWith(pkg + "::"))
        .map((k) => k.split("::")[1])
    );
    try {
      const out = execSync(`go test -list '.*' ${pkg} 2>/dev/null`, {
        encoding: "utf8",
        timeout: 300000,
      });
      const currentTests = out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^Test[A-Z]/.test(l));
      let newCount = 0;
      for (const t of currentTests) {
        if (!cachedTests.has(t)) {
          // Assign a small default duration so it gets picked up
          items.push({ ms: 1000, type: "T", pkg, test: t });
          newCount++;
        }
      }
      if (newCount > 0) {
        console.log(`  ${pkg.split("/").pop()}: ${newCount} new test(s) not in cache`);
      }
    } catch (e) {
      console.error(`::error::${pkg.split("/").pop()}: go test -list failed — new tests in this package would be silently skipped. ${e.message}`);
      // Fail loudly in CI; locally (e.g. unit tests without a Go toolchain), log and continue.
      if (process.env.CI) process.exit(1);
    }
  }
  console.log("::endgroup::");
}

// Sort descending by duration for greedy bin-packing
items.sort((a, b) => b.ms - a.ms);

// ── Greedy bin-packing assignment ──
const shards = Array.from({ length: SHARD_TOTAL }, () => ({
  load: 0,
  whole: [],
  heavy: {},
}));

if (!hasTimingData) {
  // Round-robin fallback when no timing data exists
  console.log("No timing data — using round-robin");
  allPkgs.forEach((pkg, i) => {
    shards[i % SHARD_TOTAL].whole.push(pkg);
  });
} else {
  for (const item of items) {
    // Find shard with minimum current load
    const min = shards.reduce((m, s, i) => (s.load < shards[m].load ? i : m), 0);
    shards[min].load += item.ms;
    if (item.type === "P") {
      shards[min].whole.push(item.pkg);
    } else {
      if (!shards[min].heavy[item.pkg]) shards[min].heavy[item.pkg] = [];
      shards[min].heavy[item.pkg].push(item.test);
    }
  }
}

// ── Report shard assignments ──
console.log("::group::Shard assignment");
for (let i = 0; i < SHARD_TOTAL; i++) {
  const s = shards[i];
  const hRuns = Object.keys(s.heavy).length;
  const hTests = Object.values(s.heavy).reduce((n, a) => n + a.length, 0);
  const marker = i === SHARD_INDEX ? " ← THIS SHARD" : "";
  console.log(
    `Shard ${i}: ${(s.load / 1000).toFixed(1)}s | ${s.whole.length} pkgs` +
      (hRuns > 0 ? `, ${hRuns} heavy splits (${hTests} tests)` : "") +
      marker
  );
}
console.log("::endgroup::");

// ── Write output for this shard ──
const myShard = shards[SHARD_INDEX];
const te = myShard.whole.filter((p) => !p.includes("/enterprise/")).join(" ");
const ee = myShard.whole.filter((p) => p.includes("/enterprise/")).join(" ");

fs.writeFileSync("shard-te-packages.txt", te);
fs.writeFileSync("shard-ee-packages.txt", ee);

// Heavy package runs: one line per run as "pkg REGEX"
const heavyRuns = Object.entries(myShard.heavy).map(([pkg, tests]) => {
  const regex = tests.map((t) => "^" + t + "$").join("|");
  return pkg + " " + regex;
});
fs.writeFileSync("shard-heavy-runs.txt", heavyRuns.join("\n"));

console.log(
  `Light packages: ${myShard.whole.length} (${te.split(" ").filter(Boolean).length} TE, ${ee.split(" ").filter(Boolean).length} EE)`
);
console.log(`Heavy package runs: ${heavyRuns.length}`);
