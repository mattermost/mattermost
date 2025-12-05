// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
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
        onExited: vi.fn(),
        actions: {
            leaveTeam: vi.fn(),
            toggleSideBarRightMenu: vi.fn(),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render the leave team model', () => {
        const {container} = renderWithContext(<LeaveTeamModal {...requiredProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('should hide when cancel is clicked', async () => {
        renderWithContext(<LeaveTeamModal {...requiredProps}/>);

        // Initially the modal should be visible
        expect(screen.getByText('Leave the team?')).toBeInTheDocument();

        // Click cancel button
        const cancelButton = screen.getByRole('button', {name: /no/i});
        fireEvent.click(cancelButton);

        // Modal should be hidden - check that the modal no longer has 'in' class (Bootstrap modal behavior)
        await waitFor(() => {
            const modal = document.querySelector('#leaveTeamModal');
            expect(modal).not.toHaveClass('in');
        });
    });

    it('should call leaveTeam and toggleSideBarRightMenu when ok is clicked', () => {
        renderWithContext(<LeaveTeamModal {...requiredProps}/>);

        // Click the Yes button
        const okButton = screen.getByRole('button', {name: /yes/i});
        fireEvent.click(okButton);

        expect(requiredProps.actions.leaveTeam).toHaveBeenCalledTimes(1);
        expect(requiredProps.actions.toggleSideBarRightMenu).toHaveBeenCalledTimes(1);
        expect(requiredProps.actions.leaveTeam).toHaveBeenCalledWith(
            requiredProps.currentTeamId,
            requiredProps.currentUserId,
        );
    });

    it('should call attach and remove event listeners', () => {
        const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        const {unmount} = renderWithContext(<LeaveTeamModal {...requiredProps}/>);

        // Component attaches keydown event listener (may be called with optional third argument)
        expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), expect.anything());

        unmount();

        // Component removes keydown event listener on unmount
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), expect.anything());

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });
});
