// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';

import {renderWithContext} from 'tests/react_testing_utils';

import {GroupTeamDisplay} from './group_team_display';

describe('GroupTeamDisplay', () => {
    const mockGroup: Group = {
        id: 'group1',
        name: 'developers',
        display_name: 'Developers',
        description: 'Dev team',
        source: 'custom',
        remote_id: 'dev-remote',
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        has_syncables: false,
        member_count: 5,
        allow_reference: true,
        scheme_admin: false,
    };

    const mockTeam: Team = {
        id: 'team1',
        create_at: 1234567890,
        update_at: 1234567890,
        delete_at: 0,
        display_name: 'Engineering Team',
        name: 'engineering',
        description: 'Engineering team',
        email: 'eng@example.com',
        type: 'O',
        company_name: '',
        allowed_domains: '',
        invite_id: 'invite123',
        allow_open_invite: true,
        scheme_id: '',
        group_constrained: false,
        policy_id: null,
    };

    describe('team rendering', () => {
        it('should render team badge with icon', () => {
            const {container} = renderWithContext(
                <GroupTeamDisplay
                    item={mockTeam}
                    variant='team'
                />,
            );

            const badge = container.querySelector('.GroupIcon');
            expect(badge).toBeInTheDocument();

            // Check that it contains an SVG icon
            const icon = badge?.querySelector('svg');
            expect(icon).toBeInTheDocument();
        });

        it('should render team display name', () => {
            const {getByText} = renderWithContext(
                <GroupTeamDisplay
                    item={mockTeam}
                    variant='team'
                />,
            );

            expect(getByText('Engineering Team')).toBeInTheDocument();
        });

        it('should fallback to team name if display_name is empty', () => {
            const teamWithoutDisplayName = {...mockTeam, display_name: ''};
            const {getByText} = renderWithContext(
                <GroupTeamDisplay
                    item={teamWithoutDisplayName}
                    variant='team'
                />,
            );

            expect(getByText('engineering')).toBeInTheDocument();
        });
    });

    describe('group rendering', () => {
        it('should render group badge with icon', () => {
            const {container} = renderWithContext(
                <GroupTeamDisplay
                    item={mockGroup}
                    variant='group'
                />,
            );

            const badge = container.querySelector('.GroupIcon');
            expect(badge).toBeInTheDocument();

            // Check that it contains an SVG icon
            const icon = badge?.querySelector('svg');
            expect(icon).toBeInTheDocument();
        });

        it('should render group display name', () => {
            const {getByText} = renderWithContext(
                <GroupTeamDisplay
                    item={mockGroup}
                    variant='group'
                />,
            );

            expect(getByText('Developers')).toBeInTheDocument();
        });

        it('should fallback to group name if display_name is empty', () => {
            const groupWithoutDisplayName = {...mockGroup, display_name: ''};
            const {getByText} = renderWithContext(
                <GroupTeamDisplay
                    item={groupWithoutDisplayName}
                    variant='group'
                />,
            );

            expect(getByText('developers')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('should render GroupIcon with correct class', () => {
            const {container} = renderWithContext(
                <GroupTeamDisplay
                    item={mockGroup}
                    variant='group'
                />,
            );

            const badge = container.querySelector('.GroupIcon');
            expect(badge).toBeInTheDocument();
        });

        it('should render GroupLabel with correct class', () => {
            const {container} = renderWithContext(
                <GroupTeamDisplay
                    item={mockGroup}
                    variant='group'
                />,
            );

            const label = container.querySelector('.GroupLabel');
            expect(label).toBeInTheDocument();
        });
    });
});
