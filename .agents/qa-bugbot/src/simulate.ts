/**
 * POST a synthetic GitHub pull_request synchronize event to the local webhook server.
 */
import { createHmac } from "node:crypto";
import { loadBaseEnv, parseRepoFullName } from "./env.js";

async function main(): Promise<void> {
    const env = loadBaseEnv();
    if (!env.githubWebhookSecret) {
        console.error("GITHUB_WEBHOOK_SECRET required for simulate");
        process.exit(1);
    }

    const fullName = parseRepoFullName(env.repoUrl);
    const prNumber = Number(process.env.SIMULATE_PR_NUMBER ?? "10");
    const prUrl =
        process.env.SIMULATE_PR_URL ??
        `https://github.com/${fullName}/pull/${prNumber}`;

    const payload = {
        action: process.env.SIMULATE_ACTION ?? "synchronize",
        number: prNumber,
        pull_request: {
            html_url: prUrl,
            number: prNumber,
            draft: false,
            head: { sha: `simulate-${Date.now()}` },
        },
        repository: {
            full_name: fullName,
            html_url: env.repoUrl.replace(/\.git$/, ""),
        },
    };

    const body = JSON.stringify(payload);
    const sig =
        "sha256=" +
        createHmac("sha256", env.githubWebhookSecret).update(body).digest("hex");

    const host = process.env.SIMULATE_HOST ?? `http://127.0.0.1:${env.port}`;
    const url = `${host}${env.webhookPath}`;

    console.log(`POST ${url} action=${payload.action} pr=${prUrl}`);
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": `simulate-${Date.now()}`,
            "X-Hub-Signature-256": sig,
        },
        body,
    });
    const text = await res.text();
    console.log(`→ ${res.status} ${text}`);
    if (!res.ok) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
