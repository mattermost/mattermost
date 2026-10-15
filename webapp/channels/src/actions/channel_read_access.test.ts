// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchAllMyTeamsChannels} from 'mattermost-redux/actions/channels';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {reconcileChannelReadAccess, reconcileChannelReadAccessWithJitter} from './channel_read_access';

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

const openChannel = {id: 'open1', team_id: 'team1', type: 'O', display_name: 'Open One', delete_at: 0};
const deniedChannel = {id: 'denied1', team_id: 'team1', type: 'P', display_name: 'Secret', delete_at: 0};
const dm = {id: 'dm1', team_id: '', type: 'D', display_name: 'A DM', delete_at: 0};
const archived = {id: 'arch1', team_id: 'team1', type: 'O', display_name: 'Archived', delete_at: 12345};

function makeState(overrides: {currentChannelId?: string} = {}) {
    const {currentChannelId = ''} = overrides;
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
        dispatch = jest.fn((action) => (typeof action === 'function' ? action(dispatch, makeState()) : action));
    });

    it('drops the local copy of a channel the server stopped returning', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcileChannelReadAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([deniedChannel.id]);
    });

    it('drops nothing when every channel is still returned', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel, dm, archived]}));

        await reconcileChannelReadAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([]);
    });

    // DMs and GMs are exempt on the server, so their absence never means denied.
    it('never drops a DM', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel]}));

        await reconcileChannelReadAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([]);
    });

    it('drops nothing when the refresh fails', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({error: new Error('offline')}));

        await reconcileChannelReadAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([]);
    });

    it('tells the user when the channel they are looking at is the one denied', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcileChannelReadAccess()(dispatch, makeState({currentChannelId: deniedChannel.id}), undefined);

        expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
            modalId: ModalIdentifiers.CHANNEL_ACCESS_DENIED,
            dialogProps: {channelName: deniedChannel.display_name},
        }));
    });

    it('stays silent when the denied channel is not the one in view', async () => {
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));

        await reconcileChannelReadAccess()(dispatch, makeState({currentChannelId: openChannel.id}), undefined);

        expect(openModal).not.toHaveBeenCalled();
    });

    // The channel list omits archived channels regardless of policy, so their absence
    // is not a denial.
    it('never drops an archived channel', async () => {
        // Every fixture channel except `archived`; no other test leaves out only that one.
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, deniedChannel, dm]}));

        await reconcileChannelReadAccess()(dispatch, makeState(), undefined);

        expect(droppedIds(dispatch)).toEqual([]);
    });

    // The response to a run already in flight can predate the change behind a later
    // request, so that request gets a run of its own, shared by any others made meanwhile.
    it('runs one reconcile at a time and reruns once for the requests made meanwhile', async () => {
        let respond: (result: {data: unknown[]}) => void = () => {};
        (fetchAllMyTeamsChannels as jest.Mock).
            mockReturnValueOnce(() => new Promise((resolve) => {
                respond = resolve;
            })).
            mockReturnValue(async () => ({data: [openChannel, dm]}));

        const requests = [
            reconcileChannelReadAccess()(dispatch, makeState(), undefined),
            reconcileChannelReadAccess()(dispatch, makeState(), undefined),
            reconcileChannelReadAccess()(dispatch, makeState(), undefined),
        ];
        expect(fetchAllMyTeamsChannels).toHaveBeenCalledTimes(1);

        // The first response still lists the channel; only the rerun's leaves it out.
        respond({data: [openChannel, deniedChannel, dm, archived]});
        await Promise.all(requests);

        expect(fetchAllMyTeamsChannels).toHaveBeenCalledTimes(2);
        expect(droppedIds(dispatch)).toEqual([deniedChannel.id]);
    });
});

describe('reconcileChannelReadAccessWithJitter', () => {
    let dispatch: jest.Mock;
    let random: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
        (fetchAllMyTeamsChannels as jest.Mock).mockReturnValue(async () => ({data: [openChannel, dm]}));
        dispatch = jest.fn((action) => (typeof action === 'function' ? action(dispatch, makeState()) : action));
    });

    afterEach(() => {
        random.mockRestore();
        jest.useRealTimers();
    });

    it('waits a random share of 30 seconds before reconciling', async () => {
        reconcileChannelReadAccessWithJitter()(dispatch, makeState(), undefined);

        await jest.advanceTimersByTimeAsync(14999);
        expect(fetchAllMyTeamsChannels).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        expect(fetchAllMyTeamsChannels).toHaveBeenCalledTimes(1);
        expect(droppedIds(dispatch)).toEqual([deniedChannel.id]);
    });

    // The waiting reconcile has yet to fetch, so it covers every event before it does.
    it('folds the events that arrive while one waits into it', async () => {
        reconcileChannelReadAccessWithJitter()(dispatch, makeState(), undefined);
        await jest.advanceTimersByTimeAsync(10000);
        reconcileChannelReadAccessWithJitter()(dispatch, makeState(), undefined);

        await jest.runAllTimersAsync();

        expect(fetchAllMyTeamsChannels).toHaveBeenCalledTimes(1);
    });
});
