// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchAllMyTeamsChannels} from 'mattermost-redux/actions/channels';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {reconcileChannelAccess} from './channel_access';

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

const openChannel = {id: 'open1', team_id: 'team1', type: 'O', display_name: 'Open One'};
const deniedChannel = {id: 'denied1', team_id: 'team1', type: 'P', display_name: 'Secret'};
const dm = {id: 'dm1', team_id: '', type: 'D', display_name: 'A DM'};

function makeState(overrides: {currentChannelId?: string; flagOn?: boolean} = {}) {
    const {currentChannelId = '', flagOn = true} = overrides;
    return () => ({
        entities: {
            general: {
                config: {
                    FeatureFlagPermissionPolicies: 'true',
                    FeatureFlagAccessChannelABACPermission: flagOn ? 'true' : 'false',
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
                },
                myMembers: {
                    [openChannel.id]: {channel_id: openChannel.id, user_id: 'user1'},
                    [deniedChannel.id]: {channel_id: deniedChannel.id, user_id: 'user1'},
                    [dm.id]: {channel_id: dm.id, user_id: 'user1'},
                },
            },
        },
        views: {rhs: {selectedChannelId: ''}},
    }) as any;
}

// The dropped ids across every LEAVE_CHANNEL the action dispatched, batched or not.
function droppedIds(dispatch: jest.Mock): string[] {
    return dispatch.mock.calls.flatMap(([action]) => {
        const candidates = Array.isArray(action?.payload) ? action.payload : [action];
        return candidates.
            filter((a: any) => a?.type === ChannelTypes.LEAVE_CHANNEL).
            map((a: any) => a.data.id);
    });
}

describe('reconcileChannelAccess', () => {
    let dispatch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        dispatch = jest.fn((action) => (typeof action === 'function' ? action(dispatch, makeState()) : action));
    });

    // The channel keeps its membership server-side; only the local copy goes, which
    // is what lets it come back intact when access returns.
    it('drops the local copy of a channel the server stopped returning', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcileChannelAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([deniedChannel.id]);
    });

    it('drops nothing when every channel is still returned', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel, dm]}));

        await reconcileChannelAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([]);
    });

    // DMs and GMs are exempt on the server, so their absence never means denied.
    it('never drops a DM', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel]}));

        await reconcileChannelAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([]);
    });

    // A failed fetch must not be read as "everything was denied".
    it('drops nothing when the refresh fails', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({error: new Error('offline')}));

        await reconcileChannelAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([]);
    });

    it('tells the user when the channel they are looking at is the one denied', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcileChannelAccess()(dispatch, makeState({currentChannelId: deniedChannel.id}), undefined);

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_ACCESS_DENIED,
            dialogProps: {channelName: deniedChannel.display_name},
        }));
    });

    it('stays silent when the denied channel is not the one in view', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcileChannelAccess()(dispatch, makeState({currentChannelId: openChannel.id}), undefined);

        expect(openModal).not.toHaveBeenCalled();
    });

    it('does nothing at all while the feature flag is off', async () => {
        await reconcileChannelAccess()(dispatch, makeState({flagOn: false}), undefined);

        expect(fetchAllMyTeamsChannels).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });
});
