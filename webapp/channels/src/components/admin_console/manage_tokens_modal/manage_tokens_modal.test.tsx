// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserAccessToken} from '@mattermost/types/users';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ManageTokensModal from './manage_tokens_modal';

describe('components/admin_console/manage_tokens_modal/manage_tokens_modal.tsx', () => {
    const baseProps = {
        actions: {
            getUserAccessTokensForUser: jest.fn(),
        },
        user: TestHelper.getUserMock({
            id: 'defaultuser',
        }),
        onHide: jest.fn(),
        onExited: jest.fn(),
    };

    test('initial call should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <ManageTokensModal {...baseProps}/>,
        );
        expect(baseProps.actions.getUserAccessTokensForUser).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Manage Personal Access Tokens')).toBeInTheDocument();
        expect(baseElement.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    test('should replace loading screen on update', () => {
        const {baseElement, rerender} = renderWithContext(
            <ManageTokensModal {...baseProps}/>,
        );

        expect(screen.queryByText('No personal access tokens.')).not.toBeInTheDocument();
        expect(baseElement.querySelector('.loading-screen')).toBeInTheDocument();
        expect(baseElement.querySelector('.manage-row__empty')).not.toBeInTheDocument();

        rerender(
            <ManageTokensModal
                {...baseProps}
                userAccessTokens={{}}
            />,
        );

        expect(baseElement.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(baseElement.querySelector('.loading-screen')).not.toBeInTheDocument();
        expect(baseElement.querySelector('.manage-row__empty')).toBeInTheDocument();
        expect(screen.getByText('No personal access tokens.')).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    test('should display list of tokens', () => {
        const userAccessTokens = {
            id1: {
                id: 'id1',
                description: 'first token',
                user_id: 'defaultuser',
                is_active: true,
            },
            id2: {
                id: 'id2',
                description: 'second token',
                user_id: 'defaultuser',
                is_active: true,
            },
        };

        const {baseElement} = renderWithContext(
            <ManageTokensModal
                {...baseProps}
                userAccessTokens={userAccessTokens}
            />,
        );

        expect(baseElement.querySelector('.manage-teams__teams')).toBeInTheDocument();
        expect(baseElement.querySelectorAll('.manage-teams__team')).toHaveLength(2);
        expect(screen.getByText(/first token/)).toBeInTheDocument();
        expect(screen.getByText(/second token/)).toBeInTheDocument();
        expect(screen.getByText(/id1/)).toBeInTheDocument();
        expect(screen.getByText(/id2/)).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });

    describe('expiry and status display', () => {
        // Freeze "now" so past/future expiry comparisons are deterministic.
        const FROZEN_NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
        const DAY_MS = 24 * 60 * 60 * 1000;

        beforeAll(() => {
            jest.useFakeTimers().setSystemTime(FROZEN_NOW);
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        const renderWithToken = (token: Partial<UserAccessToken>) => renderWithContext(
            <ManageTokensModal
                {...baseProps}
                userAccessTokens={{tokenId: {id: 'tokenId', description: 'a token', user_id: 'defaultuser', is_active: true, ...token}}}
            />,
        );

        test('shows an Active badge and "Never" for an active token without expiry', () => {
            renderWithToken({is_active: true});
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText(/Never/)).toBeInTheDocument();
        });

        test('shows an Expired badge for an active token whose expiry has passed', () => {
            renderWithToken({is_active: true, expires_at: FROZEN_NOW - DAY_MS});
            expect(screen.getByText('Expired')).toBeInTheDocument();
            expect(screen.queryByText('Active')).not.toBeInTheDocument();
        });

        test('shows a Disabled badge for an inactive token regardless of expiry', () => {
            renderWithToken({is_active: false, expires_at: FROZEN_NOW + DAY_MS});
            expect(screen.getByText('Disabled')).toBeInTheDocument();
            expect(screen.queryByText('Active')).not.toBeInTheDocument();
            expect(screen.queryByText('Expired')).not.toBeInTheDocument();
        });

        test('shows an Active badge and the expiry date (not "Never") for an active token expiring in the future', () => {
            renderWithToken({is_active: true, expires_at: FROZEN_NOW + (30 * DAY_MS)});
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.queryByText(/Never/)).not.toBeInTheDocument();
        });
    });
});
