// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {getHistory} from 'utils/browser_history';

import MfaSection from './mfa_section';

vi.mock('utils/browser_history', () => ({
    getHistory: vi.fn(() => ({
        push: vi.fn(),
    })),
}));

describe('MfaSection', () => {
    const baseProps = {
        active: true,
        areAllSectionsInactive: false,
        mfaActive: false,
        mfaAvailable: true,
        mfaEnforced: false,
        updateSection: vi.fn(),
        actions: {
            deactivateMfa: vi.fn(() => Promise.resolve({})),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

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
            const errorMessage = 'An error has occurred';
            const deactivateMfa = vi.fn().mockResolvedValue({error: {message: errorMessage}});
            const props = {
                ...baseProps,
                mfaActive: true,
                actions: {
                    deactivateMfa,
                },
            };

            const {container} = renderWithContext(<MfaSection {...props}/>);

            // Trigger an error by clicking remove MFA
            const removeLink = screen.getByRole('link', {name: /remove mfa from account/i});
            await userEvent.click(removeLink);

            // Wait for error to be displayed
            await waitFor(() => {
                expect(screen.getByText(errorMessage)).toBeInTheDocument();
            });

            expect(container).toMatchSnapshot();
        });
    });

    describe('setupMfa', () => {
        test('should send to setup page', async () => {
            const mockPush = vi.fn();
            vi.mocked(getHistory).mockReturnValue({push: mockPush} as any);

            renderWithContext(<MfaSection {...baseProps}/>);

            const addMfaLink = screen.getByRole('link', {name: /add mfa to account/i});
            await userEvent.click(addMfaLink);

            expect(mockPush).toHaveBeenCalledWith('/mfa/setup');
        });
    });

    describe('removeMfa', () => {
        test('on success, should close section and clear state', async () => {
            const updateSection = vi.fn();
            const deactivateMfa = vi.fn().mockResolvedValue({});
            const props = {
                ...baseProps,
                mfaActive: true,
                updateSection,
                actions: {
                    deactivateMfa,
                },
            };

            renderWithContext(<MfaSection {...props}/>);

            const removeLink = screen.getByRole('link', {name: /remove mfa from account/i});
            await userEvent.click(removeLink);

            await waitFor(() => {
                expect(updateSection).toHaveBeenCalledWith('');
            });
        });

        test('on success, should send to setup page if MFA enforcement is enabled', async () => {
            const mockPush = vi.fn();
            vi.mocked(getHistory).mockReturnValue({push: mockPush} as any);

            const deactivateMfa = vi.fn().mockResolvedValue({});
            const props = {
                ...baseProps,
                mfaActive: true,
                mfaEnforced: true,
                actions: {
                    deactivateMfa,
                },
            };

            renderWithContext(<MfaSection {...props}/>);

            const resetLink = screen.getByRole('link', {name: /reset mfa on account/i});
            await userEvent.click(resetLink);

            await waitFor(() => {
                expect(mockPush).toHaveBeenCalledWith('/mfa/setup');
            });
        });

        test('on error, should show error', async () => {
            const errorMessage = 'An error occurred';
            const deactivateMfa = vi.fn().mockResolvedValue({error: {message: errorMessage}});
            const props = {
                ...baseProps,
                mfaActive: true,
                actions: {
                    deactivateMfa,
                },
            };

            renderWithContext(<MfaSection {...props}/>);

            const removeLink = screen.getByRole('link', {name: /remove mfa from account/i});
            await userEvent.click(removeLink);

            await waitFor(() => {
                expect(screen.getByText(errorMessage)).toBeInTheDocument();
            });
        });
    });
});
