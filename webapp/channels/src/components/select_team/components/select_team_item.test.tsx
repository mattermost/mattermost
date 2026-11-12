// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import SelectTeamItem from './select_team_item';

describe('components/select_team/components/SelectTeamItem', () => {
    const baseProps = {
        team: {display_name: 'team_display_name', allow_open_invite: true} as Team,
        onTeamClick: jest.fn(),
        loading: false,
        canJoinPublicTeams: true,
        canJoinPrivateTeams: false,
    };

    test('should call onTeamClick on click when joinable', async () => {
        const onTeamClick = jest.fn();
        const props = {...baseProps, onTeamClick};
        renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        await userEvent.click(screen.getByRole('link'));
        expect(onTeamClick).toHaveBeenCalledTimes(1);
        expect(onTeamClick).toHaveBeenCalledWith(props.team);
    });

    test('should not call onTeamClick on click when you cant join the team', async () => {
        const onTeamClick = jest.fn();
        const props = {...baseProps, canJoinPublicTeams: false, onTeamClick};
        renderWithContext(
            <SelectTeamItem {...props}/>,
        );
        await userEvent.click(screen.getByRole('link'));
        expect(onTeamClick).not.toHaveBeenCalled();
    });

    test('shows the Recommended chip with an accessible label when the team is recommended', () => {
        const props = {...baseProps, team: {...baseProps.team, recommended: true} as Team};
        renderWithContext(<SelectTeamItem {...props}/>);

        expect(screen.getByText('Recommended')).toBeInTheDocument();
        expect(screen.getByLabelText('Recommended based on your attributes')).toBeInTheDocument();
    });

    test('does not show the Recommended chip when the team is not recommended', () => {
        renderWithContext(<SelectTeamItem {...baseProps}/>);

        expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
    });
});
