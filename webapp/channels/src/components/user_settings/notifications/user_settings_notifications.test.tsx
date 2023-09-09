// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {type IntlShape} from 'react-intl';

import {renderWithFullContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserSettingsNotifications from './user_settings_notifications';

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const defaultProps = {
        user: TestHelper.getUserMock({id: 'user_id'}),
        updateSection: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        updateMe: jest.fn(() => Promise.resolve({})),
        isCollapsedThreadsEnabled: true,
        sendPushNotifications: false,
        enableAutoResponder: false,
        isCallsRingingEnabled: true,
        intl: {} as IntlShape,
    };

    test('should match snapshot', () => {
        const wrapper = renderWithFullContext(
            <UserSettingsNotifications {...defaultProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should show reply notifications section when CRT off', () => {
        const props = {...defaultProps, isCollapsedThreadsEnabled: false};

        renderWithFullContext(<UserSettingsNotifications {...props}/>);

        expect(screen.getByText('Reply notifications')).toBeInTheDocument();
    });
});
