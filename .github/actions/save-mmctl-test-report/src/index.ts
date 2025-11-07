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
