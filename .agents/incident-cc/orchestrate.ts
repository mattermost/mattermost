// Cursor SDK orchestrator using LOCAL agents.
//
// Runs 5 SDK agents in sequence in the caller's process, all working in the
// same repo checkout (REPO_ROOT). Each agent's prompt does its own
// `git add` + `git commit` against the feature branch we create up front.
//
//   1. Planner       -> docs/cursor-agents/<slug>/implementation_plan.md
//   2. Designer      -> docs/cursor-agents/<slug>/design_spec.md
//   3. Implementer   -> production code + implementation_report.md
//   4. Reviewer      -> review_report.md (APPROVED / REJECTED verdict)
//   5. Release       -> release_report.md (only if APPROVED), pushes the branch
//                       and runs `gh pr create` from its prompt.

import { Agent, CursorAgentError } from "@cursor/sdk";
import type { McpServerConfig, Run, RunResult, SDKAgent } from "@cursor/sdk";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
    plannerPrompt,
    designerPrompt,
    implementerPrompt,
    reviewerPrompt,
    releasePrompt,
    ticketFromEnv,
    type Ticket,
} from "./prompts/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// Minimal .env loader (KEY=VALUE per line, no quoting / no exports).
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

const STARTING_REF = process.env.STARTING_REF ?? "master";
const MODEL_ID = process.env.MODEL_ID ?? "auto";
const API_KEY = process.env.CURSOR_API_KEY;
const FIGMA_MCP_URL = process.env.FIGMA_MCP_URL;
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FORCE_DIRTY = /^(1|true|yes)$/i.test(process.env.FORCE_DIRTY ?? "");
const SKIP_PUSH = /^(1|true|yes)$/i.test(process.env.SKIP_PUSH ?? "");

if (!API_KEY) {
    console.error("ERROR: CURSOR_API_KEY is not set. Export it or add it to .env before running.");
    process.exit(1);
}

const FIGMA_MCP: Record<string, McpServerConfig> | undefined =
    FIGMA_MCP_URL && FIGMA_TOKEN
        ? {
              figma: {
                  type: "http",
                  url: FIGMA_MCP_URL,
                  headers: { "X-FIGMA-TOKEN": FIGMA_TOKEN },
              },
          }
        : undefined;

const SESSION = new Date().toISOString().replace(/[:.]/g, "-");
const RUNS_DIR = path.resolve(__dirname, "runs");
fs.mkdirSync(RUNS_DIR, { recursive: true });
const SESSION_FILE = path.join(RUNS_DIR, `session-${SESSION}.json`);
const LOG_FILE = path.join(RUNS_DIR, `session-${SESSION}.log`);

type StepStatus = "pending" | "running" | "completed" | "errored" | "skipped";

interface StepRecord {
    label: string;
    status: StepStatus;
    agentId?: string;
    runId?: string;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
    runStatus?: string;
    verdict?: "APPROVED" | "REJECTED" | "UNKNOWN";
    finalText?: string;
    error?: string;
}

interface Session {
    ticket: Ticket;
    repoRoot: string;
    startingRef: string;
    modelId: string;
    sessionId: string;
    startedAt: string;
    branch?: string;
    headSha?: string;
    prUrl?: string;
    steps: StepRecord[];
}

const TICKET = ticketFromEnv();

const session: Session = {
    ticket: TICKET,
    repoRoot: REPO_ROOT,
    startingRef: STARTING_REF,
    modelId: MODEL_ID,
    sessionId: SESSION,
    startedAt: new Date().toISOString(),
    steps: [],
};

