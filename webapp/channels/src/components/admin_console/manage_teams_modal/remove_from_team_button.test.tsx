// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import RemoveFromTeamButton from 'components/admin_console/manage_teams_modal/remove_from_team_button';

describe('RemoveFromTeamButton', () => {
    const baseProps = {
        teamId: '1234',
        handleRemoveUserFromTeam: jest.fn(),
    };

    test('should match snapshot init', () => {
        const wrapper = shallow(
            <RemoveFromTeamButton {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should call handleRemoveUserFromTeam on button click', () => {
        const wrapper = shallow(
            <RemoveFromTeamButton {...baseProps}/>,
        );
        wrapper.find('button').prop('onClick')!({preventDefault: jest.fn()} as unknown as React.MouseEvent);
        expect(baseProps.handleRemoveUserFromTeam).toHaveBeenCalledTimes(1);
    });
});
