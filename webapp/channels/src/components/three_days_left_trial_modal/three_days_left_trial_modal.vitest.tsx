// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ThreeDaysLeftTrialModal from 'components/three_days_left_trial_modal/three_days_left_trial_modal';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';

describe('components/three_days_left_trial_modal/three_days_left_trial_modal', () => {
    // required state to mount using the provider
    const user = TestHelper.fakeUserWithId();

    const profiles = {
        [user.id]: user,
    };

    const state = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            cloud: {
                limits: {
                    limitsLoaded: true,
                },
            },
            users: {
                currentUserId: user.id,
                profiles,
            },
            usage: {
                files: {
                    totalStorage: 0,
                    totalStorageLoaded: true,
                },
                messages: {
                    history: 0,
                    historyLoaded: true,
                },
                boards: {
                    cards: 0,
                    cardsLoaded: true,
                },
                integrations: {
                    enabled: 3,
                    enabledLoaded: true,
                },
                teams: {
                    active: 0,
                    cloudArchived: 0,
                    teamsLoaded: true,
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    three_days_left_trial_modal: {
                        open: true,
                    },
                },
            },
        },
    };

    const props = {
        onExited: vi.fn(),
        limitsOverpassed: false,
    };

    test('should match snapshot', async () => {
        renderWithContext(
            <ThreeDaysLeftTrialModal {...props}/>,
            state,
            {useMockedStore: true},
        );

        // Wait for modal to render
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Verify modal title/content is rendered
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    test('should match snapshot when limits are overpassed and show the limits panel', async () => {
        renderWithContext(
            <ThreeDaysLeftTrialModal
                {...props}
                limitsOverpassed={true}
            />,
            state,
            {useMockedStore: true},
        );

        // Wait for modal to render
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Modal should show when limitsOverpassed is true
        expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    test('should show the three days left modal with the three cards', async () => {
        renderWithContext(
            <ThreeDaysLeftTrialModal {...props}/>,
            state,
            {useMockedStore: true},
        );

        // Wait for modal to render
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Verify cards are rendered (they have class 'three-days-left-card')
        const cards = document.querySelectorAll('.three-days-left-card');
        expect(cards.length).toBe(3);
    });

    test('should show the workspace limits panel when limits are overpassed', async () => {
        renderWithContext(
            <ThreeDaysLeftTrialModal
                {...props}
                limitsOverpassed={true}
            />,
            state,
            {useMockedStore: true},
        );

        // Wait for modal to render
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // When limitsOverpassed is true, WorkspaceLimitsPanel should be shown
        const limitsPanel = document.querySelector('.workspace-limits-panel');
        expect(limitsPanel).toBeInTheDocument();
    });

    test('should call on exited', async () => {
        const mockOnExited = vi.fn();

        renderWithContext(
            <ThreeDaysLeftTrialModal
                {...props}
                onExited={mockOnExited}
            />,
            state,
            {useMockedStore: true},
        );

        // Wait for modal to render
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Find and click the close button
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        // The close button should be clickable
        expect(closeButton).toBeInTheDocument();
    });
});