function saveSession(): void {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function log(line: string): void {
    const stamped = `[${new Date().toISOString()}] ${line}`;
    process.stdout.write(stamped + "\n");
    fs.appendFileSync(LOG_FILE, stamped + "\n");
}

// ---------------- Git helpers ----------------

function git(args: string[], opts: { capture?: boolean } = {}): string {
    try {
        const out = execFileSync("git", args, {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: opts.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
        });
        return out.trim();
    } catch (err: any) {
        const stderr = err.stderr?.toString?.() ?? "";
        const stdout = err.stdout?.toString?.() ?? "";
        throw new Error(`git ${args.join(" ")} failed: ${stderr || stdout || err.message}`);
    }
}

function ensureCleanWorkingTree(): void {
    const status = git(["status", "--porcelain"]);
    if (status && !FORCE_DIRTY) {
        log(`Working tree is not clean:\n${status}`);
        throw new Error("Working tree has uncommitted changes. Commit/stash them, or set FORCE_DIRTY=1 to override.");
    }
    if (status && FORCE_DIRTY) {
        log(`FORCE_DIRTY=1: proceeding despite uncommitted changes in working tree.`);
    }
}

function deriveBranchName(t: Ticket): string {
    if (process.env.BRANCH_NAME) return process.env.BRANCH_NAME;
    const stamp = new Date().toISOString().replace(/[:.]/g, "").replace(/-/g, "").slice(0, 13);
    return `cursor-agents/${t.slug}-${stamp}`;
}

function setupBranch(t: Ticket): { branch: string; baseSha: string } {
    ensureCleanWorkingTree();
    log(`git: fetching origin ${STARTING_REF}`);
    git(["fetch", "origin", STARTING_REF, "--quiet"]);
    log(`git: checking out ${STARTING_REF}`);
    git(["checkout", STARTING_REF, "--quiet"]);
    log(`git: pulling ${STARTING_REF}`);
    git(["pull", "--ff-only", "origin", STARTING_REF, "--quiet"]);
    const baseSha = git(["rev-parse", "HEAD"]);
    const branch = deriveBranchName(t);
    log(`git: creating branch ${branch} from ${baseSha.slice(0, 12)}`);
    git(["checkout", "-b", branch]);
    return { branch, baseSha };
}

// ---------------- SDK runner ----------------

async function streamRun(label: string, run: Run): Promise<void> {
    try {
        for await (const event of run.stream()) {
            switch (event.type) {
                case "assistant":
                    for (const block of event.message.content) {
                        if (block.type === "text" && block.text) {
                            const txt = block.text.length > 400
                                ? block.text.slice(0, 400) + "...[truncated]"
                                : block.text;
                            log(`  [${label}] assistant: ${txt.replace(/\n/g, " ")}`);
                        } else if (block.type === "tool_use") {
                            log(`  [${label}] tool_use(block): ${block.name}`);
                        }
                    }
                    break;
                case "tool_call":
                    log(`  [${label}] tool_call: ${event.name} status=${event.status}`);
                    break;
                case "thinking":
                    if (event.text) {
                        const txt = event.text.length > 200 ? event.text.slice(0, 200) + "..." : event.text;
                        log(`  [${label}] thinking: ${txt.replace(/\n/g, " ")}`);
                    }
                    break;
                case "status":
                    log(`  [${label}] status: ${event.status}${event.message ? " - " + event.message : ""}`);
                    break;
                case "system":
                    if (event.subtype === "init") {
                        const modelLabel = typeof event.model === "string" ? event.model : (event.model as any)?.id ?? "?";
                        log(`  [${label}] system init: model=${modelLabel}`);
                    }
                    break;
                case "user":
                case "request":
                case "task":
                    break;
            }
        }
    } catch (err) {
        log(`  [${label}] stream errored (will still wait for run): ${(err as Error).message}`);
    }
}

interface RunStepOptions {
    label: string;
    name: string;
    prompt: string;
    mcpServers?: Record<string, McpServerConfig>;
}

interface RunStepResult {
    agentId: string;
    runId: string;
    result: RunResult;
    finalText: string;
}

async function runStep(opts: RunStepOptions): Promise<RunStepResult> {
    const record: StepRecord = {
        label: opts.label,
        status: "running",
        startedAt: new Date().toISOString(),
    };
    session.steps.push(record);
    saveSession();

    log(`==================== ${opts.label} ====================`);
    log(`runtime=local cwd=${REPO_ROOT} branch=${session.branch ?? "(none)"}`);

    let agent: SDKAgent | undefined;
    try {
        agent = await Agent.create({
            apiKey: API_KEY!,
            name: opts.name,
            model: { id: MODEL_ID as any },
            local: { cwd: REPO_ROOT, settingSources: [] },
            mcpServers: opts.mcpServers,
        });
    } catch (err) {
        record.status = "errored";
        record.completedAt = new Date().toISOString();
        record.error = err instanceof Error ? err.message : String(err);
        saveSession();
        if (err instanceof CursorAgentError) {
            log(`${opts.label} Agent.create CursorAgentError: ${err.message} (retryable=${err.isRetryable})`);
        } else {
            log(`${opts.label} Agent.create error: ${record.error}`);
        }
        throw err;
    }

    record.agentId = agent.agentId;
    log(`${opts.label} agentId=${agent.agentId}`);
    saveSession();

    try {
        const run = await agent.send(opts.prompt);
        record.runId = run.id;
        log(`${opts.label} runId=${run.id}`);
        saveSession();

        await streamRun(opts.label, run);
        const result = await run.wait();

        record.completedAt = new Date().toISOString();
        record.durationMs = result.durationMs;
        record.runStatus = result.status;
        const finalText: string = result.result ?? "";
        record.finalText = finalText.length > 4000
            ? finalText.slice(0, 4000) + "...[truncated]"
            : finalText;

        if (result.status === "error") {
            record.status = "errored";
            record.error = `Run finished with status=error`;
            saveSession();
            log(`${opts.label} RUN ERRORED (result.status=error)`);
            throw new Error(record.error);
        }
        if (result.status === "cancelled") {
            record.status = "errored";
            record.error = `Run was cancelled`;
            saveSession();
            log(`${opts.label} RUN CANCELLED`);
            throw new Error(record.error);
        }

        record.status = "completed";
        saveSession();
        log(`${opts.label} completed status=${result.status} durationMs=${result.durationMs}`);

        return { agentId: agent.agentId, runId: run.id, result, finalText };
    } finally {
        await (agent as any)[Symbol.asyncDispose]?.();
    }
}

// ---------------- Main ----------------

async function main(): Promise<void> {
    log(`Session ${SESSION} - ${TICKET.id} ${TICKET.title}`);
    log(`Repo: ${REPO_ROOT} | Starting ref: ${STARTING_REF} | Model: ${MODEL_ID}`);
    log(`Ticket slug: ${TICKET.slug} | URL: ${TICKET.url}`);
    saveSession();

    // Prepare the feature branch before any agent runs.
    const { branch, baseSha } = setupBranch(TICKET);
    session.branch = branch;
    saveSession();
    log(`Feature branch ready: ${branch} (from ${baseSha.slice(0, 12)})`);

    // Expose branch + ticket info to all agents' shell environment.
    process.env.BRANCH_NAME = branch;
    process.env.TICKET_ID = TICKET.id;
    process.env.TICKET_URL = TICKET.url;
    process.env.TICKET_TITLE = TICKET.title;
    process.env.TICKET_SLUG = TICKET.slug;
    if (!process.env.TICKET_DESCRIPTION) process.env.TICKET_DESCRIPTION = TICKET.description;
    process.env.SKIP_PUSH_FLAG = SKIP_PUSH ? "1" : "0";

    // 1. Planner
    await runStep({
        label: "1-Planner",
        name: `${TICKET.id} Planner`,
        prompt: plannerPrompt(TICKET),
    });

    // 2. Designer (Figma MCP attached if creds are present)
    if (FIGMA_MCP) {
        log(`Figma MCP attached for Designer agent.`);
    } else {
        log(`Figma MCP NOT attached (no FIGMA_MCP_URL/FIGMA_TOKEN); Designer will produce textual spec only.`);
    }
    await runStep({
        label: "2-Designer",
        name: `${TICKET.id} Designer`,
        prompt: designerPrompt(TICKET),
        mcpServers: FIGMA_MCP,
    });

    // 3. Implementer
    await runStep({
        label: "3-Implementer",
        name: `${TICKET.id} Implementer`,
        prompt: implementerPrompt(TICKET),
    });

    // 4. Reviewer (quality gate)
    const reviewer = await runStep({
        label: "4-Reviewer",
        name: `${TICKET.id} Reviewer`,
        prompt: reviewerPrompt(TICKET),
    });

    const reviewerStep = session.steps[session.steps.length - 1];
    const text = reviewer.finalText ?? "";
    const approved = /REVIEWER_VERDICT:\s*APPROVED/i.test(text);
    const rejected = /REVIEWER_VERDICT:\s*REJECTED/i.test(text);
    reviewerStep.verdict = approved ? "APPROVED" : rejected ? "REJECTED" : "UNKNOWN";
    saveSession();
    log(`Reviewer verdict: ${reviewerStep.verdict}`);

    if (!approved) {
        log("Review did not produce APPROVED verdict. Skipping Release Engineer.");
        session.steps.push({
            label: "5-Release",
            status: "skipped",
            error: `Skipped because reviewer verdict was ${reviewerStep.verdict}.`,
        });
        saveSession();
        log(`Branch left at: ${branch} (not pushed)`);
        log(`Session artifact: ${SESSION_FILE}`);
        log("DONE (no PR opened).");
        process.exit(2);
    }

    // 5. Release Engineer - composes commit + PR, pushes branch, opens PR via gh.
    await runStep({
        label: "5-Release",
        name: `${TICKET.id} Release`,
        prompt: releasePrompt(TICKET),
    });

    // Capture HEAD SHA + branch state for the session record.
    try {
        session.headSha = git(["rev-parse", "HEAD"]);
    } catch (err) {
        log(`Could not read HEAD SHA: ${(err as Error).message}`);
    }
    saveSession();

    log(`Final branch: ${branch}${SKIP_PUSH ? " (push skipped via SKIP_PUSH)" : ""}`);
    log(`HEAD: ${session.headSha ?? "?"}`);
    log(`Session artifact: ${SESSION_FILE}`);
    log("DONE.");
}

main().catch((err) => {
    if (err instanceof CursorAgentError) {
        log(`FATAL CursorAgentError: ${err.message} (retryable=${err.isRetryable})`);
        process.exit(1);
    }
    log(`FATAL: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    process.exit(1);
});
