// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevel} from '@mattermost/types/client4';
import {batchActions} from 'redux-batched-actions';

import {GeneralTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {getServerVersion} from 'mattermost-redux/selectors/entities/general';
import {GetStateFunc, DispatchFunc, ActionFunc} from 'mattermost-redux/types/actions';
import {isMinimumServerVersion} from 'mattermost-redux/utils/helpers';

import {logError} from './errors';
import {bindClientFunc, forceLogoutIfNecessary, FormattedError} from './helpers';
import {loadRolesIfNeeded} from './roles';

export function getPing(): ActionFunc {
    return async () => {
        let data;
        let pingError = new FormattedError(
            'mobile.server_ping_failed',
            'Cannot connect to the server. Please check your server URL and internet connection.',
        );
        try {
            data = await Client4.ping();
            if (data.status !== 'OK') {
                // successful ping but not the right return {data}
                return {error: pingError};
            }
        } catch (error) { // ServerError
            if (error.status_code === 401) {
                // When the server requires a client certificate to connect.
                pingError = error;
            }
            return {error: pingError};
        }

        return {data};
    };
}

export function resetPing(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        dispatch({type: GeneralTypes.PING_RESET, data: {}});

        return {data: true};
    };
}

export function getClientConfig(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.getClientConfigOld();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        Client4.setEnableLogging(data.EnableDeveloper === 'true');
        Client4.setDiagnosticId(data.DiagnosticId);

        dispatch({type: GeneralTypes.CLIENT_CONFIG_RECEIVED, data});

        return {data};
    };
}

export function getDataRetentionPolicy(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.getDataRetentionPolicy();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({
                type: GeneralTypes.RECEIVED_DATA_RETENTION_POLICY,
                error,
            });
            dispatch(logError(error));
            return {error};
        }

        dispatch(batchActions([
            {type: GeneralTypes.RECEIVED_DATA_RETENTION_POLICY, data},
        ]));

        return {data};
    };
}

export function getLicenseConfig(): ActionFunc {
    return bindClientFunc({
        clientFunc: Client4.getClientLicenseOld,
        onSuccess: [GeneralTypes.CLIENT_LICENSE_RECEIVED],
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

export function setServerVersion(serverVersion: string): ActionFunc {
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

export function getRedirectLocation(url: string): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let pendingData: Promise<any>;
        if (isMinimumServerVersion(getServerVersion(getState()), 5, 3)) {
            pendingData = Client4.getRedirectLocation(url);
        } else {
            pendingData = Promise.resolve({location: url});
        }

        let data;
        try {
            data = await pendingData;
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch({type: GeneralTypes.REDIRECT_LOCATION_FAILURE, data: {error, url}});
            return {error};
        }

        dispatch({type: GeneralTypes.REDIRECT_LOCATION_SUCCESS, data: {...data, url}});
        return {data};
    };
}

export function getWarnMetricsStatus(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.getWarnMetricsStatus();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }
        dispatch({type: GeneralTypes.WARN_METRICS_STATUS_RECEIVED, data});

        return {data};
    };
}

export function setFirstAdminVisitMarketplaceStatus(): ActionFunc {
    return async (dispatch: DispatchFunc) => {
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

export function getFirstAdminVisitMarketplaceStatus(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        let data;
        try {
            data = await Client4.getFirstAdminVisitMarketplaceStatus();
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            return {error};
        }

        data = JSON.parse(data.value);
        dispatch({type: GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED, data});
        return {data};
    };
}

// accompanying "set" happens as part of Client4.completeSetup
export function getFirstAdminSetupComplete(): ActionFunc {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
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
    getPing,
    getClientConfig,
    getDataRetentionPolicy,
    getLicenseConfig,
    logClientError,
    setServerVersion,
    setUrl,
    getRedirectLocation,
    getWarnMetricsStatus,
    getFirstAdminVisitMarketplaceStatus,
};
