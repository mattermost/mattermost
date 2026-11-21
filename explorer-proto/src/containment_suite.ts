// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BrowserContext, Page} from '@playwright/test';

import {pageWebSocketEcho, startFixtureServer} from './fixture_servers.ts';
import type {FixtureServer, ServerCounters} from './fixture_servers.ts';

// One traffic suite shared by every containment check (app-level guard, launch-arg mechanism, the
// plain repo-native spec). Verdicts come from the SECOND server's own counters, never from a client error.

export const EXTERNAL_HOST = 'external.test';
const SETTLE_MS = 300;

export type SuiteServers = {
    approved: FixtureServer;
    second: FixtureServer;
    close: () => Promise<void>;
};

export type Probe = {
    name: string;
    client: string;
    secondDelta: ServerCounters;
    approvedDelta: ServerCounters;
    approvedHosts: string[];
    approvedPaths: string[];
};

export type SuiteOptions = {
    // True when the browser under test resolves EXTERNAL_HOST to the second server, so a leak would be observable there.
    externalMapsToSecond: boolean;
};

export type SuiteResult = {probes: Probe[]; externalMapsToSecond: boolean};

export const ZERO: ServerCounters = {
    connections: 0,
    httpRequests: 0,
    upgrades: 0,
};

export const isZero = (c: ServerCounters) => c.connections === 0 && c.httpRequests === 0 && c.upgrades === 0;

export function formatCounters(c: ServerCounters): string {
    return `connections ${c.connections}, http requests ${c.httpRequests}, upgrades ${c.upgrades}`;
}

export async function startSuiteServers(approvedPort?: number): Promise<SuiteServers> {
    const second = await startFixtureServer({
        websocket: 'destroy',
        handler: (_req, res) => {
            res.writeHead(200, {'content-type': 'text/html'});
            res.end('<html><body>second origin</body></html>');
        },
    });
    const script = (res: import('node:http').ServerResponse) => {
        res.writeHead(200, {'content-type': 'text/javascript'});
        res.end('self.addEventListener("fetch", () => {});');
    };
    const approved = await startFixtureServer({
        port: approvedPort,
        websocket: 'echo',
        handler: (req, res) => {
            const redirect = {
                '/redirect-same': '/ok',
                '/redirect-cross': `${second.origin}/redirect-target`,
                '/redirect-chain': '/redirect-cross',
            }[req.url ?? ''];
            if (redirect) {
                res.writeHead(302, {Location: redirect});
                res.end();
            } else if (req.url?.endsWith('.js')) {
                script(res);
            } else {
                res.writeHead(200, {'content-type': 'text/html'});
                res.end('<html><body><h1>approved origin</h1></body></html>');
            }
        },
    });
    return {
        approved,
        second,
        close: async () => {
            await approved.close();
            await second.close();
        },
    };
}

async function navigate(context: BrowserContext, url: string): Promise<string> {
    const page = await context.newPage();
    try {
        const response = await page.goto(url, {timeout: 10_000});
        const refused = response?.headers()['x-explorer-containment'] === 'refused';
        return `status:${response?.status()}${refused ? ':proxy-refused' : ''}:path=${new URL(page.url()).pathname}`;
    } catch (error) {
        return `error:${/net::(ERR_[A-Z_]+)/.exec(String(error))?.[1] ?? 'unknown'}`;
    } finally {
        await page.close();
    }
}

async function subresources(page: Page, url: string): Promise<string> {
    return page.evaluate(async (target) => {
        const results: string[] = [];
        results.push(
            await fetch(target, {mode: 'no-cors'}).then(
                () => 'fetch:resolved',
                () => 'fetch:failed',
            ),
        );
        results.push(
            await new Promise<string>((resolve) => {
                const img = new Image();
                img.onload = () => resolve('image:loaded');
                img.onerror = () => resolve('image:failed');
                img.src = `${target}?img`;
            }),
        );
        const frame = document.createElement('iframe');
        frame.src = `${target}?frame`;
        document.body.appendChild(frame);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return results.join(',');
    }, url);
}

