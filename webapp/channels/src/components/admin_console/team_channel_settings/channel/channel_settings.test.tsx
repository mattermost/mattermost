// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {ChannelsSettings} from './channel_settings';

jest.mock('components/admin_console/team_channel_settings/channel/list', () => () => <div>{'ChannelsList'}</div>);

describe('admin_console/team_channel_settings/channel/ChannelSettings', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelsSettings
                siteName='site'
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
