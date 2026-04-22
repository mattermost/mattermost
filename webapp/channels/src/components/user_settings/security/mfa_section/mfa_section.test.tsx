// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('utils/browser_history');

import React from 'react';

import MfaSection from 'components/user_settings/security/mfa_section/mfa_section';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';

describe('MfaSection', () => {
    const baseProps = {
        active: true,
        areAllSectionsInactive: false,
        mfaActive: false,
        mfaAvailable: true,
        mfaEnforced: false,
        updateSection: jest.fn(),
        actions: {
            deactivateMfa: jest.fn(() => Promise.resolve({})),
        },
    };

    describe('rendering', () => {
        test('should render nothing when MFA is not available', () => {
            const props = {
                ...baseProps,
                mfaAvailable: false,
            };
            const {container} = renderWithContext(<MfaSection {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('when section is collapsed and MFA is not active', () => {
            const props = {
                ...baseProps,
                active: false,
                mfaActive: false,
            };
            const {container} = renderWithContext(<MfaSection {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('when section is collapsed and MFA is active', () => {
            const props = {
                ...baseProps,
                active: false,
                mfaActive: true,
            };
            const {container} = renderWithContext(<MfaSection {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('when section is expanded and MFA is not active', () => {
            const props = {
                ...baseProps,
                mfaActive: false,
            };
            const {container} = renderWithContext(<MfaSection {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('when section is expanded and MFA is active but not enforced', () => {
            const props = {
                ...baseProps,
                mfaActive: true,
            };
            const {container} = renderWithContext(<MfaSection {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('when section is expanded and MFA is active and enforced', () => {
            const props = {
                ...baseProps,
                mfaActive: true,
                mfaEnforced: true,
            };
            const {container} = renderWithContext(<MfaSection {...props}/>);

            expect(container).toMatchSnapshot();
        });

        test('when section is expanded with a server error', async () => {
            const props = {
                ...baseProps,
                mfaActive: true,
                actions: {
                    deactivateMfa: jest.fn(() => Promise.resolve({error: {message: 'An error has occurred'}})),
                },
            };
            renderWithContext(<MfaSection {...props}/>);

            await userEvent.click(screen.getByText('Remove MFA from Account'));

            await waitFor(() => {
                expect(screen.getByText('An error has occurred')).toBeInTheDocument();
            });

            expect(screen.getByText('An error has occurred')).toMatchSnapshot();
        });
    });

    describe('setupMfa', () => {
        it('should send to setup page', async () => {
            renderWithContext(<MfaSection {...baseProps}/>);

            await userEvent.click(screen.getByText('Add MFA to Account'));

            expect(getHistory().push).toHaveBeenCalledWith('/mfa/setup');
        });
    });

    describe('removeMfa', () => {
        it('on success, should close section and clear state', async () => {
            const props = {
                ...baseProps,
                mfaActive: true,
            };

            renderWithContext(<MfaSection {...props}/>);

            await userEvent.click(screen.getByText('Remove MFA from Account'));

            await waitFor(() => {
                expect(baseProps.updateSection).toHaveBeenCalledWith('');
            });
            expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
            expect(getHistory().push).not.toHaveBeenCalled();
        });

        it('on success, should send to setup page if MFA enforcement is enabled', async () => {
            const props = {
                ...baseProps,
                mfaActive: true,
                mfaEnforced: true,
            };

            renderWithContext(<MfaSection {...props}/>);

            await userEvent.click(screen.getByText('Reset MFA on Account'));

            await waitFor(() => {
                expect(getHistory().push).toHaveBeenCalledWith('/mfa/setup');
            });
            expect(baseProps.updateSection).not.toHaveBeenCalled();
        });

        it('on error, should show error', async () => {
            const error = {message: 'An error occurred'};

            const props = {
                ...baseProps,
                mfaActive: true,
                actions: {
                    deactivateMfa: jest.fn(() => Promise.resolve({error})),
                },
            };

            renderWithContext(<MfaSection {...props}/>);

            await userEvent.click(screen.getByText('Remove MFA from Account'));

            await waitFor(() => {
                expect(screen.getByText('An error occurred')).toBeInTheDocument();
            });
            expect(baseProps.updateSection).not.toHaveBeenCalled();
        });
    });
});
