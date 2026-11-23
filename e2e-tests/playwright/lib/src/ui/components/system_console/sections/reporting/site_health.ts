// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A single finding row. Its header button, named after the finding, expands the row to show
 * the remediation, links and details below it.
 */
export class SiteHealthFinding {
    readonly container: Locator;

    readonly header: Locator;
    readonly severityBadge: Locator;
    readonly area: Locator;
    readonly trend: Locator;
    readonly mutedBy: Locator;
    readonly muteButton: Locator;
    readonly unmuteButton: Locator;

    // Expanded detail
    readonly remediationHeading: Locator;
    readonly openSettingLink: Locator;
    readonly docsLink: Locator;
    readonly goToSettingButton: Locator;

    constructor(container: Locator, title: string) {
        this.container = container;

        this.header = container.getByRole('button', {name: new RegExp(`^${escapeRegExp(title)}`)});
        this.severityBadge = container.getByTestId('healthFindingBadge');
        this.area = container.getByTestId('healthFindingArea');
        this.trend = container.getByText(/^(Firing for|Resolved|Unevaluated for) /);
        this.mutedBy = container.getByTestId('healthFindingMutedBy');
        this.muteButton = container.getByRole('button', {name: 'Mute', exact: true});
        this.unmuteButton = container.getByRole('button', {name: 'Unmute', exact: true});

        this.remediationHeading = container.getByRole('heading', {name: 'How to fix it'});
        this.openSettingLink = container.getByRole('link', {name: 'Open this setting in the System Console'});
        this.docsLink = container.getByRole('link', {name: 'Read the documentation'});
        this.goToSettingButton = container.getByRole('button', {name: 'Go to setting'});
    }

    /** The value listed under a term in the Details section, such as "Severity" or "First detected". */
    detail(term: string): Locator {
        return this.container
            .getByRole('term')
            .filter({hasText: new RegExp(`^${escapeRegExp(term)}$`)})
            .locator('xpath=following-sibling::dd[1]');
    }

    async expand() {
        if ((await this.header.getAttribute('aria-expanded')) !== 'true') {
            await this.header.click();
        }
        await expect(this.header).toHaveAttribute('aria-expanded', 'true');
    }
}

/** The finding row titled `title` within `scope`. Titles are unique per rule on a single-node server. */
function findingIn(scope: Locator, title: string): SiteHealthFinding {
    const row = scope.getByTestId(/^healthFinding-/).filter({has: scope.page().getByText(title, {exact: true})});
    return new SiteHealthFinding(row, title);
}

/** A severity section, such as "Info", shown when grouping by severity. */
export class SiteHealthSection {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    finding(title: string): SiteHealthFinding {
        return findingIn(this.container, title);
    }
}

/** A collapsible area section, such as "Authentication", shown when grouping by category. */
export class SiteHealthArea {
    readonly container: Locator;
    readonly toggle: Locator;
    readonly count: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.toggle = container.getByRole('heading').getByRole('button');
        this.count = container.getByText(/^\d+ findings?$/);
    }

    finding(title: string): SiteHealthFinding {
        return findingIn(this.container, title);
    }

    async expand() {
        if ((await this.toggle.getAttribute('aria-expanded')) !== 'true') {
            await this.toggle.click();
        }
        await expect(this.toggle).toHaveAttribute('aria-expanded', 'true');
    }
}

/**
 * System Console -> Reporting -> Site health
 */
export default class SiteHealth {
    readonly container: Locator;

    readonly notEvaluated: Locator;
    readonly lastEvaluated: Locator;
    readonly lastEvaluatedTime: Locator;
    readonly rerunButton: Locator;
    readonly runningButton: Locator;

    readonly openTab: Locator;
    readonly warningTab: Locator;
    readonly infoTab: Locator;
    readonly resolvedTab: Locator;
    readonly mutedToggle: Locator;

    readonly groupByCategoryButton: Locator;

    constructor(container: Locator) {
        this.container = container;

        this.notEvaluated = container.getByText('Not evaluated yet', {exact: true});
        this.lastEvaluated = container.getByText(/^Last evaluated /);
        this.lastEvaluatedTime = this.lastEvaluated.locator('time');
        this.rerunButton = container.getByRole('button', {name: 'Re-run checks'});
        this.runningButton = container.getByRole('button', {name: 'Running checks…'});

        const tabs = container.getByRole('tablist', {name: 'Filter findings'});
        this.openTab = tabs.getByRole('tab', {name: /^Open/});
        this.warningTab = tabs.getByRole('tab', {name: /^Warning/});
        this.infoTab = tabs.getByRole('tab', {name: /^Info/});
        this.resolvedTab = tabs.getByRole('tab', {name: /^Recently resolved/});
        this.mutedToggle = container.getByRole('button', {name: /^Muted/});

        this.groupByCategoryButton = container
            .getByRole('group', {name: 'Group by'})
            .getByRole('button', {name: 'Category'});
    }

    async toBeVisible() {
        await expect(this.container.getByTestId('admin-console-header')).toHaveText('Site health');
        await expect(this.notEvaluated.or(this.lastEvaluated)).toBeVisible();
    }

    finding(title: string): SiteHealthFinding {
        return findingIn(this.container, title);
    }

    section(label: string): SiteHealthSection {
        // Each section is a region named by its heading, which reads the label followed by its count.
        return new SiteHealthSection(
            this.container.getByRole('region', {name: new RegExp(`^${escapeRegExp(label)} ?\\d+$`)}),
        );
    }

    area(label: string): SiteHealthArea {
        const title = this.container.page().getByText(label, {exact: true});
        return new SiteHealthArea(this.container.locator('section').filter({has: title}));
    }

    /** Starts a run with Re-run checks and waits until the page shows its findings. */
    async runChecks() {
        // Last evaluated and the findings load together, so a new time means the new findings are shown.
        const before = (await this.lastEvaluatedTime.count())
            ? await this.lastEvaluatedTime.getAttribute('datetime')
            : null;
        await this.rerunButton.click();
        if (before) {
            await expect(this.lastEvaluatedTime).not.toHaveAttribute('datetime', before, {timeout: 60000});
        } else {
            await expect(this.lastEvaluatedTime).toBeVisible({timeout: 60000});
        }
        await expect(this.rerunButton).toBeEnabled();
        await expect(this.lastEvaluated).toHaveText('Last evaluated just now');
    }
}
