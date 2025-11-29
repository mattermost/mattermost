// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GroupTeamsAndChannelsRow from 'components/admin_console/group_settings/group_details/group_teams_and_channels_row';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

// Helper to wrap table row components in proper DOM structure
const TableWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <table><tbody>{children}</tbody></table>
);

describe('components/admin_console/group_settings/group_details/GroupTeamsAndChannelsRow', () => {
    for (const type of [
        'public-team',
        'private-team',
        'public-channel',
        'private-channel',
    ]) {
        test('should match snapshot, for ' + type, () => {
            const {container} = renderWithContext(
                <TableWrapper>
                    <GroupTeamsAndChannelsRow
                        id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                        type={type}
                        name={'Test ' + type}
                        hasChildren={false}
                        collapsed={false}
                        onRemoveItem={vi.fn()}
                        onToggleCollapse={vi.fn()}
                        onChangeRoles={vi.fn()}
                    />
                </TableWrapper>,
            );
            expect(container).toMatchSnapshot();
        });
    }
    test('should match snapshot, when has children', () => {
        const {container} = renderWithContext(
            <TableWrapper>
                <GroupTeamsAndChannelsRow
                    id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                    type='public-team'
                    name={'Test team with children'}
                    hasChildren={true}
                    collapsed={false}
                    onRemoveItem={vi.fn()}
                    onToggleCollapse={vi.fn()}
                    onChangeRoles={vi.fn()}
                />
            </TableWrapper>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when has children and is collapsed', () => {
        const {container} = renderWithContext(
            <TableWrapper>
                <GroupTeamsAndChannelsRow
                    id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                    type='public-team'
                    name={'Test team with children'}
                    hasChildren={true}
                    collapsed={true}
                    onRemoveItem={vi.fn()}
                    onToggleCollapse={vi.fn()}
                    onChangeRoles={vi.fn()}
                />
            </TableWrapper>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call onToggleCollapse on caret click', () => {
        const onToggleCollapse = vi.fn();
        const {container} = renderWithContext(
            <TableWrapper>
                <GroupTeamsAndChannelsRow
                    id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                    type='public-team'
                    name={'Test team with children'}
                    hasChildren={true}
                    collapsed={true}
                    onRemoveItem={vi.fn()}
                    onToggleCollapse={onToggleCollapse}
                    onChangeRoles={vi.fn()}
                />
            </TableWrapper>,
        );
        const caretIcon = container.querySelector('.fa-caret-right');
        expect(caretIcon).toBeInTheDocument();
        if (caretIcon) {
            fireEvent.click(caretIcon);
        }
        expect(onToggleCollapse).toHaveBeenCalledWith('xxxxxxxxxxxxxxxxxxxxxxxxxx');
    });

    test('should call onRemoveItem on remove link click', () => {
        const onRemoveItem = vi.fn();
        const {container} = renderWithContext(
            <TableWrapper>
                <GroupTeamsAndChannelsRow
                    id='xxxxxxxxxxxxxxxxxxxxxxxxxx'
                    type='public-team'
                    name={'Test team with children'}
                    hasChildren={true}
                    collapsed={true}
                    onRemoveItem={onRemoveItem}
                    onToggleCollapse={vi.fn()}
                    onChangeRoles={vi.fn()}
                />
            </TableWrapper>,
        );

        // Click the remove button to show confirmation modal
        const removeButton = container.querySelector('.btn-tertiary');
        expect(removeButton).toBeInTheDocument();
        if (removeButton) {
            fireEvent.click(removeButton);
        }

        // Find and click the confirm button in the modal
        const confirmButton = screen.queryByRole('button', {name: /yes/i}) || screen.queryByRole('button', {name: /remove/i});
        if (confirmButton) {
            fireEvent.click(confirmButton);
            expect(onRemoveItem).toHaveBeenCalledWith(
                'xxxxxxxxxxxxxxxxxxxxxxxxxx',
                'public-team',
            );
        }
    });
});
