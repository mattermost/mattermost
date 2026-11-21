// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';

import {chromium, expect, test} from '@playwright/test';

import {containmentLaunchArgs, startContainmentProxy} from './containment_proxy.ts';
import type {ContainmentProxy} from './containment_proxy.ts';
import {FRAGMENT_SCHEMA, toProbeRecords, writeJson} from './containment_report.ts';
import type {Fragment, RunRecord} from './containment_report.ts';
import {
    EXTERNAL_HOST,
    containedFailures,
    controlFailures,
    leakedProbes,
    runSuite,
    startSuiteServers,
    swScriptRequests,
} from './containment_suite.ts';
import {reportsDir} from './paths.ts';

const MAP_EXTERNAL = `--host-resolver-rules=MAP ${EXTERNAL_HOST} 127.0.0.1`;
const HOST_RESOLVER_ONLY = '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1';

type Variant = {
    id: string;
    kind: 'control' | 'contained';
    describe: string;
    args: (proxy: ContainmentProxy) => string[];
    serviceWorkers: 'allow' | 'block';
    externalMapsToSecond: boolean;
    // Controls: probes that MUST be visible to a server, otherwise the check cannot fail.
    mustLeak: string[];
};

const VARIANTS: Variant[] = [
    {
        id: 'control-plain-launch',
        kind: 'control',
        describe: 'plain Chromium launch, no containment (external name mapped to the second server)',
        args: () => [MAP_EXTERNAL],
        serviceWorkers: 'allow',
        externalMapsToSecond: true,
        mustLeak: [
            'second.navigate',
            'second.subresources',
            'second.websocket',
            'second.redirect-cross-origin',
            'second.redirect-chain',
            'second.fetch-redirect-cross-origin',
            'localhost.navigate',
            'localhost.subresources',
            'localhost.websocket',
            'external.navigate',
            'external.websocket',
            'service-worker.register',
        ],
    },
    {
        id: 'control-host-resolver-rules-only',
        kind: 'control',
        describe: 'previous replay-journey mechanism: --host-resolver-rules MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
        args: () => [HOST_RESOLVER_ONLY],
        serviceWorkers: 'block',
        externalMapsToSecond: false,
        mustLeak: [
            'second.navigate',
            'second.subresources',
            'second.websocket',
            'second.redirect-cross-origin',
            'second.redirect-chain',
        ],
    },
    {
        id: 'control-proxy-keeps-default-loopback-bypass',
        kind: 'control',
        describe: '--proxy-server without --proxy-bypass-list=<-loopback> (loopback bypasses the proxy by default)',
        args: (proxy) => [`--proxy-server=http://127.0.0.1:${proxy.port}`],
        serviceWorkers: 'block',
        externalMapsToSecond: false,
        mustLeak: ['second.navigate', 'second.subresources', 'second.websocket', 'localhost.navigate'],
    },
    {
        id: 'contained-proxy-and-host-resolver',
        kind: 'contained',
        describe: 'replay-journey containment: filtering proxy + <-loopback> + host-resolver NOTFOUND rule',
        args: (proxy) => containmentLaunchArgs(proxy.port),
        serviceWorkers: 'block',
        externalMapsToSecond: false,
        mustLeak: [],
    },
    {
        id: 'contained-proxy-only-external-name-mapped',
        kind: 'contained',
        describe: 'proxy + <-loopback> only, while DNS would resolve the external name to the second server',
        args: (proxy) => [
            `--proxy-server=http://127.0.0.1:${proxy.port}`,
            '--proxy-bypass-list=<-loopback>',
            MAP_EXTERNAL,
        ],
        serviceWorkers: 'block',
        externalMapsToSecond: true,
        mustLeak: [],
    },
];

const runs: RunRecord[] = [];

test.afterAll(() => {
    const fragment: Fragment = {schema: FRAGMENT_SCHEMA, runs};
    writeJson(path.join(reportsDir(), 'guard-journey-mechanism.fragment.json'), fragment);
});

for (const variant of VARIANTS) {
    test(`containment mechanism: ${variant.id}`, async () => {
        const servers = await startSuiteServers();
        const proxy = await startContainmentProxy({
            host: '127.0.0.1',
            port: servers.approved.port,
        });
        const browser = await chromium.launch({args: variant.args(proxy)});
        try {
            const context = await browser.newContext({
                serviceWorkers: variant.serviceWorkers,
            });
            const page = await context.newPage();
            const result = await runSuite(context, page, servers, {
                externalMapsToSecond: variant.externalMapsToSecond,
            });
            const secondTotals = {...servers.second.counters};
            await context.close();
            await browser.close();
            await new Promise((resolve) => setTimeout(resolve, 500));

            const failures =
                variant.kind === 'contained' ? containedFailures(result) : controlFailures(result, variant.mustLeak);
            if (variant.kind === 'contained') {
                // Every upstream socket the proxy opened must be an accepted connection of the approved server.
                if (proxy.stats.upstreamSocketsOpened !== servers.approved.counters.connections) {
                    failures.push(
                        `proxy opened ${proxy.stats.upstreamSocketsOpened} upstream sockets, approved server accepted ${servers.approved.counters.connections}`,
                    );
                }
                if (proxy.stats.refused === 0) {
                    failures.push('the proxy refused nothing: it was not in the request path');
                }
            }
            runs.push({
                id: variant.id,
                kind: variant.kind,
                launch: variant.describe,
                probes: toProbeRecords(result),
                leaked: leakedProbes(result),
                failures,
                secondTotals,
                secondTotalsAfterClose: {...servers.second.counters},
                approvedTotals: {...servers.approved.counters},
                swScriptRequests: swScriptRequests(result),
                proxy: {...proxy.stats},
                externalMapsToSecond: variant.externalMapsToSecond,
            });
            expect(failures).toEqual([]);
            if (variant.kind === 'contained') {
                expect(servers.second.counters).toEqual({
                    connections: 0,
                    httpRequests: 0,
                    upgrades: 0,
                });
            }
        } finally {
            await browser.close().catch(() => undefined);
            await proxy.close();
            await servers.close();
        }
    });
}
