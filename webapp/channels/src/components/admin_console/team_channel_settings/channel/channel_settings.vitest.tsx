// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import {ChannelsSettings} from './channel_settings';

describe('admin_console/team_channel_settings/channel/ChannelSettings', () => {
    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <ChannelsSettings
                siteName='site'
            />,
        );
        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
