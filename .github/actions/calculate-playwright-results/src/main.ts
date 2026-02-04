import * as core from "@actions/core";
import * as fs from "fs/promises";
import type { PlaywrightResults } from "./types";
import { mergeResults, calculateResults } from "./merge";

export async function run(): Promise<void> {
    const originalPath = core.getInput("original-results-path", {
        required: true,
    });
    const retestPath = core.getInput("retest-results-path"); // Optional
    const outputPath = core.getInput("output-path") || originalPath;

    core.info(`Original results: ${originalPath}`);
    core.info(`Retest results: ${retestPath || "(not provided)"}`);
    core.info(`Output path: ${outputPath}`);

    // Check if original file exists
    const originalExists = await fs
        .access(originalPath)
        .then(() => true)
        .catch(() => false);

    if (!originalExists) {
        core.setFailed(`Original results not found at ${originalPath}`);
        return;
    }

    // Read original file
    core.info("Reading original results...");
    const originalContent = await fs.readFile(originalPath, "utf8");
    const original: PlaywrightResults = JSON.parse(originalContent);

    core.info(
        `Original: ${original.suites.length} suites, stats: ${JSON.stringify(original.stats)}`,
    );

    // Check if retest path is provided and exists
    let finalResults: PlaywrightResults;
    let merged = false;

    if (retestPath) {
        const retestExists = await fs
            .access(retestPath)
            .then(() => true)
            .catch(() => false);

        if (retestExists) {
            // Read retest file and merge
            core.info("Reading retest results...");
            const retestContent = await fs.readFile(retestPath, "utf8");
            const retest: PlaywrightResults = JSON.parse(retestContent);

            core.info(
                `Retest: ${retest.suites.length} suites, stats: ${JSON.stringify(retest.stats)}`,
            );

            // Merge results
            core.info("Merging results at suite level...");
            const mergeResult = mergeResults(original, retest);
            finalResults = mergeResult.merged;
            merged = true;

            core.info(`Retested specs: ${mergeResult.retestFiles.join(", ")}`);
            core.info(
                `Kept ${original.suites.length - mergeResult.retestFiles.length} original suites`,
            );
            core.info(`Added ${retest.suites.length} retest suites`);
            core.info(`Total merged suites: ${mergeResult.totalSuites}`);

            // Write merged results
            core.info(`Writing merged results to ${outputPath}...`);
            await fs.writeFile(
                outputPath,
                JSON.stringify(finalResults, null, 2),
            );
        } else {
            core.warning(
                `Retest results not found at ${retestPath}, using original only`,
            );
            finalResults = original;
        }
    } else {
        core.info("No retest path provided, using original results only");
        finalResults = original;
    }

    // Calculate all outputs from final results
    const calc = calculateResults(finalResults);

    // Log results
    core.startGroup("Final Results");
    core.info(`Passed: ${calc.passed}`);
    core.info(`Failed: ${calc.failed}`);
    core.info(`Flaky: ${calc.flaky}`);
    core.info(`Skipped: ${calc.skipped}`);
    core.info(`Passing (passed + flaky): ${calc.passing}`);
    core.info(`Total: ${calc.total}`);
    core.info(`Pass Rate: ${calc.passRate}%`);
    core.info(`Color: ${calc.color}`);
    core.info(`Spec Files: ${calc.totalSpecs}`);
    core.info(`Failed Specs Count: ${calc.failedSpecsCount}`);
    core.info(`Commit Status Message: ${calc.commitStatusMessage}`);
    core.info(`Failed Specs: ${calc.failedSpecs || "none"}`);
    core.endGroup();

    // Set all outputs
    core.setOutput("merged", merged.toString());
    core.setOutput("passed", calc.passed);
    core.setOutput("failed", calc.failed);
    core.setOutput("flaky", calc.flaky);
    core.setOutput("skipped", calc.skipped);
    core.setOutput("total_specs", calc.totalSpecs);
    core.setOutput("commit_status_message", calc.commitStatusMessage);
    core.setOutput("failed_specs", calc.failedSpecs);
    core.setOutput("failed_specs_count", calc.failedSpecsCount);
    core.setOutput("failed_tests", calc.failedTests);
    core.setOutput("total", calc.total);
    core.setOutput("pass_rate", calc.passRate);
    core.setOutput("passing", calc.passing);
    core.setOutput("color", calc.color);
}
