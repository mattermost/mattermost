// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {HealthFinding, HealthFindingList} from '@mattermost/types/health';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';

import HealthDashboard from './index';

const NOW = Date.now();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

function makeFinding(overrides: Partial<HealthFinding> & Pick<HealthFinding, 'fingerprint'>): HealthFinding {
    return {
        code: 'rule',
        subject: 'subject',
        scope: '',
        severity: 'warning',
        state: 'firing',
        area: 'database',
        surface: 'product',
        title: 'Finding title',
        remediation: 'Fix it.',
        message: 'Finding message.',
        message_id: 'health.rule.rule.message',
        first_seen_at: NOW - hour,
        last_seen_at: NOW,
        state_since: NOW - hour,
        ...overrides,
    };
}

function evaluated(findings: HealthFinding[]): HealthFindingList {
    return {evaluated_at: NOW, findings};
}

const mixed = [
    makeFinding({fingerprint: 'c1', severity: 'critical', area: 'notifications', title: 'Critical one'}),
    makeFinding({fingerprint: 'w1', severity: 'warning', title: 'Warning old', state_since: NOW - (3 * hour)}),
    makeFinding({fingerprint: 'w2', severity: 'warning', title: 'Warning new', state_since: NOW - hour}),
    makeFinding({fingerprint: 'i1', severity: 'info', title: 'Info one'}),
    makeFinding({fingerprint: 'u1', severity: 'critical', state: 'unknown', area: 'auth', title: 'Unknown one', message: 'Config section unavailable.'}),
    makeFinding({fingerprint: 'r1', state: 'resolved', title: 'Resolved recently', state_since: NOW - (2 * day)}),
    makeFinding({fingerprint: 'r2', state: 'resolved', title: 'Resolved long ago', state_since: NOW - (8 * day)}),
];

function tabTexts() {
    return screen.getAllByRole('tab').map((tab) => tab.textContent);
}

function sectionHeadings() {
    return screen.getAllByRole('heading', {level: 3}).map((heading) => heading.textContent);
}

function rowTitles() {
    return screen.getAllByTestId(/^healthFinding-/).map((row) => row.querySelector('.HealthFinding__title')?.textContent);
}

async function renderDashboard(list: HealthFindingList) {
    jest.spyOn(Client4, 'getHealthFindings').mockResolvedValue(list);
    renderWithContext(<HealthDashboard/>);
    return screen.findByText(/^(Last evaluated|Not evaluated yet)/);
}

