// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {type IntlShape} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';
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
        isEnterpriseOrCloudOrSKUStarterFree: false,
        isEnterpriseReady: true,
    };

    test('should match snapshot', () => {
        const wrapper = renderWithContext(
            <UserSettingsNotifications {...defaultProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when its a starter free', () => {
        const props = {...defaultProps, isEnterpriseOrCloudOrSKUStarterFree: true};

        const wrapper = renderWithContext(
            <UserSettingsNotifications {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when its team edition', () => {
        const props = {...defaultProps, isEnterpriseReady: false};

        const wrapper = renderWithContext(
            <UserSettingsNotifications {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should show reply notifications section when CRT off', () => {
        const props = {...defaultProps, isCollapsedThreadsEnabled: false};

        renderWithContext(<UserSettingsNotifications {...props}/>);

        expect(screen.getByText('Reply notifications')).toBeInTheDocument();
    });
});
