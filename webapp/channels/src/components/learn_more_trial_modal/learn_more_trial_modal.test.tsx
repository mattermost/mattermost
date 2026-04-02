// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LearnMoreTrialModal from 'components/learn_more_trial_modal/learn_more_trial_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

jest.mock('components/common/hooks/useOpenStartTrialFormModal', () => ({
    __esModule: true,
    default: () => jest.fn(),
}));

describe('components/learn_more_trial_modal/learn_more_trial_modal', () => {
    // required state to mount using the provider
    const state = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        id: 'current_user_id',
                        roles: '',
                    },
                },
            },
            admin: {
                analytics: {
                    TOTAL_USERS: 9,
                },
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            general: {
                license: {
                    IsLicensed: 'false',
                    Cloud: 'false',
                },
                config: {
                    DiagnosticsEnabled: 'false',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    learn_more_trial_modal: {
                        open: true,
                    },
                },
            },
        },
    };

    const props = {
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <LearnMoreTrialModal {...props}/>,
            state,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should show the learn more about trial modal carousel slides', () => {
        renderWithContext(
            <LearnMoreTrialModal {...props}/>,
            state,
        );
        expect(document.querySelector('#learnMoreTrialModalCarousel')).not.toBeNull();
    });

    test('should call on close', async () => {
        const mockOnClose = jest.fn();

        renderWithContext(
            <LearnMoreTrialModal
                {...props}
                onClose={mockOnClose}
            />,
            state,
        );

        await userEvent.click(screen.getByLabelText('Close'));

        await waitFor(() => {
            expect(mockOnClose).toHaveBeenCalled();
        });
    });

    test('should call on exited', async () => {
        const mockOnExited = jest.fn();

        renderWithContext(
            <LearnMoreTrialModal
                {...props}
                onExited={mockOnExited}
            />,
            state,
        );

        await userEvent.click(screen.getByLabelText('Close'));

        await waitFor(() => {
            expect(mockOnExited).toHaveBeenCalled();
        });
    });

    test('should move the slides when clicking carousel next and prev buttons', async () => {
        renderWithContext(
            <LearnMoreTrialModal
                {...props}
            />,
            state,
        );

        // validate the value of the first slide
        expect(document.querySelector('.slide.active-anim #learnMoreTrialModalStep-useSso')).not.toBeNull();

        const nextButton = document.querySelector('.chevron-right')!;
        const prevButton = document.querySelector('.chevron-left')!;

        // move to the second slide
        await userEvent.click(nextButton);

        expect(document.querySelector('.slide.active-anim #learnMoreTrialModalStep-ldap')).not.toBeNull();

        // move to the third slide
        await userEvent.click(nextButton);

        expect(document.querySelector('.slide.active-anim #learnMoreTrialModalStep-systemConsole')).not.toBeNull();

        // move back to the second slide
        await userEvent.click(prevButton);

        expect(document.querySelector('.slide.active-anim #learnMoreTrialModalStep-ldap')).not.toBeNull();
    });

    test('should have the self hosted request trial button cloud free is disabled', () => {
        const nonCloudState = {
            ...state,
            entities: {
                ...state.entities,
                general: {
                    ...state.entities.general,
                    license: {
                        ...state.entities.general.license,
                        Cloud: 'false',
                    },
                },
            },
        };

        renderWithContext(
            <LearnMoreTrialModal
                {...props}
            />,
            nonCloudState,
        );

        // validate the cloud start trial button is not present
        expect(document.querySelector('#start_trial_btn')).not.toBeNull();
    });
});
