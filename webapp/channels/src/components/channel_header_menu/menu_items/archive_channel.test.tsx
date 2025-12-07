// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LocalStorageStore from 'stores/local_storage_store';

import DeleteChannelModal from 'components/delete_channel_modal';
import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import ArchiveChannel from './archive_channel';

// Mock the modal actions module
const mockOpenModal = jest.fn();
jest.mock('actions/views/modals', () => ({
    openModal: (...args: unknown[]) => {
        mockOpenModal(...args);
        return {type: 'MOCK_OPEN_MODAL'};
    },
}));

describe('components/ChannelHeaderMenu/MenuItems/ArchiveChannel', () => {
    const initialState = {
        entities: {
            channels: {
                currentChannelId: 'current_channel_id',
                channels: {
                    current_channel_id: TestHelper.getChannelMock({
                        id: 'current_channel_id',
                        name: 'default-name',
                        display_name: 'Default',
                        delete_at: 0,
                        type: 'O',
                        team_id: 'team_id',
                    }),
                },
            },
            teams: {
                currentTeamId: 'team-id',
                teams: {
                    'team-id': {
                        id: 'team_id',
                        name: 'team-1',
                        display_name: 'Team 1',
                    },
                },
                myMembers: {
                    'team-id': {roles: 'team_role'},
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {
                        locale: 'en',
                        roles: 'system_role'},
                },
            },
        },
    };

    LocalStorageStore.setPenultimateChannelName('current_user_id', 'team-id', 'current_channel_id');

    const channel = TestHelper.getChannelMock({header: 'Test Header'});

    beforeEach(() => {
        mockOpenModal.mockClear();
    });

    test('renders the component correctly', () => {
        renderWithContext(
            <ArchiveChannel channel={channel}/>, initialState,
        );

        const menuItem = screen.getByText('Archive Channel');
        expect(menuItem).toBeInTheDocument();
    });

    test('dispatches openModal action on click with default channel', () => {
        renderWithContext(
            <WithTestMenuContext>
                <ArchiveChannel channel={channel}/>
            </WithTestMenuContext>, initialState,
        );

        const menuItem = screen.getByText('Archive Channel');
        expect(menuItem).toBeInTheDocument();
        fireEvent.click(menuItem);

        expect(mockOpenModal).toHaveBeenCalledTimes(1);
        expect(mockOpenModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.DELETE_CHANNEL,
            dialogType: DeleteChannelModal,
            dialogProps: {
                channel,
            },
        });
    });
});
