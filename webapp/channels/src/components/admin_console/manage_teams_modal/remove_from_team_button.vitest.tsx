// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RemoveFromTeamButton from 'components/admin_console/manage_teams_modal/remove_from_team_button';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';

describe('RemoveFromTeamButton', () => {
    const baseProps = {
        teamId: '1234',
        handleRemoveUserFromTeam: vi.fn(),
    };

    test('should match snapshot init', () => {
        const {container} = renderWithContext(
            <RemoveFromTeamButton {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should call handleRemoveUserFromTeam on button click', () => {
        const handleRemoveUserFromTeam = vi.fn();
        const {container} = renderWithContext(
            <RemoveFromTeamButton
                {...baseProps}
                handleRemoveUserFromTeam={handleRemoveUserFromTeam}
            />,
        );
        const button = container.querySelector('button');
        fireEvent.click(button!);
        expect(handleRemoveUserFromTeam).toHaveBeenCalledTimes(1);
    });
});
