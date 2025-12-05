// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupRow from 'components/admin_console/group_settings/group_row';

import {renderWithContext, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/group_settings/GroupRow', () => {
    test('should match snapshot, on linked and configured row', () => {
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id='group-id'
                has_syncables={true}
                checked={false}
                failed={false}
                onCheckToggle={vi.fn()}
                actions={{
                    link: vi.fn(),
                    unlink: vi.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on linked but not configured row', () => {
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id='group-id'
                has_syncables={false}
                checked={false}
                failed={false}
                onCheckToggle={vi.fn()}
                actions={{
                    link: vi.fn(),
                    unlink: vi.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on not linked row', () => {
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id={undefined}
                has_syncables={undefined}
                checked={false}
                failed={false}
                onCheckToggle={vi.fn()}
                actions={{
                    link: vi.fn(),
                    unlink: vi.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on checked row', () => {
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id={undefined}
                has_syncables={undefined}
                checked={true}
                failed={false}
                onCheckToggle={vi.fn()}
                actions={{
                    link: vi.fn(),
                    unlink: vi.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on failed linked row', () => {
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id='group-id'
                has_syncables={undefined}
                checked={false}
                failed={true}
                onCheckToggle={vi.fn()}
                actions={{
                    link: vi.fn(),
                    unlink: vi.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on failed not linked row', () => {
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id={undefined}
                has_syncables={undefined}
                checked={false}
                failed={true}
                onCheckToggle={vi.fn()}
                actions={{
                    link: vi.fn(),
                    unlink: vi.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('onRowClick call to onCheckToggle', () => {
        const onCheckToggle = vi.fn();
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id={undefined}
                has_syncables={undefined}
                checked={false}
                failed={false}
                onCheckToggle={onCheckToggle}
                actions={{
                    link: vi.fn(),
                    unlink: vi.fn(),
                }}
            />,
        );

        const groupElement = container.querySelector('.group');
        fireEvent.click(groupElement!);
        expect(onCheckToggle).toHaveBeenCalledWith('primary_key');
    });

    test('linkHandler must run the link action', async () => {
        const link = vi.fn().mockReturnValue(Promise.resolve());
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id={undefined}
                has_syncables={undefined}
                checked={false}
                failed={false}
                onCheckToggle={vi.fn()}
                actions={{
                    link,
                    unlink: vi.fn(),
                }}
            />,
        );

        const linkElement = container.querySelector('a');
        fireEvent.click(linkElement!);

        await waitFor(() => {
            expect(link).toHaveBeenCalledWith('primary_key');
        });
    });

    test('unlinkHandler must run the unlink action', async () => {
        const unlink = vi.fn().mockReturnValue(Promise.resolve());
        const {container} = renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id='group-id'
                has_syncables={undefined}
                checked={false}
                failed={false}
                onCheckToggle={vi.fn()}
                actions={{
                    link: vi.fn(),
                    unlink,
                }}
            />,
        );

        const linkElement = container.querySelector('a');
        fireEvent.click(linkElement!);

        await waitFor(() => {
            expect(unlink).toHaveBeenCalledWith('primary_key');
        });
    });
});
