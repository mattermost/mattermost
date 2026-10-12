// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {fetchAllMyChannelMembers, fetchAllMyTeamsChannels} from 'mattermost-redux/actions/channels';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getMyTeamUnreads} from 'mattermost-redux/actions/teams';
import {getThreadCounts} from 'mattermost-redux/actions/threads';

import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {loadProfilesForSidebar} from 'actions/user_actions';
import {openModal} from 'actions/views/modals';

import configureStore from 'tests/test_store';
import {ActionTypes, ModalIdentifiers} from 'utils/constants';

import {fetchDmGmAccess, hideDirectAndGroupChannels, restoreDirectAndGroupChannels} from './dm_gm_access';

jest.mock('mattermost-redux/actions/render_permissions', () => ({
    fetchSessionRenderDecisions: jest.fn(() => ({type: 'MOCK_FETCH_SESSION_DECISIONS'})),
}));
jest.mock('mattermost-redux/actions/channels', () => ({
    fetchAllMyTeamsChannels: jest.fn(() => ({type: 'MOCK_FETCH_ALL_MY_TEAMS_CHANNELS'})),
    fetchAllMyChannelMembers: jest.fn(() => ({type: 'MOCK_FETCH_ALL_MY_CHANNEL_MEMBERS'})),
}));
jest.mock('mattermost-redux/actions/channel_categories', () => ({
    fetchMyCategories: jest.fn(() => ({type: 'MOCK_FETCH_MY_CATEGORIES'})),
}));
jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));
jest.mock('mattermost-redux/actions/teams', () => ({
    getMyTeamUnreads: jest.fn(() => ({type: 'MOCK_GET_MY_TEAM_UNREADS'})),
}));
jest.mock('mattermost-redux/actions/threads', () => ({
    getThreadCounts: jest.fn(() => ({type: 'MOCK_GET_THREAD_COUNTS'})),
}));
jest.mock('actions/user_actions', () => ({
    loadProfilesForSidebar: jest.fn(),
}));
jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));
jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => ({type: 'MOCK_CLOSE_RHS'})),
}));
jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

const dm = {id: 'dm1', team_id: '', type: 'D' as const, display_name: 'A DM', delete_at: 0};
const gm = {id: 'gm1', team_id: '', type: 'G' as const, display_name: 'A GM', delete_at: 0};
const openChannel = {id: 'open1', team_id: 'team1', type: 'O' as const, display_name: 'Open', delete_at: 0};

function makeState({
    currentChannelId = openChannel.id,
    rhsChannelId = '',
    permissionPolicies = 'true',
    collapsedThreads = CollapsedThreads.ALWAYS_ON,
} = {}) {
    return {
        entities: {
            general: {config: {FeatureFlagPermissionPolicies: permissionPolicies, CollapsedThreads: collapsedThreads}},
            users: {currentUserId: 'user1'},
            teams: {currentTeamId: 'team1'},
            channels: {
                currentChannelId,
                channels: {[dm.id]: dm, [gm.id]: gm, [openChannel.id]: openChannel},
                channelsInTeam: {'': new Set([dm.id, gm.id]), team1: new Set([openChannel.id])},
            },
            preferences: {myPreferences: {}},
        },
        views: {rhs: {selectedChannelId: rhsChannelId}},
    };
}

describe('fetchDmGmAccess', () => {
    beforeEach(() => {
        jest.useFakeTimers({doNotFake: ['nextTick']});
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    const fetches = (store: ReturnType<typeof configureStore>) => store.getActions().filter((a) => a.type === 'MOCK_FETCH_SESSION_DECISIONS');

    it('should fetch straight away without jitter', () => {
        const store = configureStore(makeState());

        store.dispatch(fetchDmGmAccess());

        expect(fetches(store)).toHaveLength(1);
    });

    it('should do nothing while permission policies are off', () => {
        const store = configureStore(makeState({permissionPolicies: 'false'}));

        store.dispatch(fetchDmGmAccess());
        store.dispatch(fetchDmGmAccess({jitter: true}));
        jest.runAllTimers();

        expect(store.getActions()).toEqual([]);
    });

    it('should wait with jitter and fold requests made meanwhile into one fetch', () => {
        const store = configureStore(makeState());

        store.dispatch(fetchDmGmAccess({jitter: true}));
        store.dispatch(fetchDmGmAccess({jitter: true}));

        jest.advanceTimersByTime(2499);
        expect(fetches(store)).toHaveLength(0);

        jest.advanceTimersByTime(1);
        expect(fetches(store)).toHaveLength(1);

        // Once the pending fetch has gone out, the next request waits again.
        store.dispatch(fetchDmGmAccess({jitter: true}));
        jest.advanceTimersByTime(2500);
        expect(fetches(store)).toHaveLength(2);
    });
});

describe('hideDirectAndGroupChannels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const leftIds = (store: ReturnType<typeof configureStore>) => store.getActions().
        flatMap((a) => (Array.isArray(a.payload) ? a.payload : [a])).
        filter((a) => a.type === ChannelTypes.LEAVE_CHANNEL).
        map((a) => a.data.id);

    it('should drop every DM and GM locally, without asking the server, and set the flag', () => {
        const store = configureStore(makeState({rhsChannelId: dm.id}));

        store.dispatch(hideDirectAndGroupChannels());

        expect(leftIds(store)).toEqual([dm.id, gm.id]);

        // Only local actions: the flag, the batched LEAVE_CHANNELs and closing the RHS.
        expect(store.getActions().map((a) => a.type)).toEqual([ActionTypes.SET_DM_GM_HIDDEN, 'BATCHING_REDUCER.BATCH', 'MOCK_CLOSE_RHS']);
        expect(store.getActions()[0]).toEqual({type: ActionTypes.SET_DM_GM_HIDDEN, data: true});
        expect(savePreferences).not.toHaveBeenCalled();

        expect(openModal).not.toHaveBeenCalled();
        expect(redirectUserToDefaultTeam).not.toHaveBeenCalled();
    });

    it('should tell the user and redirect when the conversation is the one in view', () => {
        const store = configureStore(makeState({currentChannelId: gm.id}));

        store.dispatch(hideDirectAndGroupChannels());

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_ACCESS_DENIED,
            dialogProps: {isConversation: true},
        }));
        expect(redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
    });
});

describe('restoreDirectAndGroupChannels', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should clear the flag and refetch what hiding dropped', async () => {
        const store = configureStore(makeState());

        await store.dispatch(restoreDirectAndGroupChannels());

        expect(store.getActions()[0]).toEqual({type: ActionTypes.SET_DM_GM_HIDDEN, data: false});
        expect(fetchAllMyTeamsChannels).toHaveBeenCalledTimes(1);
        expect(fetchAllMyChannelMembers).toHaveBeenCalledTimes(1);
        expect(fetchMyCategories).toHaveBeenCalledWith('team1');
        expect(loadProfilesForSidebar).toHaveBeenCalledTimes(1);
        expect(getMyTeamUnreads).toHaveBeenCalledWith(true);
        expect(getThreadCounts).toHaveBeenCalledWith('user1', 'team1');
    });

    it('should skip thread counts without collapsed threads', async () => {
        const store = configureStore(makeState({collapsedThreads: CollapsedThreads.DISABLED}));

        await store.dispatch(restoreDirectAndGroupChannels());

        expect(getMyTeamUnreads).toHaveBeenCalledWith(false);
        expect(getThreadCounts).not.toHaveBeenCalled();
    });
});
