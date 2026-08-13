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
 */
export default class ServerLogs {
    readonly container: Locator;

    // Log format toggle
    readonly structuredFormatOption: Locator;
    readonly plainFormatOption: Locator;

    // Structured viewer
    readonly searchInput: Locator;
    readonly clearSearchButton: Locator;
    readonly list: Locator;
    readonly rows: Locator;
    readonly reloadButton: Locator;
    readonly liveTailButton: Locator;
    readonly clearTimePresetButton: Locator;
    readonly lastUpdated: Locator;

    // Plain text viewer
    readonly lineNumbersButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.structuredFormatOption = container.getByRole('radio', {name: 'Structured'});
        this.plainFormatOption = container.getByRole('radio', {name: 'Plain text'});

        this.searchInput = container.getByPlaceholder('Search logs...');
        this.clearSearchButton = container.getByRole('button', {name: 'Clear search'});
        this.list = container.getByRole('list', {name: 'Server log entries'});
        this.rows = this.list.getByRole('listitem');
        this.reloadButton = container.getByRole('button', {name: 'Reload'});
        this.liveTailButton = container.getByRole('button', {name: 'Live', exact: true});
        this.clearTimePresetButton = container.getByRole('button', {name: 'Clear time preset'});

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

    /**
     * A time range preset button, e.g. '5m', '15m', '1h' or '24h'.
     */
    timePreset(label: string): Locator {
        return this.container.getByRole('button', {name: label, exact: true});
    }

    async search(term: string) {
        await this.searchInput.fill(term);
    }

    async toggleLiveTail() {
        await this.liveTailButton.click();
    }

    /**
     * Open the poll interval dropdown and pick an interval, e.g. '2s'.
     */
    async selectPollInterval(interval: string) {
        // The toggle shows the current interval and is only ambiguous with the
        // dropdown options, which are not rendered until it is open
        await this.container.getByRole('button', {name: /^\d+s$/}).click();

        // The dropdown has no landmark role of its own
        await this.container.locator('.LogViewer__poll-dropdown').getByRole('button', {name: interval}).click();
    }

    async selectStructuredFormat() {
        await this.structuredFormatOption.check();
    }

    async selectPlainFormat() {
        await this.plainFormatOption.check();
    }

    async toBeStructuredFormat() {
        await expect(this.structuredFormatOption).toBeChecked();
        await expect(this.searchInput).toBeVisible();
    }

    async toBePlainFormat() {
        await expect(this.plainFormatOption).toBeChecked();
        await expect(this.lineNumbersButton).toBeVisible();
        await expect(this.searchInput).not.toBeVisible();
    }
}
