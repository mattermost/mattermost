// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getCurrentUser, getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTeamId, getTeam} from 'mattermost-redux/selectors/entities/teams';

import {getTeamRedirectChannelIfIsAccesible} from 'actions/global_actions';
import LocalStorageStore from 'stores/local_storage_store';

import InvitationModal from 'components/invitation_modal';

import {getHistory} from 'utils/browser_history';
import {ActionTypes, Constants, ModalIdentifiers} from 'utils/constants';

import {openModal} from './modals';

import type {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';
import type {GlobalState} from 'types/store';

export function switchToChannels() {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState() as GlobalState;
        const currentUserId = getCurrentUserId(state);
        const user = getCurrentUser(state);
        const teamId = getCurrentTeamId(state) || LocalStorageStore.getPreviousTeamId(currentUserId);
        const team = getTeam(state, teamId || '');

        const channel = await getTeamRedirectChannelIfIsAccesible(user, team);
        const channelName = channel?.name || Constants.DEFAULT_CHANNEL;

        getHistory().push(`/${team.name}/channels/${channelName}`);
        return {data: true};
    };
}

export function openInvitationsModal(timeout = 1) {
    return (dispatch: DispatchFunc) => {
        dispatch(switchToChannels());
        setTimeout(() => {
            dispatch(openModal({
                modalId: ModalIdentifiers.INVITATION,
                dialogType: InvitationModal,
                dialogProps: {
                },
            }));
        }, timeout);
        return {data: true};
    };
}

export function setShowOnboardingTaskCompletion(open: boolean) {
    return {
        type: ActionTypes.SHOW_ONBOARDING_TASK_COMPLETION,
        open,
    };
}

export function setShowOnboardingCompleteProfileTour(open: boolean) {
    return {
        type: ActionTypes.SHOW_ONBOARDING_COMPLETE_PROFILE_TOUR,
        open,
    };
}

export function setShowOnboardingVisitConsoleTour(open: boolean) {
    return {
        type: ActionTypes.SHOW_ONBOARDING_VISIT_CONSOLE_TOUR,
        open,
    };
}

