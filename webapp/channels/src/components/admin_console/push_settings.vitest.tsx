// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import PushSettings from 'components/admin_console/push_settings';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/PushSettings', () => {
    test('should match snapshot, licensed', () => {
        const config = {
            EmailSettings: {
                PushNotificationServer: 'https://global.push.mattermost.com',
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

        const {container} = renderWithContext(
            <PushSettings {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, unlicensed', () => {
        const config = {
            EmailSettings: {
                PushNotificationServer: 'https://global.push.mattermost.com',
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

        const {container} = renderWithContext(
            <PushSettings {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
