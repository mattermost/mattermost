// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import LeaveTeamModal from './leave_team_modal';

describe('components/LeaveTeamModal', () => {
    const requiredProps = {
        currentUser: TestHelper.getUserMock({
            id: 'test',
        }),
        currentUserId: 'user_id',
        currentTeamId: 'team_id',
        numOfPrivateChannels: 0,
        numOfPublicChannels: 0,
        onExited: jest.fn(),
        actions: {
            leaveTeam: jest.fn(),
            toggleSideBarRightMenu: jest.fn(),
        },
    };

    it('should render the leave team model', () => {
        const {baseElement} = renderWithContext(<LeaveTeamModal {...requiredProps}/>);
        expect(baseElement).toMatchSnapshot();
    });

    it('should hide when No is clicked', async () => {
        renderWithContext(<LeaveTeamModal {...requiredProps}/>);

        // Modal should be visible initially
        expect(screen.getByRole('dialog')).toBeInTheDocument();

        // Click No button
        await userEvent.click(screen.getByRole('button', {name: 'No'}));

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('should call leaveTeam and toggleSideBarRightMenu when Yes is clicked', async () => {
        const leaveTeam = jest.fn();
        const toggleSideBarRightMenu = jest.fn();
        const props = {
            ...requiredProps,
            actions: {
                leaveTeam,
                toggleSideBarRightMenu,
            },
        };
        renderWithContext(<LeaveTeamModal {...props}/>);

        // Click Yes button
        await userEvent.click(screen.getByRole('button', {name: 'Yes'}));

        expect(leaveTeam).toHaveBeenCalledTimes(1);
        expect(toggleSideBarRightMenu).toHaveBeenCalledTimes(1);
        expect(leaveTeam).toHaveBeenCalledWith(props.currentTeamId, props.currentUserId);

        // Modal should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('should call attach and remove event listeners', () => {
        const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

        const {unmount} = renderWithContext(<LeaveTeamModal {...requiredProps}/>);

        expect(addEventListenerSpy).toHaveBeenCalledWith('keypress', expect.any(Function));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('keypress', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });
});
