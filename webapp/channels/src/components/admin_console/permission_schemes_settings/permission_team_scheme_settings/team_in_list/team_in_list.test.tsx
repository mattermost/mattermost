// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import TeamInList
    from 'components/admin_console/permission_schemes_settings/permission_team_scheme_settings/team_in_list/team_in_list';
import {TeamType} from '@mattermost/types/teams';

describe('components/admin_console/permission_schemes_settings/permission_team_scheme_settings/team_in_list/team_in_list', () => {
    test('should match snapshot with team', () => {
        const props = {
            team: {
                id: '12345',
                display_name: 'testTeam',
                create_at: 0,
                update_at: 1,
                delete_at: 2,
                name: 'testTeam',
                description: 'testTeam description',
                email: 'test@team',
                type: 'O' as TeamType,
                company_name: 'mattermost',
                allowed_domains: '',
                invite_id: '678',
                allow_open_invite: true,
                scheme_id: '987',
                group_constrained: true,
            },
            isDisabled: false,
            onRemoveTeam: () => {},
        };

        const wrapper = shallow(
            <TeamInList {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
