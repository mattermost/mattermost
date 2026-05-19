// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupTeamsAndChannelsRow from 'components/admin_console/group_settings/group_details/group_teams_and_channels_row';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/admin_console/group_settings/group_details/GroupTeamsAndChannelsRow', () => {
    const renderInTable = (ui: React.ReactElement) => {
        return renderWithContext(
            <table>
                <tbody>
                    {ui}
                </tbody>
            </table>,
        );
    };

    for (const type of [
        'public-team',
        'private-team',
        'public-channel',
        'private-channel',
    ]) {
        test('should match snapshot, for ' + type, () => {
            const {container} = renderInTable(
                <GroupTeamsAndChannelsRow
                    id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                    type={type}
                    name={'Test ' + type}
                    hasChildren={false}
                    collapsed={false}
                    onRemoveItem={jest.fn()}
                    onToggleCollapse={jest.fn()}
                    onChangeRoles={jest.fn()}
                />,
            );
            expect(container).toMatchSnapshot();
        });
    }
    test('should match snapshot, when has children', () => {
        const {container} = renderInTable(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={false}
                onRemoveItem={jest.fn()}
                onToggleCollapse={jest.fn()}
                onChangeRoles={jest.fn()}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when has children and is collapsed', () => {
        const {container} = renderInTable(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={true}
                onRemoveItem={jest.fn()}
                onToggleCollapse={jest.fn()}
                onChangeRoles={jest.fn()}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call onToggleCollapse on caret click', async () => {
        const onToggleCollapse = jest.fn();
        renderInTable(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={true}
                onRemoveItem={jest.fn()}
                onToggleCollapse={onToggleCollapse}
                onChangeRoles={jest.fn()}
            />,
        );
        const caret = document.querySelector('.fa-caret-right');
        expect(caret).toBeInTheDocument();
        await userEvent.click(caret!);
        expect(onToggleCollapse).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    test('should call onRemoveItem on remove link click', async () => {
        const onRemoveItem = jest.fn();
        renderInTable(
            <GroupTeamsAndChannelsRow
                id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                type='public-team'
                name={'Test team with children'}
                hasChildren={true}
                collapsed={true}
                onRemoveItem={onRemoveItem}
                onToggleCollapse={jest.fn()}
                onChangeRoles={jest.fn()}
            />,
        );

        // Click the Remove button to show confirmation modal
        const removeButton = screen.getByTestId('Test team with children_groupsyncable_remove');
        await userEvent.click(removeButton);

        // Confirmation modal should be shown - click confirm
        const confirmButton = screen.getByText('Yes, Remove');
        await userEvent.click(confirmButton);

        expect(onRemoveItem).toHaveBeenCalledWith(
            'xxxxxxxxxxxxxxxxxxxxxxxxxx',
            'public-team',
        );
    });
});
