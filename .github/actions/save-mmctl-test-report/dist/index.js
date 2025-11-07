"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  run: () => run
});
module.exports = __toCommonJS(index_exports);
var core2 = __toESM(require("@actions/core"));

// src/main.ts
var core = __toESM(require("@actions/core"));
var fs = __toESM(require("fs/promises"));
var import_fast_xml_parser = require("fast-xml-parser");
var reTestKey = /MM-T\d+/;
var zephyrCloudApiUrl = "https://api.zephyrscale.smartbear.com/v2";
function newTestExecution(testCaseKey, statusName, executionTime, comment) {
  return {
    testCaseKey,
    statusName,
    // Pass or Fail
    executionTime,
    comment
  };
}
async function getTestData(xmlFile, config) {
  const testCycle = {
    projectKey: config.projectKey,
    name: `mmctl: E2E Tests with ${config.branch}, ${config.buildImage}, ${config.buildNumber}`,
    description: "",
    statusName: "Done",
    folderId: config.zephyrFolderId
  };
  const testExecutions = [];
  const data = await fs.readFile(xmlFile, "utf8");
  const parser = new import_fast_xml_parser.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });
  const result = parser.parse(data);
  let totalTests = 0;
  let totalFailures = 0;
  let totalTime = 0;
  let earliestTimestamp = null;
  let latestTimestamp = null;
  if (result?.testsuites?.testsuite) {
    const testsuites = Array.isArray(result.testsuites.testsuite) ? result.testsuites.testsuite : [result.testsuites.testsuite];
    for (const testsuite of testsuites) {
      const tests = parseInt(testsuite["@_tests"] || "0", 10);
      const failures = parseInt(testsuite["@_failures"] || "0", 10);
      const time = parseFloat(testsuite["@_time"] || "0");
      totalTests += tests;
      totalFailures += failures;
      totalTime += time;
      const timestamp = testsuite["@_timestamp"];
      if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          if (!earliestTimestamp || date < earliestTimestamp) {
            earliestTimestamp = date;
          }
          if (!latestTimestamp || date > latestTimestamp) {
            latestTimestamp = date;
          }
        }
      }
      if (testsuite?.testcase) {
        const testcases = Array.isArray(testsuite.testcase) ? testsuite.testcase : [testsuite.testcase];
        for (const testcase of testcases) {
          const testName = testcase["@_name"];
          const testTime = testcase["@_time"] || 0;
          const hasFailure = testcase.failure !== void 0;
          if (testName) {
            const match = testName.match(reTestKey);
            if (match !== null) {
              const testKey = match[0];
              testCycle.description += `* ${testKey} - ${testTime}s
`;
              testExecutions.push(
                newTestExecution(
                  testKey,
                  hasFailure ? "Fail" : "Pass",
                  parseFloat(testTime),
                  testName
                )
              );
            }
          }
        }
      }
    }
  }
  const passedTests = totalTests - totalFailures;
  const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : "0";
  testCycle.description = `### Test Summary

`;
  testCycle.description += `**${passedTests}** passed | `;
  testCycle.description += `**${totalFailures}** failed | `;
  testCycle.description += `**${passRate}%** pass rate | `;
  testCycle.description += `**${totalTime.toFixed(1)}s** duration

`;
  if (config.githubRunUrl) {
    testCycle.description += `[View GitHub Pipeline](${config.githubRunUrl})

`;
  }
  testCycle.description += `---

`;
  testCycle.description += `**Build Details:**
`;
  testCycle.description += `* Branch: ${config.branch}
`;
  testCycle.description += `* Build Image: ${config.buildImage}
`;
  testCycle.description += `* Build Number: ${config.buildNumber}
`;
  if (earliestTimestamp) {
    testCycle.plannedStartDate = earliestTimestamp.toISOString();
    if (latestTimestamp && latestTimestamp > earliestTimestamp) {
      testCycle.plannedEndDate = latestTimestamp.toISOString();
    } else {
      const endDate = new Date(
        earliestTimestamp.getTime() + totalTime * 1e3
      );
      testCycle.plannedEndDate = endDate.toISOString();
    }
  }
  return {
    testCycle,
    testExecutions,
    xmlStats: {
      totalTests,
      totalFailures,
      totalPassed: passedTests,
      passRate,
      totalTime
    }
  };
}
async function saveMmctlReport() {
  const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "unknown";
  const githubRepository = process.env.GITHUB_REPOSITORY || "";
  const githubRunId = process.env.GITHUB_RUN_ID || "";
  const githubRunUrl = githubRepository && githubRunId ? `https://github.com/${githubRepository}/actions/runs/${githubRunId}` : void 0;
  const buildNumber = `${branch}-${githubRunId}`;
  const reportPath = core.getInput("report-path", { required: true });
  const buildImage = core.getInput("build-image", { required: true });
  const zephyrApiKey = core.getInput("zephyr-api-key", { required: true });
  const zephyrFolderId = parseInt(
    core.getInput("zephyr-folder-id") || "27504432",
    10
  );
  const projectKey = core.getInput("jira-project-key") || "MM";
  if (!reportPath) {
    throw new Error("report-path is required");
  }
  if (!buildImage) {
    throw new Error("build-image is required");
  }
  if (!zephyrApiKey) {
    throw new Error("zephyr-api-key is required");
  }
  core.info(`Reading report file from: ${reportPath}`);
  const { testCycle, testExecutions, xmlStats } = await getTestData(
    reportPath,
    {
      projectKey,
      zephyrFolderId,
      branch,
      buildImage,
      buildNumber,
      githubRunUrl
    }
  );
  core.info(`Test Cycle: ${testCycle.name}`);
  core.info(
    `Total tests in XML Report: ${xmlStats.totalTests} (${xmlStats.totalPassed} passed, ${xmlStats.totalFailures} failed)`
  );
  core.info(`MM-T test cases extracted: ${testExecutions.length}`);
  const createCycleResponse = await fetch(`${zephyrCloudApiUrl}/testcycles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${zephyrApiKey}`,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(testCycle)
  });
  if (!createCycleResponse.ok) {
    const errorDetails = await createCycleResponse.json();
    core.error(
      `Failed to create test cycle: ${JSON.stringify(errorDetails)}`
    );
    throw new Error(`HTTP error! Status: ${createCycleResponse.status}`);
  }
  const createdTestCycle = await createCycleResponse.json();
  core.info(`Created test cycle: ${createdTestCycle.key}`);
  core.setOutput("test-cycle-key", createdTestCycle.key);
  async function saveTestExecution(testExecution, retries = 3) {
    testExecution.projectKey = projectKey;
    testExecution.testCycleKey = createdTestCycle.key;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(
          `${zephyrCloudApiUrl}/testexecutions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${zephyrApiKey}`,
              "Content-Type": "application/json; charset=utf-8"
            },
            body: JSON.stringify(testExecution)
          }
        );
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorBody}`);
        }
        await response.json();
        return;
      } catch (error2) {
        const errorMsg = error2 instanceof Error ? error2.message : String(error2);
        core.warning(
          `Error saving test execution for ${testExecution.testCaseKey} (attempt ${attempt}/${retries}): ${errorMsg}`
        );
        if (attempt === retries) {
          throw new Error(
            `Failed after ${retries} attempts: ${errorMsg}`
          );
        }
        const delay = 1e3 * attempt;
        core.info(
          `Retrying ${testExecution.testCaseKey} in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  const promises = testExecutions.map(
    (testExecution) => saveTestExecution(testExecution).then(() => ({
      success: true,
      testCaseKey: testExecution.testCaseKey
    })).catch((error2) => ({
      success: false,
      testCaseKey: testExecution.testCaseKey,
      error: error2.message
    }))
  );
  const results = await Promise.all(promises);
  let successCount = 0;
  let failureCount = 0;
  const savedTestKeys = [];
  const failedTestKeys = [];
  results.forEach((result) => {
    if (result.success) {
      successCount++;
      savedTestKeys.push(result.testCaseKey);
    } else {
      failureCount++;
      failedTestKeys.push(result.testCaseKey);
      const error2 = "error" in result ? result.error : "Unknown error";
      core.warning(
        `Test execution failed for ${result.testCaseKey}: ${error2}`
      );
    }
  });
  const uniqueSavedTestKeys = new Set(savedTestKeys);
  const uniqueFailedTestKeys = new Set(failedTestKeys);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary2 = core.summary.addHeading("mmctl Test Report", 2).addHeading("XML Report Summary (All Tests)", 3).addRaw(`**Total Tests:** ${xmlStats.totalTests}

`).addRaw(`**Passed:** ${xmlStats.totalPassed}

`).addRaw(`**Failed:** ${xmlStats.totalFailures}

`).addRaw(`**Pass Rate:** ${xmlStats.passRate}%

`).addRaw(`**Duration:** ${xmlStats.totalTime.toFixed(1)}s

`).addRaw(`**Branch:** ${branch}

`).addRaw(`**Build Image:** ${buildImage}

`).addRaw(`**Build Number:** ${buildNumber}

`).addHeading("Zephyr Scale Results", 3).addRaw(
      `**Test Cycle:** ${createdTestCycle.key} ${testCycle.name}

`
    ).addRaw(
      `**MM-T test cases extracted:** ${testExecutions.length}

`
    ).addRaw(
      `**Successfully saved:** ${successCount} executions (${uniqueSavedTestKeys.size} unique test keys)

`
    ).addRaw(
      `**Failed to save:** ${failureCount} executions (${uniqueFailedTestKeys.size} unique test keys)

`
    ).addLink(
      "View in Zephyr Scale",
      `https://mattermost.atlassian.net/projects/${projectKey}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCycle/${createdTestCycle.key}`
    );
    if (savedTestKeys.length > 0) {
      summary2.addHeading("Saved Test Cases (Details)", 4).addRaw(`**Total Executions:** ${savedTestKeys.length}

`).addRaw(`**Unique Test Keys:** ${uniqueSavedTestKeys.size}

`).addRaw(
        `<details>
<summary>View all saved test keys</summary>

`
      ).addRaw(
        savedTestKeys.map((key) => `- ${key}`).join("\n") + "\n\n"
      ).addRaw(`</details>

`);
    }
    if (failedTestKeys.length > 0) {
      summary2.addHeading("Failed Test Cases (Details)", 4).addRaw(`**Total Executions:** ${failedTestKeys.length}

`).addRaw(
        `**Unique Test Keys:** ${uniqueFailedTestKeys.size}

`
      ).addRaw(
        `<details>
<summary>View all failed test keys</summary>

`
      ).addRaw(
        failedTestKeys.map((key) => `- ${key}`).join("\n") + "\n\n"
      ).addRaw(`</details>

`);
    }
    await summary2.write();
  } else {
    core.info("=== XML Report Summary (All Tests) ===");
    core.info(`Total Tests: ${xmlStats.totalTests}`);
    core.info(`Passed: ${xmlStats.totalPassed}`);
    core.info(`Failed: ${xmlStats.totalFailures}`);
    core.info(`Pass Rate: ${xmlStats.passRate}%`);
    core.info(`Duration: ${xmlStats.totalTime.toFixed(1)}s`);
    core.info(`Branch: ${branch}`);
    core.info(`Build Image: ${buildImage}`);
    core.info(`Build Number: ${buildNumber}`);
    core.info("");
    core.info("=== Zephyr Scale Results ===");
    core.info(`Test Cycle Key: ${createdTestCycle.key}`);
    core.info(`Test Cycle Name: ${testCycle.name}`);
    core.info(`MM-T Test Cases Extracted: ${testExecutions.length}`);
    core.info(
      `Successfully Saved: ${successCount} executions (${uniqueSavedTestKeys.size} unique test keys)`
    );
    core.info(
      `Failed to Save: ${failureCount} executions (${uniqueFailedTestKeys.size} unique test keys)`
    );
    core.info("");
    core.info(
      `View in Zephyr: https://mattermost.atlassian.net/projects/${projectKey}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCycle/${createdTestCycle.key}`
    );
    core.info("");
    core.info(
      `Saved Test Keys (${savedTestKeys.length} total, ${uniqueSavedTestKeys.size} unique): ${savedTestKeys.join(", ")}`
    );
    if (failedTestKeys.length > 0) {
      core.info(
        `Failed Test Keys (${failedTestKeys.length} total, ${uniqueFailedTestKeys.size} unique): ${failedTestKeys.join(", ")}`
      );
    }
  }
  core.setOutput("test-cycle-key", createdTestCycle.key);
  core.setOutput("test-cycle-success-count", successCount.toString());
  core.setOutput("test-cycle-failure-count", failureCount.toString());
  core.setOutput("xml-total-tests", xmlStats.totalTests.toString());
  core.setOutput("xml-total-passed", xmlStats.totalPassed.toString());
  core.setOutput("xml-total-failed", xmlStats.totalFailures.toString());
  core.setOutput("xml-pass-rate", xmlStats.passRate);
  core.setOutput("xml-duration", xmlStats.totalTime.toFixed(1));
  core.setOutput("unique-saved-keys", uniqueSavedTestKeys.size.toString());
  core.setOutput("unique-failed-keys", uniqueFailedTestKeys.size.toString());
}

// src/index.ts
async function run() {
  try {
    core2.info("Saving mmctl test report...");
    await saveMmctlReport();
    core2.info("Successfully saved mmctl test report!");
  } catch (err) {
    core2.setFailed(`Action failed with error ${err}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
