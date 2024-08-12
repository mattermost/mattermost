// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LocationDescriptor} from 'history';
import {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import type {RemoteCluster, RemoteClusterAcceptInvite, RemoteClusterPatch} from '@mattermost/types/remote_clusters';
import type {PartialExcept} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import SecureConnectionAcceptInviteModal from './secure_connection_accept_invite_modal';
import SecureConnectionCreateInviteModal from './secure_connection_create_invite_modal';
import SecureConnectionDeleteModal from './secure_connection_delete_modal';

export const useRemoteClusters = () => {
    const [remoteClusters, setRemoteClusters] = useState<RemoteCluster[]>();
    const [loadingState, setLoadingState] = useState<boolean | ClientError>(true);

    const isLoading = loadingState === true;

    const fetch = async () => {
        setLoadingState(true);
        try {
            const data = await Client4.getRemoteClusters({excludePlugins: true});
            setRemoteClusters(data?.length ? data : undefined);
            setLoadingState(false);
        } catch (err) {
            setLoadingState(err);
        }
    };

    useEffect(() => {
        fetch();
    }, []);

    return [remoteClusters, {isLoading, fetch}] as const;
};

export const useRemoteClusterEdit = (remoteId: string | 'create', initRemoteCluster?: RemoteCluster) => {
    const editing = remoteId !== 'create';

    const [currentRemoteCluster, setCurrentRemoteCluster] = useState<RemoteCluster | undefined>(initRemoteCluster);
    const [patch, setPatch] = useState<Partial<RemoteClusterPatch>>({});
    const [loading, setLoading] = useState<boolean | ClientError>(editing && !currentRemoteCluster);
    const [saving, setSaving] = useState<boolean | ClientError>(false);

    const hasChanges = Object.keys(patch).length > 0;

    useEffect(() => {
        if (!editing) {
            return;
        }
        (async () => {
            try {
                const data = await Client4.getRemoteCluster(remoteId);
                setCurrentRemoteCluster(data);
                setLoading(false);
                setPatch({});
            } catch (err) {
                setSaving(err);
            }
        })();
    }, [remoteId]);

    const applyPatch = (patch: Partial<RemoteClusterPatch>) => {
        setPatch((current) => ({...current, ...patch}));
    };

    const save = async () => {
        if (currentRemoteCluster && hasChanges) {
            if (patch.display_name === undefined) {
                return;
            }
            setSaving(true);
            try {
                const data = await Client4.patchRemoteCluster(remoteId, patch);
                setCurrentRemoteCluster(data);
                setSaving(false);
                setPatch({});
            } catch (err) {
                setSaving(err);
            }
            setSaving(false);
        }
    };

    return [
        {...currentRemoteCluster, ...patch},
        {
            applyPatch,
            save,
            hasChanges,
            loading,
            saving,
            currentRemoteCluster,
            patch,
        },
    ] as const;
};

const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~_!@-#$^';
const makePassword = () => {
    return Array.from(window.crypto.getRandomValues(new Uint32Array(16))).
        map((n) => chars[n % chars.length]).
        join('');
};

export const useRemoteClusterCreate = () => {
    const dispatch = useDispatch();
    const [saving, setSaving] = useState<boolean | ClientError>(false);

    const promptCreate = (patch: RemoteClusterPatch) => {
        return new Promise<RemoteCluster | undefined>((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SECURE_CONNECTION_CREATE_INVITE,
                dialogType: SecureConnectionCreateInviteModal,
                dialogProps: {
                    creating: true,
                    password: makePassword(),
                    onConfirm: async (password: string) => {
                        try {
                            setSaving(true);
                            const response = await Client4.createRemoteCluster({
                                ...patch,
                                name: cleanUpUrlable(patch.display_name),
                                password,
                            });
                            setSaving(false);

                            if (response) {
                                const {invite, remote_cluster: remoteCluster} = response;

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

    return {promptCreate, saving} as const;
};

export const useRemoteClusterCreateInvite = (remoteCluster: RemoteCluster) => {
    const dispatch = useDispatch();
    const [saving, setSaving] = useState<boolean | ClientError>(false);

    const promptCreateInvite = () => {
        return new Promise<RemoteCluster>((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SECURE_CONNECTION_CREATE_INVITE,
                dialogType: SecureConnectionCreateInviteModal,
                dialogProps: {
                    password: makePassword(),
                    onConfirm: async (password: string) => {
                        try {
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
    const [saving, setSaving] = useState<boolean | ClientError>(false);

    const promptAcceptInvite = () => {
        return new Promise<RemoteCluster>((resolve, reject) => {
            dispatch(openModal({
                modalId: ModalIdentifiers.SECURE_CONNECTION_CREATE_INVITE,
                dialogType: SecureConnectionAcceptInviteModal,
                dialogProps: {
                    onConfirm: async (acceptInvite: PartialExcept<RemoteClusterAcceptInvite, 'display_name' | 'invite' | 'password'>) => {
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

export const getEditLocation = (rc: RemoteCluster): LocationDescriptor<RemoteCluster> => {
    return {pathname: `/admin_console/environment/secure_connections/${rc.remote_id}`, state: rc};
};

export const getCreateLocation = (): LocationDescriptor<RemoteCluster> => {
    return {pathname: '/admin_console/environment/secure_connections/create'};
};

const SiteURLPendingPrefix = 'pending_';
export const isPending = (remoteCluster: RemoteCluster) => remoteCluster.site_url.startsWith(SiteURLPendingPrefix);
export const isConnected = (remoteCluster: RemoteCluster) => !isPending(remoteCluster);

export const isPendingState = <T extends boolean | unknown>(x: T) => x === true;
export const isErrorState = <T extends boolean | unknown>(x: T) => Boolean(typeof x !== 'boolean' && x);
