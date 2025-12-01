// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';
import type EmojiMap from 'utils/emoji_map';

import TermsOfService from './terms_of_service';
import type {TermsOfServiceProps} from './terms_of_service';

vi.mock('actions/global_actions', () => ({
    emitUserLoggedOutEvent: vi.fn(),
    redirectUserToDefaultTeam: vi.fn(),
}));

describe('components/terms_of_service/TermsOfService', () => {
    const getTermsOfService = vi.fn().mockResolvedValue({data: {id: 'tos_id', text: 'tos_text'}});
    const updateMyTermsOfServiceStatus = vi.fn().mockResolvedValue({data: true});

    const baseProps: TermsOfServiceProps = {
        actions: {
            getTermsOfService,
            updateMyTermsOfServiceStatus,
        },
        location: {search: '', hash: '', pathname: '', state: ''},
        termsEnabled: true,
        emojiMap: {} as EmojiMap,
        onboardingFlowEnabled: false,
        match: {} as any,
        history: {} as any,
    };

    const baseState = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
            },
            general: {
                config: {},
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', async () => {
        const {container} = renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for async operations to complete
        await waitFor(() => {
            expect(screen.getByText('tos_text')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should call getTermsOfService on mount', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        await waitFor(() => {
            expect(baseProps.actions.getTermsOfService).toHaveBeenCalledTimes(1);
        });
    });

    test('should call emitUserLoggedOutEvent on handleLogoutClick', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for terms to load
        await waitFor(() => {
            expect(screen.getByText('tos_text')).toBeInTheDocument();
        });

        const logoutLink = screen.getByText(/logout/i);
        await userEvent.click(logoutLink);

        expect(emitUserLoggedOutEvent).toHaveBeenCalledTimes(1);
        expect(emitUserLoggedOutEvent).toHaveBeenCalledWith('/login');
    });

    test('should match snapshot on loading', async () => {
        const {container} = renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for async operations to complete
        await waitFor(() => {
            expect(baseProps.actions.getTermsOfService).toHaveBeenCalled();
        });

        // Initial render shows loading state
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on accept terms', async () => {
        const {container} = renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for terms to load
        await waitFor(() => {
            expect(screen.getByText('tos_text')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on reject terms', async () => {
        const {container} = renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for terms to load
        await waitFor(() => {
            expect(screen.getByText('tos_text')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should call updateTermsOfServiceStatus on registerUserAction', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for terms to load
        await waitFor(() => {
            expect(screen.getByText('tos_text')).toBeInTheDocument();
        });

        const acceptButton = screen.getByRole('button', {name: /i agree/i});
        await userEvent.click(acceptButton);

        expect(updateMyTermsOfServiceStatus).toHaveBeenCalled();
    });

    test('should match state and call updateTermsOfServiceStatus on handleAcceptTerms', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for terms to load
        await waitFor(() => {
            expect(screen.getByText('tos_text')).toBeInTheDocument();
        });

        const acceptButton = screen.getByRole('button', {name: /i agree/i});
        await userEvent.click(acceptButton);

        expect(updateMyTermsOfServiceStatus).toHaveBeenCalled();
    });

    test('should match state and call updateTermsOfServiceStatus on handleRejectTerms', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>, baseState);

        // Wait for terms to load
        await waitFor(() => {
            expect(screen.getByText('tos_text')).toBeInTheDocument();
        });

        const rejectButton = screen.getByRole('button', {name: /i disagree/i});
        await userEvent.click(rejectButton);

        expect(updateMyTermsOfServiceStatus).toHaveBeenCalled();
    });
});
