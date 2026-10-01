// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {HealthFinding} from '@mattermost/types/health';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import FindingRow from './finding_row';

function makeFinding(overrides: Partial<HealthFinding> = {}): HealthFinding {
    const now = Date.now();
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

function renderRow(finding: HealthFinding) {
    return renderWithContext(
        <ul>
            <FindingRow finding={finding}/>
        </ul>,
    );
}

describe('components/admin_console/health_dashboard/finding_row', () => {
    test('a firing finding shows its title, message and severity', () => {
        renderRow(makeFinding());

        expect(screen.getByText('Push notification server is not HTTPS')).toBeInTheDocument();
        expect(screen.getByText('The push server uses http://.')).toBeInTheDocument();
        expect(screen.getByText('Critical')).toBeInTheDocument();
        expect(screen.getByText(/^Started firing/)).toBeInTheDocument();
    });

    test('an unknown finding shows its message as the cause', () => {
        renderRow(makeFinding({state: 'unknown', message: 'Config section unavailable.'}));

        expect(screen.getByText('Config section unavailable.')).toBeInTheDocument();
        expect(screen.getByText('Unknown (Critical when firing)')).toBeInTheDocument();
        expect(screen.getByText(/^Became unknown/)).toBeInTheDocument();
    });

    test('an unknown finding without a message falls back to a generic cause', () => {
        renderRow(makeFinding({state: 'unknown', message: ''}));

        expect(screen.getByText('This check could not run, so its result is unknown.')).toBeInTheDocument();
        expect(screen.getByText('Push notification server is not HTTPS')).toBeInTheDocument();
        expect(screen.getByRole('button', {expanded: false})).toBeInTheDocument();
    });

    test('a node-scoped finding names its node', () => {
        renderRow(makeFinding({scope: 'node-3'}));

        expect(screen.getByText('Push notification server is not HTTPS on node-3')).toBeInTheDocument();
    });

    test('the expand control is a button that reports and toggles its state', async () => {
        renderRow(makeFinding({scope: 'node-3'}));

        const toggle = screen.getByRole('button', {name: /Push notification server is not HTTPS/});
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        const detail = document.getElementById(toggle.getAttribute('aria-controls')!);
        expect(detail).not.toBeNull();
        expect(detail).not.toBeVisible();

        await userEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(detail).toBeVisible();
        expect(screen.getByRole('heading', {name: 'How to fix it'})).toBeInTheDocument();
        expect(screen.getByText('Set Push Notification Server to an https:// URL.')).toBeInTheDocument();
        expect(screen.getByText('Node')).toBeInTheDocument();
        expect(screen.getByText('url')).toBeInTheDocument();
        expect(screen.getByText('http://push.example.com')).toBeInTheDocument();

        toggle.focus();
        await userEvent.keyboard('{Enter}');

        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(detail).not.toBeVisible();
    });
});
