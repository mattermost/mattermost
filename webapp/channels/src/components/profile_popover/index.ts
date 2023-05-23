// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {displayLastActiveLabel, getCurrentUserId, getLastActiveTimestampUnits, getLastActivityForUserId, getStatusForUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {
    getCurrentTeam,
    getCurrentRelativeTeamUrl,
    getTeamMember,
} from 'mattermost-redux/selectors/entities/teams';
import {
    getChannelMembersInChannels,
    canManageAnyChannelMembersInCurrentTeam,
    getCurrentChannelId,
    getChannelByName,
} from 'mattermost-redux/selectors/entities/channels';
import {getCallsConfig, getCalls} from 'mattermost-redux/selectors/entities/common';
import {Action} from 'mattermost-redux/types/actions';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezone, isTimezoneEnabled} from 'mattermost-redux/selectors/entities/timezone';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {getMembershipForEntities} from 'actions/views/profile_popover';
import {closeModal, openModal} from 'actions/views/modals';

import {getRhsState, getSelectedPost} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';
import {isAnyModalOpen} from 'selectors/views/modals';
import {makeGetCustomStatus, isCustomStatusEnabled, isCustomStatusExpired} from 'selectors/views/custom_status';

import {ModalData} from 'types/actions';
import {GlobalState} from 'types/store';

import {ServerError} from '@mattermost/types/errors';

import {getDirectChannelName} from 'utils/utils';

import ProfilePopover from './profile_popover';
import {isCallsEnabled} from 'selectors/calls';

type OwnProps = {
    userId: string;
    channelId?: string;
}

function getDefaultChannelId(state: GlobalState) {
    const selectedPost = getSelectedPost(state);
    return selectedPost.exists ? selectedPost.channel_id : getCurrentChannelId(state);
}

export function checkUserInCall(state: GlobalState, userId: string) {
    let isUserInCall = false;

    const calls = getCalls(state);
    Object.keys(calls).forEach((channelId) => {
        const usersInCall = calls[channelId] || [];

        for (const user of usersInCall) {
            if (user.id === userId) {
                isUserInCall = true;
                break;
            }
        }
    });
    return isUserInCall;
}

function makeMapStateToProps() {
    const getCustomStatus = makeGetCustomStatus();

    return (state: GlobalState, {userId, channelId = getDefaultChannelId(state)}: OwnProps) => {
        const team = getCurrentTeam(state);
        const teamMember = getTeamMember(state, team.id, userId);

        const isTeamAdmin = Boolean(teamMember && teamMember.scheme_admin);
        const channelMember = getChannelMembersInChannels(state)?.[channelId]?.[userId];

        let isChannelAdmin = false;
        if (getRhsState(state) !== 'search' && channelMember != null && channelMember.scheme_admin) {
            isChannelAdmin = true;
        }

        const customStatus = getCustomStatus(state, userId);
        const status = getStatusForUserId(state, userId);
        const user = getUser(state, userId);

        const lastActivityTimestamp = getLastActivityForUserId(state, userId);
        const timestampUnits = getLastActiveTimestampUnits(state, userId);
        const enableLastActiveTime = displayLastActiveLabel(state, userId);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const callsEnabled = isCallsEnabled(state);
        const currentUserId = getCurrentUserId(state);
        const callsConfig = callsEnabled ? getCallsConfig(state) : undefined;

        return {
            currentTeamId: team.id,
            currentUserId,
            enableTimezone: isTimezoneEnabled(state),
            isTeamAdmin,
            isChannelAdmin,
            isInCurrentTeam: Boolean(teamMember) && teamMember?.delete_at === 0,
            canManageAnyChannelMembersInCurrentTeam: canManageAnyChannelMembersInCurrentTeam(state),
            status,
            teamUrl: getCurrentRelativeTeamUrl(state),
            user,
            modals: state.views.modals,
            customStatus,
            isCustomStatusEnabled: isCustomStatusEnabled(state),
            isCustomStatusExpired: isCustomStatusExpired(state, customStatus),
            channelId,
            currentUserTimezone: getCurrentTimezone(state),
            lastActivityTimestamp,
            enableLastActiveTime,
            timestampUnits,
            isMobileView: getIsMobileView(state),
            isCallsEnabled: callsEnabled,
            isUserInCall: callsEnabled ? checkUserInCall(state, userId) : undefined,
            isCurrentUserInCall: callsEnabled ? checkUserInCall(state, currentUserId) : undefined,
            isCallsDefaultEnabledOnAllChannels: callsConfig?.DefaultEnabled,
            isCallsCanBeDisabledOnSpecificChannels: callsConfig?.AllowEnableCalls,
            dMChannel: getChannelByName(state, getDirectChannelName(currentUserId, userId)),
            teammateNameDisplay: getTeammateNameDisplaySetting(state),
            isAnyModalOpen: isAnyModalOpen(state),
        };
    };
}

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
    closeModal: (modalId: string) => void;
    openDirectChannelToUserId: (userId?: string) => Promise<{error: ServerError}>;
    getMembershipForEntities: (teamId: string, userId: string, channelId?: string) => Promise<void>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            closeModal,
            openDirectChannelToUserId,
            openModal,
            getMembershipForEntities,
        }, dispatch),
    };
}

export default connect(makeMapStateToProps, mapDispatchToProps)(ProfilePopover);
