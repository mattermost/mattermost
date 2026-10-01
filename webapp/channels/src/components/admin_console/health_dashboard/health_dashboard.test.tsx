// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {HealthFinding} from '@mattermost/types/health';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, within} from 'tests/react_testing_utils';

import HealthDashboard from './index';

function makeFinding(overrides: Partial<HealthFinding> & Pick<HealthFinding, 'fingerprint'>): HealthFinding {
    const now = Date.now();
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
        first_seen_at: now - 60000,
        last_seen_at: now,
        state_since: now - 60000,
        ...overrides,
    };
}

function getCounts() {
    const list = screen.getByRole('list', {name: 'Finding counts'});
    return within(list).getAllByRole('listitem').map((item) => item.textContent);
}

describe('components/admin_console/health_dashboard', () => {
    const originalFetch = global.fetch;
    let getHealthFindings: jest.SpyInstance;

    beforeEach(() => {
        global.fetch = jest.fn();
        getHealthFindings = jest.spyOn(Client4, 'getHealthFindings');
    });

    afterEach(() => {
        global.fetch = originalFetch;
        getHealthFindings.mockRestore();
    });

    test('makes exactly one findings request on mount, with no filter, and no other request', async () => {
        getHealthFindings.mockResolvedValue([makeFinding({fingerprint: 'a'})]);

        renderWithContext(<HealthDashboard/>);

        await screen.findByText('Finding title');
        expect(getHealthFindings).toHaveBeenCalledTimes(1);
        expect(getHealthFindings).toHaveBeenCalledWith({});
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('empty state: nothing has been evaluated yet', async () => {
        getHealthFindings.mockResolvedValue([]);

        renderWithContext(<HealthDashboard/>);

        expect(await screen.findByText('Not evaluated yet')).toBeInTheDocument();
        expect(screen.queryByRole('list', {name: 'Finding counts'})).not.toBeInTheDocument();
    });

    test('all-healthy state: only resolved findings', async () => {
        getHealthFindings.mockResolvedValue([
            makeFinding({fingerprint: 'a', state: 'resolved', title: 'Resolved finding'}),
        ]);

        renderWithContext(<HealthDashboard/>);

        expect(await screen.findByText('No problems found')).toBeInTheDocument();
        expect(getCounts()).toEqual(['0 Critical', '0 Warning', '0 Info', '0 Unknown']);
        expect(screen.queryByText('Resolved finding')).not.toBeInTheDocument();
        expect(screen.queryByText('Could not be evaluated')).not.toBeInTheDocument();
    });

    test('mixed severities: counts per severity, areas ordered by their most severe finding', async () => {
        getHealthFindings.mockResolvedValue([
            makeFinding({fingerprint: 'w1', severity: 'warning', area: 'database', title: 'Warning one'}),
            makeFinding({fingerprint: 'w2', severity: 'warning', area: 'database', title: 'Warning two'}),
            makeFinding({fingerprint: 'i1', severity: 'info', area: 'database', title: 'Info one'}),
            makeFinding({fingerprint: 'c1', severity: 'critical', area: 'notifications', title: 'Critical one'}),
            makeFinding({fingerprint: 'u1', severity: 'critical', state: 'unknown', area: 'auth', title: 'Unknown one'}),
        ]);

        renderWithContext(<HealthDashboard/>);

        await screen.findByText('Critical one');
        expect(getCounts()).toEqual(['1 Critical', '2 Warning', '1 Info', '1 Unknown']);

        const headings = screen.getAllByRole('heading', {level: 3}).map((heading) => heading.textContent);
        expect(headings).toEqual(['Notifications1', 'Database3', 'Could not be evaluated1']);
    });

    test('unknown findings are excluded from severity counts', async () => {
        getHealthFindings.mockResolvedValue([
            makeFinding({fingerprint: 'u1', severity: 'critical', state: 'unknown'}),
            makeFinding({fingerprint: 'u2', severity: 'warning', state: 'unknown'}),
        ]);

        renderWithContext(<HealthDashboard/>);

        await screen.findByText('Could not be evaluated');
        expect(getCounts()).toEqual(['0 Critical', '0 Warning', '0 Info', '2 Unknown']);
    });

    test('unknown-only state is not presented as an all-clear', async () => {
        getHealthFindings.mockResolvedValue([
            makeFinding({fingerprint: 'u1', state: 'unknown', title: 'Unknown one'}),
        ]);

        renderWithContext(<HealthDashboard/>);

        expect(await screen.findByText('No firing findings')).toBeInTheDocument();
        expect(screen.getByText('Some checks could not be evaluated, so this is not an all-clear.')).toBeInTheDocument();
        expect(screen.queryByText('No problems found')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Could not be evaluated/})).toHaveAttribute('aria-expanded', 'false');
    });

    test('node-scoped findings of one rule render one row per node', async () => {
        getHealthFindings.mockResolvedValue([
            makeFinding({fingerprint: 'n3', code: 'disk_low', scope: 'node-3', title: 'Disk space is low'}),
            makeFinding({fingerprint: 'n5', code: 'disk_low', scope: 'node-5', title: 'Disk space is low'}),
        ]);

        renderWithContext(<HealthDashboard/>);

        expect(await screen.findByText('Disk space is low on node-3')).toBeInTheDocument();
        expect(screen.getByText('Disk space is low on node-5')).toBeInTheDocument();
        expect(screen.getAllByTestId(/^healthFinding-/)).toHaveLength(2);
    });

    test('an unrecognized area still renders, labelled with its raw value', async () => {
        getHealthFindings.mockResolvedValue([
            makeFinding({fingerprint: 'a', area: 'brand_new_area'}),
        ]);

        renderWithContext(<HealthDashboard/>);

        expect(await screen.findByRole('heading', {level: 3, name: /brand_new_area/})).toBeInTheDocument();
        expect(screen.getByText('Finding title')).toBeInTheDocument();
    });

    test('shows an error when the findings cannot be loaded', async () => {
        getHealthFindings.mockRejectedValue(new Error('boom'));

        renderWithContext(<HealthDashboard/>);

        expect(await screen.findByText('Health findings could not be loaded')).toBeInTheDocument();
    });
});
