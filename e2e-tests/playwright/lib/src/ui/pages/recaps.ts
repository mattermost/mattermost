// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, Page, expect} from '@playwright/test';

import {duration} from '@/util';

class CreateRecapModal {
    readonly container: Locator;
    readonly titleInput: Locator;
    readonly channelSearchInput: Locator;

    constructor(private readonly page: Page) {
        this.container = page.locator('#createRecapModal');
        this.titleInput = this.container.locator('#recap-name-input');
        this.channelSearchInput = this.container.getByPlaceholder('Search and select channels');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async fillTitle(title: string) {
        await expect(this.titleInput).toBeVisible();
        await this.titleInput.fill(title);
    }

    async selectSelectedChannels() {
        await this.container.getByRole('button', {name: 'Recap selected channels'}).click();
    }

    async selectAllUnreads() {
        await this.container.getByRole('button', {name: 'Recap all my unreads'}).click();
    }

    async clickNext() {
        await this.container.getByRole('button', {name: 'Next'}).click();
    }

    async clickPrevious() {
        await this.container.getByRole('button', {name: 'Previous'}).click();
    }

    async startRecap() {
        await this.container.getByRole('button', {name: 'Start recap'}).click();
        await expect(this.container).not.toBeVisible({timeout: duration.ten_sec});
    }

    async createSchedule() {
        await this.container.getByRole('button', {name: 'Create schedule'}).click();
        await expect(this.container).not.toBeVisible({timeout: duration.ten_sec});
    }

    async enableRunOnce() {
        const runOnce = this.container.locator('#run-once-toggle');
        await expect(runOnce).toBeVisible();
        if ((await runOnce.getAttribute('aria-pressed')) !== 'true') {
            await runOnce.click();
        }
    }

    async expectChannelSelectorVisible() {
        await expect(this.channelSearchInput).toBeVisible();
    }

    async expectChannelSelectorHidden() {
        await expect(this.channelSearchInput).not.toBeVisible();
    }

    async searchChannel(channelName: string) {
        await this.channelSearchInput.fill(channelName);
    }

    getChannelOption(channelName: string) {
        return this.container.locator('.channel-selector-item').filter({hasText: channelName});
    }

    async selectChannel(channelName: string) {
        const channelOption = this.getChannelOption(channelName);
        await expect(channelOption).toBeVisible();
        await channelOption.click();
        await expect(channelOption.locator('input[type="checkbox"]')).toBeChecked();
    }

    async expectSummaryChannels(channelNames: string[]) {
        for (const channelName of channelNames) {
            await expect(this.container.locator('.summary-channel-item').filter({hasText: channelName})).toBeVisible();
        }
    }

    async expectScheduleConfigurationVisible() {
        await expect(this.container.getByText('On which days should your recap run?')).toBeVisible();
        await expect(this.container.getByRole('button', {name: 'Create schedule'})).toBeVisible();
    }

    async selectScheduleDay(dayLabel: string) {
        await this.container.getByRole('button', {name: dayLabel, exact: true}).click();
    }

    async selectAgent(agentName: string) {
        await this.container.getByLabel('Agent selector').click();
        await this.page
            .getByRole('menuitem', {name: new RegExp(`^${escapeRegExp(agentName)}(?: \\(default\\))?$`)})
            .click();
    }
}

class RecapChannelCard {
    readonly channelButton: Locator;
    readonly collapseButton: Locator;
    readonly menuButton: Locator;

    constructor(
        private readonly page: Page,
        readonly container: Locator,
    ) {
        this.channelButton = container.locator('.recap-channel-name-tag');
        this.collapseButton = container.locator('.recap-channel-collapse-button');
        // Scope to header actions so we do not match the parent .recap-channel-header (role="button").
        this.menuButton = container
            .locator('.recap-channel-header-actions')
            .getByRole('button', {name: /Options for /});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async clickChannelName() {
        await this.channelButton.click();
    }

    async toggleCollapse() {
        await this.collapseButton.click();
    }

    async expectText(text: string) {
        await expect(this.container).toContainText(text);
    }

    async openMenuAction(actionName: string) {
        await this.menuButton.click();
        await this.page.getByRole('menuitem', {name: actionName}).click();
    }
}

class RecapItem {
    readonly header: Locator;
    readonly markReadButton: Locator;
    readonly deleteButton: Locator;
    readonly menuButton: Locator;

    constructor(
        private readonly page: Page,
        readonly container: Locator,
    ) {
        this.header = container.locator('.recap-item-header');
        this.markReadButton = container.getByRole('button', {name: 'Mark read'});
        this.deleteButton = container.locator('.recap-delete-button');
        this.menuButton = this.header.getByRole('button', {name: /Options for /});
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expectProcessing() {
        await expect(this.container).toContainText("Recap created. You'll receive a summary shortly");
        await expect(this.container).toContainText("We're working on your recap. Check back shortly");
    }

    async expectFailed() {
        await expect(this.container).toContainText('Failed');
    }

    async expectText(text: string) {
        await expect(this.container).toContainText(text);
    }

    async isExpanded() {
        const className = await this.container.getAttribute('class');
        return className?.includes('expanded') ?? false;
    }

    async expand() {
        if (await this.isExpanded()) {
            return;
        }
        await this.header.click();
        await expect(this.container).toHaveClass(/expanded/);
    }

    async clickMarkRead() {
        await this.markReadButton.click();
    }

    async clickDelete() {
        await this.deleteButton.click();
    }

    async openMenuAction(actionName: string) {
        await this.menuButton.click();
        await this.page.getByRole('menuitem', {name: actionName}).click();
    }

    getChannelCard(channelName: string) {
        return new RecapChannelCard(
            this.page,
            this.container.locator('.recap-channel-card').filter({hasText: channelName}).first(),
        );
    }
}

class ScheduledRecapItem {
    readonly menuButton: Locator;
    readonly schedulePattern: Locator;
    readonly toggleButton: Locator;

