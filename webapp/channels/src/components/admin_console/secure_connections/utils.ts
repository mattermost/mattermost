// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {LocationDescriptor} from 'history';
import {DateTime, Interval} from 'luxon';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import type {Channel} from '@mattermost/types/channels';
import {isRemoteClusterPatch, type RemoteCluster, type RemoteClusterPatch} from '@mattermost/types/remote_clusters';
import type {SharedChannelRemote} from '@mattermost/types/shared_channels';
import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects, RelationOneToOne} from '@mattermost/types/utilities';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {getChannel as fetchChannel} from 'mattermost-redux/actions/channels';
import {Client4} from 'mattermost-redux/client';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getActiveTeamsList, getTeam} from 'mattermost-redux/selectors/entities/teams';

import type {ActionFuncAsync} from 'types/store';

export const useRemoteClusters = () => {
    const [remoteClusters, setRemoteClusters] = useState<RemoteCluster[]>();
    const [loadingState, setLoadingState] = useState<boolean | ClientError>(true);
    const {loading, error} = loadingStatus(loadingState);

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

    return [remoteClusters, {loading, fetch, error}] as const;
};

export const useRemoteClusterEdit = (remoteId: string | 'create', initRemoteCluster: RemoteCluster | undefined) => {
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
        if (currentRemoteCluster && isRemoteClusterPatch(patch)) {
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

export const useSharedChannelRemotes = (remoteId: string) => {
    const [remotes, setRemotes] = useState<RelationOneToOne<Channel, SharedChannelRemote>>();
    const [loadingState, setLoadingState] = useState<TLoadingState>(true);

    const loading = isPendingState(loadingState);
    const error = !loading && loadingState;

    const fetch = async () => {
        setLoadingState(true);
        try {
            const data = await Client4.getSharedChannelRemotes(remoteId, {include_deleted: true, include_unconfirmed: true});

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

const remoteRow = (remote: SharedChannelRemote, channel: Channel, team?: Team) => {
    return {...remote, display_name: channel.display_name, team_display_name: team?.display_name ?? ''};
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
        dispatch<ActionFuncAsync<IDMappedObjects<SharedChannelRemoteRow>>>(async (dispatch, getState) => {
            const collected: IDMappedObjects<SharedChannelRemoteRow> = {};
            const missing: SharedChannelRemote[] = [];

            try {
                const data = await Client4.getSharedChannelRemotes(remoteId, {include_unconfirmed: true, exclude_remote: opts.filter === 'home', exclude_home: opts.filter === 'remote'});
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

                // first-past, get known channels or do initial load on first not-found channel
                for (const remote of data) {
                    // eslint-disable-next-line no-await-in-loop
                    const channel = getChannel(state, remote.channel_id) ?? await getMyChannelsOnce?.(remote);

                    if (!channel) {
                        // collect all remotes with missing channels
                        missing?.push(remote);
                        continue;
                    }

                    const team = getTeam(state, channel.team_id);
                    collected[remote.id] = remoteRow(remote, channel, team);
                }

                // fetch missing channels individually
                if (missing.length) {
                    // TODO: performance; consider adding sharedchannelremotes search param to api/v4/channels
                    await Promise.allSettled(missing.map((remote) => dispatch(fetchChannel(remote.channel_id))));
                    state = getState();

                    for (const remote of missing) {
                        const channel = getChannel(state, remote.channel_id);

                        if (!channel) {
                            continue;
                        }

                        const team = getTeam(state, channel.team_id);
                        collected[remote.id] = remoteRow(remote, channel, team);
                    }
                }

                const rows = Object.values(collected);

                setSharedChannelRemotes(rows.length ? rows : undefined);
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

export const useTeamOptions = () => {
    const teams = useSelector(getActiveTeamsList);
    const teamsById = useMemo(() => teams.reduce<IDMappedObjects<Team>>((teams, team) => ({...teams, [team.id]: team}), {}), [teams]);
    return teamsById;
};

export const getEditLocation = (rc: RemoteCluster): LocationDescriptor<RemoteCluster> => {
    return {pathname: `/admin_console/site_config/secure_connections/${rc.remote_id}`, state: rc};
};

export const getCreateLocation = (): LocationDescriptor<RemoteCluster> => {
    return {pathname: '/admin_console/site_config/secure_connections/create'};
};

const SiteURLPendingPrefix = 'pending_';
export const isConfirmed = (rc: RemoteCluster) => Boolean(rc.site_url && !rc.site_url.startsWith(SiteURLPendingPrefix));
export const isConnected = (rc: RemoteCluster) => Interval.before(DateTime.now(), {minutes: 5}).contains(DateTime.fromMillis(rc.last_ping_at));

export type TLoadingState<TError extends Error = ClientError> = boolean | TError;
export const isPendingState = <T extends Error>(loadingState: TLoadingState<T>) => loadingState === true;
export const isErrorState = <T extends Error>(loadingState: TLoadingState<T>): loadingState is T => loadingState instanceof Error;

const loadingStatus = <T extends Error>(loadingState: TLoadingState<T>) => {
    const loading = isPendingState(loadingState);
    const error = isErrorState(loadingState) ? loadingState : undefined;

    return {error, loading};
};
