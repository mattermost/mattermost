// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {Post} from '@mattermost/types/posts';
import type {NameMappedPropertyFields, PropertyValue} from '@mattermost/types/properties';
import type {Team} from '@mattermost/types/teams';

import {TeamTypes, ContentFlaggingTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {forceLogoutIfNecessary} from 'mattermost-redux/actions/helpers';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';
import {DelayedDataLoader} from 'mattermost-redux/utils/data_loader';

export type ContentFlaggingChannelRequestIdentifier = {
    channelId?: string;
    flaggedPostId?: string;
}

export type ContentFlaggingTeamRequestIdentifier = {
    teamId?: string;
    flaggedPostId?: string;
}

function channelComparator(a: ContentFlaggingChannelRequestIdentifier, b: ContentFlaggingChannelRequestIdentifier) {
    return a.channelId === b.channelId;
}

function teamComparator(a: ContentFlaggingTeamRequestIdentifier, b: ContentFlaggingTeamRequestIdentifier) {
    return a.teamId === b.teamId;
}

export function getTeamContentFlaggingStatus(teamId: string): ActionFuncAsync<{enabled: boolean}> {
    return async (dispatch, getState) => {
        let response;

        try {
            response = await Client4.getTeamContentFlaggingStatus(teamId);

            dispatch({
                type: TeamTypes.RECEIVED_CONTENT_FLAGGING_STATUS,
                data: {
                    teamId,
                    status: response.enabled,
                },
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: response};
    };
}

export function getContentFlaggingConfig(teamId?: string): ActionFuncAsync<ContentFlaggingConfig> {
    return async (dispatch, getState) => {
        let response;

        try {
            response = await Client4.getContentFlaggingConfig(teamId);

            dispatch({
                type: ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_CONFIG,
                data: response,
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: response};
    };
}

export function getPostContentFlaggingFields(): ActionFuncAsync<NameMappedPropertyFields> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getPostContentFlaggingFields();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_FIELDS,
            data,
        });

        return {data};
    };
}

export function loadPostContentFlaggingFields(): ActionFuncAsync<NameMappedPropertyFields> {
    // Use data loader and fetch data to manage multiple, simultaneous dispatches
    return async (dispatch, getState, {loaders}: any) => {
        if (!loaders.postContentFlaggingFieldsLoader) {
            loaders.postContentFlaggingFieldsLoader = new DelayedDataLoader<NameMappedPropertyFields>({
                fetchBatch: () => dispatch(getPostContentFlaggingFields()),
                maxBatchSize: 1,
                wait: 200,
            });
        }

        const loader = loaders.postContentFlaggingFieldsLoader;
        loader.queue([true]);

        return {};
    };
}

function getFlaggedPost(flaggedPostId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getFlaggedPost(flaggedPostId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ContentFlaggingTypes.RECEIVED_FLAGGED_POST,
            data,
        });

        return {data};
    };
}

export function loadFlaggedPost(flaggedPostId: string): ActionFuncAsync<Post> {
    return async (dispatch, getState, {loaders}: any) => {
        if (!loaders.flaggedPostLoader) {
            loaders.flaggedPostLoader = new DelayedDataLoader<Post['id']>({
                fetchBatch: ([postId]) => dispatch(getFlaggedPost(postId)),
                maxBatchSize: 1,
                wait: 200,
            });
        }

        const loader = loaders.flaggedPostLoader as DelayedDataLoader<Post['id']>;
        loader.queue([flaggedPostId]);
        return {};
    };
}

function getContentFlaggingChannel(channelId: string, flaggedPostId: string): ActionFuncAsync<Channel> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getChannel(channelId, true, flaggedPostId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_CHANNEL,
            data,
        });

        return {data};
    };
}

export function loadContentFlaggingChannel(identifier: ContentFlaggingChannelRequestIdentifier): ActionFuncAsync<Channel> {
    return async (dispatch, getState, {loaders}: any) => {
        if (!loaders.contentFlaggingChannelLoader) {
            loaders.contentFlaggingChannelLoader =
                new DelayedDataLoader<ContentFlaggingChannelRequestIdentifier>({
                    fetchBatch: ([{flaggedPostId, channelId}]) => {
                        if (channelId && flaggedPostId) {
                            return dispatch(getContentFlaggingChannel(channelId, flaggedPostId));
                        }

                        return Promise.resolve(null);
                    },
                    maxBatchSize: 1,
                    wait: 200,
                    comparator: channelComparator,
                });
        }

        const loader = loaders.contentFlaggingChannelLoader as DelayedDataLoader<ContentFlaggingChannelRequestIdentifier>;
        loader.queue([identifier]);

        return {};
    };
}

function getContentFlaggingTeam(teamId: string, flaggedPostId: string): ActionFuncAsync<Team> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getTeam(teamId, true, flaggedPostId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({
            type: ContentFlaggingTypes.RECEIVED_CONTENT_FLAGGING_TEAM,
            data,
        });

        return {data};
    };
}

export function loadContentFlaggingTeam(identifier: ContentFlaggingTeamRequestIdentifier): ActionFuncAsync<Team> {
    return async (dispatch, getState, {loaders}: any) => {
        if (!loaders.contentFlaggingTeamLoader) {
            loaders.contentFlaggingTeamLoader =
                new DelayedDataLoader<ContentFlaggingTeamRequestIdentifier>({
                    fetchBatch: ([{flaggedPostId, teamId}]) => {
                        if (teamId && flaggedPostId) {
                            return dispatch(getContentFlaggingTeam(teamId, flaggedPostId));
                        }

                        return Promise.resolve(null);
                    },
                    maxBatchSize: 1,
                    wait: 200,
                    comparator: teamComparator,
                });
        }

        const loader = loaders.contentFlaggingTeamLoader as DelayedDataLoader<ContentFlaggingTeamRequestIdentifier>;
        loader.queue([identifier]);

        return {};
    };
}

export function getPostContentFlaggingValues(postId: string): ActionFuncAsync<Array<PropertyValue<unknown>>> {
    return async (dispatch, getState) => {
        let response;

        try {
            response = await Client4.getPostContentFlaggingValues(postId);

            dispatch({
                type: ContentFlaggingTypes.RECEIVED_POST_CONTENT_FLAGGING_VALUES,
                data: {
                    postId,
                    values: response,
                },
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: response};
    };
}
