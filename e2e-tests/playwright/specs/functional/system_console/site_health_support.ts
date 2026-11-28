// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, openSystemConsoleSection, systemConsolePath, type App} from '@mattermost/playwright-lib';

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

/** The severity section a label names, by the key the page keys its sections by. */
const SECTION_KEY = {
    Critical: 'critical',
    Warning: 'warning',
    Info: 'info',
    'Could not be evaluated': 'unknown',
    'Recently resolved': 'resolved',
} as const;

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
    section: (label: keyof typeof SECTION_KEY) => Locator;
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
        // Within a section or area the rows are found from that scope: the generated list is rooted at the page, so it
        // cannot be nested inside a region.
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the same finding rows, found inside a section or area region; the generated finding list is rooted at the page and cannot be scoped to one
        const all = within ? within.getByTestId(FINDING_ROW) : health.findingList.locator;

        // Rows are keyed by a hash of the finding, which the specs do not know: the rule's title is their handle, and
        // an absent title cannot be asserted through keyWith, which waits for a match.
        return all.filter({hasText: title});
    }

    return {
        health,
        rows,

        async goto() {
            await app.page.goto(systemConsolePath('reporting/site_health'));
            await this.toBeVisible();
        },

        async toBeVisible() {
            await expect(app.admin.header).toHaveText('Site health');
            await expect(health.notEvaluated.locator.or(health.lastEvaluatedText.locator)).toBeVisible();
        },

        /** The generated page object of the finding titled `title`, once its row shows. */
        async finding(title: string) {
            await expect(rows(title)).toHaveCount(1);
            return health.findingList.itemWith({text: title});
        },

        /** A severity section, such as "Info", shown when grouping by severity: its region, named by its heading. */
        section(label: keyof typeof SECTION_KEY): Locator {
            return health.section(SECTION_KEY[label]).container.locator;
        },

        /** A collapsible area section, such as "Authentication", shown when grouping by category. */
        area(label: string) {
            const area = health.area(AREA_KEY[label] ?? label);
            return {
                area,
                count: area.countText.locator,
                rows: (title: string) => rows(title, area.container.locator),
                async expand() {
                    // eslint-disable-next-line test-surface/e2e-no-conditional-logic -- expand-if-collapsed: the page opens the areas holding a firing critical itself, and the spec does not know which
                    if ((await area.toggleButton.locator.getAttribute('aria-expanded')) !== 'true') {
                        await area.toggleButton.click();
                    }
                    await expect(area.toggleButton).toBeExpanded();
                },
            };
        },

        get lastEvaluatedTime(): Locator {
            // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the <time> element is rendered by the shared Timestamp component, which cannot take this page's testid
            return health.lastEvaluatedText.locator.locator('time');
        },

        /** Starts a run with Re-run checks and waits until the page shows its findings. */
        async runChecks() {
            // Last evaluated and the findings load together, so a new time means the new findings are shown.
            const time = this.lastEvaluatedTime;
            // No time yet (never evaluated) reads as null, and the first run is the change away from it.
            const shown = () => time.evaluateAll((nodes) => nodes[0]?.getAttribute('datetime') ?? null);
            const before = await shown();
            await health.runButton.click();
            await expect.poll(shown, {timeout: 60000}).not.toBe(before);
            await expect(health.runButton.locator).toBeEnabled();
            await expect(health.lastEvaluatedText.locator).toHaveText('Last evaluated just now');
        },

        /** Expands the finding titled `title` (if it is collapsed) and returns its page object. */
        async expand(title: string) {
            const row = await this.finding(title);

            // eslint-disable-next-line test-surface/e2e-no-conditional-logic -- expand-if-collapsed: the page keeps a finding open across re-runs and tab switches, and callers do not know whether it already is
            if ((await row.toggleButton.locator.getAttribute('aria-expanded')) !== 'true') {
                await row.toggleButton.click();
            }
            await expect(row.toggleButton).toBeExpanded();
            return row;
        },

        /** Selects a findings tab and waits for it to show as selected. */
        async selectTab(key: HealthTab) {
            const tab = health.tab(key);
            await tab.select();
            await expect(tab).toBeSelected();
        },

        /** Groups the findings by category or by severity and waits for the button to show as pressed. */
        async setGroupBy(key: 'category' | 'severity') {
            const button = health.groupBy(key);
            await button.setPressed(true);
            await expect(button).toBePressed();
        },

        /** Shows the muted findings and waits for the toggle to show as pressed. */
        async showMuted() {
            await health.showMutedToggleButton.toggle();
            await expect(health.showMutedToggleButton).toBePressed();
        },

        /** Opens the page from the System Console sidebar. */
        async openFromSidebar() {
            await openSystemConsoleSection(app);
            await app.admin.sidebar.category('reporting').section('site_health').titleLink.click();
            await expect(app.page).toHavePath(systemConsolePath('reporting/site_health'));
        },
    };
}

type FindingRow = ReturnType<ReturnType<typeof siteHealthPage>['health']['finding']>;

/** The trend line of a finding row ("Firing for 3h", "Resolved ...", "Unevaluated for ..."). */
export function trendOf(row: FindingRow): Locator {
    return row.trendText.locator;
}

/** The value listed under a term in a finding's Details section: its severity or when it was first detected. */
export function detailOf(row: FindingRow, term: 'Severity' | 'First detected'): Locator {
    return term === 'Severity' ? row.detailSeverityText.locator : row.detailFirstSeenText.locator;
}

/** The remediation heading and the links of an expanded finding. */
export function remediationOf(row: FindingRow) {
    return {
        heading: row.remediationTitleText.locator,
        openSettingLink: row.openSettingLink.locator,
        docsLink: row.docsLink.locator,
    };
}
