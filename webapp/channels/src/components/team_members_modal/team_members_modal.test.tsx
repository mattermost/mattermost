// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamMembersModal from './team_members_modal';

jest.mock('components/common/hooks/useAccessControlAttributes', () => ({
    __esModule: true,
    EntityType: {Channel: 'channel', Team: 'team'},
    default: jest.fn(() => ({
        attributeTags: ['Engineering'],
        structuredAttributes: [{name: 'Department', values: ['Engineering']}],
        loading: false,
        error: null,
        fetchAttributes: jest.fn(),
    })),
}));

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

    test('shows the membership requirements notice and attribute tags on a policy-governed team', () => {
        const props = {
            ...baseProps,
            currentTeam: TestHelper.getTeamMock({id: 'id', display_name: 'display name', policy_enforced: true}),
        };

        renderWithContext(<TeamMembersModal {...props}/>);

        expect(screen.getByText('Only people who meet the membership requirements can be members of this team.')).toBeInTheDocument();
        expect(screen.getByText('Department: Engineering')).toBeInTheDocument();
        expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1);
    });

    test('does not show the membership requirements notice on a non-governed team', () => {
        renderWithContext(<TeamMembersModal {...baseProps}/>);

        expect(screen.queryByText('Only people who meet the membership requirements can be members of this team.')).not.toBeInTheDocument();
    });
});
