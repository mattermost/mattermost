/**
 * QA Bugbot chain — chained Cursor SDK cloud agents on a target PR.
 *
 *   PR → 1. QA Planner → 2. QA Tester ⇄ 3. QA Fixer (loop) → 4. PR Summary
 */
import { Agent, CursorSdkError } from "@cursor/sdk";
import type { CloudAgentOptions, Run, RunResult } from "@cursor/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadEnv, type Env } from "./env.js";
import { parseTesterMarker } from "./parseTesterMarker.js";
import {
    qaContextFromEnv,
    qaFixerPrompt,
    qaPlannerPrompt,
    qaSummaryPrompt,
    qaTesterPrompt,
} from "./prompts/index.js";

type StepStatus = "pending" | "running" | "completed" | "errored";

interface StepRecord {
    label: string;
    status: StepStatus;
    agentId?: string;
    runId?: string;
    branch?: string;
    prUrl?: string;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    runStatus?: string;
    pass?: number;
    fail?: number;
    finalText?: string;
    error?: string;
}

interface SessionRecord {
    sessionId: string;
    sessionSlug: string;
    status: "running" | "finished" | "error" | "startup_error";
    repoUrl: string;
    targetPrUrl: string;
    startingRef: string;
    maxIterations: number;
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    branch?: string;
    prUrl?: string;
    finalPass?: number;
    finalFail?: number;
    needsHuman?: boolean;
    error?: string;
    steps: StepRecord[];
}

function log(line: string): void {
    process.stdout.write(`[${new Date().toISOString()}] ${line}\n`);
}

function formatSdkError(err: CursorSdkError): string {
    const parts = [
        err.constructor.name,
        err.message,
        err.code ? `code=${err.code}` : "",
        err.status != null ? `http=${err.status}` : "",
        err.operation ? `op=${err.operation}` : "",
        `retryable=${err.isRetryable}`,
    ].filter(Boolean);
    return parts.join(" ");
}

function branchFromResult(result: RunResult): string | undefined {
    return result.git?.branches?.find((b) => b.branch)?.branch;
}

function prUrlFromResult(result: RunResult): string | undefined {
    return result.git?.branches?.find((b) => b.prUrl)?.prUrl;
}

function cloudOnPr(env: Env): CloudAgentOptions {
    return {
        repos: [{ url: env.repoUrl, prUrl: env.targetPrUrl }],
        workOnCurrentBranch: true,
        autoCreatePR: false,
        skipReviewerRequest: true,
    };
}

async function streamRun(label: string, run: Run): Promise<void> {
    try {
        for await (const event of run.stream()) {
            if (event.type !== "assistant") continue;
            for (const block of event.message.content) {
                if (block.type !== "text" || !block.text) continue;
                const txt =
                    block.text.length > 280
                        ? block.text.slice(0, 280) + "...[truncated]"
                        : block.text;
                log(`  [${label}] ${txt.replace(/\n/g, " ")}`);
            }
        }
    } catch (err) {
        log(`  [${label}] stream: ${(err as Error).message}`);
    }
}

function saveSession(env: Env, session: SessionRecord): void {
    fs.mkdirSync(env.runsDir, { recursive: true });
    const file = path.join(env.runsDir, `session-${session.sessionId}.json`);
    fs.writeFileSync(file, JSON.stringify(session, null, 2));
}

function addStep(session: SessionRecord, label: string): StepRecord {
    const step: StepRecord = { label, status: "pending" };
    session.steps.push(step);
    return step;
}

async function runCloudAgent(opts: {
    env: Env;
    label: string;
    name: string;
    modelId: string;
    prompt: string;
    idempotencyKey: string;
    cloud: CloudAgentOptions;
    step: StepRecord;
    session: SessionRecord;
}): Promise<RunResult> {
    const { step, session, env } = opts;
    step.status = "running";
    step.startedAt = new Date().toISOString();
    saveSession(env, session);

    log(`==================== ${opts.label} ====================`);

    await using agent = await Agent.create({
        apiKey: env.apiKey,
        name: opts.name,
        model: { id: opts.modelId as `${string}` },
        idempotencyKey: opts.idempotencyKey,
        cloud: opts.cloud,
    });

    step.agentId = agent.agentId;
    saveSession(env, session);
    log(`${opts.label} agentId=${agent.agentId}`);

    let run;
    try {
        run = await agent.send(opts.prompt);
    } catch (err) {
        if (err instanceof CursorSdkError) {
            log(`${opts.label} send failed: ${formatSdkError(err)}`);
        }
        throw err;
    }
    step.runId = run.id;
    saveSession(env, session);
    log(`${opts.label} runId=${run.id} — monitoring cloud run...`);

    await streamRun(opts.label, run);

    let result: RunResult;
    try {
        result = await run.wait();
    } catch (err) {
        step.status = "errored";
        step.completedAt = new Date().toISOString();
        step.error = err instanceof Error ? err.message : String(err);
        saveSession(env, session);
        throw err;
    }

    step.completedAt = new Date().toISOString();
    step.durationMs = result.durationMs;
    step.runStatus = result.status;
    step.branch = branchFromResult(result) ?? step.branch;
    step.prUrl = prUrlFromResult(result) ?? step.prUrl;
    const text = result.result ?? "";
    step.finalText =
        text.length > 4000 ? text.slice(0, 4000) + "...[truncated]" : text;

    if (result.status === "error" || result.status === "cancelled") {
        step.status = "errored";
        step.error = `run ${result.status}`;
        saveSession(env, session);
        throw new Error(`${opts.label} finished with status=${result.status}`);
    }

    step.status = "completed";
    saveSession(env, session);
    log(`${opts.label} done status=${result.status}`);
    return result;
}

