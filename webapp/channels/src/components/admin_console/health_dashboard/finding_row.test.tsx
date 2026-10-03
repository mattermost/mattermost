// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import type {HealthFinding} from '@mattermost/types/health';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

import FindingRow from './finding_row';

const now = Date.now();
const consolePath = '/admin_console/environment/push_notification_server';
const docsURL = 'https://mattermost.com/pl/configure-push-notifications';

function makeFinding(overrides: Partial<HealthFinding> = {}): HealthFinding {
    return {
        fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        code: 'push_bad_scheme',
        subject: 'EmailSettings.PushNotificationServer',
        scope: '',
        severity: 'critical',
        state: 'firing',
        area: 'notifications',
        surface: 'product',
        title: 'Push notification server is not HTTPS',
        remediation: 'Set Push Notification Server to an https:// URL.',
        message: 'The push server uses http://.',
        message_id: 'health.rule.push_bad_scheme.message.http',
        details: {url: 'http://push.example.com'},
        first_seen_at: now - 60000,
        last_seen_at: now,
        state_since: now - 60000,
        ...overrides,
    };
}

function header() {
    return within(screen.getByRole('button', {name: /Push notification server is not HTTPS/}));
}

function renderRow(finding: HealthFinding, {expanded = false, hideArea = false, onToggle = jest.fn()} = {}) {
    const history = createMemoryHistory();
    jest.spyOn(history, 'push');
    renderWithContext(
        <ul>
            <FindingRow
                finding={finding}
                now={now}
                expanded={expanded}
                onToggle={onToggle}
                hideArea={hideArea}
            />
        </ul>,
        {},
        {history},
    );
    return {history, onToggle};
}

