// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RemoveFromTeamButton from 'components/admin_console/manage_teams_modal/remove_from_team_button';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('RemoveFromTeamButton', () => {
    const baseProps = {
        teamId: '1234',
        handleRemoveUserFromTeam: jest.fn(),
    };

    test('should match snapshot init', () => {
        const {container} = renderWithContext(
            <RemoveFromTeamButton {...baseProps}/>,
        );

        expect(screen.getByRole('button', {name: 'Remove from Team'})).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should call handleRemoveUserFromTeam on button click', async () => {
        renderWithContext(
            <RemoveFromTeamButton {...baseProps}/>,
        );
        await userEvent.click(screen.getByRole('button', {name: 'Remove from Team'}));
        expect(baseProps.handleRemoveUserFromTeam).toHaveBeenCalledTimes(1);
    });
});
