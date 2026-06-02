import * as fs from "node:fs";
import * as path from "node:path";
import { envForPr, type BaseEnv } from "./env.js";
import { runQaBugbotPipeline } from "./pipeline.js";

function log(line: string): void {
    process.stdout.write(`[${new Date().toISOString()}] ${line}\n`);
}

function deliveryPath(env: BaseEnv, deliveryId: string): string {
    const safe = deliveryId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(env.runsDir, `webhook-${safe}.json`);
}

export function hasProcessedDelivery(env: BaseEnv, deliveryId: string): boolean {
    return fs.existsSync(deliveryPath(env, deliveryId));
}

export function markDeliveryAccepted(
    env: BaseEnv,
    deliveryId: string,
    prUrl: string,
): void {
    if (hasProcessedDelivery(env, deliveryId)) return;
    fs.mkdirSync(env.runsDir, { recursive: true });
    fs.writeFileSync(
        deliveryPath(env, deliveryId),
        JSON.stringify(
            {
                deliveryId,
                prUrl,
                status: "queued",
                queuedAt: new Date().toISOString(),
            },
            null,
            2,
        ),
    );
}

export function triggerQaForPr(
    base: BaseEnv,
    prUrl: string,
    deliveryId: string,
): void {
    const env = envForPr(base, prUrl);
    log(`webhook queued QA for ${prUrl} delivery=${deliveryId}`);

    void runQaBugbotPipeline(env)
        .then((session) => {
            const record = {
                deliveryId,
                prUrl,
                sessionId: session.sessionId,
                status: session.status,
                finalPass: session.finalPass,
                finalFail: session.finalFail,
                needsHuman: session.needsHuman,
                completedAt: new Date().toISOString(),
            };
            fs.writeFileSync(
                deliveryPath(base, deliveryId),
                JSON.stringify(record, null, 2),
            );
            log(
                `webhook QA done delivery=${deliveryId} status=${session.status} pass=${session.finalPass} fail=${session.finalFail}`,
            );
        })
        .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            log(`webhook QA failed delivery=${deliveryId}: ${msg}`);
            fs.writeFileSync(
                deliveryPath(base, deliveryId),
                JSON.stringify(
                    {
                        deliveryId,
                        prUrl,
                        status: "error",
                        error: msg,
                        completedAt: new Date().toISOString(),
                    },
                    null,
                    2,
                ),
            );
        });
}
