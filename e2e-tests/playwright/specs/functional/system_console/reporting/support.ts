// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {systemConsolePath, expect, formatMessage, Msg, type App} from '@mattermost/playwright-lib';

type Logs = App['admin']['serverLogs'];
type AdminInterval = Parameters<Logs['liveTailMenu']['interval']>[0];
type AdminLevel = Parameters<Logs['levelsMenu']['level']>[0];
type AdminPreset = Parameters<Logs['durationMenu']['preset']>[0];

/**
 * The System Console's Server Logs page on the generated `app.admin.serverLogs`: its filter row (each filter is a
 * menu opened by its button, whose value shows in a read-only textbox), the entries and the plain text viewer.
 */

/** Opens the page, on `query` ("?search=timeout&range=60") to open it with filters, once the System Console shows. */
export async function gotoServerLogs(app: App, query = '') {
    await app.page.goto(systemConsolePath('reporting/server_logs') + query);
    await expect(app.backstage.navbar).toBeVisible();
    await expect(app.backstage.navbar.backLink).toBeVisible();
    await expect(app.admin.sidebar).toBeVisible();
}

/** The page once its structured viewer shows (a plain text viewer has no entry list). */
export async function expectStructuredViewer(app: App) {
    await expect(app.admin.serverLogs.entriesList).toBeVisible();
}

/** Every entry the structured viewer lists. */
export function logEntries(app: App) {
    return app.admin.serverLogs.entry.locator;
}

/**
 * The entry whose text contains `text` (the entries of a test are unique): its row, and its parts (level, node,
 * message and the toggle that expands it) found inside the row.
 */
export function logEntryWith(app: App, text: string) {
    const row = logEntries(app).filter({hasText: text});
    // Log entries have no stable key; scope the declared parts to the content-matched row.
    const entry = app.admin.serverLogs.entry;
    return {
        row,
        parts: {
            nodeText: row.getByTestId(entry.nodeText.meta.testId),
            levelText: row.getByTestId(entry.levelText.meta.testId),
            toggleButton: row.getByTestId(entry.toggleButton.meta.testId),
        },
    };
}

/** Turns live tail on at the given poll interval: picking an interval is what enables polling. */
export async function selectLiveTailInterval(app: App, interval: AdminInterval) {
    const menu = app.admin.serverLogs.liveTailMenu;
    await app.admin.serverLogs.liveTailButton.clickTo(menu.interval(interval));
    // Menu-item drivers have no text-reading verb; this is the label the input displays after selection.
    const label = await menu.interval(interval).locator.innerText();
    await menu.interval(interval).click();
    await expect(app.admin.serverLogs.liveTailInput.container).toHaveValue(label);
}

/** Shows a single node. The node menu is only shown on a cluster. */
export async function selectNode(app: App, node: string) {
    const menu = app.admin.serverLogs.nodeMenu;
    await app.admin.serverLogs.nodeButton.clickTo(menu.node(node));
    await menu.node(node).click();
    await expect(app.admin.serverLogs.nodeInput.container).toHaveValue(node);
}

/** Sets a level in the levels menu (checked or unchecked, from the opposite state), then closes the menu. */
export async function toggleLevel(app: App, level: AdminLevel, checked: boolean) {
    const menu = app.admin.serverLogs.levelsMenu;
    const option = menu.level(level);
    await app.admin.serverLogs.levelsButton.clickTo(option);
    await expect(option).toHaveAttribute('aria-checked', String(!checked));
    await option.click();
    await expect(option).toHaveAttribute('aria-checked', String(checked));
    await app.page.keyboard.press('Escape');
    await expect(option).not.toBeVisible();
}

/** Applies a time range: one of the presets (minutes), or all time. */
export async function selectDuration(app: App, range: AdminPreset | 'all') {
    const menu = app.admin.serverLogs.durationMenu;
    const option = range === 'all' ? menu.allMenuItemRadio : menu.preset(range);
    await app.admin.serverLogs.durationButton.clickTo(option);
    await option.click();
    await expect(option).not.toBeVisible();
}

/** Opens the custom range dialog from the Duration menu and applies the range it starts with, the last hour. */
export async function applyDefaultCustomRange(app: App) {
    const menu = app.admin.serverLogs.durationMenu;
    await app.admin.serverLogs.durationButton.clickTo(menu.customMenuItemRadio);
    const dialog = await menu.customMenuItemRadio.clickTo(app.admin.serverLogs.customRange);
    await expect(dialog).toBeVisible();
    await dialog.confirmButton.click();
    await expect(dialog).not.toBeVisible();
}

/** The viewer for the format that shows: the structured one has a search box, the plain text one line numbers. */
export async function expectLogFormat(app: App, format: 'structured' | 'plain') {
    const logs = app.admin.serverLogs;
    if (format === 'structured') {
        await expect(logs.logFormatInput.container).toHaveValue(formatMessage(Msg.admin.logs.logFormatStructured));
        await expect(logs.search.container).toBeVisible();
    } else {
        await expect(logs.logFormatInput.container).toHaveValue(formatMessage(Msg.admin.logs.logFormatPlain));
        await expect(logs.lineNumbersToggleButton).toBeVisible();
        await expect(logs.search.container).not.toBeVisible();
    }
}

/** Switches the log format from the Log format menu. */
export async function selectLogFormat(app: App, format: 'structured' | 'plain') {
    const menu = app.admin.serverLogs.logFormatMenu;
    const option = format === 'structured' ? menu.structuredMenuItemRadio : menu.plainMenuItemRadio;
    await app.admin.serverLogs.logFormatButton.clickTo(option);
    await option.click();
    await expect(app.admin.serverLogs.logFormatInput.container).toHaveValue(
        formatMessage(format === 'structured' ? Msg.admin.logs.logFormatStructured : Msg.admin.logs.logFormatPlain),
    );
}