export async function runQaBugbotPipeline(env: Env): Promise<SessionRecord> {
    const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    const sessionSlug = `qa-${sessionId.slice(0, 19)}`;
    const ctx = qaContextFromEnv(env, sessionSlug);
    const started = Date.now();
    const cloud = cloudOnPr(env);

    const session: SessionRecord = {
        sessionId,
        sessionSlug,
        status: "running",
        repoUrl: env.repoUrl,
        targetPrUrl: env.targetPrUrl,
        startingRef: env.startingRef,
        maxIterations: env.maxIterations,
        startedAt: new Date().toISOString(),
        steps: [],
    };
    saveSession(env, session);

    log("QA Bugbot chain");
    log(`pr=${env.targetPrUrl} session=${sessionId} maxIter=${env.maxIterations}`);

    let finalPass = 0;
    let finalFail = 0;
    let needsHuman = false;
    let iterationsRun = 0;
    let previousFail: number | undefined;

    try {
        log("Stage 1: QA Planner (cloud, read-only)");

        const plannerStep = addStep(session, "1-Planner");
        await runCloudAgent({
            env,
            label: "1-Planner",
            name: "QA Bugbot Planner",
            modelId: env.modelId,
            prompt: qaPlannerPrompt(ctx),
            idempotencyKey: `${sessionId}-planner`,
            cloud,
            step: plannerStep,
            session,
        });

        for (let n = 1; n <= env.maxIterations; n++) {
            iterationsRun = n;
            log(`Stage 2: QA Tester iteration ${n}/${env.maxIterations}`);

            const testerStep = addStep(session, `2-Tester-iter${n}`);
            const testerResult = await runCloudAgent({
                env,
                label: `2-Tester-iter${n}`,
                name: `QA Bugbot Tester iter${n}`,
                modelId: env.testerModelId,
                prompt: qaTesterPrompt(ctx, n),
                idempotencyKey: `${sessionId}-tester-${n}`,
                cloud,
                step: testerStep,
                session,
            });

            const marker = parseTesterMarker(testerResult);
            testerStep.pass = marker.pass;
            testerStep.fail = marker.fail;
            finalPass = marker.pass;
            finalFail = marker.fail;
            saveSession(env, session);

            if (!marker.parsed) {
                log(`Warning: could not parse TESTER_COMPLETE marker; treating as fail`);
            }
            log(`Tester iter ${n}: pass=${marker.pass} fail=${marker.fail}`);

            const branch = branchFromResult(testerResult);
            const prUrl = prUrlFromResult(testerResult);
            if (branch) session.branch = branch;
            if (prUrl) session.prUrl = prUrl;

            if (marker.fail === 0) {
                log(`All scenarios passed on iteration ${n}`);
                break;
            }

            if (previousFail != null && marker.fail > previousFail) {
                needsHuman = true;
                log(`Failures increased (${previousFail} → ${marker.fail}); marking NEEDS HUMAN`);
                break;
            }
            previousFail = marker.fail;

            if (n >= env.maxIterations) {
                needsHuman = true;
                log(`Max iterations (${env.maxIterations}) reached with failures`);
                break;
            }

            log(`Stage 3: QA Fixer iteration ${n}`);

            const fixerStep = addStep(session, `3-Fixer-iter${n}`);
            await runCloudAgent({
                env,
                label: `3-Fixer-iter${n}`,
                name: `QA Bugbot Fixer iter${n}`,
                modelId: env.fixerModelId,
                prompt: qaFixerPrompt(ctx, n),
                idempotencyKey: `${sessionId}-fixer-${n}`,
                cloud,
                step: fixerStep,
                session,
            });
        }

        session.finalPass = finalPass;
        session.finalFail = finalFail;
        session.needsHuman = needsHuman;
        saveSession(env, session);

        log("Stage 4: QA Summary");

        const summaryStep = addStep(session, "4-Summary");
        const summaryResult = await runCloudAgent({
            env,
            label: "4-Summary",
            name: "QA Bugbot Summary",
            modelId: env.modelId,
            prompt: qaSummaryPrompt({
                ctx,
                iterations: iterationsRun,
                finalPass,
                finalFail,
                needsHuman,
                postPrComment: env.postPrComment,
            }),
            idempotencyKey: `${sessionId}-summary`,
            cloud,
            step: summaryStep,
            session,
        });

        session.status = "finished";
        session.completedAt = new Date().toISOString();
        session.durationMs = Date.now() - started;
        saveSession(env, session);

        log("\nQA summary (excerpt)\n====================");
        const summaryText = summaryResult.result ?? summaryStep.finalText ?? "";
        console.log(summaryText.slice(0, 6000));
        if (summaryText.length > 6000) {
            log("...[truncated; see session JSON]");
        }

        log(`\nQA Bugbot finished. PR: ${env.targetPrUrl}`);
        log(`Artifacts: docs/qa-bugbot/${sessionSlug}/`);
        log(`Session log: runs/session-${sessionId}.json`);
        return session;
    } catch (err) {
        session.completedAt = new Date().toISOString();
        session.durationMs = Date.now() - started;
        if (err instanceof CursorSdkError) {
            session.status = "startup_error";
            session.error = formatSdkError(err);
            log(`startup failed: ${session.error}`);
        } else {
            session.status = "error";
            session.error = err instanceof Error ? err.message : String(err);
            log(`Pipeline failed: ${session.error}`);
        }
        saveSession(env, session);
        return session;
    }
}

async function main(): Promise<void> {
    const env = loadEnv();
    const session = await runQaBugbotPipeline(env);
    if (session.status !== "finished") process.exit(2);
    if (session.needsHuman || (session.finalFail ?? 0) > 0) process.exit(2);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
