// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';

import type {AdminConfig} from '@mattermost/types/config';

import {PushSettings} from 'components/admin_console/push_settings';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext} from 'tests/react_testing_utils';

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
            intl: defaultIntl,
            config,
            license: {
                IsLicensed: 'true',
                MHPNS: 'true',
            },
        };

        const ref = React.createRef<InstanceType<typeof PushSettings>>();
        const {container} = renderWithContext(
            <PushSettings
                {...props}
                ref={ref}
            />,
        );

        act(() => {
            ref.current!.handleDropdownChange('pushNotificationServerType', 'mhpns');
        });
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
            intl: defaultIntl,
            config,
            license: {},
        };

        const {container} = renderWithContext(
            <PushSettings {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });
});
