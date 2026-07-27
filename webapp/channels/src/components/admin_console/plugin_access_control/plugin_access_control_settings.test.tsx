// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import PluginAccessControlSettings, {type PluginAccessControlUI} from './plugin_access_control_settings';

jest.mock('components/admin_console/content_flagging/user_multiselector/user_multiselector', () => ({
    UserSelector: () => <div data-testid='user-selector'/>,
}));

describe('PluginAccessControlSettings', () => {
    test('selecting Everyone preserves AllowedUserIds', async () => {
        const user = userEvent.setup();
        const onAccessControlChange = jest.fn();
        const accessControl: PluginAccessControlUI = {
            Enable: true,
            AllowedUserIds: ['user-a', 'user-b'],
        };

        renderWithContext(
            <PluginAccessControlSettings
                pluginId='com.mattermost.test'
                accessControl={accessControl}
                onAccessControlChange={onAccessControlChange}
            />,
        );

        await user.click(screen.getByRole('radio', {name: 'Everyone'}));

        expect(onAccessControlChange).toHaveBeenCalledWith({
            Enable: false,
            AllowedUserIds: ['user-a', 'user-b'],
        });
    });
});
