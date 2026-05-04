import * as core from "@actions/core";
import * as fs from "fs/promises";
import {buildMarkdown, classifyFlakyTests} from "./classifier";

export async function run(): Promise<void> {
    const reportPath = core.getInput("report-path", {required: true});

    core.info(`Reading JUnit report: ${reportPath}`);
    const reportXml = await fs.readFile(reportPath, "utf8");
    const flakyTests = classifyFlakyTests(reportXml);

    core.info(`High-confidence flaky tests: ${flakyTests.length}`);
    core.setOutput("has_flaky", flakyTests.length > 0 ? "true" : "false");
    core.setOutput("flaky_markdown", flakyTests.length > 0 ? buildMarkdown(flakyTests) : "");
}