    constructor(
        private readonly page: Page,
        readonly container: Locator,
    ) {
        this.menuButton = container.getByRole('button', {name: /Options for /});
        this.schedulePattern = container.locator('.schedule-pattern');
        this.toggleButton = container.locator('.scheduled-recap-toggle button');
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }

    async expectText(text: string | RegExp) {
        await expect(this.container).toContainText(text);
    }

    async expectSchedulePattern(text: string | RegExp) {
        await expect(this.schedulePattern).toBeVisible();
        await expect(this.schedulePattern).toContainText(text);
    }

    async expectActive() {
        await expect(this.toggleButton).toHaveAttribute('aria-pressed', 'true');
        await expect(this.toggleButton).toHaveAccessibleName('Active - click to pause');
    }

    async expectPaused() {
        await expect(this.toggleButton).toHaveAttribute('aria-pressed', 'false');
        await expect(this.toggleButton).toHaveAccessibleName('Paused - click to resume');
    }

    async pause() {
        await this.expectActive();
        await this.toggleButton.click();
        await this.expectPaused();
    }

    async resume() {
        await this.expectPaused();
        await this.toggleButton.click();
        await this.expectActive();
    }

    async openMenuAction(actionName: string) {
        await this.menuButton.click();
        await this.page.getByRole('menuitem', {name: actionName}).click();
    }
}

export default class RecapsPage {
    readonly heading: Locator;
    readonly unreadTab: Locator;
    readonly readTab: Locator;
    readonly scheduledTab: Locator;
    readonly addRecapButton: Locator;
    readonly createRecapModal: CreateRecapModal;

    constructor(readonly page: Page) {
        this.heading = page.getByRole('heading', {name: 'Recaps'});
        this.unreadTab = page.getByRole('button', {name: 'Unread', exact: true});
        this.readTab = page.getByRole('button', {name: 'Read', exact: true});
        this.scheduledTab = page.getByRole('button', {name: 'Scheduled', exact: true});
        this.addRecapButton = page.getByRole('button', {name: 'Add a recap'});
        this.createRecapModal = new CreateRecapModal(page);
    }

    async goto(teamName: string) {
        await this.page.goto(`/${teamName}/recaps`);
        await this.dismissViewInBrowserPrompt();
    }

    async toBeVisible() {
        await expect(this.page).toHaveURL(/.*\/recaps/);
        await expect(this.heading).toBeVisible({timeout: duration.one_min});
    }

    async dismissViewInBrowserPrompt() {
        const viewInBrowserButton = this.page.getByRole('button', {name: 'View in Browser'});
        if (await viewInBrowserButton.isVisible({timeout: 1000}).catch(() => false)) {
            await viewInBrowserButton.click();
        }
    }

    async openCreateRecap() {
        await this.addRecapButton.click();
        await this.createRecapModal.toBeVisible();
        return this.createRecapModal;
    }

    async switchToUnread() {
        await this.unreadTab.click();
        await expect(this.unreadTab).toHaveClass(/active/);
    }

    async switchToRead() {
        await this.readTab.click();
        await expect(this.readTab).toHaveClass(/active/);
    }

    async switchToScheduled() {
        await this.scheduledTab.click();
        await expect(this.scheduledTab).toHaveClass(/active/);
    }

    async expectSetupPlaceholder() {
        await expect(this.page.getByRole('heading', {name: 'Set up your recap'})).toBeVisible();
        await expect(
            this.page.getByText(
                'Recaps help you get caught up quickly on discussions that are most important to you with a summarized report.',
            ),
        ).toBeVisible();
        await expect(this.page.getByRole('button', {name: 'Create a recap'})).toBeVisible();
    }

    async expectCaughtUpEmptyState() {
        await expect(this.page.getByRole('heading', {name: "You're all caught up"})).toBeVisible();
        await expect(this.page.getByText("You don't have any recaps yet. Create one to get started.")).toBeVisible();
    }

    async expectAddRecapDisabled(reason: string) {
        await expect(this.addRecapButton).toBeDisabled();
        await expect(this.addRecapButton).toHaveAttribute('title', reason);
    }

    async confirmDelete() {
        const dialog = this.page.locator('#confirmModal');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', {name: 'Delete'}).click();
        await expect(dialog).not.toBeVisible({timeout: duration.ten_sec});
    }

    getRecap(title: string) {
        return new RecapItem(
            this.page,
            this.page
                .locator('.recap-item, .recap-processing')
                .filter({
                    has: this.page.getByRole('heading', {name: title, exact: true}),
                })
                .first(),
        );
    }

    getScheduledRecap(title: string) {
        return new ScheduledRecapItem(
            this.page,
            this.page
                .locator('.scheduled-recap-item')
                .filter({
                    has: this.page.getByRole('heading', {name: title, exact: true}),
                })
                .first(),
        );
    }

    async expectRecapNotVisible(title: string) {
        await expect(this.page.getByRole('heading', {name: title, exact: true})).not.toBeVisible();
    }

    async expectScheduledRecapNotVisible(title: string) {
        await expect(this.page.getByRole('heading', {name: title, exact: true})).not.toBeVisible();
    }
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
