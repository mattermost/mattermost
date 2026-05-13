// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupRow from 'components/admin_console/group_settings/group_row';

import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';

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
                onCheckToggle={jest.fn()}
                actions={{
                    link: jest.fn(),
                    unlink: jest.fn(),
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
                onCheckToggle={jest.fn()}
                actions={{
                    link: jest.fn(),
                    unlink: jest.fn(),
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
                onCheckToggle={jest.fn()}
                actions={{
                    link: jest.fn(),
                    unlink: jest.fn(),
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
                onCheckToggle={jest.fn()}
                actions={{
                    link: jest.fn(),
                    unlink: jest.fn(),
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
                onCheckToggle={jest.fn()}
                actions={{
                    link: jest.fn(),
                    unlink: jest.fn(),
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
                onCheckToggle={jest.fn()}
                actions={{
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('onRowClick call to onCheckToggle', async () => {
        const onCheckToggle = jest.fn();
        renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id={undefined}
                has_syncables={undefined}
                checked={false}
                failed={false}
                onCheckToggle={onCheckToggle}
                actions={{
                    link: jest.fn(),
                    unlink: jest.fn(),
                }}
            />,
        );

        await userEvent.click(document.getElementById('name_group')!);
        expect(onCheckToggle).toHaveBeenCalledWith('primary_key');
    });

    test('linkHandler must run the link action', async () => {
        const link = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id={undefined}
                has_syncables={undefined}
                checked={false}
                failed={false}
                onCheckToggle={jest.fn()}
                actions={{
                    link,
                    unlink: jest.fn(),
                }}
            />,
        );

        await userEvent.click(screen.getByText('Not Linked'));
        await waitFor(() => {
            expect(link).toHaveBeenCalledWith('primary_key');
        });
        expect(screen.queryByText('Linking')).not.toBeInTheDocument();
    });

    test('unlinkHandler must run the unlink action', async () => {
        const unlink = jest.fn().mockReturnValue(Promise.resolve());
        renderWithContext(
            <GroupRow
                primary_key='primary_key'
                name='name'
                mattermost_group_id='group-id'
                has_syncables={undefined}
                checked={false}
                failed={false}
                onCheckToggle={jest.fn()}
                actions={{
                    link: jest.fn(),
                    unlink,
                }}
            />,
        );

        await userEvent.click(screen.getByText('Linked'));
        await waitFor(() => {
            expect(unlink).toHaveBeenCalledWith('primary_key');
        });
        expect(screen.queryByText('Unlinking')).not.toBeInTheDocument();
    });
});
