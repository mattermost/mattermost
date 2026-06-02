import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadBaseEnv, type BaseEnv } from "./env.js";
import {
    parseGitHubPayload,
    parsePullRequestEvent,
    shouldTriggerQa,
    verifyGitHubSignature,
} from "./github.js";
import {
    hasProcessedDelivery,
    markDeliveryAccepted,
    triggerQaForPr,
} from "./webhookTrigger.js";

function readRawBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

function json(res: ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
    });
    res.end(payload);
}

async function handleWebhook(
    env: BaseEnv,
    req: IncomingMessage,
    res: ServerResponse,
    rawBody: Buffer,
): Promise<void> {
    const eventType = req.headers["x-github-event"];
    if (eventType !== "pull_request") {
        json(res, 200, { ok: true, skipped: "not pull_request event" });
        return;
    }

    if (!env.githubWebhookSecret) {
        json(res, 500, { error: "GITHUB_WEBHOOK_SECRET not configured" });
        return;
    }

    const sig = req.headers["x-hub-signature-256"];
    if (
        !verifyGitHubSignature(
            rawBody,
            Array.isArray(sig) ? sig[0] : sig,
            env.githubWebhookSecret,
        )
    ) {
        json(res, 401, { error: "Invalid signature" });
        return;
    }

    let payload;
    try {
        payload = parseGitHubPayload(rawBody);
    } catch {
        json(res, 400, { error: "Invalid JSON" });
        return;
    }

    const event = parsePullRequestEvent(payload);
    if (!event) {
        json(res, 400, { error: "Could not parse pull_request payload" });
        return;
    }

    const skipReason = shouldTriggerQa(env, event);
    if (skipReason) {
        json(res, 200, {
            ok: true,
            skipped: skipReason,
            action: event.action,
            pr: event.prUrl,
        });
        return;
    }

    const deliveryHeader = req.headers["x-github-delivery"];
    const deliveryId =
        (Array.isArray(deliveryHeader) ? deliveryHeader[0] : deliveryHeader) ??
        `${event.prNumber}-${event.headSha ?? Date.now()}`;

    if (hasProcessedDelivery(env, deliveryId)) {
        json(res, 200, { ok: true, skipped: "duplicate delivery", deliveryId });
        return;
    }

    markDeliveryAccepted(env, deliveryId, event.prUrl);
    json(res, 200, {
        ok: true,
        accepted: true,
        prUrl: event.prUrl,
        action: event.action,
        deliveryId,
    });

    triggerQaForPr(env, event.prUrl, deliveryId);
}

async function main(): Promise<void> {
    const env = loadBaseEnv();

    if (!env.githubWebhookSecret) {
        console.error(
            "GITHUB_WEBHOOK_SECRET is required for the webhook server.\n" +
                "GitHub → repo Settings → Webhooks → add webhook with secret, events: Pull requests.",
        );
        process.exit(1);
    }

    const server = createServer(async (req, res) => {
        try {
            if (req.method === "GET" && req.url === "/health") {
                json(res, 200, { ok: true, repo: env.repoFullName });
                return;
            }

            if (req.method !== "POST" || req.url !== env.webhookPath) {
                json(res, 404, { error: "Not found" });
                return;
            }

            const rawBody = await readRawBody(req);
            await handleWebhook(env, req, res, rawBody);
        } catch (err) {
            console.error("request handler error:", err);
            if (!res.headersSent) json(res, 500, { error: "Internal error" });
        }
    });

    server.listen(env.port, () => {
        console.log(`QA Bugbot webhook listening on :${env.port}${env.webhookPath}`);
        console.log(`  repo filter: ${env.repoFullName}`);
        console.log(`  actions: ${[...env.webhookPrActions].join(", ")}`);
        console.log(`  health: GET /health`);
    });
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
