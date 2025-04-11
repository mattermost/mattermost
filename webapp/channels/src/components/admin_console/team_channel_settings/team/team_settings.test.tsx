// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {TeamsSettings} from './team_settings';

describe('admin_console/team_channel_settings/team/TeamSettings', () => {
    test('should render correctly', () => {
        renderWithContext(
            <TeamsSettings
                siteName='site'
            />,
        );

        expect(screen.getByText('site Teams')).toBeInTheDocument();
        expect(screen.getByText('Teams')).toBeInTheDocument();
        expect(screen.getByText('Manage team settings.')).toBeInTheDocument();
    });
});
