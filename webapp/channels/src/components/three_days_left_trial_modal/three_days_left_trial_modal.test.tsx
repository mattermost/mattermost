// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ThreeDaysLeftTrialModal from 'components/three_days_left_trial_modal/three_days_left_trial_modal';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

describe('components/three_days_left_trial_modal/three_days_left_trial_modal', () => {
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

    const defaultProps = {
        onExited: jest.fn(),
        limitsOverpassed: false,
    };

    test('should render the modal with header, subtitle, feature cards, and view plans button', () => {
        renderWithContext(
            <ThreeDaysLeftTrialModal {...defaultProps}/>,
            state,
        );

        // Header and subtitle
        expect(screen.getByText('Your trial ends soon')).toBeInTheDocument();
        expect(screen.getByText('There is still time to explore what our paid plans can help you accomplish.')).toBeInTheDocument();

        // Three feature cards
        expect(screen.getByText('Use SSO (with OpenID, SAML, Google, O365)')).toBeInTheDocument();
        expect(screen.getByText('Synchronize your Active Directory/LDAP groups')).toBeInTheDocument();
        expect(screen.getByText('Provide controlled access to the System Console')).toBeInTheDocument();

        // View plans button
        expect(screen.getByRole('button', {name: 'View plan options'})).toBeInTheDocument();
    });

    test('should show limits overpassed content when limitsOverpassed is true', () => {
        renderWithContext(
            <ThreeDaysLeftTrialModal
                {...defaultProps}
                limitsOverpassed={true}
            />,
            state,
        );

        // Different header and subtitle
        expect(screen.getByText('Upgrade before the trial ends')).toBeInTheDocument();
        expect(screen.getByText('There are 3 days left on your trial. Upgrade to our Professional or Enterprise plan to avoid exceeding your data limits on the Free plan.')).toBeInTheDocument();

        // Shows limits panel instead of feature cards
        expect(screen.getByText('Limits')).toBeInTheDocument();
        expect(screen.queryByText('Use SSO (with OpenID, SAML, Google, O365)')).not.toBeInTheDocument();
    });

    test('should call onExited when modal is closed', async () => {
        const mockOnExited = jest.fn();

        renderWithContext(
            <ThreeDaysLeftTrialModal
                {...defaultProps}
                onExited={mockOnExited}
            />,
            state,
        );

        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        await waitFor(() => {
            expect(mockOnExited).toHaveBeenCalledTimes(1);
        });
    });

    test('should not render when modal is not open', () => {
        const closedState = {
            ...state,
            views: {
                modals: {
                    modalState: {
                        three_days_left_trial_modal: {
                            open: false,
                        },
                    },
                },
            },
        };

        renderWithContext(
            <ThreeDaysLeftTrialModal {...defaultProps}/>,
            closedState,
        );

        expect(screen.queryByText('Your trial ends soon')).not.toBeInTheDocument();
    });
});
