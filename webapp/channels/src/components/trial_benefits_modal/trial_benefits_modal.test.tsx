// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import TrialBenefitsModal from 'components/trial_benefits_modal/trial_benefits_modal';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

const mockLocation = {pathname: '', search: '', hash: ''};

jest.mock('components/admin_console/blockable_link', () => {
    return () => {
        return <div/>;
    };
});

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom') as typeof import('react-router-dom'),
    useLocation: () => mockLocation,
}));

describe('components/trial_benefits_modal/trial_benefits_modal', () => {
    // required state to mount using the provider
    const state = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'false',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    trial_benefits_modal: {
                        open: true,
                    },
                },
            },
            admin: {
                navigationBlock: {
                    blocked: true,
                },
            },
        },
    };

    const props = {
        onExited: jest.fn(),
        trialJustStarted: false,
    };

    beforeAll(() => {
        jest.useFakeTimers({advanceTimers: true});
        jest.setSystemTime(new Date('2026-02-20T00:00:00Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        mockLocation.pathname = '';
    });

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <TrialBenefitsModal {...props}/>,
            state,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot when trial has already started', () => {
        const {baseElement} = renderWithContext(
            <TrialBenefitsModal
                {...props}
                trialJustStarted={true}
            />,
            state,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should show the benefits modal', () => {
        renderWithContext(
            <TrialBenefitsModal {...props}/>,
            state,
        );
        expect(document.getElementById('trialBenefitsModalCarousel')).toBeInTheDocument();
    });

    test('should hide the benefits modal', () => {
        const trialBenefitsModalHidden = {
            modals: {
                modalState: {},
            },
        };
        const localState = {...state, views: trialBenefitsModalHidden};
        renderWithContext(
            <TrialBenefitsModal {...props}/>,
            localState,
        );
        expect(document.getElementById('trialBenefitsModalCarousel')).not.toBeInTheDocument();
    });

    test('should call on close', async () => {
        const mockOnClose = jest.fn();

        renderWithContext(
            <TrialBenefitsModal
                {...props}
                onClose={mockOnClose}
                trialJustStarted={true}
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
            <TrialBenefitsModal
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

    test('should present the just started trial modal content', () => {
        renderWithContext(
            <TrialBenefitsModal
                {...props}
                trialJustStarted={true}
            />,
            state,
        );

        expect(screen.getByText('Your trial has started! Explore the benefits of Enterprise')).toBeInTheDocument();
    });

    test('should have a shorter title and not include the cta button when in cloud env', () => {
        const cloudState = {...state, entities: {...state.entities, general: {...state.entities.general, license: {Cloud: 'true'}}}};
        renderWithContext(
            <TrialBenefitsModal
                {...props}
                trialJustStarted={true}
            />,
            cloudState,
        );

        expect(screen.getByText('Your trial has started!')).toBeInTheDocument();

        const trialStartDiv = document.getElementById('trialBenefitsModalStarted-trialStart');
        expect(trialStartDiv?.querySelector('button.btn-primary')).toBeNull();
    });

    test('should show the invite people call to action when trial started from the team', () => {
        const cloudState = {...state, entities: {...state.entities, general: {...state.entities.general, license: {Cloud: 'true'}}}};
        renderWithContext(
            <TrialBenefitsModal
                {...props}
                trialJustStarted={true}
            />,
            cloudState,
        );

        expect(screen.getByText('Your trial has started!')).toBeInTheDocument();
        expect(screen.getByText('Invite people')).toBeInTheDocument();
    });

    test('should show hide the invite people call to action when trial started from system console', () => {
        const cloudState = {...state, entities: {...state.entities, general: {...state.entities.general, license: {Cloud: 'true'}}}};

        mockLocation.pathname = '/admin_console';
        renderWithContext(
            <TrialBenefitsModal
                {...props}
                trialJustStarted={true}
            />,
            cloudState,
        );

        expect(screen.getByText('Your trial has started!')).toBeInTheDocument();
        const buttonsSection = document.querySelector('.buttons-section-wrapper');
        expect(buttonsSection).not.toBeNull();
        expect(buttonsSection!.textContent).toContain('Close');
    });
});
