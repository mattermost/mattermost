// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import {TeamsSettings} from './team_settings';

describe('admin_console/team_channel_settings/team/TeamSettings', () => {
    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <TeamsSettings
                siteName='site'
            />,
        );
        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
