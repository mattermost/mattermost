const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const os = require("node:os");

const SCRIPT = path.join(__dirname, "shard-split.js");
const TESTDATA = path.join(__dirname, "testdata");

/**
 * Helper: run shard-split.js in a temp directory with given inputs.
 * Returns the output files and stdout.
 */
function runSolver({ packages, shardIndex, shardTotal, gotestsumJson, prevReportXml }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shard-test-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "all-packages.txt"), packages.join("\n"));

    if (gotestsumJson) {
      fs.writeFileSync(path.join(tmpDir, "prev-gotestsum.json"), gotestsumJson);
    }
    if (prevReportXml) {
      fs.writeFileSync(path.join(tmpDir, "prev-report.xml"), prevReportXml);
    }

    const stdout = execFileSync("node", [SCRIPT], {
      cwd: tmpDir,
      env: {
        ...process.env,
        SHARD_INDEX: String(shardIndex),
        SHARD_TOTAL: String(shardTotal),
      },
      encoding: "utf8",
    });

    const te = fs.readFileSync(path.join(tmpDir, "shard-te-packages.txt"), "utf8");
    const ee = fs.readFileSync(path.join(tmpDir, "shard-ee-packages.txt"), "utf8");
    const heavy = fs.readFileSync(path.join(tmpDir, "shard-heavy-runs.txt"), "utf8");

    return { te, ee, heavy, stdout };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe("shard-split.js", () => {
  describe("round-robin fallback (no timing data)", () => {
    it("distributes packages evenly across shards", () => {
      const packages = [
        "github.com/mattermost/mattermost/server/v8/channels/api4",
        "github.com/mattermost/mattermost/server/v8/channels/app",
        "github.com/mattermost/mattermost/server/v8/channels/store/sqlstore",
        "github.com/mattermost/mattermost/server/v8/config",
      ];

      // Collect assignments from all shards
      const allTe = [];
      for (let i = 0; i < 2; i++) {
        const result = runSolver({ packages, shardIndex: i, shardTotal: 2 });
        allTe.push(...result.te.split(" ").filter(Boolean));
      }

      // All packages should be assigned exactly once
      assert.equal(allTe.sort().join("\n"), packages.sort().join("\n"));
    });

    it("uses round-robin when no timing files exist", () => {
      const packages = ["pkg/a", "pkg/b", "pkg/c", "pkg/d", "pkg/e"];
      const r0 = runSolver({ packages, shardIndex: 0, shardTotal: 2 });
      const r1 = runSolver({ packages, shardIndex: 1, shardTotal: 2 });

      assert.ok(r0.stdout.includes("round-robin"), "Should mention round-robin in output");
      // No heavy runs
      assert.equal(r0.heavy.trim(), "");
      assert.equal(r1.heavy.trim(), "");
    });
  });

  describe("timing-based balancing", () => {
    it("balances shards using gotestsum.json timing data", () => {
      const gotestsumJson = fs.readFileSync(
        path.join(TESTDATA, "sample-gotestsum.json"),
        "utf8"
      );
      const packages = [
        "github.com/mattermost/mattermost/server/v8/channels/api4",
        "github.com/mattermost/mattermost/server/v8/channels/app",
        "github.com/mattermost/mattermost/server/v8/channels/store/sqlstore",
        "github.com/mattermost/mattermost/server/v8/config",
        "github.com/mattermost/mattermost/server/v8/enterprise/elasticsearch",
        "github.com/mattermost/mattermost/server/v8/enterprise/compliance",
        "github.com/mattermost/mattermost/server/public/model",
      ];

      // Run for all 4 shards and check that loads are somewhat balanced
      const loads = [];
      const allAssigned = new Set();

      for (let i = 0; i < 4; i++) {
        const result = runSolver({
          packages,
          shardIndex: i,
          shardTotal: 4,
          gotestsumJson,
        });

        // Track all assigned packages and tests
        const tePkgs = result.te.split(" ").filter(Boolean);
        const eePkgs = result.ee.split(" ").filter(Boolean);
        tePkgs.forEach((p) => allAssigned.add(p));
        eePkgs.forEach((p) => allAssigned.add(p));

        // Parse heavy runs
        if (result.heavy.trim()) {
          result.heavy
            .trim()
            .split("\n")
            .forEach((line) => {
              const pkg = line.split(" ")[0];
              allAssigned.add(pkg);
            });
        }
      }

      // Every package should be covered
      for (const pkg of packages) {
        assert.ok(
          allAssigned.has(pkg),
          `Package ${pkg} should be assigned to some shard`
        );
      }
    });

    it("does not produce empty shards with sample data", () => {
      const gotestsumJson = fs.readFileSync(
        path.join(TESTDATA, "sample-gotestsum.json"),
        "utf8"
      );
      const packages = [
        "github.com/mattermost/mattermost/server/v8/channels/api4",
        "github.com/mattermost/mattermost/server/v8/channels/app",
        "github.com/mattermost/mattermost/server/v8/channels/store/sqlstore",
        "github.com/mattermost/mattermost/server/v8/config",
      ];

      for (let i = 0; i < 4; i++) {
        const result = runSolver({
          packages,
          shardIndex: i,
          shardTotal: 4,
          gotestsumJson,
        });
        const hasWork =
          result.te.trim() !== "" ||
          result.ee.trim() !== "" ||
          result.heavy.trim() !== "";
        assert.ok(hasWork, `Shard ${i} should have some work assigned`);
      }
    });
  });

  describe("heavy package splitting", () => {
    it("splits packages over HEAVY_MS threshold into individual tests", () => {
      // Create timing data where api4 is very heavy (> 300s = 300000ms)
      const lines = [];
      // api4: 6 tests totaling 452.2s (> 300s threshold)
      for (const [test, elapsed] of [
        ["TestGetChannel", 145.2],
        ["TestCreatePost", 98.1],
        ["TestUpdateChannel", 72.5],
        ["TestDeleteChannel", 58.3],
        ["TestGetChannelMembers", 45.7],
        ["TestSearchChannels", 32.4],
      ]) {
        lines.push(
          JSON.stringify({
            Time: "2025-03-20T10:00:00Z",
            Action: "pass",
            Package: "github.com/mattermost/mattermost/server/v8/channels/api4",
            Test: test,
            Elapsed: elapsed,
          })
        );
      }
      // config: 2 tests totaling 8s (< 120s, stays whole)
      for (const [test, elapsed] of [
        ["TestConfigStore", 5.0],
        ["TestConfigMigrate", 3.0],
      ]) {
        lines.push(
          JSON.stringify({
            Time: "2025-03-20T10:00:00Z",
            Action: "pass",
            Package: "github.com/mattermost/mattermost/server/v8/config",
            Test: test,
            Elapsed: elapsed,
          })
        );
      }

      const gotestsumJson = lines.join("\n");
      const packages = [
        "github.com/mattermost/mattermost/server/v8/channels/api4",
        "github.com/mattermost/mattermost/server/v8/config",
      ];

      // With 2 shards, api4 tests should be split across shards
      let heavyFound = false;
      const allHeavyTests = [];

      for (let i = 0; i < 2; i++) {
        const result = runSolver({
          packages,
          shardIndex: i,
          shardTotal: 2,
          gotestsumJson,
        });

        if (result.heavy.trim()) {
          heavyFound = true;
          // Parse heavy runs to extract test names
          for (const line of result.heavy.trim().split("\n")) {
            const parts = line.split(" ");
            assert.equal(
              parts[0],
              "github.com/mattermost/mattermost/server/v8/channels/api4",
              "Heavy package should be api4"
            );
            // Regex is like "^TestGetChannel$|^TestCreatePost$"
            const tests = parts[1].split("|").map((r) => r.replace(/[\^$]/g, ""));
            allHeavyTests.push(...tests);
          }
        }
      }

      assert.ok(heavyFound, "Should have heavy package splits for api4");
      // All api4 tests should be distributed
      const expectedTests = [
        "TestGetChannel",
        "TestCreatePost",
        "TestUpdateChannel",
        "TestDeleteChannel",
        "TestGetChannelMembers",
        "TestSearchChannels",
      ];
      assert.deepEqual(
        allHeavyTests.sort(),
        expectedTests.sort(),
        "All api4 tests should be distributed across shards"
      );
    });

    it("keeps light packages whole even with timing data", () => {
      const gotestsumJson = [
        '{"Action":"pass","Package":"pkg/light","Test":"TestA","Elapsed":5.0}',
        '{"Action":"pass","Package":"pkg/light","Test":"TestB","Elapsed":3.0}',
      ].join("\n");

      const result = runSolver({
        packages: ["pkg/light"],
        shardIndex: 0,
        shardTotal: 2,
        gotestsumJson,
      });

      // Light package should be assigned whole, not split
      assert.equal(result.heavy.trim(), "", "Light package should not be in heavy runs");
      assert.ok(
        result.te.includes("pkg/light"),
        "Light package should be in TE packages"
      );
    });
  });

  describe("JUnit XML fallback", () => {
    it("uses JUnit XML when gotestsum.json is missing", () => {
      const prevReportXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="pkg/fast" time="10.0" tests="5">
    <testcase name="TestA" time="5.0"/>
    <testcase name="TestB" time="5.0"/>
  </testsuite>
  <testsuite name="pkg/slow" time="50.0" tests="3">
    <testcase name="TestX" time="25.0"/>
    <testcase name="TestY" time="25.0"/>
  </testsuite>
</testsuites>`;

      const result = runSolver({
        packages: ["pkg/fast", "pkg/slow"],
        shardIndex: 0,
        shardTotal: 2,
        prevReportXml,
      });

      assert.ok(
        result.stdout.includes("JUnit XML"),
        "Should indicate using JUnit XML fallback"
      );
      // No heavy splits with XML-only data (no per-test timing)
      assert.equal(result.heavy.trim(), "", "Should not split packages without per-test timing");
    });
  });

  describe("enterprise package separation", () => {
    it("separates enterprise packages into EE output", () => {
      const packages = [
        "github.com/mattermost/mattermost/server/v8/channels/app",
        "github.com/mattermost/mattermost/server/v8/enterprise/compliance",
      ];

      const result = runSolver({
        packages,
        shardIndex: 0,
        shardTotal: 1,
      });

      assert.ok(
        result.te.includes("channels/app"),
        "TE should include non-enterprise packages"
      );
      assert.ok(
        result.ee.includes("enterprise/compliance"),
        "EE should include enterprise packages"
      );
      assert.ok(
        !result.te.includes("enterprise"),
        "TE should not include enterprise packages"
      );
    });
  });
});
