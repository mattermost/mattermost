// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import TeamGroupsManageModal from 'components/team_groups_manage_modal/team_groups_manage_modal';

import {renderWithContext, userEvent, waitFor, waitForElementToBeRemoved} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/TeamGroupsManageModal', () => {
    const team = TestHelper.getTeamMock({type: 'O', allowed_domains: '', allow_open_invite: false, scheme_id: undefined});
    const group = TestHelper.getGroupMock({id: 'group1', display_name: 'group1'});
    const actions = {
        getGroupsAssociatedToTeam: vi.fn().mockResolvedValue({data: {groups: [group], totalGroupCount: 1}}),
        closeModal: vi.fn(),
        openModal: vi.fn(),
        unlinkGroupSyncable: vi.fn().mockResolvedValue({data: []}),
        patchGroupSyncable: vi.fn().mockResolvedValue({data: []}),
        getMyTeamMembers: vi.fn(),
    };

    const baseProps = {
        intl: {
            formatMessage: vi.fn(),
        },
        team,
        actions,
    };

    test('should show confirm modal when remove-group button is clicked', async () => {
        const wrapper = renderWithContext(<TeamGroupsManageModal {...baseProps}/>);
        expect(await wrapper.findByTestId('group-name')).toBeInTheDocument();
        await userEvent.click(wrapper.getByTestId('menu-button'));

        await userEvent.click(wrapper.getByTestId('remove-group-button'));

        expect(await wrapper.findByTestId('confirm-modal')).toBeInTheDocument();
    });

    test('should call loadItems on render', async () => {
        renderWithContext(<TeamGroupsManageModal {...baseProps}/>);

        // Wait for the groups to be fetched - they are called on mount
        await waitFor(() => {
            expect(actions.getGroupsAssociatedToTeam).toHaveBeenCalled();
        }, {timeout: 5000});
    });

    test('should hide confirm modal when cancel button is clicked', async () => {
        const wrapper = renderWithContext(<TeamGroupsManageModal {...baseProps}/>);
        expect(await wrapper.findByTestId('group-name')).toBeInTheDocument();
        await userEvent.click(wrapper.getByTestId('menu-button'));

        await userEvent.click(wrapper.getByTestId('remove-group-button'));
        expect(await wrapper.findByTestId('confirm-modal')).toBeInTheDocument();

        await userEvent.click(wrapper.getByTestId('cancel-button'));
        await waitForElementToBeRemoved(() => wrapper.queryByTestId('confirm-modal'));
        expect(wrapper.queryByTestId('confirm-modal')).toBeNull();
    });
});
