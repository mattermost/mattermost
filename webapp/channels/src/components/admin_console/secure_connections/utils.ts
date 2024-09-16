// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LocationDescriptor} from 'history';
import {DateTime, Interval} from 'luxon';
import {useCallback, useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import type {StatusOK} from '@mattermost/types/client4';
import type {ServerError} from '@mattermost/types/errors';
import type {RemoteCluster, RemoteClusterAcceptInvite, RemoteClusterPatch} from '@mattermost/types/remote_clusters';
import type {SharedChannelRemote} from '@mattermost/types/shared_channels';
import type {PartialExcept, RelationOneToOne} from '@mattermost/types/utilities';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeam} from 'mattermost-redux/selectors/entities/teams';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import type {GlobalState} from 'types/store';

import SecureConnectionAcceptInviteModal from './secure_connection_accept_invite_modal';
import SecureConnectionCreateInviteModal from './secure_connection_create_invite_modal';
import SecureConnectionDeleteModal from './secure_connection_delete_modal';
import SharedChannelsAddModal from './shared_channels_add_modal';
import SharedChannelsRemoveModal from './shared_channels_remove_modal';

export const useRemoteClusters = () => {
    const [remoteClusters, setRemoteClusters] = useState<RemoteCluster[]>();
    const [loadingState, setLoadingState] = useState<boolean | ClientError>(true);
    const loading = isPendingState(loadingState);

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

    return [remoteClusters, {loading, fetch}] as const;
};

export const useRemoteClusterEdit = (remoteId: string | 'create', initRemoteCluster?: RemoteCluster) => {
    const editing = remoteId !== 'create';

    const [currentRemoteCluster, setCurrentRemoteCluster] = useState<RemoteCluster | undefined>(initRemoteCluster);
    const [patch, setPatch] = useState<Partial<RemoteClusterPatch>>({});
    const [loading, setLoading] = useState<TLoadingState>(editing && !currentRemoteCluster);
    const [saving, setSaving] = useState<TLoadingState>(false);

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
    const [saving, setSaving] = useState<TLoadingState>(false);

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
    const [saving, setSaving] = useState<TLoadingState>(false);

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

export const useSharedChannelRemotes = (remoteId: string) => {
    const [remotes, setRemotes] = useState<RelationOneToOne<Channel, SharedChannelRemote>>();
    const [loadingState, setLoadingState] = useState<TLoadingState>(true);

    const loading = isPendingState(loadingState);
    const error = !loading && loadingState;

    const fetch = async () => {
        setLoadingState(true);
        try {
            const data = await Client4.getSharedChannelRemotes(remoteId, '', true);

            setRemotes(data?.reduce<typeof remotes>((state, remote) => {
                state![remote.channel_id] = remote;

                return state;
            }, {}));
            setLoadingState(false);
        } catch (error) {
            setLoadingState(error);
        }
    };

    useEffect(() => {
        fetch();
    }, [remoteId]);

    return [remotes, {loading, error, fetch}] as const;
};

export type SharedChannelRemoteRow = SharedChannelRemote & Pick<Channel, 'display_name'> & {team_display_name: string};
export const useSharedChannelRemoteRows = (remoteId: string, opts: {filter: 'home' | 'remote' | undefined}) => {
    const [sharedChannelRemotes, setSharedChannelRemotes] = useState<SharedChannelRemoteRow[]>();
    const [loadingState, setLoadingState] = useState<TLoadingState>(true);
    const dispatch = useDispatch();

    const loading = isPendingState(loadingState);
    const error = !loading && loadingState;

    const fetch = useCallback(async () => {
        if (opts.filter === undefined) {
            // wait for a filter
            return;
        }

        setLoadingState(true);
        dispatch<ActionFuncAsync<SharedChannelRemoteRow[], GlobalState>>(async (dispatch, getState) => {
            const collected: SharedChannelRemoteRow[] = [];
            let missing: string[] = [];

            try {
                const data = await Client4.getSharedChannelRemotes(remoteId, opts.filter);
                let state = getState();
                let getMyChannelsOnce: undefined | ((remote: SharedChannelRemote) => Promise<Channel | undefined>) = async (firstNotFound: SharedChannelRemote) => {
                    const channels = await Client4.getAllTeamsChannels();
                    dispatch({
                        type: ChannelTypes.RECEIVED_ALL_CHANNELS,
                        data: channels,
                    });
                    state = getState();

                    getMyChannelsOnce = undefined; // once-only

                    // return triggering not-found remote
                    return getChannel(state, firstNotFound.channel_id);
                };

                for (const remote of data) {
                    let channel = getChannel(state, remote.channel_id);

                    if (!channel) {
                        // eslint-disable-next-line no-await-in-loop
                        channel = await getMyChannelsOnce?.(remote);

                        if (!channel) {
                            // still no channel, continue and find remaining missing channels
                            missing?.push(remote.channel_id);
                            break;
                        }
                    }

                    const team = getTeam(state, channel.team_id);
                    collected.push({...remote, display_name: channel.display_name, team_display_name: team?.display_name ?? ''});
                }

                if (missing.length) {
                    // fetch missing channels individually
                    // TODO: performance; consider adding sharedchannelremotes search param to api/v4/channels
                    await Promise.allSettled(missing.map((id) => dispatch(fetchChannel(id))));
                    missing = [];
                    state = getState();

                    // resume where we left off
                    for (const remote of data.slice(collected.length)) {
                        const channel = getChannel(state, remote.channel_id);

                        if (!channel) {
                            missing?.push(remote.channel_id);
                            continue;
                        }
                        const team = getTeam(state, channel.team_id);
                        collected.push({...remote, display_name: channel.display_name, team_display_name: team?.display_name ?? ''});
                    }
                }

                setSharedChannelRemotes(collected.length ? collected : undefined);
                setLoadingState(false);
            } catch (error) {
                setLoadingState(error);
                return {error};
            }

            return {data: collected};
        });
    }, [remoteId, opts.filter]);

    useEffect(() => {
        fetch();
    }, [remoteId, opts.filter]);

    return [sharedChannelRemotes, {loading, error, fetch}] as const;
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

export const getEditLocation = (rc: RemoteCluster): LocationDescriptor<RemoteCluster> => {
    return {pathname: `/admin_console/environment/secure_connections/${rc.remote_id}`, state: rc};
};

export const getCreateLocation = (): LocationDescriptor<RemoteCluster> => {
    return {pathname: '/admin_console/environment/secure_connections/create'};
};

const SiteURLPendingPrefix = 'pending_';
export const isConfirmed = (rc: RemoteCluster) => rc.site_url && !rc.site_url.startsWith(SiteURLPendingPrefix);
export const isConnected = (rc: RemoteCluster) => Interval.before(DateTime.now(), {minutes: 5}).contains(DateTime.fromMillis(rc.last_ping_at));

type TLoadingState<TError = ClientError> = boolean | TError;

export const isPendingState = <TError, T extends TLoadingState<TError>>(x: T) => x === true;
export const isErrorState = <TError, T extends TLoadingState<TError>>(x: T) => Boolean(!isPendingState(x) && x);

