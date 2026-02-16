import * as core from "@actions/core";
import {
    loadSpecFiles,
    mergeResults,
    writeMergedResults,
    calculateResultsFromSpecs,
} from "./merge";

export async function run(): Promise<void> {
    const originalPath = core.getInput("original-results-path", {
        required: true,
    });
    const retestPath = core.getInput("retest-results-path"); // Optional
    const shouldWriteMerged = core.getInput("write-merged") !== "false"; // Default true

    core.info(`Original results: ${originalPath}`);
    core.info(`Retest results: ${retestPath || "(not provided)"}`);

    let merged = false;
    let specs;

    if (retestPath) {
        // Check if retest path has results
        const retestSpecs = await loadSpecFiles(retestPath);

        if (retestSpecs.length > 0) {
            core.info(`Found ${retestSpecs.length} retest spec files`);

            // Merge results
            core.info("Merging results...");
            const mergeResult = await mergeResults(originalPath, retestPath);
            specs = mergeResult.specs;
            merged = true;

            core.info(`Retested specs: ${mergeResult.retestFiles.join(", ")}`);
            core.info(`Total merged specs: ${specs.length}`);

            // Write merged results back to original directory
            if (shouldWriteMerged) {
                core.info("Writing merged results to original directory...");
                const writeResult = await writeMergedResults(
                    originalPath,
                    retestPath,
                );
                core.info(`Updated files: ${writeResult.updatedFiles.length}`);
                core.info(
                    `Removed duplicates: ${writeResult.removedFiles.length}`,
                );
            }
        } else {
            core.warning(
                `No retest results found at ${retestPath}, using original only`,
            );
            specs = await loadSpecFiles(originalPath);
        }
    } else {
        core.info("No retest path provided, using original results only");
        specs = await loadSpecFiles(originalPath);
    }

    core.info(`Calculating results from ${specs.length} spec files...`);

    // Handle case where no results found
    if (specs.length === 0) {
        core.setFailed("No Cypress test results found");
        return;
    }

    // Calculate all outputs from final results
    const calc = calculateResultsFromSpecs(specs);

    // Log results
    core.startGroup("Final Results");
    core.info(`Passed: ${calc.passed}`);
    core.info(`Failed: ${calc.failed}`);
    core.info(`Pending: ${calc.pending}`);
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
    core.setOutput("pending", calc.pending);
    core.setOutput("total_specs", calc.totalSpecs);
    core.setOutput("commit_status_message", calc.commitStatusMessage);
    core.setOutput("failed_specs", calc.failedSpecs);
    core.setOutput("failed_specs_count", calc.failedSpecsCount);
    core.setOutput("failed_tests", calc.failedTests);
    core.setOutput("total", calc.total);
    core.setOutput("pass_rate", calc.passRate);
    core.setOutput("color", calc.color);
}
