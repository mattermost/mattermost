// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import {TeamModes} from './team_modes';

describe('admin_console/team_channel_settings/team/TeamModes', () => {
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <TeamModes
                onToggle={jest.fn()}
                syncChecked={false}
                allAllowedChecked={false}
                allowedDomains={''}
                allowedDomainsChecked={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
