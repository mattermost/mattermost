// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

/**
 * System Console -> Reporting -> Server Logs
 *
 * The page renders one of two viewers depending on the selected log format:
 * the structured viewer (JSON logs, one expandable row per entry) or the plain
 * text viewer.
 *
 * The filter row is built from the same Menu.Container selectors the rest of
 * the system console uses. Their triggers are divs rather than buttons, so they
 * are located by their aria-label and the values they show are read off the
 * readonly input inside them.
 */
export default class ServerLogs {
    readonly container: Locator;

    // Filter row selectors
    readonly logFormatMenuButton: Locator;
    readonly logFormatValue: Locator;
    readonly levelsMenuButton: Locator;
    readonly durationMenuButton: Locator;
    readonly durationValue: Locator;
    readonly liveTailMenuButton: Locator;
    readonly liveTailValue: Locator;

    // Structured viewer
    readonly searchInput: Locator;
    readonly clearSearchButton: Locator;
    readonly list: Locator;
    readonly rows: Locator;
    readonly reloadButton: Locator;
    readonly lastUpdated: Locator;

    // Plain text viewer
    readonly lineNumbersButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.logFormatMenuButton = container.getByLabel('Open menu to select the log format');
        this.logFormatValue = container.getByLabel('Log format', {exact: true});
        this.levelsMenuButton = container.getByLabel('Open menu to select which log levels to show');
        this.durationMenuButton = container.getByLabel('Open menu to select a time range');
        this.durationValue = container.getByLabel('Duration', {exact: true});
        this.liveTailMenuButton = container.getByLabel('Open menu to turn live tail on or off');
        this.liveTailValue = container.getByLabel('Live tail', {exact: true});

        this.searchInput = container.getByLabel('Search logs', {exact: true});
        this.clearSearchButton = container.getByRole('button', {name: 'Clear search'});
        this.list = container.getByRole('list', {name: 'Server log entries'});
        this.rows = this.list.getByRole('listitem');
        this.reloadButton = container.getByRole('button', {name: 'Reload'});

        // The elapsed-time indicator is a plain span with no role or stable text
        this.lastUpdated = container.locator('.LogViewer__last-updated');

        this.lineNumbersButton = container.getByRole('button', {name: 'Lines'});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await expect(this.list).toBeVisible();
    }

    /**
     * A log row matching the given text. Log entries are unique per test, so this
     * is expected to resolve to a single row.
     */
    row(text: string): Locator {
        return this.rows.filter({hasText: text});
    }

    async search(term: string) {
        await this.searchInput.fill(term);
    }

    /**
     * Turn live tail on at the given poll interval, e.g. 'Every 5 seconds'.
     * Picking an interval is what enables polling.
     */
    async selectLiveTailInterval(interval: string) {
        await this.liveTailMenuButton.click();
        await this.page().getByRole('menuitemradio', {name: interval}).click();
    }

    /**
     * Apply a time range, e.g. 'Last 5 minutes' or 'All time'.
     */
    async selectDuration(duration: string) {
        await this.durationMenuButton.click();
        await this.page().getByRole('menuitemradio', {name: duration, exact: true}).click();
    }

    async selectStructuredFormat() {
        await this.selectLogFormat('Structured');
    }

    async selectPlainFormat() {
        await this.selectLogFormat('Plain text');
    }

    async toBeStructuredFormat() {
        await expect(this.logFormatValue).toHaveValue('Structured');
        await expect(this.searchInput).toBeVisible();
    }

    async toBePlainFormat() {
        await expect(this.logFormatValue).toHaveValue('Plain text');
        await expect(this.lineNumbersButton).toBeVisible();
        await expect(this.searchInput).not.toBeVisible();
    }

    private async selectLogFormat(format: string) {
        await this.logFormatMenuButton.click();
        await this.page().getByRole('menuitemradio', {name: format, exact: true}).click();
    }

    /**
     * Menus render in a portal outside the page container, so their items have to
     * be located from the page rather than from the container.
     */
    private page() {
        return this.container.page();
    }
}
