// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import {
    deriveTokenStatus,
    endOfLocalDayFromIsoDate,
    endOfLocalDayPlusDays,
    mapServerErrorIdToMessage,
    PRESET_DAYS,
} from './user_access_token_section';

describe('user_access_token_section helpers', () => {
    // Freeze time so date arithmetic (Date.now, endOfLocalDayPlusDays) doesn't
    // flake across midnight boundaries. 2026-06-15T12:00 local sits in the
    // middle of a day with no DST transitions.
    const FROZEN_NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();

    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(FROZEN_NOW);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    describe('deriveTokenStatus', () => {
        test('inactive when is_active=false, regardless of expires_at', () => {
            expect(deriveTokenStatus({is_active: false})).toBe('inactive');
            expect(deriveTokenStatus({is_active: false, expires_at: FROZEN_NOW + 1_000_000})).toBe('inactive');
            expect(deriveTokenStatus({is_active: false, expires_at: FROZEN_NOW - 1_000_000})).toBe('inactive');
        });

        test('expired when active and expires_at is in the past', () => {
            expect(deriveTokenStatus({is_active: true, expires_at: FROZEN_NOW - 1_000})).toBe('expired');
        });

        test('active when no expires_at, expires_at=0, or future expires_at', () => {
            expect(deriveTokenStatus({is_active: true})).toBe('active');
            expect(deriveTokenStatus({is_active: true, expires_at: 0})).toBe('active');
            expect(deriveTokenStatus({is_active: true, expires_at: FROZEN_NOW + 1_000_000})).toBe('active');
        });
    });

    describe('mapServerErrorIdToMessage', () => {
        const renderNode = (node: React.ReactNode) => render(
            <IntlProvider locale='en'>{node as React.ReactElement}</IntlProvider>,
        ).container.textContent;

        test('maps expires_at_required (short and app_error variants)', () => {
            expect(renderNode(mapServerErrorIdToMessage('expires_at_required'))).toBe('An expiry date is required.');
            expect(renderNode(mapServerErrorIdToMessage('api.user.create_user_access_token.expires_at_required.app_error'))).toBe('An expiry date is required.');
        });

        test('maps expires_at_in_past (short and app_error variants)', () => {
            expect(renderNode(mapServerErrorIdToMessage('expires_at_in_past'))).toBe('Expiry must be in the future.');
            expect(renderNode(mapServerErrorIdToMessage('api.user.create_user_access_token.expires_at_in_past.app_error'))).toBe('Expiry must be in the future.');
        });

        test('maps expires_at_too_far with the maxDays interpolated', () => {
            expect(renderNode(mapServerErrorIdToMessage('expires_at_too_far', 30))).toBe('Expiry can be at most 30 days from now.');
            expect(renderNode(mapServerErrorIdToMessage('expires_at_too_far', 1))).toBe('Expiry can be at most 1 day from now.');
        });

        test('returns null for unknown or missing ids', () => {
            expect(mapServerErrorIdToMessage(undefined)).toBeNull();
            expect(mapServerErrorIdToMessage('some.unrelated.error')).toBeNull();
        });
    });

    describe('endOfLocalDayPlusDays', () => {
        test('returns end-of-local-day on the Nth future day', () => {
            const ts = endOfLocalDayPlusDays(7);
            const d = new Date(ts);
            expect(d.getHours()).toBe(23);
            expect(d.getMinutes()).toBe(59);
            expect(d.getSeconds()).toBe(59);

            const expected = new Date();
            expected.setDate(expected.getDate() + 7);
            expect(d.toDateString()).toBe(expected.toDateString());
        });

        test('handles 0 days as end of today', () => {
            const ts = endOfLocalDayPlusDays(0);
            const d = new Date(ts);
            expect(d.toDateString()).toBe(new Date().toDateString());
        });
    });

    describe('endOfLocalDayFromIsoDate', () => {
        test('parses YYYY-MM-DD as local end-of-day', () => {
            const ts = endOfLocalDayFromIsoDate('2026-12-31');
            const d = new Date(ts);
            expect(d.getFullYear()).toBe(2026);
            expect(d.getMonth()).toBe(11);
            expect(d.getDate()).toBe(31);
            expect(d.getHours()).toBe(23);
            expect(d.getMinutes()).toBe(59);
        });

        test('returns 0 for malformed input', () => {
            expect(endOfLocalDayFromIsoDate('')).toBe(0);
            expect(endOfLocalDayFromIsoDate('not-a-date')).toBe(0);
            expect(endOfLocalDayFromIsoDate('2026-13')).toBe(0);
        });
    });

    describe('PRESET_DAYS', () => {
        test('exposes the preset durations used by the UI', () => {
            expect(PRESET_DAYS).toEqual({'7d': 7, '30d': 30, '90d': 90, '1y': 365});
        });
    });
});
