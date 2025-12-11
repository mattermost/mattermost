// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import GroupRow from './group_row';

describe('admin_console/team_channel_settings/group/GroupRow', () => {
    const testGroup = {
        id: '123',
        display_name: 'DN',
        member_count: 3,
    };
    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <GroupRow
                group={testGroup}
                removeGroup={vi.fn()}
                setNewGroupRole={vi.fn()}
                type='channel'
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
