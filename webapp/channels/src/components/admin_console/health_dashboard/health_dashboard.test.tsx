// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {HealthFinding, HealthFindingList} from '@mattermost/types/health';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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

async function renderDashboard(list: HealthFindingList, initialState = {}) {
    jest.spyOn(Client4, 'getHealthFindings').mockResolvedValue(list);
    renderWithContext(<HealthDashboard/>, initialState);
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

    test('makes exactly one findings request on mount, including muted findings, and no other request', async () => {
        const getHealthFindings = jest.spyOn(Client4, 'getHealthFindings').mockResolvedValue(evaluated([makeFinding({fingerprint: 'a'})]));

        renderWithContext(<HealthDashboard/>);

        await screen.findByText('Finding title');
        expect(getHealthFindings).toHaveBeenCalledTimes(1);
        expect(getHealthFindings).toHaveBeenCalledWith({muted: 'included'});
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

    describe('mute', () => {
        const admins = {
            entities: {
                users: {
                    currentUserId: 'admin1',
                    profiles: {
                        admin1: TestHelper.getUserMock({id: 'admin1', username: 'alice'}),
                        admin2: TestHelper.getUserMock({id: 'admin2', username: 'bob'}),
                    },
                },
            },
        };

        const pushFinding = makeFinding({fingerprint: 'c1', severity: 'critical', title: 'Push notification server is not HTTPS'});
        const diskFinding = makeFinding({fingerprint: 'n3', code: 'disk_low', scope: 'node-3', title: 'Disk space is low'});
        const mutedByBob = makeFinding({fingerprint: 'm1', title: 'Muted by a colleague', muted_at: NOW - (2 * day), muted_by: 'admin2'});

        function row(title: string) {
            return screen.getByRole('button', {name: new RegExp(title)}).closest('li') as HTMLElement;
        }

        function mutedToggle() {
            return screen.getByRole('button', {name: /^Muted\s?\d+$/});
        }

        async function mute(title: string) {
            await userEvent.click(within(row(title)).getByRole('button', {name: 'Mute'}));
        }

        test('the muted count sits next to the tabs and muted findings are left out of every tab', async () => {
            await renderDashboard(evaluated([pushFinding, mutedByBob]), admins);

            expect(mutedToggle()).toHaveTextContent('Muted1');
            expect(tabTexts()).toEqual(['Open1', 'Critical1', 'Warning0', 'Info0', 'Recently resolved0', 'Unknown0']);
            expect(screen.queryByText('Muted by a colleague')).not.toBeInTheDocument();
        });

        test('the muted list shows who muted each finding and when, for every admin', async () => {
            await renderDashboard(evaluated([pushFinding, mutedByBob]), admins);

            await userEvent.click(mutedToggle());

            expect(mutedToggle()).toHaveAttribute('aria-pressed', 'true');
            expect(rowTitles()).toEqual(['Muted by a colleague']);
            expect(within(row('Muted by a colleague')).getByTestId('healthFindingMutedBy')).toHaveTextContent('Muted by @bob 2 days ago');
            for (const tab of screen.getAllByRole('tab')) {
                expect(tab).toHaveAttribute('aria-selected', 'false');
            }

            await userEvent.click(screen.getByRole('tab', {name: /^Open/}));

            expect(rowTitles()).toEqual(['Push notification server is not HTTPS']);
        });

        test('the muted list follows the Group by choice', async () => {
            const mutedCritical = makeFinding({fingerprint: 'm2', severity: 'critical', title: 'Muted critical', muted_at: NOW, muted_by: 'admin1'});
            await renderDashboard(evaluated([mutedByBob, mutedCritical]), admins);

            await userEvent.click(mutedToggle());

            expect(sectionHeadings()).toEqual(['Critical1', 'Warning1']);

            await userEvent.click(screen.getByRole('button', {name: 'Category'}));

            expect(screen.getByRole('heading', {level: 3, name: /Database/})).toBeInTheDocument();
            expect(rowTitles()).toEqual(['Muted critical', 'Muted by a colleague']);
        });

        test('a tab emptied by muting says how many findings are muted instead of all clear', async () => {
            await renderDashboard(evaluated([mutedByBob, makeFinding({fingerprint: 'm2', title: 'Another', muted_at: NOW, muted_by: 'admin1'})]), admins);

            expect(screen.queryByText('All clear')).not.toBeInTheDocument();
            expect(screen.getByText('2 findings here are muted')).toBeInTheDocument();

            await userEvent.click(screen.getByRole('tab', {name: /^Critical/}));

            expect(screen.getByText('No critical findings')).toBeInTheDocument();
        });

        test('the muted list explains itself when nothing is muted', async () => {
            await renderDashboard(evaluated([pushFinding]), admins);

            await userEvent.click(mutedToggle());

            expect(screen.getByText('No muted findings')).toBeInTheDocument();
        });

        test('mute moves a finding from the open list to the muted list, and unmute moves it back', async () => {
            const muteRequest = jest.spyOn(Client4, 'muteHealthFinding').mockResolvedValue({status: 'OK'});
            const unmuteRequest = jest.spyOn(Client4, 'unmuteHealthFinding').mockResolvedValue({status: 'OK'});
            await renderDashboard(evaluated([pushFinding, diskFinding]), admins);

            await mute('Push notification server is not HTTPS');

            expect(muteRequest).toHaveBeenCalledWith('c1');
            expect(rowTitles()).toEqual(['Disk space is low on node-3']);
            expect(tabTexts()[0]).toBe('Open1');
            expect(mutedToggle()).toHaveTextContent('Muted1');

            await userEvent.click(mutedToggle());

            expect(rowTitles()).toEqual(['Push notification server is not HTTPS']);
            expect(screen.getByTestId('healthFindingMutedBy')).toHaveTextContent('Muted by @alice');

            await userEvent.click(screen.getByRole('button', {name: 'Unmute'}));

            expect(unmuteRequest).toHaveBeenCalledWith('c1');
            expect(screen.getByText('No muted findings')).toBeInTheDocument();
            expect(mutedToggle()).toHaveTextContent('Muted0');

            await userEvent.click(screen.getByRole('tab', {name: /^Open/}));

            expect(rowTitles()).toEqual(['Push notification server is not HTTPS', 'Disk space is low on node-3']);
            expect(screen.queryByTestId('healthFindingMutedBy')).not.toBeInTheDocument();
        });

        test('a mute the server rejects is rolled back and shows an error', async () => {
            jest.spyOn(Client4, 'muteHealthFinding').mockRejectedValue(new Error('boom'));
            await renderDashboard(evaluated([pushFinding]), admins);

            await mute('Push notification server is not HTTPS');

            expect(await screen.findByText('The finding could not be muted, so it is still in the open list. Try again.')).toBeVisible();
            expect(rowTitles()).toEqual(['Push notification server is not HTTPS']);
            expect(mutedToggle()).toHaveTextContent('Muted0');
        });

        test('an unmute the server rejects is rolled back and shows an error', async () => {
            jest.spyOn(Client4, 'unmuteHealthFinding').mockRejectedValue(new Error('boom'));
            await renderDashboard(evaluated([mutedByBob]), admins);

            await userEvent.click(mutedToggle());
            await userEvent.click(screen.getByRole('button', {name: 'Unmute'}));

            expect(await screen.findByText('The finding could not be unmuted, so it is still muted. Try again.')).toBeVisible();
            expect(rowTitles()).toEqual(['Muted by a colleague']);
            expect(mutedToggle()).toHaveTextContent('Muted1');
        });
    });
});
