// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Group} from '@mattermost/types/groups';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import GroupList from './group_list';

describe('admin_console/team_channel_settings/group/GroupList', () => {
    test('should match snapshot', async () => {
        const testGroups: Group[] = [TestHelper.getGroupMock({
            id: '123',
            display_name: 'DN',
            member_count: 3,
        })];

        const actions = {
            getData: vi.fn().mockResolvedValue(testGroups),
        };

        const {container} = renderWithContext(
            <GroupList
                data={testGroups}
                groups={[]}
                onGroupRemoved={vi.fn()}
                isModeSync={false}
                totalGroups={0}
                onPageChangedCallback={vi.fn()}
                total={testGroups.length}
                actions={actions}
                removeGroup={vi.fn()}
                type='team'
                setNewGroupRole={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('DN')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with paging', async () => {
        const testGroups: Group[] = [];
        for (let i = 0; i < 30; i++) {
            testGroups.push(TestHelper.getGroupMock({
                id: 'id' + i,
                display_name: 'DN' + i,
                member_count: 3,
            }));
        }
        const actions = {
            getData: vi.fn().mockResolvedValue(Promise.resolve(testGroups)),
        };

        const {container} = renderWithContext(
            <GroupList
                data={testGroups}
                groups={[]}
                onGroupRemoved={vi.fn()}
                isModeSync={false}
                totalGroups={0}
                onPageChangedCallback={vi.fn()}
                total={30}
                actions={actions}
                type='team'
                removeGroup={vi.fn()}
                setNewGroupRole={vi.fn()}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('DN0')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
