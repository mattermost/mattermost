// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {LogLevel} from '@mattermost/types/client4';
import type {ClientConfig} from '@mattermost/types/config';
import type {SystemSetting} from '@mattermost/types/general';

import {AppsTypes, GeneralTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc, ActionFuncAsync, ActionResult} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary} from './helpers';
import {loadRolesIfNeeded} from './roles';

const CLIENT_CONFIG_OVERRIDES_INITIAL_RETRY_MS = 1000;
const CLIENT_CONFIG_OVERRIDES_MAX_RETRIES = 3;

let overridesGenerationCounter = 0;
let inFlightOverridesRequest: {generation: number; promise: Promise<ActionResult<Partial<ClientConfig>>>} | null = null;
let overridesRetryTimer: ReturnType<typeof setTimeout> | null = null;

function clearOverridesRetryTimer() {
    if (overridesRetryTimer !== null) {
        clearTimeout(overridesRetryTimer);
        overridesRetryTimer = null;
    }
}

export function resetClientConfigOverridesSyncState() {
    overridesGenerationCounter++;
    inFlightOverridesRequest = null;
    clearOverridesRetryTimer();
}

export function receivedClientConfigOverrides(overrides: Partial<ClientConfig>): ActionFunc<Partial<ClientConfig>> {
    return (dispatch) => {
        overridesGenerationCounter++;
        inFlightOverridesRequest = null;
        clearOverridesRetryTimer();

        dispatch({
            type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
            data: overrides,
        });

        return {data: overrides};
    };
}

export function getClientConfigOverrides(attempt = 0): ActionFuncAsync<Partial<ClientConfig>> {
    return async (dispatch, getState) => {
        if (attempt === 0 && inFlightOverridesRequest && inFlightOverridesRequest.generation === overridesGenerationCounter) {
            return inFlightOverridesRequest.promise;
        }

        clearOverridesRetryTimer();
        const generation = ++overridesGenerationCounter;

        const requestPromise = (async (): Promise<ActionResult<Partial<ClientConfig>>> => {
            let data: Partial<ClientConfig>;
            try {
                data = await Client4.getClientConfigOverrides();
            } catch (error) {
                forceLogoutIfNecessary(error, dispatch, getState);
                if (
                    generation === overridesGenerationCounter &&
                    attempt < CLIENT_CONFIG_OVERRIDES_MAX_RETRIES &&
                    Boolean(getCurrentUserId(getState()))
                ) {
                    const delayMs = CLIENT_CONFIG_OVERRIDES_INITIAL_RETRY_MS * (2 ** attempt);
                    overridesRetryTimer = setTimeout(() => {
                        overridesRetryTimer = null;
                        if (getCurrentUserId(getState())) {
                            dispatch(getClientConfigOverrides(attempt + 1));
                        }
                    }, delayMs);
                }
                return {error};
            } finally {
                if (inFlightOverridesRequest?.generation === generation) {
                    inFlightOverridesRequest = null;
                }
            }

            if (generation === overridesGenerationCounter) {
                dispatch({
                    type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
                    data,
                });
            }

            return {data};
        })();

        inFlightOverridesRequest = {generation, promise: requestPromise};
        return requestPromise;
    };
}

export function getClientConfig(): ActionFuncAsync<ClientConfig> {
    return async (dispatch, getState) => {
        let data;
        try {
            data = await Client4.getClientConfig();
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
        onSuccess: [GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELDS_RECEIVED],
    });
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

export function checkCWSAvailability(): ActionFuncAsync {
    return async (dispatch, getState) => {
        const state = getState();
        const config = state.entities.general.config;
        const isEnterpriseReady = config.BuildEnterpriseReady === 'true';

        if (!isEnterpriseReady) {
            dispatch({type: GeneralTypes.CWS_AVAILABILITY_CHECK_SUCCESS, data: 'not_applicable'});
            return {data: 'not_applicable'};
        }

        dispatch({type: GeneralTypes.CWS_AVAILABILITY_CHECK_REQUEST});

        try {
            const response = await Client4.cwsAvailabilityCheck();
            const status = response.status;
            dispatch({type: GeneralTypes.CWS_AVAILABILITY_CHECK_SUCCESS, data: status});
            return {data: status};
        } catch {
            dispatch({type: GeneralTypes.CWS_AVAILABILITY_CHECK_FAILURE});
            return {data: 'unavailable'};
        }
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
