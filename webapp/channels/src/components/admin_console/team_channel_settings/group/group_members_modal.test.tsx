// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GroupMembersModal from './group_members_modal';

describe('admin_console/team_channel_settings/group/GroupList', () => {
    test('should match snapshot while visible', () => {
        const group = TestHelper.getGroupMock({});

        const {baseElement} = renderWithContext(
            <GroupMembersModal
                group={group}
                onExited={jest.fn()}
            />,
        );

        expect(screen.getByRole('heading', {name: group.display_name})).toBeInTheDocument();
        expect(baseElement).toMatchSnapshot();
    });
});
