import { createHmac, timingSafeEqual } from "node:crypto";
import type { BaseEnv } from "./env.js";

export interface GitHubPullRequestPayload {
    action?: string;
    number?: number;
    pull_request?: {
        html_url?: string;
        number?: number;
        draft?: boolean;
        head?: { sha?: string };
    };
    repository?: {
        full_name?: string;
        html_url?: string;
    };
}

export interface ParsedPrEvent {
    prUrl: string;
    prNumber: number;
    action: string;
    repoFullName: string;
    headSha?: string;
    draft: boolean;
}

export function verifyGitHubSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
    secret: string,
): boolean {
    if (!signatureHeader?.startsWith("sha256=")) return false;
    const expected =
        "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
        const a = Buffer.from(signatureHeader, "utf8");
        const b = Buffer.from(expected, "utf8");
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export function parseGitHubPayload(rawBody: Buffer): GitHubPullRequestPayload {
    return JSON.parse(rawBody.toString("utf8")) as GitHubPullRequestPayload;
}

export function parsePullRequestEvent(
    payload: GitHubPullRequestPayload,
): ParsedPrEvent | null {
    const pr = payload.pull_request;
    const repo = payload.repository;
    if (!pr || !repo?.full_name || !payload.action) return null;

    const prUrl = pr.html_url;
    const prNumber = pr.number ?? payload.number;
    if (!prUrl || prNumber == null) return null;

    return {
        prUrl,
        prNumber,
        action: payload.action,
        repoFullName: repo.full_name,
        headSha: pr.head?.sha,
        draft: Boolean(pr.draft),
    };
}

export function shouldTriggerQa(env: BaseEnv, event: ParsedPrEvent): string | null {
    if (event.repoFullName.toLowerCase() !== env.repoFullName.toLowerCase()) {
        return `repo mismatch (got ${event.repoFullName}, want ${env.repoFullName})`;
    }
    if (env.webhookIgnoreDraft && event.draft) {
        return "draft PR";
    }
    if (!env.webhookPrActions.has(event.action.toLowerCase())) {
        return `action ${event.action} not in WEBHOOK_PR_ACTIONS`;
    }
    return null;
}
