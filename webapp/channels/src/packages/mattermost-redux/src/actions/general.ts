// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {LogLevel} from '@mattermost/types/client4';
import type {ClientConfig} from '@mattermost/types/config';
import type {SystemSetting} from '@mattermost/types/general';

import {AppsTypes, GeneralTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';
import {loadRolesIfNeeded} from './roles';

export function getClientConfig(): ActionFuncAsync<ClientConfig> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getClientConfigOld();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        Client4.setEnableLogging(data.EnableDeveloper === 'true');
        Client4.setDiagnosticId(data.DiagnosticId);

        const type = data.AppsPluginEnabled === 'true' ? AppsTypes.APPS_PLUGIN_ENABLED : AppsTypes.APPS_PLUGIN_DISABLED;
        const actions = [{type: GeneralTypes.CLIENT_CONFIG_RECEIVED, data}, {type}];
        dispatch(batchActions(actions));

        return {data};
    };
}

export function getLicenseConfig() {
    return bindClientFunc({
        clientFunc: Client4.getClientLicenseOld,
        onSuccess: [GeneralTypes.CLIENT_LICENSE_RECEIVED],
    });
}

export function getCustomProfileAttributeFields() {
    return bindClientFunc({
        clientFunc: Client4.getCustomProfileAttributeFields,
        onSuccess: [GeneralTypes.CUSTOM_PROFILE_ATTRIBUTES_RECEIVED],
    });
}

export function getCustomProfileAttributeValues(userID: string) {
    return async () => {
        let data;
        try {
            data = await Client4.getUserCustomProfileAttributesValues(userID);
        } catch (error) {
            return {error};
        }
        return {data};
    };
}

export function logClientError(message: string, level = LogLevel.Error) {
    return bindClientFunc({
        clientFunc: Client4.logClientError,
        onRequest: GeneralTypes.LOG_CLIENT_ERROR_REQUEST,
        onSuccess: GeneralTypes.LOG_CLIENT_ERROR_SUCCESS,
        onFailure: GeneralTypes.LOG_CLIENT_ERROR_FAILURE,
        params: [
            message,
            level,
        ],
    });
}

export function setServerVersion(serverVersion: string): ActionFuncAsync {
    return async (dispatch) => {
        dispatch({type: GeneralTypes.RECEIVED_SERVER_VERSION, data: serverVersion});
        dispatch(loadRolesIfNeeded([]));

        return {data: true};
    };
}

export function setUrl(url: string) {
    Client4.setUrl(url);
    return true;
}

export function setFirstAdminVisitMarketplaceStatus(): ActionFuncAsync {
    return async (dispatch) => {
        try {
            await Client4.setFirstAdminVisitMarketplaceStatus();
        } catch (e) {
            dispatch(logError(e));
            return {error: e.message};
        }
        dispatch({type: GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED, data: true});
        return {data: true};
    };
}

// accompanying "set" happens as part of Client4.completeSetup
export function getFirstAdminSetupComplete(): ActionFuncAsync<SystemSetting> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getFirstAdminSetupComplete();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        data = JSON.parse(data.value);
        dispatch({type: GeneralTypes.FIRST_ADMIN_COMPLETE_SETUP_RECEIVED, data});
        return {data};
    };
}

export default {
    getClientConfig,
    getLicenseConfig,
    getCustomProfileAttributeFields,
    logClientError,
    setServerVersion,
    setUrl,
};
