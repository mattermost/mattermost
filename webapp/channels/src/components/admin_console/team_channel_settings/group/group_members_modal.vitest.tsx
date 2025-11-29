// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GroupMembersModal from './group_members_modal';

describe('admin_console/team_channel_settings/group/GroupList', () => {
    test('should match snapshot while visible', async () => {
        const group = TestHelper.getGroupMock({});

        const {container} = renderWithContext(
            <GroupMembersModal
                group={group}
                onExited={vi.fn()}
            />,
        );

        // Modal should be rendered
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
