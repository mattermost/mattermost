// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Recap, ScheduledRecap, ScheduledRecapInput} from '@mattermost/types/recaps';

import {RecapTypes} from 'mattermost-redux/action_types';
import {logError} from 'mattermost-redux/actions/errors';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

export function createRecap(title: string, channelIds: string[], agentId: string): ActionFuncAsync<Recap> {
    return bindClientFunc({
        clientFunc: () => Client4.createRecap({title, channel_ids: channelIds, agent_id: agentId}),
        onRequest: RecapTypes.CREATE_RECAP_REQUEST,
        onSuccess: [RecapTypes.CREATE_RECAP_SUCCESS, RecapTypes.RECEIVED_RECAP],
        onFailure: RecapTypes.CREATE_RECAP_FAILURE,
    });
}

export function getRecaps(page = 0, perPage = 60): ActionFuncAsync<Recap[]> {
    return bindClientFunc({
        clientFunc: () => Client4.getRecaps(page, perPage),
        onRequest: RecapTypes.GET_RECAPS_REQUEST,
        onSuccess: [RecapTypes.GET_RECAPS_SUCCESS, RecapTypes.RECEIVED_RECAPS],
        onFailure: RecapTypes.GET_RECAPS_FAILURE,
    });
}

export function getRecap(recapId: string): ActionFuncAsync<Recap> {
    return bindClientFunc({
        clientFunc: () => Client4.getRecap(recapId),
        onRequest: RecapTypes.GET_RECAP_REQUEST,
        onSuccess: [RecapTypes.GET_RECAP_SUCCESS, RecapTypes.RECEIVED_RECAP],
        onFailure: RecapTypes.GET_RECAP_FAILURE,
    });
}

export function markRecapAsRead(recapId: string): ActionFuncAsync<Recap> {
    return bindClientFunc({
        clientFunc: () => Client4.markRecapAsRead(recapId),
        onRequest: RecapTypes.MARK_RECAP_READ_REQUEST,
        onSuccess: [RecapTypes.MARK_RECAP_READ_SUCCESS, RecapTypes.RECEIVED_RECAP],
        onFailure: RecapTypes.MARK_RECAP_READ_FAILURE,
    });
}

export function regenerateRecap(recapId: string): ActionFuncAsync<Recap> {
    return bindClientFunc({
        clientFunc: () => Client4.regenerateRecap(recapId),
        onRequest: RecapTypes.REGENERATE_RECAP_REQUEST,
        onSuccess: [RecapTypes.REGENERATE_RECAP_SUCCESS, RecapTypes.RECEIVED_RECAP],
        onFailure: RecapTypes.REGENERATE_RECAP_FAILURE,
    });
}

export function deleteRecap(recapId: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        dispatch({type: RecapTypes.DELETE_RECAP_REQUEST, data: recapId});

        try {
            await Client4.deleteRecap(recapId);

            dispatch({
                type: RecapTypes.DELETE_RECAP_SUCCESS,
                data: {recapId},
            });

            return {data: true};
        } catch (error) {
            dispatch(logError(error));
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({
                type: RecapTypes.DELETE_RECAP_FAILURE,
                error,
            });
            return {error};
        }
    };
}

// Scheduled Recap Actions

export function getScheduledRecaps(page = 0, perPage = 60): ActionFuncAsync<ScheduledRecap[]> {
    return async (dispatch, getState) => {
        dispatch({type: RecapTypes.GET_SCHEDULED_RECAPS_REQUEST});

        let data: ScheduledRecap[];
        try {
            data = await Client4.getScheduledRecaps(page, perPage);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: RecapTypes.GET_SCHEDULED_RECAPS_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: RecapTypes.RECEIVED_SCHEDULED_RECAPS, data});
        dispatch({type: RecapTypes.GET_SCHEDULED_RECAPS_SUCCESS});

        return {data};
    };
}

export function pauseScheduledRecap(id: string): ActionFuncAsync<ScheduledRecap> {
    return async (dispatch, getState) => {
        dispatch({type: RecapTypes.PAUSE_SCHEDULED_RECAP_REQUEST});

        let data: ScheduledRecap;
        try {
            data = await Client4.pauseScheduledRecap(id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: RecapTypes.PAUSE_SCHEDULED_RECAP_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: RecapTypes.RECEIVED_SCHEDULED_RECAP, data});
        dispatch({type: RecapTypes.PAUSE_SCHEDULED_RECAP_SUCCESS});

        return {data};
    };
}

export function resumeScheduledRecap(id: string): ActionFuncAsync<ScheduledRecap> {
    return async (dispatch, getState) => {
        dispatch({type: RecapTypes.RESUME_SCHEDULED_RECAP_REQUEST});

        let data: ScheduledRecap;
        try {
            data = await Client4.resumeScheduledRecap(id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: RecapTypes.RESUME_SCHEDULED_RECAP_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: RecapTypes.RECEIVED_SCHEDULED_RECAP, data});
        dispatch({type: RecapTypes.RESUME_SCHEDULED_RECAP_SUCCESS});

        return {data};
    };
}

export function deleteScheduledRecap(id: string): ActionFuncAsync {
    return async (dispatch, getState) => {
        dispatch({type: RecapTypes.DELETE_SCHEDULED_RECAP_REQUEST});

        try {
            await Client4.deleteScheduledRecap(id);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: RecapTypes.DELETE_SCHEDULED_RECAP_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: RecapTypes.DELETE_SCHEDULED_RECAP_SUCCESS, data: {id}});

        return {data: true};
    };
}

export function createScheduledRecap(input: ScheduledRecapInput): ActionFuncAsync<ScheduledRecap> {
    return async (dispatch, getState) => {
        dispatch({type: RecapTypes.CREATE_SCHEDULED_RECAP_REQUEST});

        let data: ScheduledRecap;
        try {
            data = await Client4.createScheduledRecap(input);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: RecapTypes.CREATE_SCHEDULED_RECAP_FAILURE, error});
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: RecapTypes.RECEIVED_SCHEDULED_RECAP, data});
        dispatch({type: RecapTypes.CREATE_SCHEDULED_RECAP_SUCCESS});

        return {data};
    };
}
