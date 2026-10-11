// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchAllMyTeamsChannels} from 'mattermost-redux/actions/channels';

import {hideDirectAndGroupChannels} from 'actions/dm_gm_access';
import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {reconcileChannelReadAccess} from './channel_read_access';

jest.mock('mattermost-redux/actions/channels', () => ({
    fetchAllMyTeamsChannels: jest.fn(),
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
jest.mock('actions/dm_gm_access', () => ({
    hideDirectAndGroupChannels: jest.fn(() => ({type: 'MOCK_HIDE_DIRECT_AND_GROUP_CHANNELS'})),
}));

const openChannel = {id: 'open1', team_id: 'team1', type: 'O', display_name: 'Open One', delete_at: 0};
const deniedChannel = {id: 'denied1', team_id: 'team1', type: 'P', display_name: 'Secret', delete_at: 0};
const dm = {id: 'dm1', team_id: '', type: 'D', display_name: 'A DM', delete_at: 0};
const archived = {id: 'arch1', team_id: 'team1', type: 'O', display_name: 'Archived', delete_at: 12345};

function makeState(overrides: {currentChannelId?: string; dmGmReadDenied?: boolean} = {}) {
    const {currentChannelId = '', dmGmReadDenied = false} = overrides;
    return () => ({
        entities: {
            general: {
                config: {
                    FeatureFlagPermissionPolicies: 'true',
                },
                license: {},
            },
            users: {currentUserId: 'user1'},
            channels: {
                currentChannelId,
                channels: {
                    [openChannel.id]: openChannel,
                    [deniedChannel.id]: deniedChannel,
                    [dm.id]: dm,
                    [archived.id]: archived,
                },
                myMembers: {
                    [openChannel.id]: {channel_id: openChannel.id, user_id: 'user1'},
                    [deniedChannel.id]: {channel_id: deniedChannel.id, user_id: 'user1'},
                    [dm.id]: {channel_id: dm.id, user_id: 'user1'},
                    [archived.id]: {channel_id: archived.id, user_id: 'user1'},
                },
            },
            renderPermissions: {
                byResource: dmGmReadDenied ? {permission: {'': {dm_gm_read_access: {allowed: false, evaluated: true, generation: 1}}}} : {},
            },
        },
        views: {rhs: {selectedChannelId: ''}},
    }) as any;
}

// Across every LEAVE_CHANNEL the action dispatched, batched or not.
function droppedIds(dispatch: jest.Mock): string[] {
    return dispatch.mock.calls.flatMap(([action]) => {
        const candidates = Array.isArray(action?.payload) ? action.payload : [action];
        return candidates.
            filter((a: any) => a?.type === ChannelTypes.LEAVE_CHANNEL).
            map((a: any) => a.data.id);
    });
}

describe('reconcileChannelReadAccess', () => {
    let dispatch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Nested thunks see the same state as the reconcile itself.
    function reconcile(getState: ReturnType<typeof makeState>) {
        dispatch = jest.fn((action) => (typeof action === 'function' ? action(dispatch, getState) : action));
        return reconcileChannelReadAccess()(dispatch, getState, undefined);
    }

    it('drops the local copy of a channel the server stopped returning', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcile(makeState());

        expect(droppedIds(dispatch)).toEqual([deniedChannel.id]);
    });

    it('drops nothing when every channel is still returned', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel, dm]}));

        await reconcile(makeState());

        expect(droppedIds(dispatch)).toEqual([]);
    });

    // DMs and GMs are exempt on the server, so their absence never means denied.
    it('never drops a DM', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel]}));

        await reconcile(makeState());

        expect(droppedIds(dispatch)).toEqual([]);
        expect(hideDirectAndGroupChannels).not.toHaveBeenCalled();
    });

    it('hides conversations when Read is denied', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel]}));

        await reconcile(makeState({dmGmReadDenied: true}));

        expect(droppedIds(dispatch)).toEqual([]);
        expect(dispatch).toHaveBeenCalledWith({type: 'MOCK_HIDE_DIRECT_AND_GROUP_CHANNELS'});
    });

    it('drops nothing when the refresh fails', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({error: new Error('offline')}));

        await reconcile(makeState());

        expect(droppedIds(dispatch)).toEqual([]);
    });

    it('tells the user when the channel they are looking at is the one denied', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcile(makeState({currentChannelId: deniedChannel.id}));

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_ACCESS_DENIED,
            dialogProps: {channelName: deniedChannel.display_name},
        }));
    });

    it('stays silent when the denied channel is not the one in view', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcile(makeState({currentChannelId: openChannel.id}));

        expect(openModal).not.toHaveBeenCalled();
    });

    // The channel list omits archived channels regardless of policy, so their absence
    // is not a denial.
    it('never drops an archived channel', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel, dm]}));

        await reconcile(makeState());

        expect(droppedIds(dispatch)).toEqual([]);
    });
});
