// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitForElementToBeRemoved} from '@testing-library/react';
import React from 'react';

import TeamGroupsManageModal from 'components/team_groups_manage_modal/team_groups_manage_modal';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/TeamGroupsManageModal', () => {
    const team = TestHelper.getTeamMock({type: 'O', allowed_domains: '', allow_open_invite: false, scheme_id: undefined});
    const group = TestHelper.getGroupMock({id: 'group1', display_name: 'group1'});
    const actions = {
        getGroupsAssociatedToTeam: jest.fn().mockResolvedValue({data: {groups: [group], totalGroupCount: 1}}),
        closeModal: jest.fn(),
        openModal: jest.fn(),
        unlinkGroupSyncable: jest.fn().mockResolvedValue({data: []}),
        patchGroupSyncable: jest.fn().mockResolvedValue({data: []}),
        getMyTeamMembers: jest.fn(),
    };

    const baseProps = {
        intl: {
            formatMessage: jest.fn(),
        },
        team,
        actions,
    };

    test('should show confirm modal when remove-group button is clicked', async () => {
        const wrapper = renderWithContext(<TeamGroupsManageModal {...baseProps}/>);
        expect(await wrapper.findByTestId('group-name')).toBeInTheDocument();
        userEvent.click(wrapper.getByTestId('menu-button'));

        userEvent.click(wrapper.getByTestId('remove-group-button'));

        expect(await wrapper.findByTestId('confirm-modal')).toBeInTheDocument();
    });

    test('should call loadItems on render', async () => {
        renderWithContext(<TeamGroupsManageModal {...baseProps}/>);
        expect(actions.getGroupsAssociatedToTeam).toHaveBeenCalledTimes(1);
    });

    test('should hide confirm modal when cancel button is clicked', async () => {
        const wrapper = renderWithContext(<TeamGroupsManageModal {...baseProps}/>);
        expect(await wrapper.findByTestId('group-name')).toBeInTheDocument();
        userEvent.click(wrapper.getByTestId('menu-button'));

        userEvent.click(wrapper.getByTestId('remove-group-button'));
        expect(await wrapper.findByTestId('confirm-modal')).toBeInTheDocument();

        userEvent.click(wrapper.getByTestId('cancel-button'));
        await waitForElementToBeRemoved(() => wrapper.queryByTestId('confirm-modal'));
        expect(wrapper.queryByTestId('confirm-modal')).toBeNull();
    });
});
