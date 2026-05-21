// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as modalActions from 'actions/views/modals';

import EditChannelHeaderModal from 'components/edit_channel_header_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import AddChannelHeaderButton from './add_channel_header_button';

describe('AddChannelHeaderButton', () => {
    const defaultTeamId = TestHelper.getTeamMock().id;

    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should show add header button for DM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <AddChannelHeaderButton
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByLabelText('Add a channel header')).toBeInTheDocument();
    });

    test('should show add header button for GM channels without header', () => {
        const channel = TestHelper.getChannelMock({type: 'G', header: ''});

        renderWithContext(
            <AddChannelHeaderButton
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.getByLabelText('Add a channel header')).toBeInTheDocument();
    });

    test('should not show add header button for bot DM channels', () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});
        const botDm = TestHelper.getUserMock({is_bot: true});

        renderWithContext(
            <AddChannelHeaderButton
                teamId={defaultTeamId}
                channel={channel}
                dmUser={botDm}
            />,
        );

        expect(screen.queryByLabelText('Add a channel header')).not.toBeInTheDocument();
    });

    test('should not show add header button when public channel user lacks permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        renderWithContext(
            <AddChannelHeaderButton
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        expect(screen.queryByLabelText('Add a channel header')).not.toBeInTheDocument();
    });

    test('should show add header button when public channel user has permission', () => {
        const channel = TestHelper.getChannelMock({
            type: 'O',
            header: '',
        });

        const state = {
            entities: {
                channels: {
                    myMembers: {
                        [channel.id]: {channel_id: channel.id, roles: 'channel_role'},
                    },
                    roles: {
                        [channel.id]: new Set(['channel_role']),
                    },
                },
                teams: {
                    myMembers: {
                        [defaultTeamId]: {team_id: defaultTeamId, roles: 'team_role'},
                    },
                },
                users: {
                    currentUserId: 'user_id',
                    profiles: {
                        user_id: {
                            id: 'user_id',
                            roles: 'system_role',
                        },
                    },
                },
                roles: {
                    roles: {
                        system_role: {permissions: ['test_system_permission']},
                        team_role: {permissions: ['test_team_permission']},
                        channel_role: {permissions: ['manage_public_channel_properties']},
                    },
                },
            },
        };

        renderWithContext(
            <AddChannelHeaderButton
                teamId={defaultTeamId}
                channel={channel}
            />,
            state,
        );

        expect(screen.getByLabelText('Add a channel header')).toBeInTheDocument();
    });

    test('should open edit channel header modal on click', async () => {
        const channel = TestHelper.getChannelMock({type: 'D', header: ''});

        renderWithContext(
            <AddChannelHeaderButton
                teamId={defaultTeamId}
                channel={channel}
            />,
        );

        await userEvent.click(screen.getByLabelText('Add a channel header'));

        expect(modalActions.openModal).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
            dialogType: EditChannelHeaderModal,
            dialogProps: {channel},
        });
    });
});
