// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, openSystemConsoleSection, type App} from '@mattermost/playwright-lib';

/** Area label as the page shows it, by the area key the page keys its groups by. */
const AREA_KEY: Record<string, string> = {
    Authentication: 'auth',
    Database: 'database',
    Search: 'search',
    Jobs: 'jobs',
    'High availability': 'cluster',
    Notifications: 'notifications',
    Compliance: 'compliance',
    Platform: 'platform',
    Licensing: 'license',
    Updates: 'version',
};

const FINDING_ROW = /^admin\.health\.finding:.+--listitem$/;
const FINDING_TESTID = /^admin\.health\.finding:(.*)--listitem$/;

type Health = App['admin']['health'];
type FindingPage = ReturnType<Health['finding']>;
type AreaPage = ReturnType<Health['area']>;

export type SiteHealthPage = {
    health: Health;
    rows: (title: string, within?: Locator) => Locator;
    goto: () => Promise<void>;
    toBeVisible: () => Promise<void>;
    finding: (title: string) => Promise<FindingPage>;
    expand: (title: string) => Promise<FindingPage>;
    section: (label: string) => Locator;
    area: (label: string) => {
        area: AreaPage;
        count: Locator;
        rows: (title: string) => Locator;
        expand: () => Promise<void>;
    };
    lastEvaluatedTime: Locator;
    runChecks: () => Promise<void>;
    selectTab: (key: HealthTab) => Promise<void>;
    setGroupBy: (key: 'category' | 'severity') => Promise<void>;
    showMuted: () => Promise<void>;
    openFromSidebar: () => Promise<void>;
};

type HealthTab = Parameters<Health['tab']>[0];

/**
 * System Console > Reporting > Site health on the generated page objects. Findings are keyed by fingerprint, but the
 * specs know a finding by the rule's title, so a row is found by its title first (`rows`) and used through the
 * generated page object once it shows (`finding`).
 */
export function siteHealthPage(app: App): SiteHealthPage {
    const {health} = app.admin;

    /** The finding rows whose text contains `title`, optionally only those within `within`. */
    function rows(title: string, within?: Locator): Locator {
        // Within a section or area the rows are found from that scope by the same testid pattern as the list's.
        const all = within ? within.getByTestId(FINDING_ROW) : health.findingList.locator;
        return all.filter({hasText: title});
    }

    return {
        health,
        rows,

        async goto() {
            await app.page.goto('/admin_console/reporting/site_health');
            await this.toBeVisible();
        },

        async toBeVisible() {
            await expect(app.admin.header).toHaveText('Site health');
            await expect(health.notEvaluated.locator.or(health.lastEvaluatedText.locator)).toBeVisible();
        },

        /** The generated page object of the finding titled `title`, once its row shows. */
        async finding(title: string) {
            const row = rows(title);
            await expect(row).toHaveCount(1);
            const testId = await row.getAttribute('data-testid');
            const key = FINDING_TESTID.exec(testId ?? '')?.[1];
            expect(key, `fingerprint in the test id of the "${title}" row`).toBeTruthy();
            return health.finding(key!);
        },

        /** A severity section, such as "Info", shown when grouping by severity: its region, named by its heading. */
        section(label: string): Locator {
            // The sections have no declared part; each is a region named by its heading, which reads the label and count.
            return health.findingsTabPanel.locator.getByRole('region', {name: new RegExp(`^${label} ?\\d+$`)});
        },

        /** A collapsible area section, such as "Authentication", shown when grouping by category. */
        area(label: string) {
            const area = health.area(AREA_KEY[label] ?? label);
            return {
                area,
                // The finding count has no declared part; it is the "N findings" text of the area's heading.
                count: area.container.locator.getByText(/^\d+ findings?$/),
                rows: (title: string) => rows(title, area.container.locator),
                async expand() {
                    if ((await area.toggleButton.locator.getAttribute('aria-expanded')) !== 'true') {
                        await area.toggleButton.click();
                    }
                    await expect(area.toggleButton.locator).toHaveAttribute('aria-expanded', 'true');
                },
            };
        },

        get lastEvaluatedTime(): Locator {
            return health.lastEvaluatedText.locator.locator('time');
        },

        /** Starts a run with Re-run checks and waits until the page shows its findings. */
        async runChecks() {
            // Last evaluated and the findings load together, so a new time means the new findings are shown.
            const time = this.lastEvaluatedTime;
            const before = (await time.count()) ? await time.getAttribute('datetime') : null;
            await health.runButton.click();
            if (before) {
                await expect(time).not.toHaveAttribute('datetime', before, {timeout: 60000});
            } else {
                await expect(time).toBeVisible({timeout: 60000});
            }
            await expect(health.runButton.locator).toBeEnabled();
            await expect(health.lastEvaluatedText.locator).toHaveText('Last evaluated just now');
        },

        /** Expands the finding titled `title` (if it is collapsed) and returns its page object. */
        async expand(title: string) {
            const row = await this.finding(title);
            if ((await row.toggleButton.locator.getAttribute('aria-expanded')) !== 'true') {
                await row.toggleButton.click();
            }
            await expect(row.toggleButton.locator).toHaveAttribute('aria-expanded', 'true');
            return row;
        },

        /** Selects a findings tab and waits for it to show as selected. */
        async selectTab(key: HealthTab) {
            const tab = health.tab(key);
            await tab.select();
            await expect(tab.locator).toHaveAttribute('aria-selected', 'true');
        },

        /** Groups the findings by category or by severity and waits for the button to show as pressed. */
        async setGroupBy(key: 'category' | 'severity') {
            const button = health.groupBy(key);
            await button.setPressed(true);
            await expect(button.locator).toHaveAttribute('aria-pressed', 'true');
        },

        /** Shows the muted findings and waits for the toggle to show as pressed. */
        async showMuted() {
            await health.showMutedToggleButton.toggle();
            await expect(health.showMutedToggleButton.locator).toHaveAttribute('aria-pressed', 'true');
        },

        /** Opens the page from the System Console sidebar. */
        async openFromSidebar() {
            await openSystemConsoleSection(app);
            await app.admin.sidebar.category('reporting').section('site_health').titleLink.click();
            await expect(app.page).toHaveURL(/\/admin_console\/reporting\/site_health$/);
        },
    };
}

type FindingRow = ReturnType<ReturnType<typeof siteHealthPage>['health']['finding']>;

/** The trend line of a finding row ("Firing for 3h", "Resolved ...", "Unevaluated for ..."); it has no declared part. */
export function trendOf(row: FindingRow): Locator {
    return row.container.locator.getByText(/^(Firing for|Resolved|Unevaluated for) /);
}

/** The value listed under a term in a finding's Details section, such as "Severity" or "First detected". */
export function detailOf(row: FindingRow, term: string): Locator {
    // The details list has no declared parts; each value is the definition following its term.
    return row.container.locator
        .getByRole('term')
        .filter({hasText: new RegExp(`^${term}$`)})
        .locator('xpath=following-sibling::dd[1]');
}

/** The remediation heading and the links of an expanded finding; none has a declared part. */
export function remediationOf(row: FindingRow) {
    const scope = row.container.locator;
    return {
        heading: scope.getByRole('heading', {name: 'How to fix it'}),
        openSettingLink: scope.getByRole('link', {name: 'Open this setting in the System Console'}),
        docsLink: scope.getByRole('link', {name: 'Read the documentation'}),
    };
}
