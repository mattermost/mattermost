// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import type {HealthFinding} from '@mattermost/types/health';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';

import FindingRow from './finding_row';

const now = Date.now();

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

    test('the expanded detail shows the remediation, node, times and details', () => {
        renderRow(makeFinding({scope: 'node-3'}), {expanded: true});

        const toggle = screen.getByRole('button', {name: /Push notification server is not HTTPS/});
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const detail = document.getElementById(toggle.getAttribute('aria-controls')!)!;
        expect(detail).toBeVisible();

        expect(within(detail).getByRole('heading', {name: 'How to fix it'})).toBeInTheDocument();
        expect(within(detail).getByText('Set Push Notification Server to an https:// URL.')).toBeInTheDocument();
        const terms = Array.from(detail.querySelectorAll('dt')).map((term) => term.textContent);
        expect(terms).toEqual(['Node', 'First detected', 'Last checked', 'url']);
        expect(within(detail).getByText('node-3')).toBeInTheDocument();
        expect(within(detail).getByText('http://push.example.com')).toBeInTheDocument();
    });
});
