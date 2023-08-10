// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';
import {cleanForm} from 'mattermost-redux/utils/apps';

import {openModal} from 'actions/views/modals';

import AppsForm from 'components/apps_form';

import {createCallRequest, makeCallErrorResponse} from 'utils/apps';
import {getHistory} from 'utils/browser_history';
import {ModalIdentifiers} from 'utils/constants';
import {getSiteURL, shouldOpenInNewTab} from 'utils/url';

import {sendEphemeralPost} from './global_actions';

import type {AppCallResponse, AppForm, AppCallRequest, AppContext, AppBinding} from '@mattermost/types/apps';
import type {CommandArgs} from '@mattermost/types/integrations';
import type {Post} from '@mattermost/types/posts';
import type {Action, ActionFunc, DispatchFunc} from 'mattermost-redux/types/actions';

export function handleBindingClick<Res=unknown>(binding: AppBinding, context: AppContext, intl: any): ActionFunc {
    return async (dispatch: DispatchFunc) => {
        // Fetch form
        let form = binding.form;
        if (form?.source) {
            const callRequest = createCallRequest(form.source, context);
            const res = await dispatch(doAppFetchForm<Res>(callRequest, intl));
            if (res.error) {
                return res;
            }
            form = res.data.form;
        }

        // Open form
        if (form) {
            // This should come properly formed, but using preventive checks
            if (!form?.submit) {
                const errMsg = intl.formatMessage({
                    id: 'apps.error.malformed_binding',
                    defaultMessage: 'This binding is not properly formed. Contact the App developer.',
                });
                return {error: makeCallErrorResponse(errMsg)};
            }

            const res: AppCallResponse = {
                type: AppCallResponseTypes.FORM,
                form,
            };
            return {data: res};
        }

        // Submit binding
        // This should come properly formed, but using preventive checks
        if (!binding.submit) {
            const errMsg = intl.formatMessage({
                id: 'apps.error.malformed_binding',
                defaultMessage: 'This binding is not properly formed. Contact the App developer.',
            });
            return {error: makeCallErrorResponse(errMsg)};
        }

        const callRequest = createCallRequest(
            binding.submit,
            context,
        );

        const res = await dispatch(doAppSubmit<Res>(callRequest, intl));
        return res;
    };
}

export function doAppSubmit<Res=unknown>(inCall: AppCallRequest, intl: any): ActionFunc {
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
                        defaultMessage: 'Response type is `form`, but no valid form was included in response.',
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
                const navigateURL = res.navigate_to_url.startsWith(getSiteURL()) ?
                    res.navigate_to_url.slice(getSiteURL().length) :
                    res.navigate_to_url;
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

export function doAppFetchForm<Res=unknown>(call: AppCallRequest, intl: any): ActionFunc {
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
                        defaultMessage: 'Response type is `form`, but no valid form was included in response.',
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

export function doAppLookup<Res=unknown>(call: AppCallRequest, intl: any): ActionFunc {
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

export function makeFetchBindings(location: string): (channelId: string, teamId: string) => ActionFunc {
    return (channelId: string, teamId: string): ActionFunc => {
        return async () => {
            try {
                const allBindings = await Client4.getAppsBindings(channelId, teamId);
                const headerBindings = allBindings.filter((b) => b.location === location);
                const bindings = headerBindings.reduce((accum: AppBinding[], current: AppBinding) => accum.concat(current.bindings || []), []);
                return {data: bindings};
            } catch {
                return {data: []};
            }
        };
    };
}

export function openAppsModal(form: AppForm, context: AppContext): Action {
    return openModal({
        modalId: ModalIdentifiers.APPS_MODAL,
        dialogType: AppsForm,
        dialogProps: {
            form,
            context,
        },
    });
}

export function postEphemeralCallResponseForPost(response: AppCallResponse, message: string, post: Post): ActionFunc {
    return sendEphemeralPost(
        message,
        post.channel_id,
        post.root_id || post.id,
        response.app_metadata?.bot_user_id,
    );
}

export function postEphemeralCallResponseForChannel(response: AppCallResponse, message: string, channelID: string): ActionFunc {
    return sendEphemeralPost(
        message,
        channelID,
        '',
        response.app_metadata?.bot_user_id,
    );
}

export function postEphemeralCallResponseForContext(response: AppCallResponse, message: string, context: AppContext): ActionFunc {
    return sendEphemeralPost(
        message,
        context.channel_id,
        context.root_id || context.post_id,
        response.app_metadata?.bot_user_id,
    );
}

export function postEphemeralCallResponseForCommandArgs(response: AppCallResponse, message: string, args: CommandArgs): ActionFunc {
    return sendEphemeralPost(
        message,
        args.channel_id,
        args.root_id,
        response.app_metadata?.bot_user_id,
    );
}
