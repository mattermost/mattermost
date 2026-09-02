// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';

import type {RemoteClusterPatch} from '@mattermost/types/remote_clusters';

import {Client4} from 'mattermost-redux/client';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import {
    useRemoteClusterAcceptInvite,
    useRemoteClusterCreate,
    useRemoteClusterCreateInvite,
    useRemoteClusterDelete,
    useSharedChannelsAdd,
    useSharedChannelsRemove,
} from './modal_utils';

const mockOpenedModals: any[] = [];

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn((arg) => {
        mockOpenedModals.push(arg);
        return {type: 'OPEN_MODAL', arg};
    }),
}));

const remoteCluster = TestHelper.getRemoteClusterMock({
    remote_id: 'rc-1',
    display_name: 'Acme',
    name: 'acme',
    site_url: 'https://siteurl',
});

describe('modal_utils', () => {
    beforeEach(() => {
        mockOpenedModals.length = 0;
        jest.clearAllMocks();
    });

    describe('useRemoteClusterCreate', () => {
        it('opens the create-invite modal in "creating" mode', async () => {
            const {result} = renderHookWithContext(() => useRemoteClusterCreate());

            const patch: RemoteClusterPatch = {display_name: 'Acme'} as RemoteClusterPatch;
            act(() => {
                result.current.promptCreate(patch);
            });

            expect(mockOpenedModals).toHaveLength(1);
            expect(mockOpenedModals[0].modalId).toBe(ModalIdentifiers.SECURE_CONNECTION_CREATE_INVITE);
            expect(mockOpenedModals[0].dialogProps.creating).toBe(true);
            expect(typeof mockOpenedModals[0].dialogProps.onConfirm).toBe('function');
        });
    });

    describe('useRemoteClusterCreateInvite', () => {
        it('opens the create-invite modal without "creating"', () => {
            const {result} = renderHookWithContext(() => useRemoteClusterCreateInvite(remoteCluster));

            act(() => {
                result.current.promptCreateInvite();
            });

            expect(mockOpenedModals).toHaveLength(1);
            expect(mockOpenedModals[0].modalId).toBe(ModalIdentifiers.SECURE_CONNECTION_CREATE_INVITE);
            expect(mockOpenedModals[0].dialogProps.creating).toBeUndefined();
        });

        it('passes an onConfirm that calls Client4.generateInviteRemoteCluster', async () => {
            jest.spyOn(Client4, 'generateInviteRemoteCluster').mockResolvedValue('INVITE_TOKEN');

            const {result} = renderHookWithContext(() => useRemoteClusterCreateInvite(remoteCluster));

            act(() => {
                result.current.promptCreateInvite();
            });

            const share = await mockOpenedModals[0].dialogProps.onConfirm();

            expect(Client4.generateInviteRemoteCluster).toHaveBeenCalledWith(remoteCluster.remote_id, expect.objectContaining({password: expect.any(String)}));
            expect(share).toEqual({remoteCluster, share: {invite: 'INVITE_TOKEN', password: expect.any(String)}});
        });
    });

    describe('useRemoteClusterAcceptInvite', () => {
        it('opens the accept-invite modal', () => {
            const {result} = renderHookWithContext(() => useRemoteClusterAcceptInvite());

            act(() => {
                result.current.promptAcceptInvite();
            });

            expect(mockOpenedModals).toHaveLength(1);
            expect(mockOpenedModals[0].modalId).toBe(ModalIdentifiers.SECURE_CONNECTION_ACCEPT_INVITE);
        });

        it('passes an onConfirm that calls Client4.acceptInviteRemoteCluster', async () => {
            const accepted = TestHelper.getRemoteClusterMock({remote_id: 'rc-1', display_name: 'Acme'});
            jest.spyOn(Client4, 'acceptInviteRemoteCluster').mockResolvedValue(accepted);

            const {result} = renderHookWithContext(() => useRemoteClusterAcceptInvite());

            act(() => {
                result.current.promptAcceptInvite();
            });

            const rc = await mockOpenedModals[0].dialogProps.onConfirm({
                display_name: 'Acme',
                default_team_id: 'team-1',
                invite: 'INVITE',
                password: 'PASSWORD',
            });

            expect(Client4.acceptInviteRemoteCluster).toHaveBeenCalledWith(expect.objectContaining({
                display_name: 'Acme',
                default_team_id: 'team-1',
                invite: 'INVITE',
                password: 'PASSWORD',
                name: 'acme',
            }));
            expect(rc).toBe(accepted);
        });
    });

    describe('useRemoteClusterDelete', () => {
        it('opens the delete modal with the cluster display name', () => {
            const {result} = renderHookWithContext(() => useRemoteClusterDelete(remoteCluster));

            act(() => {
                result.current.promptDelete();
            });

            expect(mockOpenedModals).toHaveLength(1);
            expect(mockOpenedModals[0].modalId).toBe(ModalIdentifiers.SECURE_CONNECTION_DELETE);
            expect(mockOpenedModals[0].dialogProps.displayName).toBe('Acme');
        });

        it('onConfirm calls Client4.deleteRemoteCluster', async () => {
            const spy = jest.spyOn(Client4, 'deleteRemoteCluster').mockResolvedValue({} as any);

            const {result} = renderHookWithContext(() => useRemoteClusterDelete(remoteCluster));

            act(() => {
                result.current.promptDelete();
            });

            await mockOpenedModals[0].dialogProps.onConfirm();

            expect(spy).toHaveBeenCalledWith('rc-1');
        });
    });

    describe('useSharedChannelsRemove', () => {
        it('opens the shared-channels-remove modal', async () => {
            jest.spyOn(Client4, 'sharedChannelRemoteUninvite').mockResolvedValue({status: 'OK'});

            const {result} = renderHookWithContext(() => useSharedChannelsRemove('rc-1'));

            act(() => {
                result.current.promptRemove('ch-a');
            });

            expect(mockOpenedModals).toHaveLength(1);
            expect(mockOpenedModals[0].modalId).toBe(ModalIdentifiers.SHARED_CHANNEL_REMOTE_UNINVITE);

            await mockOpenedModals[0].dialogProps.onConfirm();
            expect(Client4.sharedChannelRemoteUninvite).toHaveBeenCalledWith('rc-1', 'ch-a');
        });
    });

    describe('useSharedChannelsAdd', () => {
        it('opens the shared-channels-add modal', () => {
            const {result} = renderHookWithContext(() => useSharedChannelsAdd('rc-1'));

            act(() => {
                result.current.promptAdd();
            });

            expect(mockOpenedModals).toHaveLength(1);
            expect(mockOpenedModals[0].modalId).toBe(ModalIdentifiers.SHARED_CHANNEL_REMOTE_INVITE);
            expect(mockOpenedModals[0].dialogProps.remoteId).toBe('rc-1');
        });

        it('onConfirm aggregates per-channel results and errors', async () => {
            const spy = jest.spyOn(Client4, 'sharedChannelRemoteInvite').
                mockResolvedValueOnce({status: 'OK'}).
                mockRejectedValueOnce({server_error_id: 'oops'});

            const {result} = renderHookWithContext(() => useSharedChannelsAdd('rc-1'));

            act(() => {
                result.current.promptAdd();
            });

            const channels = [
                {id: 'ch-ok'},
                {id: 'ch-fail'},
            ] as any;
            const res = await mockOpenedModals[0].dialogProps.onConfirm(channels);

            expect(spy).toHaveBeenCalledTimes(2);
            expect(res.data['ch-ok']).toBeDefined();
            expect(res.errors['ch-fail']).toEqual({server_error_id: 'oops'});
        });
    });
});
