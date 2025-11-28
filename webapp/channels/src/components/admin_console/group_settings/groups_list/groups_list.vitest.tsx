// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupsList from 'components/admin_console/group_settings/groups_list/groups_list';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/GroupsList.tsx', () => {
    const defaultProps = {
        groups: [],
        total: 0,
        actions: {
            getLdapGroups: vi.fn().mockReturnValue(Promise.resolve()),
            link: vi.fn().mockReturnValue(Promise.resolve()),
            unlink: vi.fn().mockReturnValue(Promise.resolve()),
        },
    };

    test('should match snapshot, with empty groups', () => {
        const {container} = renderWithContext(
            <GroupsList {...defaultProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with groups', () => {
        const {container} = renderWithContext(
            <GroupsList
                {...defaultProps}
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                ]}
                total={2}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with results including configured', () => {
        const {container} = renderWithContext(
            <GroupsList
                {...defaultProps}
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                ]}
                total={3}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with many results', () => {
        const {container} = renderWithContext(
            <GroupsList
                {...defaultProps}
                groups={[
                    {primary_key: 'test1', name: 'test1'},
                    {primary_key: 'test2', name: 'test2', mattermost_group_id: 'group-id-1', has_syncables: false},
                    {primary_key: 'test3', name: 'test3', mattermost_group_id: 'group-id-2', has_syncables: true},
                    {primary_key: 'test4', name: 'test4'},
                    {primary_key: 'test5', name: 'test5'},
                    {primary_key: 'test6', name: 'test6'},
                    {primary_key: 'test7', name: 'test7'},
                    {primary_key: 'test8', name: 'test8'},
                    {primary_key: 'test9', name: 'test9'},
                    {primary_key: 'test10', name: 'test10'},
                ]}
                total={33}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call getLdapGroups on mount', () => {
        const getLdapGroups = vi.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupsList
                {...defaultProps}
                actions={{
                    ...defaultProps.actions,
                    getLdapGroups,
                }}
            />,
        );
        expect(getLdapGroups).toHaveBeenCalled();
    });
});
