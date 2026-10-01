// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {HealthFinding} from '@mattermost/types/health';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import UnknownNotice from './unknown_notice';

function makeUnknown(fingerprint: string, message: string): HealthFinding {
    const now = Date.now();
    return {
        fingerprint,
        code: 'site_url_https',
        subject: 'ServiceSettings.SiteURL',
        scope: '',
        severity: 'warning',
        state: 'unknown',
        area: 'platform',
        surface: 'product',
        title: `Site URL is not HTTPS ${fingerprint}`,
        message,
        message_id: 'health.reason.config_unavailable',
        first_seen_at: now,
        last_seen_at: now,
        state_since: now,
    };
}

describe('components/admin_console/health_dashboard/unknown_notice', () => {
    test('renders nothing without unknown findings', () => {
        const {container} = renderWithContext(<UnknownNotice findings={[]}/>);

        expect(container).toBeEmptyDOMElement();
    });

    test('is collapsed by default, explains unknown, and expands through an accessible toggle', async () => {
        renderWithContext(
            <UnknownNotice
                findings={[
                    makeUnknown('a', 'Config section unavailable.'),
                    makeUnknown('b', ''),
                ]}
            />,
        );

        expect(screen.getByRole('heading', {level: 3, name: /Could not be evaluated/})).toBeInTheDocument();
        expect(screen.getByText(/Unknown does not mean healthy/)).toBeVisible();

        const toggle = screen.getByRole('button', {name: /Could not be evaluated/});
        expect(toggle).toHaveAttribute('aria-expanded', 'false');

        const list = document.getElementById(toggle.getAttribute('aria-controls')!);
        expect(list).not.toBeVisible();

        await userEvent.click(toggle);

        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(list).toBeVisible();
        expect(screen.getByText('Config section unavailable.')).toBeVisible();
        expect(screen.getByText('This check could not run, so its result is unknown.')).toBeVisible();
    });
});
