// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {serializeError} from 'serialize-error';
import type {ErrorObject} from 'serialize-error';

import {LogLevel} from '@mattermost/types/client4';
import type {ServerError} from '@mattermost/types/errors';
import type {GlobalState} from '@mattermost/types/store';

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

export type LogErrorOptions = {

    /**
     * errorBarMode controls how and when the error bar is shown for this error.
     *
     * If unspecified, this defaults to DontShow.
     */
    errorBarMode?: LogErrorBarMode;
};

export enum LogErrorBarMode {

    /**
     * Always show the error bar for this error.
     */
    Always = 'Always',

    /**
     * Never show the error bar for this error.
     */
    Never = 'Never',

    /**
     * Only shows the error bar if Developer Mode is enabled, and the message displayed will tell the user to check the
     * JS console for more information.
     */
    InDevMode = 'InDevMode',
}

export function logError(error: ServerError, options: LogErrorOptions = {}): ActionFuncAsync<boolean> {
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

        if (options && options.errorBarMode === LogErrorBarMode.InDevMode) {
            serializedError.message = 'A JavaScript error has occurred. Please use the JavaScript console to capture and report the error';
        }

        dispatch(getLogErrorAction(serializedError, shouldShowErrorBar(getState(), options)));

        return {data: true};
    };
}

export function shouldShowErrorBar(state: GlobalState, options: LogErrorOptions) {
    if (options && options.errorBarMode === LogErrorBarMode.Always) {
        return true;
    }

    if (options && options.errorBarMode === LogErrorBarMode.InDevMode) {
        const isDevMode = state.entities.general.config?.EnableDeveloper === 'true';
        return isDevMode;
    }

    return false;
}

export function clearErrors() {
    return {
        type: ErrorTypes.CLEAR_ERRORS,
        data: null,
    };
}
