import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, "..");

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

loadDotEnv(path.join(PACKAGE_ROOT, ".env"));

/** Shared config; no target PR (webhook supplies it per event). */
export interface BaseEnv {
    apiKey: string;
    repoUrl: string;
    repoFullName: string;
    startingRef: string;
    modelId: string;
    testerModelId: string;
    fixerModelId: string;
    featureDescription?: string;
    maxIterations: number;
    postPrComment: boolean;
    runsDir: string;
    githubWebhookSecret?: string;
    webhookPath: string;
    port: number;
    webhookPrActions: Set<string>;
    webhookIgnoreDraft: boolean;
}

/** Full env for a single pipeline run (includes target PR). */
export interface Env extends BaseEnv {
    targetPrUrl: string;
}

function requireEnv(name: string): string {
    const v = process.env[name]?.trim();
    if (!v) throw new Error(`Missing required environment variable: ${name}`);
    return v;
}

function validateApiKey(key: string): void {
    if (key === "cursor_..." || key.endsWith("...") || key.length < 20) {
        throw new Error(
            "CURSOR_API_KEY looks like the .env.example placeholder. Paste a real key from Cursor → Settings → Integrations.",
        );
    }
}

export function parseRepoFullName(repoUrl: string): string {
    const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
    if (!m) {
        throw new Error(
            `REPO_URL must be a GitHub URL (https://github.com/owner/repo): ${repoUrl}`,
        );
    }
    return `${m[1]}/${m[2]}`;
}

function parseWebhookPrActions(): Set<string> {
    const raw =
        process.env.WEBHOOK_PR_ACTIONS?.trim() ||
        "synchronize,opened,reopened";
    return new Set(
        raw
            .split(",")
            .map((a) => a.trim().toLowerCase())
            .filter(Boolean),
    );
}

export function loadBaseEnv(): BaseEnv {
    const apiKey = requireEnv("CURSOR_API_KEY");
    validateApiKey(apiKey);
    const repoUrl = requireEnv("REPO_URL");
    const modelId = process.env.MODEL_ID?.trim() || "composer-2.5";

    return {
        apiKey,
        repoUrl,
        repoFullName: parseRepoFullName(repoUrl),
        startingRef: process.env.STARTING_REF?.trim() || "master",
        modelId,
        testerModelId: process.env.TESTER_MODEL_ID?.trim() || modelId,
        fixerModelId: process.env.FIXER_MODEL_ID?.trim() || modelId,
        featureDescription: process.env.FEATURE_DESCRIPTION?.trim(),
        maxIterations: Math.max(
            1,
            Number(process.env.MAX_QA_ITERATIONS ?? "3") || 3,
        ),
        postPrComment: !/^(0|false|no)$/i.test(process.env.POST_PR_COMMENT ?? "1"),
        runsDir: path.join(PACKAGE_ROOT, "runs"),
        githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim(),
        webhookPath: process.env.WEBHOOK_PATH?.trim() || "/webhooks/github",
        port: Number(process.env.PORT ?? "8788"),
        webhookPrActions: parseWebhookPrActions(),
        webhookIgnoreDraft: !/^(0|false|no)$/i.test(
            process.env.WEBHOOK_IGNORE_DRAFT ?? "1",
        ),
    };
}

export function envForPr(base: BaseEnv, targetPrUrl: string): Env {
    return { ...base, targetPrUrl };
}

function resolveTargetPrUrl(repoUrl: string): string {
    const direct = process.env.TARGET_PR_URL?.trim();
    if (direct) return direct;

    const prNumber = process.env.TARGET_PR_NUMBER?.trim();
    if (!prNumber) {
        throw new Error(
            "Set TARGET_PR_URL or TARGET_PR_NUMBER for CLI runs, or use npm run webhook for GitHub push events.",
        );
    }

    const fullName = parseRepoFullName(repoUrl);
    const [owner, repo] = fullName.split("/");
    return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}

/** CLI mode: requires TARGET_PR_URL or TARGET_PR_NUMBER. */
export function loadEnv(): Env {
    const base = loadBaseEnv();
    return envForPr(base, resolveTargetPrUrl(base.repoUrl));
}
