// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactRedux from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserAccountNameMenuItem from './user_account_name_menuitem';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useDispatch: jest.fn(),
}));

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(),
}));

describe('UserAccountNameMenuItem', () => {
    let currentUser: UserProfile;

    beforeEach(() => {
        currentUser = TestHelper.getUserMock({
            first_name: 'sampleFirstName',
            last_name: 'sampleLastName',
            username: 'sampleUsername',
        });
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.clearAllMocks();
    });

    test('should render with both first and last name along with username', () => {
        renderWithContext(<UserAccountNameMenuItem currentUser={currentUser}/>);

        expect(screen.getByText('sampleFirstName sampleLastName')).toBeInTheDocument();
        expect(screen.getByText('@sampleUsername')).toBeInTheDocument();
    });

    test('should render with only username', () => {
        Reflect.deleteProperty(currentUser, 'first_name');
        Reflect.deleteProperty(currentUser, 'last_name');

        renderWithContext(<UserAccountNameMenuItem currentUser={currentUser}/>);

        expect(screen.queryByText('sampleFirstName sampleLastName')).not.toBeInTheDocument();
        expect(screen.getByText('@sampleUsername')).toBeInTheDocument();
    });

    test('should try to open user settings modal', async () => {
        jest.spyOn(reactRedux, 'useDispatch').mockReturnValue(jest.fn());

        renderWithContext(<UserAccountNameMenuItem currentUser={currentUser}/>);

        userEvent.click(screen.getByRole('menuitem'));

        expect(reactRedux.useDispatch).toHaveBeenCalledTimes(1);
    });

    test('should not break if no props are passed', () => {
        const {container} = renderWithContext(<UserAccountNameMenuItem/>);

        expect(container).toMatchSnapshot();
    });
});
