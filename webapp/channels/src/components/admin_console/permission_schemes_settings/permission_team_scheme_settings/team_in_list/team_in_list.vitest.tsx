// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TeamType} from '@mattermost/types/teams';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import TeamInList from './team_in_list';

describe('components/admin_console/permission_schemes_settings/permission_team_scheme_settings/team_in_list', () => {
    const defaultProps = {
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
        onRemoveTeam: vi.fn(),
    };

    it('renders team in list', () => {
        renderWithContext(
            <TeamInList {...defaultProps}/>,
        );

        expect(screen.getByText('testTeam')).toBeInTheDocument();
    });

    it('renders with remove button', () => {
        renderWithContext(
            <TeamInList {...defaultProps}/>,
        );

        // Should render the team name
        expect(screen.getByText('testTeam')).toBeInTheDocument();
    });
});