describe('components/admin_console/health_dashboard/finding_row', () => {
    test('a firing finding shows its title, message, severity, area and how long it has been firing', () => {
        renderRow(makeFinding());

        expect(screen.getByText('Push notification server is not HTTPS')).toBeInTheDocument();
        expect(screen.getByText('The push server uses http://.')).toBeInTheDocument();
        expect(screen.getByText('Critical')).toBeInTheDocument();
        expect(screen.getByTestId('healthFindingArea')).toHaveTextContent('Notifications');
        expect(header().getByText('Firing for 1m')).toBeInTheDocument();
    });

    test('hideArea omits the area tag', () => {
        renderRow(makeFinding(), {hideArea: true});

        expect(screen.queryByTestId('healthFindingArea')).not.toBeInTheDocument();
    });

    test('an unknown finding shows its message as the cause and how long it has been unevaluated', () => {
        renderRow(makeFinding({state: 'unknown', message: 'Config section unavailable.', state_since: now - (125 * 60000)}));

        expect(screen.getByText('Config section unavailable.')).toBeInTheDocument();
        expect(screen.getByText('Unknown (Critical when firing)')).toBeInTheDocument();
        expect(header().getByText('Unevaluated for 2h 5m')).toBeInTheDocument();
    });

    test('an unknown finding without a message falls back to a generic cause', () => {
        renderRow(makeFinding({state: 'unknown', message: ''}));

        expect(screen.getByText('This check could not run, so its result is unknown.')).toBeInTheDocument();
        expect(screen.getByText('Push notification server is not HTTPS')).toBeInTheDocument();
    });

    test('a resolved finding says when it resolved', () => {
        renderRow(makeFinding({state: 'resolved', state_since: now - (2 * 60 * 60000)}));

        expect(screen.getByText('Resolved (Critical when firing)')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Resolved 2 hours ago/})).toBeInTheDocument();
    });

    test('a node-scoped finding names its node', () => {
        renderRow(makeFinding({scope: 'node-3'}));

        expect(screen.getByText('Push notification server is not HTTPS on node-3')).toBeInTheDocument();
    });

    test('the expand control is a button that reports its state and asks the page to toggle', async () => {
        const {onToggle} = renderRow(makeFinding());

        const toggle = screen.getByRole('button', {name: /Push notification server is not HTTPS/});
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        const detail = document.getElementById(toggle.getAttribute('aria-controls')!);
        expect(detail).not.toBeVisible();

        await userEvent.click(toggle);
        toggle.focus();
        await userEvent.keyboard('{Enter}');

        expect(onToggle).toHaveBeenCalledTimes(2);
        expect(onToggle).toHaveBeenCalledWith('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    test('the expanded detail shows the remediation, state, times, node and details', () => {
        renderRow(makeFinding({scope: 'node-3'}), {expanded: true});

        const toggle = screen.getByRole('button', {name: /Push notification server is not HTTPS/});
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const detail = document.getElementById(toggle.getAttribute('aria-controls')!)!;
        expect(detail).toBeVisible();

        expect(within(detail).getByRole('heading', {name: 'How to fix it'})).toBeInTheDocument();
        expect(within(detail).getByText('Set Push Notification Server to an https:// URL.')).toBeInTheDocument();
        const terms = Array.from(detail.querySelectorAll('dt')).map((term) => term.textContent);
        expect(terms).toEqual(['State', 'First detected', 'Last checked', 'Node', 'url']);
        expect(within(detail).getByText('Firing for 1m')).toBeInTheDocument();
        expect(within(detail).getByText('node-3')).toBeInTheDocument();
        expect(within(detail).getByText('http://push.example.com')).toBeInTheDocument();
    });

    describe('resolve here', () => {
        test('is omitted when the finding has neither a console path nor a docs URL', () => {
            renderRow(makeFinding(), {expanded: true});

            expect(screen.queryByRole('heading', {name: 'Resolve here'})).not.toBeInTheDocument();
            expect(screen.queryByRole('link')).not.toBeInTheDocument();
        });

        test('shows only the setting card when only the console path is set', () => {
            renderRow(makeFinding({console_path: consolePath}), {expanded: true});

            expect(screen.getByRole('heading', {name: 'Resolve here'})).toBeInTheDocument();
            expect(screen.getByRole('link', {name: 'Open this setting in the System Console'})).toBeInTheDocument();
            expect(screen.queryByRole('link', {name: 'Read the documentation'})).not.toBeInTheDocument();
        });

        test('shows only the documentation card when only the docs URL is set', () => {
            renderRow(makeFinding({docs_url: docsURL}), {expanded: true});

            expect(screen.getByRole('link', {name: 'Read the documentation'})).toBeInTheDocument();
            expect(screen.queryByRole('link', {name: 'Open this setting in the System Console'})).not.toBeInTheDocument();
        });

        test('the setting card navigates within the app', async () => {
            const {history} = renderRow(makeFinding({console_path: consolePath}), {expanded: true});

            await userEvent.click(screen.getByRole('link', {name: 'Open this setting in the System Console'}));

            expect(history.push).toHaveBeenCalledWith(consolePath);
            expect(history.location.pathname).toBe(consolePath);
        });

        test('the documentation card opens externally in a new tab', () => {
            renderRow(makeFinding({docs_url: docsURL}), {expanded: true});

            const link = screen.getByRole('link', {name: 'Read the documentation'});
            expect(link).toHaveAttribute('href', expect.stringContaining(docsURL));
            expect(link).toHaveAttribute('target', '_blank');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });
    });

    describe('go to setting', () => {
        test.each([
            ['firing' as const],
            ['unknown' as const],
        ])('is offered for a %s finding with a console path and navigates within the app', async (state) => {
            renderRow(makeFinding({state, console_path: consolePath}), {expanded: true});

            await userEvent.click(screen.getByRole('button', {name: 'Go to setting'}));

            expect(getHistory().push).toHaveBeenCalledWith(consolePath);
        });

        test('is not offered for a resolved finding', () => {
            renderRow(makeFinding({state: 'resolved', console_path: consolePath}), {expanded: true});

            expect(screen.queryByRole('button', {name: 'Go to setting'})).not.toBeInTheDocument();
        });

        test('is not offered without a console path', () => {
            renderRow(makeFinding({docs_url: docsURL}), {expanded: true});

            expect(screen.queryByRole('button', {name: 'Go to setting'})).not.toBeInTheDocument();
        });
    });
});
