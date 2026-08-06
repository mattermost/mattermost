// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';
import type {AnyAction} from 'redux';

import type {AppCallResponse, AppForm, AppCallRequest, AppContext} from '@mattermost/types/apps';

import {Client4} from 'mattermost-redux/client';
import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';
import {cleanForm} from 'mattermost-redux/utils/apps';

import {openModal} from 'actions/views/modals';

import AppsForm from 'components/apps_form';

import {makeCallErrorResponse} from 'utils/apps';
import {getHistory} from 'utils/browser_history';
import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';

import type {DoAppCallResult} from 'types/apps';
import type {ThunkActionFunc} from 'types/store';

import {sendEphemeralPost} from './global_actions';

export function doAppSubmit<Res=unknown>(inCall: AppCallRequest, intl: IntlShape): ThunkActionFunc<Promise<DoAppCallResult<Res>>> {
    return async () => {
        try {
            const call: AppCallRequest = {
                ...inCall,
                context: {
                    ...inCall.context,
                    track_as_submit: true,
                },
            };
            const res = await Client4.executeAppCall(call, true) as AppCallResponse<Res>;
            const responseType = res.type || AppCallResponseTypes.OK;

            switch (responseType) {
            case AppCallResponseTypes.OK:
                return {data: res};
            case AppCallResponseTypes.ERROR:
                return {error: res};
            case AppCallResponseTypes.FORM:
                if (!res.form?.submit) {
                    const errMsg = intl.formatMessage({
                        id: 'apps.error.responses.form.no_form',
                        defaultMessage: 'Response type is `form`, but no form was included in response.',
                    });
                    return {error: makeCallErrorResponse(errMsg)};
                }

                cleanForm(res.form);
                return {data: res};

            case AppCallResponseTypes.NAVIGATE: {
                if (!res.navigate_to_url) {
                    const errMsg = intl.formatMessage({
                        id: 'apps.error.responses.navigate.no_url',
                        defaultMessage: 'Response type is `navigate`, but no url was included in response.',
                    });
                    return {error: makeCallErrorResponse(errMsg)};
                }
                if (shouldOpenInNewTab(res.navigate_to_url, getSiteURL())) {
                    window.open(res.navigate_to_url);
                    return {data: res};
                }
                const navigateURL = res.navigate_to_url.startsWith(getSiteURL()) ? res.navigate_to_url.slice(getSiteURL().length) : res.navigate_to_url;
                getHistory().push(navigateURL);
                return {data: res};
            }
            default: {
                const errMsg = intl.formatMessage({
                    id: 'apps.error.responses.unknown_type',
                    defaultMessage: 'App response type not supported. Response type: {type}.',
                }, {type: responseType});
                return {error: makeCallErrorResponse(errMsg)};
            }
            }
        } catch (error: any) {
            const errMsg = error.message || intl.formatMessage({
                id: 'apps.error.responses.unexpected_error',
                defaultMessage: 'Received an unexpected error.',
            });
            return {error: makeCallErrorResponse(errMsg)};
        }
    };
}

export function doAppFetchForm<Res=unknown>(call: AppCallRequest, intl: any): ThunkActionFunc<Promise<DoAppCallResult<Res>>> {
    return async () => {
        try {
            const res = await Client4.executeAppCall(call, false) as AppCallResponse<Res>;
            const responseType = res.type || AppCallResponseTypes.OK;

            switch (responseType) {
            case AppCallResponseTypes.ERROR:
                return {error: res};
            case AppCallResponseTypes.FORM:
                if (!res.form?.submit) {
                    const errMsg = intl.formatMessage({
                        id: 'apps.error.responses.form.no_form',
                        defaultMessage: 'Response type is `form`, but no form was included in response.',
                    });
                    return {error: makeCallErrorResponse(errMsg)};
                }
                cleanForm(res.form);
                return {data: res};
            default: {
                const errMsg = intl.formatMessage({
                    id: 'apps.error.responses.unknown_type',
                    defaultMessage: 'App response type not supported. Response type: {type}.',
                }, {type: responseType});
                return {error: makeCallErrorResponse(errMsg)};
            }
            }
        } catch (error: any) {
            const errMsg = error.message || intl.formatMessage({
                id: 'apps.error.responses.unexpected_error',
                defaultMessage: 'Received an unexpected error.',
            });
            return {error: makeCallErrorResponse(errMsg)};
        }
    };
}

export function doAppLookup<Res=unknown>(call: AppCallRequest, intl: any): ThunkActionFunc<Promise<DoAppCallResult<Res>>> {
    return async () => {
        try {
            const res = await Client4.executeAppCall(call, false) as AppCallResponse<Res>;
            const responseType = res.type || AppCallResponseTypes.OK;

            switch (responseType) {
            case AppCallResponseTypes.OK:
                return {data: res};
            case AppCallResponseTypes.ERROR:
                return {error: res};

            default: {
                const errMsg = intl.formatMessage({
                    id: 'apps.error.responses.unknown_type',
                    defaultMessage: 'App response type not supported. Response type: {type}.',
                }, {type: responseType});
                return {error: makeCallErrorResponse(errMsg)};
            }
            }
        } catch (error: any) {
            const errMsg = error.message || intl.formatMessage({
                id: 'apps.error.responses.unexpected_error',
                defaultMessage: 'Received an unexpected error.',
            });
            return {error: makeCallErrorResponse(errMsg)};
        }
    };
}

export function openAppsModal(form: AppForm, context: AppContext): AnyAction {
    return openModal({
        modalId: ModalIdentifiers.APPS_MODAL,
        dialogType: AppsForm,
        dialogProps: {
            form,
            appContext: context,
        },
    });
}

export function postEphemeralCallResponseForContext(response: AppCallResponse, message: string, context: AppContext) {
    return sendEphemeralPost(
        message,
        context.channel_id,
        context.root_id || context.post_id,
        response.app_metadata?.bot_user_id,
    );
}
