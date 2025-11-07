import * as core from "@actions/core";
import { saveMmctlReport } from "./main";

export async function run() {
    try {
        core.info("Saving mmctl test report...");
        await saveMmctlReport();
        core.info("Successfully saved mmctl test report!");
    } catch (err) {
        core.setFailed(`Action failed with error ${err}`);
    }
}

// Run the action when executed directly (not when imported by local-action tool)
if (process.env.GITHUB_ACTIONS === "true") {
    run();
}
