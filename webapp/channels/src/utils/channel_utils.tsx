// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ArchiveLockOutlineIcon, ArchiveOutlineIcon, GlobeIcon, LockOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';

import {TeamTypes} from 'mattermost-redux/action_types';
import {removeUserFromTeam} from 'mattermost-redux/actions/teams';
import Permissions from 'mattermost-redux/constants/permissions';
import {getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import LocalStorageStore from 'stores/local_storage_store';

import JoinPrivateChannelModal from 'components/join_private_channel_modal';

import Constants, {ModalIdentifiers} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {ActionFuncAsync, GlobalState} from 'types/store';

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

export function isArchivedChannel(channel?: Channel) {
    return Boolean(channel?.delete_at);
}

/**
 * Returns the appropriate archive icon component based on channel type.
 * Private archived channels get a lock icon, public archived channels get a standard archive icon.
 *
 * @param channelType - The type of the channel (e.g., Constants.PRIVATE_CHANNEL, Constants.OPEN_CHANNEL)
 * @returns The appropriate icon component
 */
export function getArchiveIconComponent(channelType?: ChannelType | string) {
    return channelType === Constants.PRIVATE_CHANNEL ? ArchiveLockOutlineIcon : ArchiveOutlineIcon;
}

/**
 * Returns the appropriate archive icon CSS class name based on channel type.
 * Private archived channels get 'icon-archive-lock-outline', public archived channels get 'icon-archive-outline'.
 *
 * @param channelType - The type of the channel (e.g., Constants.PRIVATE_CHANNEL, Constants.OPEN_CHANNEL)
 * @returns The appropriate icon class name
 */
export function getArchiveIconClassName(channelType?: ChannelType | string): string {
    return channelType === Constants.PRIVATE_CHANNEL ? 'icon-archive-lock-outline' : 'icon-archive-outline';
}

/**
 * Returns the appropriate channel icon component based on channel state and type.
 * Handles archived channels (with lock for private), private channels, and public channels.
 *
 * @param channel - The channel object
 * @returns The appropriate icon component (ArchiveLockOutlineIcon, ArchiveOutlineIcon, LockOutlineIcon, or GlobeIcon)
 */
export function getChannelIconComponent(channel?: Channel) {
    if (isArchivedChannel(channel)) {
        return getArchiveIconComponent(channel?.type);
    }

    if (channel?.type === Constants.PRIVATE_CHANNEL) {
        return LockOutlineIcon;
    }

    return GlobeIcon;
}

/**
 * Returns the appropriate channel icon CSS class name based on channel state and type.
 * Handles archived channels (with lock for private), private channels, and public channels.
 * If channel is undefined, returns 'icon-globe' (matching getChannelIconComponent(undefined) behavior).
 *
 * @param channel - The channel object
 * @returns The appropriate icon class name
 */
export function getChannelIconClassName(channel?: Channel): string {
    if (isArchivedChannel(channel)) {
        return getArchiveIconClassName(channel?.type);
    }

    if (channel?.type === Constants.DM_CHANNEL) {
        return 'icon-account-outline';
    }

    if (channel?.type === Constants.GM_CHANNEL) {
        return 'icon-account-multiple-outline';
    }

    if (channel?.type === Constants.PRIVATE_CHANNEL) {
        return 'icon-lock-outline';
    }

    return 'icon-globe';
}

type JoinPrivateChannelPromptResult = {
    data: {
        join: boolean;
    };
};

export function joinPrivateChannelPrompt(team: Team, channelDisplayName: string, handleOnCancel = true): ActionFuncAsync<JoinPrivateChannelPromptResult['data']> {
    return async (dispatch, getState) => {
        const result: JoinPrivateChannelPromptResult = await new Promise((resolve) => {
            const modalData = {
                modalId: ModalIdentifiers.JOIN_CHANNEL_PROMPT,
                dialogType: JoinPrivateChannelModal,
                dialogProps: {
                    channelName: channelDisplayName,
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

export function getChannelRoutePathAndIdentifier(channel: Pick<Channel, 'type' | 'name'>, dmUsername?: string): {path: string; identifier: string} {
    if (channel.type === Constants.DM_CHANNEL) {
        return {
            path: 'messages',
            identifier: dmUsername ? `@${dmUsername}` : channel.name,
        };
    }
    if (channel.type === Constants.GM_CHANNEL) {
        return {path: 'messages', identifier: channel.name};
    }
    return {path: 'channels', identifier: channel.name};
}

/**
 * Reports whether the given channel's membership is gated by an ABAC policy.
 *
 * Prefer this over a bare `channel.policy_enforced` check whenever the caller
 * cares about "is this channel ABAC-controlled for joins/invites?" — that is
 * the meaning the UI historically read into `policy_enforced`, but the flag
 * was widened server-side to mean "any access control policy is attached"
 * (membership policies + permission-only policies like file upload
 * restrictions). Reading `policy_enforced` directly now misfires for
 * permission-only channels (e.g. it empties the invite picker and shows
 * misleading "policy applied" indicators).
 *
 * The membership-specific bit lives at `channel.policy_actions.membership`
 * (hydrated lazily by the server). When `policy_actions` is undefined (older
 * server build, or an unhydrated read path) we fall back to `policy_enforced`
 * so the UI degrades to the legacy behavior — no worse than today, never
 * worse than today.
 *
 * Use {@link isChannelAccessControlled} when you want the inclusive
 * "any AC policy attached" semantic (e.g. admin console toggles).
 */
export function isMembershipPolicyEnforced(channel?: Pick<Channel, 'policy_enforced' | 'policy_actions'> | null): boolean {
    if (!channel) {
        return false;
    }
    if (channel.policy_actions) {
        return Boolean(channel.policy_actions.membership);
    }
    return Boolean(channel.policy_enforced);
}

/**
 * Reports whether the channel has any access control policy attached,
 * regardless of which actions that policy enforces. Use this for admin
 * console toggles and the "fetch the channel's policy" short-circuit in
 * useChannelSystemPolicies — anywhere the caller cares about the existence
 * of a policy rather than its membership semantics.
 */
export function isChannelAccessControlled(channel?: Pick<Channel, 'policy_enforced'> | null): boolean {
    return Boolean(channel?.policy_enforced);
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
