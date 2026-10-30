// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {Permissions} from 'mattermost-redux/constants';
import * as teams from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import AddMembersButton from './add_members_button';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn((modalData) => ({type: 'MOCK_OPEN_MODAL', modalData})),
}));

describe('components/post_view/AddMembersButton', () => {
    const channel = {
        create_at: 1508265709607,
        creator_id: 'creator_id',
        delete_at: 0,
        display_name: 'test channel',
        header: 'test',
        id: 'channel_id',
        last_post_at: 1508265709635,
        name: 'testing',
        purpose: 'test',
        team_id: 'team-id',
        type: 'O',
        update_at: 1508265709607,
    } as Channel;

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team-id',
            },
            users: {
                currentUserId: 'test-user-id',
                profiles: {
                    'test-user-id': {
                        id: 'test-user-id',
                        roles: 'system_role',
                    },
                },
            },
            roles: {
                roles: {
                    system_role: {permissions: [
                        Permissions.ADD_USER_TO_TEAM,
                        Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
                    ]},
                },
            },
        },
    };

    jest.spyOn(teams, 'getCurrentTeamId').mockReturnValue('team-id');

    test('should match snapshot, less than limit', () => {
        const props = {
            totalUsers: 10,
            usersLimit: 100,
            channel,
        };
        renderWithContext(
            <AddMembersButton {...props}/>,
            initialState,
        );

        expect(screen.queryByText('Invite others to the workspace')).toBeInTheDocument();
    });

    test('should match snapshot, more than limit', () => {
        const props = {
            totalUsers: 100,
            usersLimit: 10,
            channel,
        };
        renderWithContext(
            <AddMembersButton {...props}/>,
            initialState,
        );

        expect(screen.queryByText('Add people')).toBeInTheDocument();
    });

    test('should match snapshot, setHeader and pluginButtons', () => {
        const PLUGIN_TEXT = 'Create a board plugin';
        const pluginButtons = (
            <button>
                {PLUGIN_TEXT}
            </button>
        );

        const props = {
            totalUsers: 100,
            usersLimit: 10,
            channel,
            pluginButtons,
        };
        renderWithContext(
            <AddMembersButton {...props}/>,
            initialState,
        );

        expect(screen.queryByText(PLUGIN_TEXT)).toBeInTheDocument();
    });

    describe('Add people button (more than limit)', () => {
        const moreThanLimitProps = {
            totalUsers: 100,
            usersLimit: 10,
        };

        beforeEach(() => {
            jest.mocked(openModal).mockClear();
        });

        test('should be a dialog trigger, not a toggle', () => {
            renderWithContext(
                <AddMembersButton
                    {...moreThanLimitProps}
                    channel={channel}
                />,
                initialState,
            );

            const button = screen.getByRole('button', {name: 'Add people'});
            expect(button).toHaveAttribute('aria-haspopup', 'dialog');
            expect(button).not.toHaveAttribute('aria-pressed');
        });

        test('should open the channel invite modal for a regular channel', async () => {
            renderWithContext(
                <AddMembersButton
                    {...moreThanLimitProps}
                    channel={channel}
                />,
                initialState,
            );

            await userEvent.click(screen.getByRole('button', {name: 'Add people'}));

            expect(openModal).toHaveBeenCalledTimes(1);
            expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
                modalId: ModalIdentifiers.CHANNEL_INVITE,
                dialogProps: {channel},
            }));
        });

        test('should open the add groups modal for a group constrained channel', async () => {
            const groupConstrainedChannel = {...channel, group_constrained: true} as Channel;

            renderWithContext(
                <AddMembersButton
                    {...moreThanLimitProps}
                    channel={groupConstrainedChannel}
                />,
                initialState,
            );

            expect(screen.queryByRole('button', {name: 'Add people'})).not.toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', {name: 'Add groups'}));

            expect(openModal).toHaveBeenCalledTimes(1);
            expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
                modalId: ModalIdentifiers.ADD_GROUPS_TO_CHANNEL,
                dialogProps: {channel: groupConstrainedChannel},
            }));
        });
    });
});
