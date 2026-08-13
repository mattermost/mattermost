// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {Client4} from '@mattermost/client';

/**
 * Write a uniquely identifiable entry to the server log.
 *
 * The client logs endpoint is the only way to put a known string into the server
 * log from a test. As a system admin the message is written at ERROR level, so it
 * passes the default INFO file log level.
 */
async function writeServerLogEntry(adminClient: Client4, marker: string) {
    adminClient.setEnableLogging(true);
    await adminClient.logClientError(marker);
}

test.describe('System Console - Reporting - Server Logs', () => {
    /**
     * @objective Verify the server logs page renders entries returned by the logs query API and
     * that search narrows them to a single matching entry.
     */
    test(
        'displays a newly written server log entry and narrows the list with search',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();
            const marker = `pw-log-${pw.random.id()}`;

            // # Write a uniquely identifiable entry to the server log
            await writeServerLogEntry(adminClient, marker);

            // # Log in as admin and go to the server logs page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.gotoServerLogs();
            await systemConsolePage.toBeVisible();

            const serverLogs = systemConsolePage.serverLogs;
            await serverLogs.toBeVisible();

            // * Verify the entry reaches the page. Reload until the server has flushed
            // it to the log file.
            await expect(async () => {
                await serverLogs.reloadButton.click();
                await expect(serverLogs.row(marker)).toBeVisible({timeout: 2000});
            }).toPass({timeout: 30000});

            // # Search for the entry
            await serverLogs.search(marker);

            // * Verify search narrows the list down to that entry alone
            await expect(serverLogs.rows).toHaveCount(1);
            await expect(serverLogs.row(marker)).toBeVisible();

            // # Clear the search
            await serverLogs.clearSearchButton.click();

            // * Verify the other entries come back
            await expect(serverLogs.rows).not.toHaveCount(1);
        },
    );

    /**
     * @objective Verify live tail polls the server and renders entries written after the page
     * was loaded, without the admin triggering a reload.
     */
    test(
        'picks up a new server log entry while live tail is on, without a manual reload',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();

            // # Log in as admin and go to the server logs page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.gotoServerLogs();
            await systemConsolePage.toBeVisible();

            const serverLogs = systemConsolePage.serverLogs;
            await serverLogs.toBeVisible();

            // # Turn on live tail at the shortest poll interval
            await serverLogs.selectPollInterval('5s');
            await serverLogs.toggleLiveTail();

            // * Verify polling is running
            await expect(serverLogs.lastUpdated).toBeVisible();

            // # Write an entry only after the page has loaded, so it can only arrive by polling
            const marker = `pw-log-${pw.random.id()}`;
            await writeServerLogEntry(adminClient, marker);

            // * Verify the entry appears without the reload button being used
            await expect(serverLogs.row(marker)).toBeVisible({timeout: 30000});
        },
    );

    /**
     * @objective Verify a time range preset is sent to the logs query API in a format the server
     * accepts, and that recent entries survive the filter.
     */
    test(
        'applies a time range preset through the logs query API',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            const {adminUser, adminClient} = await pw.initSetup();
            const marker = `pw-log-${pw.random.id()}`;

            // # Write a uniquely identifiable entry to the server log
            await writeServerLogEntry(adminClient, marker);

            // # Log in as admin and go to the server logs page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.gotoServerLogs();
            await systemConsolePage.toBeVisible();

            const serverLogs = systemConsolePage.serverLogs;
            await serverLogs.toBeVisible();

            // # Wait for the entry to reach the page
            await expect(async () => {
                await serverLogs.reloadButton.click();
                await expect(serverLogs.row(marker)).toBeVisible({timeout: 2000});
            }).toPass({timeout: 30000});

            // # Apply the 5 minute preset
            const page = systemConsolePage.page;
            const queryRequest = page.waitForRequest(
                (request) => request.url().includes('/api/v4/logs/query') && request.method() === 'POST',
            );
            const queryResponse = page.waitForResponse((response) => response.url().includes('/api/v4/logs/query'));
            await serverLogs.timePreset('5m').click();

            // * Verify both range bounds are sent in the layout the server parses. An
            // unparseable date is silently dropped server side rather than rejected, so
            // the response status alone would not catch a format change.
            const body = (await queryRequest).postDataJSON();
            const serverDateFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \+00:00$/;
            expect(body.date_from).toMatch(serverDateFormat);
            expect(body.date_to).toMatch(serverDateFormat);
            expect((await queryResponse).status()).toBe(200);

            // * Verify the just-written entry is still listed under the 5 minute range
            await expect(serverLogs.row(marker)).toBeVisible();

            // # Clear the preset
            await serverLogs.clearTimePresetButton.click();

            // * Verify the unfiltered list comes back
            await expect(serverLogs.rows.first()).toBeVisible();
        },
    );

    /**
     * @objective Verify the selected log format is remembered across a page reload.
     */
    test(
        'keeps the selected log format across a page reload',
        {tag: ['@system_console', '@server_logs']},
        async ({pw}) => {
            const {adminUser} = await pw.initSetup();

            // # Log in as admin and go to the server logs page
            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await systemConsolePage.gotoServerLogs();
            await systemConsolePage.toBeVisible();

            const serverLogs = systemConsolePage.serverLogs;

            // * Verify the structured viewer is shown by default
            await serverLogs.toBeStructuredFormat();

            // # Switch to plain text
            await serverLogs.selectPlainFormat();

            // * Verify the plain text viewer replaces the structured one
            await serverLogs.toBePlainFormat();

            // # Reload the page
            await systemConsolePage.page.reload();
            await systemConsolePage.toBeVisible();

            // * Verify plain text is still selected
            await serverLogs.toBePlainFormat();

            // # Switch back to structured
            await serverLogs.selectStructuredFormat();
            await systemConsolePage.page.reload();
            await systemConsolePage.toBeVisible();

            // * Verify structured is still selected
            await serverLogs.toBeStructuredFormat();
        },
    );
});
