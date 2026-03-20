// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import type EmojiMap from 'utils/emoji_map';

import TermsOfService from './terms_of_service';
import type {TermsOfServiceProps} from './terms_of_service';

jest.mock('actions/global_actions', () => ({
    emitUserLoggedOutEvent: jest.fn(),
    redirectUserToDefaultTeam: jest.fn(),
}));

describe('components/terms_of_service/TermsOfService', () => {
    const getTermsOfService = jest.fn().mockResolvedValue({data: {id: 'tos_id', text: 'tos_text'}});
    const updateMyTermsOfServiceStatus = jest.fn().mockResolvedValue({data: true});

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

    beforeEach(() => {
        getTermsOfService.mockClear();
        updateMyTermsOfServiceStatus.mockClear();
        (emitUserLoggedOutEvent as jest.Mock).mockClear();
    });

    test('should match snapshot', async () => {
        const props = {...baseProps};
        const {container} = renderWithContext(<TermsOfService {...props}/>);
        await waitFor(() => {
            expect(screen.getByTestId('termsOfService')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    test('should call getTermsOfService on mount', () => {
        const props = {...baseProps};
        renderWithContext(<TermsOfService {...props}/>);
        expect(props.actions.getTermsOfService).toHaveBeenCalledTimes(1);
    });

    test('should match snapshot on loading', () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getTermsOfService: jest.fn().mockReturnValue(new Promise(() => {})),
            },
        };
        const {container} = renderWithContext(<TermsOfService {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on accept terms', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                updateMyTermsOfServiceStatus: jest.fn().mockReturnValue(new Promise(() => {})),
            },
        };
        const {container} = renderWithContext(<TermsOfService {...props}/>);
        await waitFor(() => {
            expect(screen.getByTestId('termsOfService')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('I Agree'));
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on reject terms', async () => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                updateMyTermsOfServiceStatus: jest.fn().mockReturnValue(new Promise(() => {})),
            },
        };
        const {container} = renderWithContext(<TermsOfService {...props}/>);
        await waitFor(() => {
            expect(screen.getByTestId('termsOfService')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('I Disagree'));
        expect(container).toMatchSnapshot();
    });

    test('should call updateTermsOfServiceStatus on registerUserAction', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>);
        await waitFor(() => {
            expect(screen.getByTestId('termsOfService')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('I Agree'));
        expect(baseProps.actions.updateMyTermsOfServiceStatus).toHaveBeenCalledTimes(1);
    });

    test('should match state and call updateTermsOfServiceStatus on handleAcceptTerms', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>);
        await waitFor(() => {
            expect(screen.getByTestId('termsOfService')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('I Agree'));
        expect(baseProps.actions.updateMyTermsOfServiceStatus).toHaveBeenCalledTimes(1);
    });

    test('should match state and call updateTermsOfServiceStatus on handleRejectTerms', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>);
        await waitFor(() => {
            expect(screen.getByTestId('termsOfService')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('I Disagree'));
        expect(baseProps.actions.updateMyTermsOfServiceStatus).toHaveBeenCalledTimes(1);
    });

    test('should call emitUserLoggedOutEvent on handleLogoutClick', async () => {
        renderWithContext(<TermsOfService {...baseProps}/>);
        await waitFor(() => {
            expect(screen.getByTestId('termsOfService')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('Logout'));
        expect(emitUserLoggedOutEvent).toHaveBeenCalledTimes(1);
        expect(emitUserLoggedOutEvent).toHaveBeenCalledWith('/login');
    });
});
