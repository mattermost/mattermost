// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import Permissions from 'mattermost-redux/constants/permissions';

import {Channel, ChannelType} from '@mattermost/types/channels';
import {Team} from '@mattermost/types/teams';
import {GetStateFunc, DispatchFunc, ActionFunc} from 'mattermost-redux/types/actions';
import {removeUserFromTeam} from 'mattermost-redux/actions/teams';
import {TeamTypes} from 'mattermost-redux/action_types';
import {getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import JoinPrivateChannelModal from 'components/join_private_channel_modal';
import LocalStorageStore from 'stores/local_storage_store';

import {GlobalState} from 'types/store';

import Constants, {ModalIdentifiers} from 'utils/constants';
import * as Utils from 'utils/utils';

import {getHistory} from './browser_history';

import {cleanUpUrlable} from './url';

export function canManageMembers(state: GlobalState, channel: Channel) {
    if (channel.type === Constants.PRIVATE_CHANNEL) {
        return haveIChannelPermission(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
        );
    }

    if (channel.type === Constants.OPEN_CHANNEL) {
        return haveIChannelPermission(
            state,
            channel.team_id,
            channel.id,
            Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
        );
    }

    return true;
}

export function findNextUnreadChannelId(curChannelId: string, allChannelIds: string[], unreadChannelIds: string[], direction: number) {
    const curIndex = allChannelIds.indexOf(curChannelId);

    for (let i = 1; i < allChannelIds.length; i++) {
        const index = Utils.mod(curIndex + (i * direction), allChannelIds.length);

        if (unreadChannelIds.includes(allChannelIds[index])) {
            return index;
        }
    }

    return -1;
}

export function isArchivedChannel(channel: Channel) {
    return Boolean(channel && channel.delete_at !== 0);
}

type JoinPrivateChannelPromptResult = {
    data: {
        join: boolean;
    };
};

export function joinPrivateChannelPrompt(team: Team, channel: Channel, handleOnCancel = true): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const result: JoinPrivateChannelPromptResult = await new Promise((resolve) => {
            const modalData = {
                modalId: ModalIdentifiers.JOIN_CHANNEL_PROMPT,
                dialogType: JoinPrivateChannelModal,
                dialogProps: {
                    channelName: channel.display_name,
                    onJoin: () => {
                        LocalStorageStore.setTeamIdJoinedOnLoad(null);
                        resolve({
                            data: {join: true},
                        });
                    },
                    onCancel: async () => {
                        if (handleOnCancel) {
                            const state = getState();

                            // If auto joined the team on load, leave the team as well
                            if (LocalStorageStore.getTeamIdJoinedOnLoad() === team.id) {
                                await dispatch(removeUserFromTeam(team.id, getCurrentUserId(state)));
                                dispatch({type: TeamTypes.LEAVE_TEAM, data: team});
                                getHistory().replace('/');
                            } else {
                                const redirectChannelName = getRedirectChannelNameForTeam(state, team.id);
                                getHistory().replace(`/${team.name}/channels/${redirectChannelName}`);
                            }
                        }
                        LocalStorageStore.setTeamIdJoinedOnLoad(null);
                        resolve({
                            data: {join: false},
                        });
                    },
                },
            };
            dispatch(openModal(modalData));
        });
        return result;
    };
}

export function makeNewEmptyChannel(displayName: string, teamId: string): Channel {
    return {
        team_id: teamId,
        name: cleanUpUrlable(displayName),
        display_name: displayName,
        purpose: '',
        header: '',
        type: Constants.OPEN_CHANNEL as ChannelType,
        create_at: 0,
        creator_id: '',
        delete_at: 0,
        group_constrained: false,
        id: '',
        last_post_at: 0,
        last_root_post_at: 0,
        scheme_id: '',
        update_at: 0,
    };
}
