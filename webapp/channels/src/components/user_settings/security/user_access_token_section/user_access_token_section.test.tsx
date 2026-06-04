// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserAccessTokenSection, {
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
            expect(renderNode(mapServerErrorIdToMessage('app.user_access_token.expires_at_required.app_error'))).toBe('An expiry date is required.');
        });

        test('maps expires_at_in_past (short and app_error variants)', () => {
            expect(renderNode(mapServerErrorIdToMessage('expires_at_in_past'))).toBe('Expiry must be in the future.');
            expect(renderNode(mapServerErrorIdToMessage('app.user_access_token.expires_at_in_past.app_error'))).toBe('Expiry must be in the future.');
        });

        test('maps expires_at_too_far with the maxDays interpolated', () => {
            expect(renderNode(mapServerErrorIdToMessage('expires_at_too_far', 30))).toBe('Expiry can be at most 30 days from now.');
            expect(renderNode(mapServerErrorIdToMessage('expires_at_too_far', 1))).toBe('Expiry can be at most 1 day from now.');
            expect(renderNode(mapServerErrorIdToMessage('app.user_access_token.expires_at_too_far.app_error', 30))).toBe('Expiry can be at most 30 days from now.');
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

describe('UserAccessTokenSection component', () => {
    // Same frozen "now" as the helper tests so date arithmetic
    // (Date.now, custom-date comparisons) is deterministic.
    const FROZEN_NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;

    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(FROZEN_NOW);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    type SectionProps = React.ComponentProps<typeof UserAccessTokenSection>;

    const getBaseProps = (overrides: Partial<SectionProps> = {}): SectionProps => ({
        user: TestHelper.getUserMock({id: 'user_id', roles: ''}) as UserProfile,
        active: true,
        areAllSectionsInactive: false,
        updateSection: jest.fn(),
        userAccessTokens: {},
        maxLifetimeDays: 0,
        setRequireConfirm: jest.fn(),
        actions: {
            getUserAccessTokensForUser: jest.fn(),
            createUserAccessToken: jest.fn().mockResolvedValue({data: {}}),
            revokeUserAccessToken: jest.fn().mockResolvedValue({}),
            enableUserAccessToken: jest.fn().mockResolvedValue({}),
            disableUserAccessToken: jest.fn().mockResolvedValue({}),
            clearUserAccessTokens: jest.fn(),
        },
        ...overrides,
    });

    const renderSection = (overrides: Partial<SectionProps> = {}) => {
        const props = getBaseProps(overrides);
        const {container} = renderWithContext(<UserAccessTokenSection {...props}/>);
        return {props, container};
    };

    const startCreating = () => {
        fireEvent.click(screen.getByText('Create Token'));
    };

    const change = (container: HTMLElement, selector: string, value: string) => {
        fireEvent.change(container.querySelector(selector)!, {target: {value}});
    };

    const clickSave = () => {
        fireEvent.click(screen.getByText('Save'));
    };

    describe('create form validation branches', () => {
        test('requires a description', () => {
            renderSection();
            startCreating();
            clickSave();
            expect(screen.getByText('Please enter a description.')).toBeInTheDocument();
        });

        test('requires a date when the custom preset is chosen but left empty', () => {
            const {container} = renderSection();
            startCreating();
            change(container, '#newTokenDescription', 'my token');
            change(container, '#newTokenExpiry', 'custom');
            change(container, '#newTokenExpiryCustom', '');
            clickSave();
            expect(screen.getByText('An expiry date is required.')).toBeInTheDocument();
        });

        test('rejects a custom date in the past', () => {
            const {container} = renderSection();
            startCreating();
            change(container, '#newTokenDescription', 'my token');
            change(container, '#newTokenExpiry', 'custom');
            change(container, '#newTokenExpiryCustom', '2020-01-01');
            clickSave();
            expect(screen.getByText('Expiry must be in the future.')).toBeInTheDocument();
        });

        test('rejects a custom date beyond maxLifetimeDays', () => {
            const {container} = renderSection({maxLifetimeDays: 30});
            startCreating();
            change(container, '#newTokenDescription', 'my token');
            change(container, '#newTokenExpiry', 'custom');
            change(container, '#newTokenExpiryCustom', '2027-01-01');
            clickSave();
            expect(screen.getByText('Expiry can be at most 30 days from now.')).toBeInTheDocument();
        });

        test('does not submit when validation fails', () => {
            const {props} = renderSection();
            startCreating();
            clickSave();
            expect(props.actions.createUserAccessToken).not.toHaveBeenCalled();
        });
    });

    describe('expiry enforcement (implied by maxLifetimeDays > 0)', () => {
        test('hides the "No expiry" option and shows the enforced hint when a maximum lifetime is set', () => {
            renderSection({maxLifetimeDays: 30});
            startCreating();
            expect(screen.queryByText('No expiry')).not.toBeInTheDocument();
            expect(screen.getByText('Your administrator requires all personal access tokens to have an expiry date.')).toBeInTheDocument();
        });

        test('offers the "No expiry" option when no maximum lifetime is set', () => {
            renderSection({maxLifetimeDays: 0});
            startCreating();
            expect(screen.getByText('No expiry')).toBeInTheDocument();
        });
    });

    describe('maxLifetimeDays preset filtering', () => {
        test('hides presets longer than the configured maximum and shows the hint', () => {
            renderSection({maxLifetimeDays: 30});
            startCreating();
            expect(screen.getByText('7 days')).toBeInTheDocument();
            expect(screen.getByText('30 days')).toBeInTheDocument();
            expect(screen.queryByText('90 days')).not.toBeInTheDocument();
            expect(screen.queryByText('1 year')).not.toBeInTheDocument();
            expect(screen.getByText('Tokens can be valid for up to 30 days.')).toBeInTheDocument();
        });

        test('shows all presets when no maximum is configured', () => {
            renderSection({maxLifetimeDays: 0});
            startCreating();
            expect(screen.getByText('7 days')).toBeInTheDocument();
            expect(screen.getByText('30 days')).toBeInTheDocument();
            expect(screen.getByText('90 days')).toBeInTheDocument();
            expect(screen.getByText('1 year')).toBeInTheDocument();
        });
    });

    describe('token list status display', () => {
        test('shows an Active badge and "Never" for an active token without expiry', () => {
            renderSection({userAccessTokens: {t1: {id: 't1', description: 'desc', is_active: true}}});
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText(/Never/)).toBeInTheDocument();
        });

        test('shows an Expired badge for an active token whose expiry has passed', () => {
            renderSection({userAccessTokens: {t1: {id: 't1', description: 'desc', is_active: true, expires_at: FROZEN_NOW - DAY_MS}}});
            expect(screen.getByText('Expired')).toBeInTheDocument();
        });

        test('shows a Disabled badge for an inactive token', () => {
            renderSection({userAccessTokens: {t1: {id: 't1', description: 'desc', is_active: false, expires_at: FROZEN_NOW + DAY_MS}}});
            expect(screen.getByText('Disabled')).toBeInTheDocument();
        });

        test('shows an "expires soon" warning for a token within 7 days of expiry', () => {
            renderSection({userAccessTokens: {t1: {id: 't1', description: 'desc', is_active: true, expires_at: FROZEN_NOW + (3 * DAY_MS)}}});
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('Expires in 3 days')).toBeInTheDocument();
        });
    });
});
