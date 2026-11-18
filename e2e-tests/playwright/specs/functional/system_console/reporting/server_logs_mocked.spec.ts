// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, formatMessage, Msg, test, type PlaywrightExtended} from '@mattermost/playwright-lib';

import {expectStructuredViewer, gotoServerLogs, logEntryWith, selectDuration, selectNode, toggleLevel} from './support';

type LogEntry = Record<string, unknown>;
type LogsByNode = Record<string, LogEntry[]>;
type QueryLogsRequest = {body: Record<string, unknown>; params: URLSearchParams};

const LOGS_PAGE_SIZE = 10000;

function logEntry(msg: string, level = 'info', time = new Date()): LogEntry {
    // mlog's layout: "2026-10-28 10:00:00.000 Z"
    const timestamp = time.toISOString().replace('T', ' ').replace('Z', ' Z');
    return {timestamp, level, msg, caller: 'app/server_logs_test.go:1'};
}

/**
 * Log in as admin and open the server logs page with the logs query API answered by
 * the test. A single-node test server can't log a cluster's response, levels such as
 * fatal or a full page of entries on demand, and the viewer builds everything it
 * shows from this response. The latest request is kept for the assertions.
 */
async function openWithMockedLogs(pw: PlaywrightExtended, respond: (body: Record<string, unknown>) => LogsByNode) {
    const {adminUser} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(adminUser);

    let latest: QueryLogsRequest | undefined;
    await app.page.route(
        (url) => url.pathname.endsWith('/api/v4/logs/query'),
        async (route) => {
            const request = route.request();
            const body = request.postDataJSON();
            latest = {body, params: new URL(request.url()).searchParams};
            await route.fulfill({json: respond(body)});
        },
    );

    await gotoServerLogs(app);
    await expectStructuredViewer(app);

    const lastRequest = () => {
        if (!latest) {
            throw new Error('No logs query request was made');
        }
        return latest;
    };

    return {app, lastRequest};
}

