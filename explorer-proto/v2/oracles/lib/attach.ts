// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserContext, Page} from '@playwright/test';

import {FindingSink, EMPTY_ALLOWLIST} from './findings.ts';
import type {Allowlist, Finding} from './findings.ts';
import {runA11yOracle} from './oracle-a11y.ts';
import {attachConsoleOracle, attachHttpOracle, attachWebSocketOracle} from './oracle-events.ts';
import type {OracleCtx} from './oracle-events.ts';
import {runCheck} from './oracle-uirest.ts';
import type {CheckResult, CheckSpec} from './oracle-uirest.ts';
import {createScrubber} from './scrub.ts';

export type AttachOptions = {
    allowlist?: Allowlist;
    /** Known seeded ids; matched literally in memory only and written as <id>. */
    ids?: string[];
    /** Values that must never reach an artefact (the seeded password); written as <redacted>. */
    literals?: string[];
    checks?: CheckSpec[];
    /** Data the check subjects are read from, e.g. {manifest}. */
    checkData?: Record<string, unknown>;
    a11y?: boolean;
    /**
     * Origin the REST side of O-UIREST reads from (default: the session origin). Fault runs point it at the
     * unfaulted forwarder so the "truth" does not pass through the fault layer. Loopback http only.
     */
    restOrigin?: string;
};

export type OracleHandle = {
    sink: FindingSink;
    /** Starts the next scripted action and returns its index (the initial load is action 0). */
    action(label: string): number;
    /** Runs the state oracles (O-A11Y, O-UIREST) against the current page. */
    checkpoint(): Promise<void>;
    detach(): void;
    /** Waits for deferred decisions (WebSocket closes) so every finding is in the sink. */
    drain(): Promise<void>;
    actionLabels(): string[];
    checkResults(): CheckResult[];
    oracleErrors(): string[];
    findings(): Finding[];
};

/**
 * Attaches every oracle to a guarded session's context and main page. Works on any Playwright context:
 * the oracles only listen, read the accessibility snapshot and DOM attributes, and call same-origin REST.
 */
export function attachOracles(
    session: {context: BrowserContext; page: Page; origin: string},
    options: AttachOptions = {},
): OracleHandle {
    const {context, page, origin} = session;
    const restOrigin = options.restOrigin ?? origin;
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(restOrigin)) {
        throw new Error('restOrigin must be an http://127.0.0.1:<port> origin.');
    }
    const scrubber = createScrubber({origins: [origin], ids: options.ids, literals: options.literals});
    const sink = new FindingSink(scrubber, options.allowlist ?? EMPTY_ALLOWLIST);
    const labels: string[] = [];
    const results: CheckResult[] = [];
    const errors: string[] = [];
    let current = 0;
    let detached = false;
    const pending = new Set<Promise<void>>();

    const ctx: OracleCtx = {
        sink,
        origin,
        action: () => current,
        detached: () => detached,
        track(promise) {
            pending.add(promise);
            promise.finally(() => pending.delete(promise));
        },
    };

    const watch = (target: Page) => {
        attachConsoleOracle(target, ctx);
        attachWebSocketOracle(target, context, ctx);
    };
    attachHttpOracle(context, ctx);
    for (const existing of context.pages()) {
        watch(existing);
    }
    context.on('page', watch);

    const guarded = async (name: string, run: () => Promise<void>) => {
        try {
            await run();
        } catch (error) {
            if (!detached) {
                errors.push(
                    `${name}: ${scrubber.text(error instanceof Error ? error.message.split('\n')[0] : String(error))}`,
                );
            }
        }
    };

    return {
        sink,
        action(label) {
            current += 1;
            labels.push(scrubber.text(label, 120));
            return current;
        },
        async checkpoint() {
            sink.startCheckpoint();
            if (options.a11y !== false) {
                await guarded('O-A11Y', async () => {
                    await runA11yOracle(page, (input) => sink.add(input), current);
                });
            }
            for (const check of options.checks ?? []) {
                await guarded(`O-UIREST ${check.id}`, async () => {
                    results.push(
                        ...(await runCheck(
                            page,
                            context,
                            restOrigin,
                            check,
                            options.checkData ?? {},
                            (i) => sink.add(i),
                            current,
                        )),
                    );
                });
            }
        },
        detach() {
            detached = true;
        },
        async drain() {
            await Promise.allSettled([...pending]);
        },
        actionLabels: () => [...labels],
        checkResults: () => [...results],
        oracleErrors: () => [...errors],
        findings: () => sink.list(),
    };
}
