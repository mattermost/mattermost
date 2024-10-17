// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState} from 'react';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {StatusOK} from '@mattermost/types/client4';
import type {ServerError} from '@mattermost/types/errors';
import type {RemoteClusterPatch, RemoteCluster, RemoteClusterAcceptInvite} from '@mattermost/types/remote_clusters';
import type {PartialExcept} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import SecureConnectionAcceptInviteModal from './secure_connection_accept_invite_modal';
import SecureConnectionCreateInviteModal from './secure_connection_create_invite_modal';
import SecureConnectionDeleteModal from './secure_connection_delete_modal';
import SharedChannelsAddModal from './shared_channels_add_modal';
import SharedChannelsRemoveModal from './shared_channels_remove_modal';

import type {TLoadingState} from '../utils';

const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~_!@-#$^';
const makePassword = () => {
    return Array.from(window.crypto.getRandomValues(new Uint32Array(16))).
        map((n) => chars[n % chars.length]).
        join('');
};

export const useRemoteClusterCreate = () => {
    const dispatch = useDispatch();
    const [saving, setSaving] = useState<TLoadingState>(false);

    const promptCreate = (patch: RemoteClusterPatch) => {
        return new Promise<RemoteCluster | undefined>((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SECURE_CONNECTION_CREATE_INVITE,
                dialogType: SecureConnectionCreateInviteModal,
                dialogProps: {
                    creating: true,
                    onConfirm: async () => {
                        try {
                            setSaving(true);
                            const response = await Client4.createRemoteCluster({
                                ...patch,
                                name: cleanUpUrlable(patch.display_name),
                            });
                            setSaving(false);

                            if (response) {
                                const {invite, password, remote_cluster: remoteCluster} = response;

                                resolve(remoteCluster);
                                return {remoteCluster, share: {invite, password}};
                            }
                        } catch (err) {
                            // handle create error
                            reject(err);
                        }
                        setSaving(false);
                        return undefined;
                    },
                },
            }));
        });
    };

    return {promptCreate, saving};
};

export const useRemoteClusterCreateInvite = (remoteCluster: RemoteCluster) => {
    const dispatch = useDispatch();
    const [saving, setSaving] = useState<TLoadingState>(false);

    const promptCreateInvite = () => {
        return new Promise<RemoteCluster>((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SECURE_CONNECTION_CREATE_INVITE,
                dialogType: SecureConnectionCreateInviteModal,
                dialogProps: {
                    onConfirm: async () => {
                        try {
                            const password = makePassword();
                            setSaving(true);
                            const invite = await Client4.generateInviteRemoteCluster(remoteCluster.remote_id, {password});
                            setSaving(false);
                            resolve(remoteCluster);
                            return {remoteCluster, share: {invite, password}};
                        } catch (err) {
                            // handle create error
                            reject(err);
                        }
                        setSaving(false);
                        return undefined;
                    },
                },
            }));
        });
    };

    return {promptCreateInvite, saving} as const;
};

export const useRemoteClusterAcceptInvite = () => {
    const dispatch = useDispatch();
    const [saving, setSaving] = useState<TLoadingState>(false);

    const promptAcceptInvite = () => {
        return new Promise<RemoteCluster>((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SECURE_CONNECTION_ACCEPT_INVITE,
                dialogType: SecureConnectionAcceptInviteModal,
                dialogProps: {
                    onConfirm: async (acceptInvite: PartialExcept<RemoteClusterAcceptInvite, 'display_name' | 'default_team_id' | 'invite' | 'password'>) => {
                        try {
                            setSaving(true);
                            const rc = await Client4.acceptInviteRemoteCluster({
                                ...acceptInvite,
                                name: cleanUpUrlable(acceptInvite.display_name),
                            });
                            setSaving(false);
                            resolve(rc);
                            return rc;
                        } catch (err) {
                            // handle create error
                            reject(err);
                            setSaving(err);
                            throw (err);
                        }
                    },
                },
            }));
        });
    };

    return {promptAcceptInvite, saving} as const;
};

export const useRemoteClusterDelete = (rc: RemoteCluster) => {
    const dispatch = useDispatch();
    const promptDelete = () => {
        return new Promise((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SECURE_CONNECTION_DELETE,
                dialogType: SecureConnectionDeleteModal,
                dialogProps: {
                    displayName: rc.display_name,
                    onConfirm: () => Client4.deleteRemoteCluster(rc.remote_id).then(resolve, reject),
                },
            }));
        });
    };

    return {promptDelete} as const;
};

export const useSharedChannelsRemove = (remoteId: string) => {
    const dispatch = useDispatch();
    const promptRemove = (channelId: string) => {
        return new Promise((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SHARED_CHANNEL_REMOTE_UNINVITE,
                dialogType: SharedChannelsRemoveModal,
                dialogProps: {
                    onConfirm: () => Client4.sharedChannelRemoteUninvite(remoteId, channelId).then(resolve, reject),
                },
            }));
        });
    };

    return {promptRemove};
};

export type SharedChannelsAddResult = {
    data: {[channel_id: string]: PromiseSettledResult<StatusOK>};
    errors: {[channel_id: string]: ServerError};
}
export const useSharedChannelsAdd = (remoteId: string) => {
    const dispatch = useDispatch();
    const promptAdd = () => {
        return new Promise((resolve) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SHARED_CHANNEL_REMOTE_INVITE,
                dialogType: SharedChannelsAddModal,
                dialogProps: {
                    remoteId,
                    onConfirm: async (channels: Channel[]) => {
                        const result: SharedChannelsAddResult = {data: {}, errors: {}};
                        const {data, errors} = result;

                        const requests = channels.map(({id}) => Client4.sharedChannelRemoteInvite(remoteId, id));
                        (await Promise.allSettled(requests)).forEach((r, i) => {
                            if (r.status === 'rejected' && r.reason.server_error_id) {
                                errors[channels[i].id] = r.reason;
                            } else if (r.status === 'fulfilled') {
                                data[channels[i].id] = r;
                            }
                        });

                        resolve(result);
                        return result;
                    },
                },
            }));
        });
    };

    return {promptAdd};
};
