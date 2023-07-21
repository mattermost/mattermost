// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminConfig} from '@mattermost/types/config';
import {shallow} from 'enzyme';
import React from 'react';

import PushSettings from 'components/admin_console/push_settings';

describe('components/PushSettings', () => {
    test('should match snapshot, licensed', () => {
        const config = {
            EmailSettings: {
                PushNotificationServer: 'https://push.mattermost.com',
                PushNotificationServerType: 'mhpns',
                SendPushNotifications: true,
            },
            TeamSettings: {
                MaxNotificationsPerChannel: 1000,
            },
        } as AdminConfig;

        const props = {
            config,
            license: {
                IsLicensed: 'true',
                MHPNS: 'true',
            },
        };

        const wrapper = shallow(
            <PushSettings {...props}/>,
        );

        wrapper.find('#pushNotificationServerType').simulate('change', 'pushNotificationServerType', 'mhpns');
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, unlicensed', () => {
        const config = {
            EmailSettings: {
                PushNotificationServer: 'https://push.mattermost.com',
                PushNotificationServerType: 'mhpns',
                SendPushNotifications: true,
            },
            TeamSettings: {
                MaxNotificationsPerChannel: 1000,
            },
        } as AdminConfig;

        const props = {
            config,
            license: {},
        };

        const wrapper = shallow(
            <PushSettings {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
