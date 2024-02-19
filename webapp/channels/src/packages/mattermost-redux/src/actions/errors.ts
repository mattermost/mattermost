// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {serializeError} from 'serialize-error';
import type {ErrorObject} from 'serialize-error';

import {LogLevel} from '@mattermost/types/client4';
import type {ServerError} from '@mattermost/types/errors';

import {ErrorTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

export function dismissError(index: number) {
    return {
        type: ErrorTypes.DISMISS_ERROR,
        index,
        data: null,
    };
}

export function getLogErrorAction(error: ErrorObject, displayable = false) {
    return {
        type: ErrorTypes.LOG_ERROR,
        displayable,
        error,
        data: null,
    };
}

export function logError(error: ServerError, displayable = false, consoleError = false): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        if (error.server_error_id === 'api.context.session_expired.app_error') {
            return {data: true};
        }

        let sendToServer = true;

        const message = error.stack || '';
        if (message.includes('TypeError: Failed to fetch')) {
            sendToServer = false;
        }
        if (error.server_error_id) {
            sendToServer = false;
        }

        const serializedError = serializeError(error);

        if (sendToServer) {
            try {
                const stringifiedSerializedError = JSON.stringify(serializedError).toString();
                await Client4.logClientError(stringifiedSerializedError, LogLevel.Debug);
            } catch (err) {
                // avoid crashing the app if an error sending "the error" occurs.
            }
        }

        if (consoleError) {
            serializedError.message = 'A JavaScript error has occurred. Please use the JavaScript console to capture and report the error';
        }

        const isDevMode = getState()?.entities.general?.config?.EnableDeveloper === 'true';
        let shouldDisplay = displayable;

        // Display announcements bar if error is a developer error and we are in dev mode
        if (isDevMode && error.type === 'developer') {
            shouldDisplay = true;
        }

        dispatch(getLogErrorAction(serializedError, shouldDisplay));

        return {data: true};
    };
}

export function clearErrors() {
    return {
        type: ErrorTypes.CLEAR_ERRORS,
        data: null,
    };
}
