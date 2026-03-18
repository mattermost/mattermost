// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamMembersModal from './team_members_modal';

describe('components/TeamMembersModal', () => {
    const baseProps = {
        currentTeam: TestHelper.getTeamMock({
            id: 'id',
            display_name: 'display name',
        }),
        onExited: jest.fn(),
        onLoad: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <TeamMembersModal
                {...baseProps}
            />,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should call onHide on Modal\'s onExited', async () => {
        renderWithContext(
            <TeamMembersModal
                {...baseProps}
            />,
        );

        await userEvent.click(screen.getByLabelText('Close'));

        await waitFor(() => {
            expect(baseProps.onExited).toHaveBeenCalledTimes(1);
        });
    });
});
