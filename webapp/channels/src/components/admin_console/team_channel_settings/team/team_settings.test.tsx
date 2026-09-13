// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {TeamsSettings} from './team_settings';

jest.mock('components/admin_console/team_channel_settings/team/list', () => () => <div>{'TeamList'}</div>);

jest.mock('mattermost-redux/selectors/entities/roles_helpers', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles_helpers'),
    haveISystemPermission: jest.fn(),
}));

describe('admin_console/team_channel_settings/team/TeamSettings', () => {
    beforeEach(() => {
        (haveISystemPermission as jest.Mock).mockReturnValue(false);
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <TeamsSettings
                siteName='site'
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should not render the Create Team button without write permission', () => {
        (haveISystemPermission as jest.Mock).mockReturnValue(false);
        renderWithContext(
            <TeamsSettings
                siteName='site'
            />,
        );
        expect(screen.queryByText('Create Team')).not.toBeInTheDocument();
    });

    test('should render the Create Team button with write permission', () => {
        (haveISystemPermission as jest.Mock).mockReturnValue(true);
        renderWithContext(
            <TeamsSettings
                siteName='site'
            />,
        );
        expect(screen.getByText('Create Team')).toBeInTheDocument();
    });
});
