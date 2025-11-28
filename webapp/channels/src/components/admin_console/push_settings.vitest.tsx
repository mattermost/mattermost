// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import PushSettings from './push_settings';

describe('components/admin_console/push_settings', () => {
    const defaultConfig = {
        EmailSettings: {
            PushNotificationServer: 'https://global.push.mattermost.com',
            PushNotificationServerType: 'mhpns',
            SendPushNotifications: true,
        },
        TeamSettings: {
            MaxNotificationsPerChannel: 1000,
        },
    } as AdminConfig;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders with licensed MHPNS', () => {
        const props = {
            config: defaultConfig,
            license: {
                IsLicensed: 'true',
                MHPNS: 'true',
            },
        };

        renderWithContext(<PushSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders without license', () => {
        const props = {
            config: defaultConfig,
            license: {},
        };

        renderWithContext(<PushSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with MHPNS server type', () => {
        const props = {
            config: {
                ...defaultConfig,
                EmailSettings: {
                    ...defaultConfig.EmailSettings,
                    PushNotificationServerType: 'mhpns',
                },
            } as AdminConfig,
            license: {
                IsLicensed: 'true',
                MHPNS: 'true',
            },
        };

        renderWithContext(<PushSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with custom server type', () => {
        const props = {
            config: {
                ...defaultConfig,
                EmailSettings: {
                    ...defaultConfig.EmailSettings,
                    PushNotificationServerType: 'custom',
                    PushNotificationServer: 'https://custom.push.server.com',
                },
            } as AdminConfig,
            license: {},
        };

        renderWithContext(<PushSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });

    it('renders with push notifications disabled', () => {
        const props = {
            config: {
                ...defaultConfig,
                EmailSettings: {
                    ...defaultConfig.EmailSettings,
                    SendPushNotifications: false,
                },
            } as AdminConfig,
            license: {},
        };

        renderWithContext(<PushSettings {...props}/>);

        expect(document.querySelector('.wrapper--fixed')).toBeInTheDocument();
    });
});
