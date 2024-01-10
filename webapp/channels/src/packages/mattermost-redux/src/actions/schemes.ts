// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {Scheme, SchemeScope, SchemePatch} from '@mattermost/types/schemes';
import type {Team} from '@mattermost/types/teams';

import {SchemeTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {NewActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';

import {General} from '../constants';

export function getScheme(schemeId: string): NewActionFuncAsync<Scheme> {
    return bindClientFunc({
        clientFunc: Client4.getScheme,
        onSuccess: [SchemeTypes.RECEIVED_SCHEME],
        params: [
            schemeId,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getSchemes(scope: SchemeScope, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<Scheme[]> {
    return bindClientFunc({
        clientFunc: Client4.getSchemes,
        onSuccess: [SchemeTypes.RECEIVED_SCHEMES],
        params: [
            scope,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function createScheme(scheme: Scheme): NewActionFuncAsync<Scheme> {
    return bindClientFunc({
        clientFunc: Client4.createScheme,
        onSuccess: [SchemeTypes.CREATED_SCHEME],
        params: [
            scheme,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function deleteScheme(schemeId: string): NewActionFuncAsync {
    return async (dispatch, getState) => {
        let data = null;
        try {
            data = await Client4.deleteScheme(schemeId);
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        dispatch({type: SchemeTypes.DELETED_SCHEME, data: {schemeId}});

        return {data};
    };
}

export function patchScheme(schemeId: string, scheme: SchemePatch): NewActionFuncAsync<Scheme> {
    return bindClientFunc({
        clientFunc: Client4.patchScheme,
        onSuccess: [SchemeTypes.PATCHED_SCHEME],
        params: [
            schemeId,
            scheme,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getSchemeTeams(schemeId: string, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<Team[]> {
    return bindClientFunc({
        clientFunc: Client4.getSchemeTeams,
        onSuccess: [SchemeTypes.RECEIVED_SCHEME_TEAMS],
        params: [
            schemeId,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}

export function getSchemeChannels(schemeId: string, page = 0, perPage: number = General.PAGE_SIZE_DEFAULT): NewActionFuncAsync<Channel[]> {
    return bindClientFunc({
        clientFunc: Client4.getSchemeChannels,
        onSuccess: [SchemeTypes.RECEIVED_SCHEME_CHANNELS],
        params: [
            schemeId,
            page,
            perPage,
        ],
    }) as any; // HARRISONTODO Type bindClientFunc
}
