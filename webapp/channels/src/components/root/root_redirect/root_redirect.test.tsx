// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';
import type {RouteComponentProps} from 'react-router-dom';
import {Redirect} from 'react-router-dom';

import {getFirstAdminSetupComplete as getFirstAdminSetupCompleteAction} from 'mattermost-redux/actions/general';

import * as GlobalActions from 'actions/global_actions';

import {renderWithContext, waitFor} from 'tests/react_testing_utils';

import RootRedirect from './root_redirect';
import type {Props} from './root_redirect';

jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

jest.mock('mattermost-redux/actions/general', () => ({
    getFirstAdminSetupComplete: jest.fn(() =>
        Promise.resolve({
            data: true,
        }),
    ),
}));

jest.mock('react-router-dom', () => {
    const actual = jest.requireActual('react-router-dom');
    return {
        ...actual,
        Redirect: jest.fn(() => null),
    };
});

describe('components/RootRedirect', () => {
    const baseProps: Props = {
        currentUserId: '',
        isElegibleForFirstAdmingOnboarding: false,
        isFirstAdmin: false,
        areThereTeams: false,
        actions: {
            getFirstAdminSetupComplete: getFirstAdminSetupCompleteAction as jest.Mock,
        },
    };

    const defaultProps = {
        ...baseProps,
        location: {
            pathname: '/',
        },
    } as Props & RouteComponentProps;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should redirect to /login when currentUserId is empty', () => {
        renderWithContext(<RootRedirect {...defaultProps}/>);

        expect(Redirect).toHaveBeenCalledTimes(1);
        expect(Redirect).toHaveBeenCalledWith(
            expect.objectContaining({
                to: expect.objectContaining({
                    pathname: '/login',
                }),
            }),
            {},
        );
    });

    test('should call GlobalActions.redirectUserToDefaultTeam when user is logged in and not eligible for first admin onboarding', () => {
        const props = {
            ...defaultProps,
            currentUserId: 'test-user-id',
            isElegibleForFirstAdmingOnboarding: false,
        };

        renderWithContext(<RootRedirect {...props}/>);

        expect(GlobalActions.redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
    });

    test('should redirect to preparing-workspace when eligible for first admin onboarding and no teams created', async () => {
        const history = createMemoryHistory({initialEntries: ['/']});
        const mockHistoryPush = jest.spyOn(history, 'push');

        const props = {
            currentUserId: 'test-user-id',
            isElegibleForFirstAdmingOnboarding: true,
            isFirstAdmin: true,
            areThereTeams: false,
            actions: {
                getFirstAdminSetupComplete: jest.fn().mockResolvedValue({data: false}),
            },
        };

        renderWithContext(<RootRedirect {...props}/>, {}, {history});

        expect(props.actions.getFirstAdminSetupComplete).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(mockHistoryPush).toHaveBeenCalledWith('/preparing-workspace');
        });
    });

    test('should NOT redirect to preparing-workspace when there are teams created, even if system value for first admin onboarding complete is false', async () => {
        const history = createMemoryHistory({initialEntries: ['/']});

        const props = {
            ...defaultProps,
            currentUserId: 'test-user-id',
            isElegibleForFirstAdmingOnboarding: true,
            isFirstAdmin: true,
            areThereTeams: true,
            actions: {
                getFirstAdminSetupComplete: jest.fn().mockResolvedValue({data: false}),
            },
        };

        renderWithContext(<RootRedirect {...props}/>, {}, {history});

        expect(props.actions.getFirstAdminSetupComplete).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(GlobalActions.redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
        });
    });

    test('should redirect to default team when first admin setup is complete', async () => {
        const props = {
            ...defaultProps,
            currentUserId: 'test-user-id',
            isElegibleForFirstAdmingOnboarding: true,
            isFirstAdmin: true,
            areThereTeams: false,
            actions: {
                getFirstAdminSetupComplete: jest.fn().mockResolvedValue({data: true}),
            },
        };

        renderWithContext(<RootRedirect {...props}/>);

        expect(props.actions.getFirstAdminSetupComplete).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(GlobalActions.redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
        });
    });

    test('should redirect to default team when not first admin or teams exist', async () => {
        const props = {
            ...defaultProps,
            currentUserId: 'test-user-id',
            isElegibleForFirstAdmingOnboarding: true,
            isFirstAdmin: false,
            areThereTeams: true,
            actions: {
                getFirstAdminSetupComplete: jest.fn().mockResolvedValue({data: false}),
            },
        };

        renderWithContext(<RootRedirect {...props}/>);

        expect(props.actions.getFirstAdminSetupComplete).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(GlobalActions.redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
        });
    });
});
