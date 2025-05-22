// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import UserAccountNameMenuItem from './user_account_name_menuitem';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: jest.fn(),
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(),
}));

describe('UserAccountNameMenuItem', () => {
    const user = TestHelper.getUserMock({
        first_name: 'sampleFirstName',
        last_name: 'sampleLastName',
        username: 'sampleUsername',
    });

    let initialState: GlobalState;

    beforeEach(() => {
        initialState = {
            entities: {
                users: {
                    profiles: {
                        [user.id]: user,
                    },
                    currentUserId: user.id,
                },
            },
        } as GlobalState;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('should render with both first and last name along with username', () => {
        renderWithContext(<UserAccountNameMenuItem/>, initialState);

        expect(screen.getByText('sampleFirstName sampleLastName')).toBeInTheDocument();
        expect(screen.getByText('@sampleUsername')).toBeInTheDocument();
    });

    test('should render with only username', () => {
        const state = {
            entities: {
                users: {
                    profiles: {
                        [user.id]: {
                            id: user.id,
                            username: user.username,
                        },
                    },
                    currentUserId: user.id,
                },
            },
        } as GlobalState;

        renderWithContext(<UserAccountNameMenuItem/>, state);

        expect(screen.queryByText('sampleFirstName sampleLastName')).not.toBeInTheDocument();
        expect(screen.getByText('@sampleUsername')).toBeInTheDocument();
    });

    test('should try to open user settings modal', async () => {
        jest.spyOn(reactRedux, 'useDispatch').mockReturnValue(jest.fn());

        renderWithContext(<UserAccountNameMenuItem/>, initialState);

        userEvent.click(screen.getByRole('menuitem'));

        expect(reactRedux.useDispatch).toHaveBeenCalledTimes(1);
    });

    test('should not break if no props are passed', () => {
        const {container} = renderWithContext(<UserAccountNameMenuItem/>);

        expect(container).toMatchSnapshot();
    });
});