/**
 * Runs the whole suite on a page that has already loaded nothing. `approved.origin` must be the origin the
 * containment under test allows; every other target is built from the servers' ports.
 */
export async function runSuite(
    context: BrowserContext,
    page: Page,
    servers: SuiteServers,
    options: SuiteOptions,
): Promise<SuiteResult> {
    const {approved, second} = servers;
    const probes: Probe[] = [];
    const wsOf = (host: string, port: number) => `ws://${host}:${port}/ws`;

    const measure = async (name: string, attempt: () => Promise<string>) => {
        const secondBefore = {...second.counters};
        const approvedBefore = {...approved.counters};
        const hostsBefore = approved.hostHeaders.length;
        const pathsBefore = approved.requestPaths.length;
        const client = await attempt();
        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
        const diff = (after: ServerCounters, before: ServerCounters): ServerCounters => ({
            connections: after.connections - before.connections,
            httpRequests: after.httpRequests - before.httpRequests,
            upgrades: after.upgrades - before.upgrades,
        });
        probes.push({
            name,
            client,
            secondDelta: diff(second.counters, secondBefore),
            approvedDelta: diff(approved.counters, approvedBefore),
            approvedHosts: approved.hostHeaders.slice(hostsBefore),
            approvedPaths: approved.requestPaths.slice(pathsBefore),
        });
    };

    // The page is loaded before the measurement starts, so the approved server's counters only show the probe.
    const fromApprovedPage = async (name: string, attempt: () => Promise<string>) => {
        await page.goto(`${approved.origin}/ok`);
        await measure(name, attempt);
    };
    const subresourcesOf = (host: string, port: number) => () =>
        subresources(page, `http://${host}:${port}/subresource`);

    await measure('approved.http', async () => {
        const response = await page.goto(`${approved.origin}/ok`);
        return `status:${response?.status()}`;
    });
    await measure('approved.websocket', async () =>
        page.evaluate(pageWebSocketEcho, {
            url: wsOf('127.0.0.1', approved.port),
            message: 'approved-echo',
        }),
    );
    await measure('approved.fetch', async () =>
        page.evaluate(
            (url) =>
                fetch(url).then(
                    (r) => `status:${r.status}`,
                    () => 'failed',
                ),
            `${approved.origin}/api-ping`,
        ),
    );
    await measure('approved.redirect-same-origin', async () => navigate(context, `${approved.origin}/redirect-same`));

    await measure('second.navigate', async () => navigate(context, `${second.origin}/navigate`));
    await fromApprovedPage('second.subresources', subresourcesOf('127.0.0.1', second.port));
    await fromApprovedPage('second.websocket', async () =>
        page.evaluate(pageWebSocketEcho, {
            url: wsOf('127.0.0.1', second.port),
            message: 'second-echo',
        }),
    );
    await measure('second.redirect-cross-origin', async () => navigate(context, `${approved.origin}/redirect-cross`));
    await measure('second.redirect-chain', async () => navigate(context, `${approved.origin}/redirect-chain`));
    await fromApprovedPage('second.fetch-redirect-cross-origin', async () =>
        page.evaluate(
            (url) =>
                fetch(url, {mode: 'no-cors'}).then(
                    () => 'fetch:resolved',
                    () => 'fetch:failed',
                ),
            `${approved.origin}/redirect-cross`,
        ),
    );

    await measure('localhost.navigate', async () => navigate(context, `http://localhost:${approved.port}/navigate`));
    await fromApprovedPage('localhost.subresources', subresourcesOf('localhost', approved.port));
    await fromApprovedPage('localhost.websocket', async () =>
        page.evaluate(pageWebSocketEcho, {
            url: wsOf('localhost', approved.port),
            message: 'alias-echo',
        }),
    );

    await measure('external.navigate', async () =>
        navigate(context, `http://${EXTERNAL_HOST}:${second.port}/navigate`),
    );
    await fromApprovedPage('external.subresources', subresourcesOf(EXTERNAL_HOST, second.port));
    await fromApprovedPage('external.websocket', async () =>
        page.evaluate(pageWebSocketEcho, {
            url: wsOf(EXTERNAL_HOST, second.port),
            message: 'external-echo',
        }),
    );

    await fromApprovedPage('service-worker.register', async () =>
        page.evaluate(() =>
            navigator.serviceWorker.register('/explorer-sw-probe.js').then(
                () => 'registered',
                () => 'rejected',
            ),
        ),
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {probes, externalMapsToSecond: options.externalMapsToSecond};
}

export const probeOf = (result: SuiteResult, name: string): Probe => {
    const probe = result.probes.find((p) => p.name === name);
    if (!probe) {
        throw new Error(`suite has no probe ${name}`);
    }
    return probe;
};

export const swScriptRequests = (result: SuiteResult): number =>
    result.probes
        .filter((p) => p.name === 'service-worker.register')
        .reduce((n, p) => n + p.approvedPaths.filter((path) => path === '/explorer-sw-probe.js').length, 0);

/** Probes whose traffic was SEEN by a server that must not see it (second origin, localhost alias, service worker). */
export function leakedProbes(result: SuiteResult): string[] {
    const leaked: string[] = [];
    for (const probe of result.probes) {
        const secondSaw = !isZero(probe.secondDelta);
        const aliasSaw = !isZero(probe.approvedDelta) || probe.approvedHosts.some((h) => h.startsWith('localhost'));
        if (
            (/^(second|external)\./.test(probe.name) && secondSaw) ||
            (probe.name.startsWith('localhost.') && (aliasSaw || secondSaw))
        ) {
            leaked.push(probe.name);
        }
    }
    if (swScriptRequests(result) > 0) {
        leaked.push('service-worker.register');
    }
    return leaked;
}

/** Failures of a CONTAINED run: approved works and nothing else reached any server. Empty means contained. */
export function containedFailures(result: SuiteResult): string[] {
    const failures: string[] = [];
    const approvedHttp = probeOf(result, 'approved.http');
    if (approvedHttp.client !== 'status:200') {
        failures.push(`approved HTTP: ${approvedHttp.client}`);
    }
    const ws = probeOf(result, 'approved.websocket');
    if (ws.client !== 'ws:echo:approved-echo' || ws.approvedDelta.upgrades !== 1) {
        failures.push(`approved WebSocket: ${ws.client}, approved upgrades +${ws.approvedDelta.upgrades}`);
    }
    const fetched = probeOf(result, 'approved.fetch');
    if (fetched.client !== 'status:200') {
        failures.push(`approved fetch: ${fetched.client}`);
    }
    const redirect = probeOf(result, 'approved.redirect-same-origin');
    if (!redirect.client.startsWith('status:200:path=/ok')) {
        failures.push(`same-origin redirect: ${redirect.client}`);
    }
    failures.push(...leakedProbes(result).map((name) => `${name}: a server that must not see traffic saw it`));
    for (const probe of result.probes.filter((p) => p.name.startsWith('external.'))) {
        if (/^(status:200|ws:echo)/.test(probe.client)) {
            failures.push(`${probe.name}: client got ${probe.client}`);
        }
    }
    return failures;
}

/** Failures of an UNCONTAINED control: every probe named in `expected` must be visible server-side, or the check is vacuous. */
export function controlFailures(result: SuiteResult, expected: string[]): string[] {
    const leaked = leakedProbes(result);
    return expected.filter((name) => !leaked.includes(name)).map((name) => `control ${name}: no server-side evidence`);
}

export function renderProbes(result: SuiteResult): string[] {
    return result.probes.map(
        (p) =>
            `- probe ${p.name}: client ${p.client}; second server +${p.secondDelta.connections}c/+${p.secondDelta.httpRequests}h/+${p.secondDelta.upgrades}u; approved server +${p.approvedDelta.connections}c/+${p.approvedDelta.httpRequests}h/+${p.approvedDelta.upgrades}u`,
    );
}