test.describe('System Console - Reporting - Server Logs with a mocked logs query', () => {
    /**
     * @objective Verify a response from two cluster nodes shows the node menu and each row's node,
     * and that picking a node sends it as the server_names filter.
     */
    test(
        'shows the node of each entry on a cluster and queries a single picked node',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            // # Open the server logs with a response from two nodes
            const {app, lastRequest} = await openWithMockedLogs(pw, (body) => {
                const names = body.server_names as string[];
                if (names.length) {
                    return Object.fromEntries(names.map((name) => [name, [logEntry(`queried ${name} alone`)]]));
                }
                return {'node-a': [logEntry('from node a')], 'node-b': [logEntry('from node b')]};
            });

            // * Verify the node menu shows all nodes and each row names its node
            await expect(app.admin.serverLogs.nodeInput.container).toHaveValue(formatMessage(Msg.admin.logs.allNodes));
            for (const [message, node] of [
                ['from node a', 'node-a'],
                ['from node b', 'node-b'],
            ]) {
                const badge = logEntryWith(app, message).parts.nodeText;
                await expect(badge).toBeVisible();
                await expect(badge).toHaveText(node);
                await expect(badge).toHaveAttribute('title', node);
            }

            // # Pick node-b
            await selectNode(app, 'node-b');

            // * Verify the query asks for node-b alone and its response replaces the list
            await expect.poll(() => lastRequest().body.server_names).toEqual(['node-b']);
            await expect(logEntryWith(app, 'queried node-b alone').row).toBeVisible();
            await expect(logEntryWith(app, 'from node a').row).toHaveCount(0);
        },
    );

    /**
     * @objective Verify the entry a cluster returns for a node it could not reach is shown as an
     * error and survives a time range, while the viewer hides other entries older than the range.
     */
    test(
        'keeps the failed node entry visible under a time range that hides older entries',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            // # Open the server logs with an hour-old entry and a failed node entry stamped an hour
            // ago, as by a server clock behind the browser's. The response ignores the date filter,
            // like a node that predates it.
            const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const {timestamp} = logEntry('', 'error', anHourAgo);
            const failedNode = {
                timestamp,
                level: 'error',
                msg: 'Failed to fetch logs from node',
                error: 'connection refused',
                failed_node: true,
            };
            const {app, lastRequest} = await openWithMockedLogs(pw, () => ({
                'node-a': [logEntry('an hour old entry', 'info', anHourAgo)],
                'node-b': [failedNode],
            }));

            // * Verify the failed node is listed as an error
            const failed = logEntryWith(app, 'Failed to fetch logs from node');
            await expect(failed.parts.levelText).toHaveMessage(Msg.admin.logs.level.error);

            // # Apply the 5 minute range
            await selectDuration(app, 5);

            // * Verify the range is sent, the old entry is hidden and the failed node entry stays
            await expect
                .poll(() => lastRequest().body.date_from)
                .toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \+00:00$/);
            await expect(logEntryWith(app, 'an hour old entry').row).toHaveCount(0);
            await expect(failed.row).toBeVisible();
        },
    );

    /**
     * @objective Verify levels outside the four filter entries are shown in their group's color,
     * kept or hidden with their group, and sent with the query when filtering.
     */
    test(
        'filters fatal and trace entries with the error and debug levels',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            // # Open the server logs with a fatal, a trace and an info entry
            const {app, lastRequest} = await openWithMockedLogs(pw, () => ({
                'node-a': [
                    logEntry('a fatal entry', 'fatal'),
                    logEntry('a trace entry', 'trace'),
                    logEntry('an info entry', 'info'),
                ],
            }));

            // * Verify the fatal entry shows its own level in the error color
            const fatal = logEntryWith(app, 'a fatal entry');
            await expect(fatal.parts.levelText).toHaveText('fatal');
            await expect(fatal.parts.levelText).toHaveClass(/LogRow__level--error/);

            // # Uncheck Debug
            await toggleLevel(app, 'debug', false);

            // * Verify every level of the other groups is queried
            await expect
                .poll(() => lastRequest().body.log_levels)
                .toEqual(['panic', 'fatal', 'critical', 'error', 'warn', 'info', 'stdlog']);

            // * Verify the fatal entry stays and the trace entry is hidden with Debug
            await expect(fatal.row).toBeVisible();
            await expect(logEntryWith(app, 'an info entry').row).toBeVisible();
            await expect(logEntryWith(app, 'a trace entry').row).toHaveCount(0);
        },
    );

    /**
     * @objective Verify a node returning a full page of entries marks the footer total with a
     * trailing "+", since older entries weren't loaded.
     */
    test(
        'marks the total as capped when a node returns the maximum number of entries',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            // # Open the server logs with a full page of entries from one node
            const fullPage = Array.from({length: LOGS_PAGE_SIZE}, (_, i) => logEntry(`entry ${i}`));
            const {app, lastRequest} = await openWithMockedLogs(pw, () => ({'node-a': fullPage}));

            // * Verify the page size is requested and the footer total is shown as a lower bound
            expect(lastRequest().params.get('logs_per_page')).toBe(String(LOGS_PAGE_SIZE));
            await expect(app.admin.serverLogs.footerInfoText).toHaveText(
                new RegExp(`^Showing \\d+ - \\d+ of ${LOGS_PAGE_SIZE.toLocaleString('en-US')}\\+$`),
            );
        },
    );

    /**
     * @objective Verify the search term is sent to the logs query API, so the server searches
     * the whole log file rather than only the entries already loaded.
     */
    test('sends the search term with the logs query', {tag: ['@system_console', '@server_logs']}, async ({pw}) => {
        // # Open the server logs
        const {app, lastRequest} = await openWithMockedLogs(pw, (body) => ({
            'node-a': [logEntry(body.search === 'needle' ? 'found by the server search for needle' : 'unsearched')],
        }));

        // * Verify the first query has no search term
        expect(lastRequest().body.search).toBe('');

        // # Search for a term
        await app.admin.serverLogs.search.container.fill('needle');

        // * Verify the term is sent with the query and the searched response is listed
        await expect.poll(() => lastRequest().body.search).toBe('needle');
        await expect(logEntryWith(app, 'found by the server search for needle').row).toBeVisible();
    });
});