describe('components/admin_console/health_dashboard', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn();
        jest.spyOn(Date, 'now').mockReturnValue(NOW);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('makes exactly one findings request on mount, with no filter, and no other request', async () => {
        const getHealthFindings = jest.spyOn(Client4, 'getHealthFindings').mockResolvedValue(evaluated([makeFinding({fingerprint: 'a'})]));

        renderWithContext(<HealthDashboard/>);

        await screen.findByText('Finding title');
        expect(getHealthFindings).toHaveBeenCalledTimes(1);
        expect(getHealthFindings).toHaveBeenCalledWith({});
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('shows the page title once, in the admin header, above the last evaluation time', async () => {
        await renderDashboard(evaluated(mixed));

        const titles = screen.getAllByText('Site health');
        expect(titles).toHaveLength(1);
        expect(screen.getByTestId('admin-console-header')).toContainElement(titles[0]);
        expect(screen.queryByRole('heading', {name: 'Site health'})).not.toBeInTheDocument();
        expect(screen.getByText(/^Last evaluated/)).toBeInTheDocument();
    });

    test('empty state: nothing has been evaluated yet', async () => {
        await renderDashboard({evaluated_at: 0, findings: []});

        expect(screen.getByText('Not evaluated yet')).toBeInTheDocument();
        expect(screen.queryByText(/^Last evaluated/)).not.toBeInTheDocument();
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    test('shows an error when the findings cannot be loaded', async () => {
        jest.spyOn(Client4, 'getHealthFindings').mockRejectedValue(new Error('boom'));

        renderWithContext(<HealthDashboard/>);

        expect(await screen.findByText('Health findings could not be loaded')).toBeInTheDocument();
        expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    test('every finding muted: shows the last evaluation and the all-clear, not "Not evaluated yet"', async () => {
        await renderDashboard(evaluated([]));

        expect(screen.getByText('All clear')).toBeInTheDocument();
        expect(screen.getByText(/^Last evaluated/)).toBeInTheDocument();
        expect(tabTexts()).toEqual(['Open0', 'Critical0', 'Warning0', 'Info0', 'Recently resolved0', 'Unknown0']);
        expect(screen.queryByText('Not evaluated yet')).not.toBeInTheDocument();
    });

    describe('tabs', () => {
        test('count open as firing plus unknown, severities as firing only, and resolved within 7 days', async () => {
            await renderDashboard(evaluated(mixed));

            expect(tabTexts()).toEqual(['Open5', 'Critical1', 'Warning2', 'Info1', 'Recently resolved1', 'Unknown1']);
        });

        test('unknown findings are excluded from severity counts', async () => {
            await renderDashboard(evaluated([
                makeFinding({fingerprint: 'u1', severity: 'critical', state: 'unknown'}),
                makeFinding({fingerprint: 'u2', severity: 'warning', state: 'unknown'}),
            ]));

            expect(tabTexts()).toEqual(['Open2', 'Critical0', 'Warning0', 'Info0', 'Recently resolved0', 'Unknown2']);
            expect(screen.queryByText('All clear')).not.toBeInTheDocument();
            expect(sectionHeadings()).toEqual(['Could not be evaluated2']);
        });

        test('open lists firing findings by severity, then unknowns, and no resolved findings', async () => {
            await renderDashboard(evaluated(mixed));

            expect(sectionHeadings()).toEqual(['Critical1', 'Warning2', 'Info1', 'Could not be evaluated1']);
            expect(screen.queryByText('Resolved recently')).not.toBeInTheDocument();
        });

        test('a severity tab lists firing findings of that severity only', async () => {
            await renderDashboard(evaluated(mixed));

            await userEvent.click(screen.getByRole('tab', {name: /^Critical/}));

            expect(sectionHeadings()).toEqual(['Critical1']);
            expect(rowTitles()).toEqual(['Critical one']);
        });

        test('recently resolved lists findings resolved in the last 7 days and hides older ones', async () => {
            await renderDashboard(evaluated(mixed));

            await userEvent.click(screen.getByRole('tab', {name: /^Recently resolved/}));

            expect(sectionHeadings()).toEqual(['Recently resolved1']);
            expect(rowTitles()).toEqual(['Resolved recently']);
        });

        test('unknown lists unknown findings, expanded, with the explanation and their cause', async () => {
            await renderDashboard(evaluated(mixed));

            await userEvent.click(screen.getByRole('tab', {name: /^Unknown/}));

            expect(sectionHeadings()).toEqual(['Could not be evaluated1']);
            expect(screen.getByText(/Unknown does not mean healthy/)).toBeVisible();
            expect(screen.getByText('Config section unavailable.')).toBeVisible();
        });

        test('form an accessible tablist with icons, selection state and arrow key navigation', async () => {
            await renderDashboard(evaluated(mixed));

            const tablist = screen.getByRole('tablist', {name: 'Filter findings'});
            const tabs = within(tablist).getAllByRole('tab');
            expect(tabs).toHaveLength(6);

            const [open, critical, ...rest] = tabs;
            const unknown = rest[rest.length - 1];
            expect(open).toHaveAttribute('aria-selected', 'true');
            expect(open).toHaveAttribute('tabindex', '0');
            expect(open.querySelector('svg')).toBeNull();
            for (const tab of tabs.slice(1)) {
                expect(tab).toHaveAttribute('aria-selected', 'false');
                expect(tab).toHaveAttribute('tabindex', '-1');
                expect(tab.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
            }
            expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', open.id);

            open.focus();
            await userEvent.keyboard('{ArrowRight}');
            expect(critical).toHaveAttribute('aria-selected', 'true');
            expect(critical).toHaveFocus();
            expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', critical.id);

            await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
            expect(unknown).toHaveAttribute('aria-selected', 'true');
            expect(unknown).toHaveFocus();

            await userEvent.keyboard('{Home}');
            expect(open).toHaveAttribute('aria-selected', 'true');
            await userEvent.keyboard('{End}');
            expect(unknown).toHaveAttribute('aria-selected', 'true');
        });

        test.each([
            ['Critical', 'No critical findings'],
            ['Info', 'No info findings'],
            ['Recently resolved', 'Nothing resolved in the last 7 days'],
            ['Unknown', 'Every check could be evaluated'],
        ])('an empty %s tab explains why it is empty', async (tab, message) => {
            await renderDashboard(evaluated([makeFinding({fingerprint: 'w1', severity: 'warning'})]));

            await userEvent.click(screen.getByRole('tab', {name: new RegExp(`^${tab}`)}));

            expect(screen.getByText(message)).toBeInTheDocument();
            expect(screen.queryByTestId(/^healthFinding-/)).not.toBeInTheDocument();
        });
    });

    test('rows sort by severity, then newest first', async () => {
        await renderDashboard(evaluated(mixed));

        expect(rowTitles()).toEqual(['Critical one', 'Warning new', 'Warning old', 'Info one', 'Unknown one']);
    });

    test('only one row is expanded at a time', async () => {
        await renderDashboard(evaluated(mixed));

        const first = screen.getByRole('button', {name: /Critical one/});
        const second = screen.getByRole('button', {name: /Warning new/});

        await userEvent.click(first);
        expect(first).toHaveAttribute('aria-expanded', 'true');

        await userEvent.click(second);
        expect(second).toHaveAttribute('aria-expanded', 'true');
        expect(first).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(second);
        expect(second).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', {expanded: true})).not.toBeInTheDocument();
    });

    test('switching tab or grouping collapses the expanded row', async () => {
        await renderDashboard(evaluated(mixed));

        await userEvent.click(screen.getByRole('button', {name: /Critical one/}));
        await userEvent.click(screen.getByRole('tab', {name: /^Critical/}));
        await userEvent.click(screen.getByRole('tab', {name: /^Open/}));
        expect(screen.getByRole('button', {name: /Critical one/})).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(screen.getByRole('button', {name: /Critical one/}));
        await userEvent.click(screen.getByRole('button', {name: 'Category'}));
        expect(screen.getByRole('button', {name: /Critical one/})).toHaveAttribute('aria-expanded', 'false');
    });

    describe('group by', () => {
        test('defaults to severity and switches to category', async () => {
            await renderDashboard(evaluated(mixed));

            const severity = screen.getByRole('button', {name: 'Severity'});
            const category = screen.getByRole('button', {name: 'Category'});
            expect(screen.getByRole('group', {name: 'Group by'})).toBeInTheDocument();
            expect(severity).toHaveAttribute('aria-pressed', 'true');
            expect(category).toHaveAttribute('aria-pressed', 'false');
            expect(screen.getAllByTestId('healthFindingArea')).toHaveLength(5);

            await userEvent.click(category);

            expect(category).toHaveAttribute('aria-pressed', 'true');
            expect(severity).toHaveAttribute('aria-pressed', 'false');
            expect(sectionHeadings().map((heading) => heading?.split(/\d/)[0])).toEqual(['Notifications', 'Database', 'Authentication']);

            await userEvent.click(severity);

            expect(sectionHeadings()).toEqual(['Critical1', 'Warning2', 'Info1', 'Could not be evaluated1']);
        });

        test('category expands areas with a firing critical and omits area tags from rows', async () => {
            await renderDashboard(evaluated(mixed));

            await userEvent.click(screen.getByRole('button', {name: 'Category'}));

            const notifications = screen.getByRole('button', {name: /^Notifications/});
            const database = screen.getByRole('button', {name: /^Database/});
            const auth = screen.getByRole('button', {name: /^Authentication/});
            expect(notifications).toHaveAttribute('aria-expanded', 'true');
            expect(database).toHaveAttribute('aria-expanded', 'false');
            expect(auth).toHaveAttribute('aria-expanded', 'false');
            expect(database).toHaveTextContent('3 findings');
            expect(database).toHaveTextContent('2 Warning');
            expect(database).toHaveTextContent('1 Info');

            expect(screen.getByText('Critical one')).toBeVisible();
            expect(screen.getByText('Warning new')).not.toBeVisible();
            expect(screen.queryByTestId('healthFindingArea')).not.toBeInTheDocument();

            await userEvent.click(database);
            expect(database).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByText('Warning new')).toBeVisible();
        });

        test('an unknown-only area is not expanded for its rule severity', async () => {
            await renderDashboard(evaluated([
                makeFinding({fingerprint: 'u1', severity: 'critical', state: 'unknown', area: 'auth'}),
            ]));

            await userEvent.click(screen.getByRole('button', {name: 'Category'}));

            expect(screen.getByRole('button', {name: /^Authentication/})).toHaveAttribute('aria-expanded', 'false');
        });

        test('every area starts expanded on tabs other than Open', async () => {
            await renderDashboard(evaluated(mixed));

            await userEvent.click(screen.getByRole('button', {name: 'Category'}));
            await userEvent.click(screen.getByRole('tab', {name: /^Warning/}));

            expect(screen.getByRole('button', {name: /^Database/})).toHaveAttribute('aria-expanded', 'true');

            await userEvent.click(screen.getByRole('tab', {name: /^Open/}));

            expect(screen.getByRole('button', {name: /^Notifications/})).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByRole('button', {name: /^Database/})).toHaveAttribute('aria-expanded', 'false');
        });
    });

    test('node-scoped findings of one rule render one row per node', async () => {
        await renderDashboard(evaluated([
            makeFinding({fingerprint: 'n3', code: 'disk_low', scope: 'node-3', title: 'Disk space is low'}),
            makeFinding({fingerprint: 'n5', code: 'disk_low', scope: 'node-5', title: 'Disk space is low'}),
        ]));

        expect(screen.getByText('Disk space is low on node-3')).toBeInTheDocument();
        expect(screen.getByText('Disk space is low on node-5')).toBeInTheDocument();
        expect(screen.getAllByTestId(/^healthFinding-/)).toHaveLength(2);
    });

    test('an unrecognized area still renders, labelled with its raw value', async () => {
        await renderDashboard(evaluated([
            makeFinding({fingerprint: 'a', area: 'brand_new_area'}),
        ]));

        expect(screen.getByTestId('healthFindingArea')).toHaveTextContent('brand_new_area');

        await userEvent.click(screen.getByRole('button', {name: 'Category'}));

        expect(screen.getByRole('heading', {level: 3, name: /brand_new_area/})).toBeInTheDocument();
    });
});
