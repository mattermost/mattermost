// Smoke test: validate CURSOR_API_KEY and list the GitHub repos connected to the Cursor team.
import { Cursor } from "@cursor/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadDotEnv(file: string): void {
    if (!fs.existsSync(file)) return;
    for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        if (!(key in process.env)) process.env[key] = value;
    }
}
loadDotEnv(path.resolve(__dirname, ".env"));

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
    console.error("CURSOR_API_KEY not set");
    process.exit(1);
}

async function main(): Promise<void> {
    try {
        const models = await Cursor.models.list({ apiKey });
        console.log(`OK: models.list returned ${models.length} models. Sample:`, models.slice(0, 3).map((m) => m.id));
    } catch (err) {
        console.error(`FAIL models.list: ${(err as Error).message}`);
        process.exit(2);
    }

    try {
        const repos = await Cursor.repositories.list({ apiKey });
        console.log(`OK: repositories.list returned ${repos.length} repos.`);
        const target = "yvettejade/mattermost";
        const hit = repos.find((r) => r.url.includes(target));
        if (hit) {
            console.log(`OK: target repo connected: ${hit.url}`);
        } else {
            console.log(`WARN: target repo "${target}" not found in team's connected repos. First few:`);
            for (const r of repos.slice(0, 5)) console.log(`  - ${r.url}`);
        }
    } catch (err) {
        console.error(`FAIL repositories.list: ${(err as Error).message}`);
        process.exit(3);
    }
}

main();
