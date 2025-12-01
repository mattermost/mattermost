// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import SelectTeamItem from './select_team_item';

describe('components/select_team/components/SelectTeamItem', () => {
    const baseProps = {
        team: {display_name: 'team_display_name', allow_open_invite: true} as Team,
        onTeamClick: vi.fn(),
        loading: false,
        canJoinPublicTeams: true,
        canJoinPrivateTeams: false,
        intl: {
            formatMessage: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot, on public joinable', () => {
        const {container} = renderWithContext(<SelectTeamItem {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on public not joinable', () => {
        const props = {...baseProps, canJoinPublicTeams: false};
        const {container} = renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on private joinable', () => {
        const props = {...baseProps, team: {...baseProps.team, allow_open_invite: false}, canJoinPrivateTeams: true};
        const {container} = renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on private not joinable', () => {
        const props = {...baseProps, team: {...baseProps.team, allow_open_invite: false}};
        const {container} = renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on loading', () => {
        const props = {...baseProps, loading: true};
        const {container} = renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with description', () => {
        const props = {...baseProps, team: {...baseProps.team, description: 'description'}};
        const {container} = renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call onTeamClick on click when joinable', () => {
        renderWithContext(
            <SelectTeamItem {...baseProps}/>,
        );
        const link = screen.getByText('team_display_name');
        fireEvent.click(link);
        expect(baseProps.onTeamClick).toHaveBeenCalledTimes(1);
        expect(baseProps.onTeamClick).toHaveBeenCalledWith(baseProps.team);
    });

    test('should not call onTeamClick on click when you cant join the team', () => {
        const props = {...baseProps, canJoinPublicTeams: false};
        renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        const link = screen.getByText('team_display_name');
        fireEvent.click(link);
        expect(baseProps.onTeamClick).not.toHaveBeenCalled();
    });
});
