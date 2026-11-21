// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Run by measure.mjs (never directly). MEASUREMENT SCRIPTS, NOT DISCOVERY: fixed traversals of the seeded stack.
import fs from 'node:fs';
import path from 'node:path';

import {expect, test} from '@mattermost/playwright-lib';

import {readManifest} from '../../src/manifest.ts';
import {closeGuardedSession, openGuardedSession} from '../../src/session.ts';

import {adminApi} from './lib/admin-api.ts';
import {attachOracles} from './lib/attach.ts';
import type {OracleHandle} from './lib/attach.ts';
import {loadChecks, loadDefaultAllowlist} from './lib/load.ts';
import {SCENARIOS} from './lib/scenarios.ts';
import {checkEnterWhileConfirmDisabled} from './lib/oracle-modal.ts';
import {EXTRA_TRAVERSALS, TRAVERSALS, findTraversal} from './lib/traversals.ts';
import type {Traversal} from './lib/traversals.ts';

const out = path.resolve(process.env.ORACLE_OUT ?? '');
const repeat = Number(process.env.ORACLE_REPEAT ?? 3);
const label = process.env.ORACLE_RUN_LABEL ?? 'clean';
const scenario = SCENARIOS.find((s) => s.id === process.env.ORACLE_SCENARIO);
const injecting = scenario !== undefined && label !== 'control';

function seedMarkers() {
    const manifest = readManifest();
    return {
        manifest,
        literals: [manifest.user.password],
        ids: [manifest.user.id, manifest.team.id, ...Object.values(manifest.channels).map((c) => c.id)],
    };
}

function withInjection(handle: OracleHandle, page: import('@playwright/test').Page): OracleHandle {
    if (!injecting || scenario?.id !== 'S5-console-error') {
        return handle;
    }
    let done = false;
    return {
        ...handle,
        async checkpoint() {
            if (!done && handle.actionLabels().length >= (scenario?.trigger_action ?? 0)) {
                done = true;
                // The injected fault itself: a deliberate console error for the O-CONSOLE self-test.
                // eslint-disable-next-line no-console
                await page.evaluate(() => console.error('SYNTHETIC injected console error'));
            }
            await handle.checkpoint();
        },
    };
}

async function runTraversal(pw: Parameters<Parameters<typeof test>[2]>[0]['pw'], traversal: Traversal, name: string) {
    const {manifest, literals, ids} = seedMarkers();
    const session = await openGuardedSession(pw, 'replay');
    const {page, channelsPage, origin, ledger} = session;
    const base = attachOracles(session, {
        allowlist: loadDefaultAllowlist(),
        literals,
        ids,
        checks: loadChecks(),
        checkData: {manifest},
        restOrigin: process.env.ORACLE_REST_ORIGIN || undefined,
    });
    const oracles = withInjection(base, page);

    const sockets = {opened: 0, frames_received: 0};
    page.on('websocket', (socket) => {
        sockets.opened += 1;
        socket.on('framereceived', () => {
            sockets.frames_received += 1;
        });
    });

    if (injecting && scenario?.id === 'S4-aria-dangling-reference') {
        await page.addInitScript(() => {
            const apply = () => document.body?.setAttribute('aria-labelledby', 'synthetic-missing-label-id');
            new MutationObserver(apply).observe(document, {childList: true, subtree: true});
            apply();
        });
    }

    if (scenario) {
        page.setDefaultTimeout(8_000);
    }
    let traversalError: string | null = null;
    const admin = await adminApi(origin);
    const channelId = (channel: string) => manifest.channels[channel].id;
    try {
        await traversal.run({
            page,
            oracles,
            async gotoChannel(channel) {
                await channelsPage.goto(manifest.team.name, channel);
                await page.getByRole('banner', {name: 'channel header region'}).waitFor();
                await page.getByRole('application', {name: 'channel sidebar region'}).waitFor();
            },
            async readChannel(channel) {
                const result = await admin.request('GET', `/channels/${channelId(channel)}`);
                expect(result.status).toBe(200);
                return result.body as Record<string, unknown>;
            },
            async patchChannel(channel, patch) {
                const result = await admin.request('PUT', `/channels/${channelId(channel)}/patch`, patch);
                expect(result.status).toBe(200);
            },
            async postIds(channel) {
                const result = await admin.request('GET', `/channels/${channelId(channel)}/posts?per_page=60`);
                expect(result.status).toBe(200);
                return (result.body as {order: string[]}).order;
            },
            async probeEnterWhileDisabled({dialog, confirm, field, submitPaths}) {
                await checkEnterWhileConfirmDisabled(
                    {
                        page,
                        context: session.context,
                        origin,
                        sink: base.sink,
                        action: oracles.actionLabels().length,
                        dialog,
                        confirm,
                        field,
                    },
                    {submitPaths},
                );
            },
            async deletePostsExcept(channel, type, keep) {
                const result = await admin.request('GET', `/channels/${channelId(channel)}/posts?per_page=60`);
                const posts = Object.values((result.body as {posts: Record<string, {id: string; type: string}>}).posts);
                for (const post of posts.filter((p) => p.type === type && !keep.includes(p.id))) {
                    const deleted = await admin.request('DELETE', `/posts/${post.id}`);
                    expect(deleted.status).toBe(200);
                }
            },
        });
    } catch (error) {
        // A fault may legitimately break the scripted path (for example by renaming the link it clicks);
        // that is a result to report. A clean-build run must never do so.
        if (!scenario) {
            throw error;
        }
        traversalError = base.sink.scrubber.text(
            error instanceof Error ? error.message.split('\n')[0] : String(error),
            200,
        );
        await oracles.checkpoint();
    } finally {
        await page.waitForLoadState('networkidle', {timeout: 8_000}).catch(() => undefined);
        oracles.detach();
    }
    await base.drain();

    fs.mkdirSync(path.join(out, 'findings'), {recursive: true});
    fs.mkdirSync(path.join(out, 'runs'), {recursive: true});
    base.sink.write(path.join(out, 'findings', `${name}.jsonl`));
    const checks: Record<string, Record<string, number>> = {};
    for (const result of oracles.checkResults()) {
        checks[result.check] ??= {};
        checks[result.check][result.status] = (checks[result.check][result.status] ?? 0) + 1;
    }
    const summary = {
        traversal: traversal.id,
        label,
        scenario: scenario?.id ?? null,
        actions: oracles.actionLabels(),
        findings: oracles.findings().length,
        suppressed_by_allowlist: base.sink.suppressed(),
        oracle_errors: oracles.oracleErrors(),
        traversal_error: traversalError,
        checks,
        websocket: sockets,
        guard_blocked: ledger.summary(),
    };
    base.sink.scrubber.assertClean(JSON.stringify(summary));
    fs.writeFileSync(path.join(out, 'runs', `${name}.json`), `${JSON.stringify(summary, null, 2)}\n`);
    await closeGuardedSession(session);
}

if (scenario) {
    test(`${scenario.id} [${label}] ${scenario.kind === 'proxy' ? 'SYNTHETIC fault layer' : 'SYNTHETIC page-script'}`, async ({
        pw,
    }) => {
        await runTraversal(pw, findTraversal(scenario.traversal), `${scenario.id}.${label}`);
    });
} else {
    for (const traversal of [...TRAVERSALS, ...EXTRA_TRAVERSALS]) {
        for (let i = 1; i <= repeat; i++) {
            test(`${traversal.id} run ${i} [measurement script, not discovery]`, async ({pw}) => {
                await runTraversal(pw, traversal, `${traversal.id}.run${i}`);
            });
        }
    }
}
