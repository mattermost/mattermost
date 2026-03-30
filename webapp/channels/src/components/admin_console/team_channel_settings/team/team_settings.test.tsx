// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {TeamsSettings} from './team_settings';

jest.mock('components/admin_console/team_channel_settings/team/list', () => () => <div>{'TeamList'}</div>);

describe('admin_console/team_channel_settings/team/TeamSettings', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <TeamsSettings
                siteName='site'
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
