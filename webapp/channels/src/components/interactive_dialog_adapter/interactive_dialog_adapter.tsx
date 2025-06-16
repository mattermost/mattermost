// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';
import {useSelector} from 'react-redux';

import type {AppForm, AppFormValues, AppField, AppLookupResponse, FormResponseData} from '@mattermost/types/apps';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {AppsForm} from 'components/apps_form/apps_form_component';

import type {DoAppCallResult} from 'types/apps';

import {InteractiveDialogConverter} from './interactive_dialog_converter';

// Note: These types are not exported from @mattermost/types/integrations,
// so we define them locally for the adapter
type OpenDialogRequest = {
    trigger_id: string;
    url: string;
    dialog: any; // Will use the Dialog type from converter
};

type SubmitDialogRequest = {
    type: string;
    url?: string;
    callback_id: string;
    state?: string;
    user_id: string;
    channel_id: string;
    team_id: string;
    submission: Record<string, any>;
    cancelled: boolean;
};

type SubmitDialogResponse = {
    error?: string;
    errors?: {[field: string]: string};
    data?: {
        error?: string;
        errors?: {[field: string]: string};
    };
};

interface Props extends WrappedComponentProps {
    dialogRequest: OpenDialogRequest;
    onExited: () => void;
    onHide?: () => void;
    actions: {
        submitInteractiveDialog: (request: SubmitDialogRequest) => Promise<SubmitDialogResponse>;
    };
}

function InteractiveDialogAdapter({
    dialogRequest,
    onExited,
    actions,
    intl,
}: Props) {
    const currentUserId = useSelector(getCurrentUserId);
    const currentChannelId = useSelector(getCurrentChannelId);
    const currentTeamId = useSelector(getCurrentTeamId);

    // Convert Interactive Dialog to Apps Form
    const appForm: AppForm = InteractiveDialogConverter.dialogToAppForm(dialogRequest.dialog);

    // Create adapter actions that convert back to Interactive Dialog format
    const adapterActions = {
        submit: useCallback(async ({values}: {values: AppFormValues}): Promise<DoAppCallResult<FormResponseData>> => {
            // Convert Apps Form submission back to Interactive Dialog format
            const dialogSubmission = InteractiveDialogConverter.appFormToDialogSubmission(
                values,
                dialogRequest.dialog,
            );

            const submitRequest: SubmitDialogRequest = {
                type: 'dialog_submission',
                url: dialogRequest.url,
                callback_id: dialogRequest.dialog.callback_id,
                state: dialogRequest.dialog.state,
                submission: dialogSubmission,
                cancelled: false,
                user_id: currentUserId,
                channel_id: currentChannelId,
                team_id: currentTeamId,
            };

            try {
                // Submit using original Interactive Dialog API
                const result = await actions.submitInteractiveDialog(submitRequest);

                // Handle server-side validation errors from the response data (like original dialog)
                if (result?.data?.error || result?.data?.errors) {
                    return {
                        error: {
                            type: 'error' as const,
                            text: result.data.error || 'Submission failed with validation errors',
                            data: {
                                errors: result.data.errors || {},
                            },
                        },
                    };
                }

                // Handle direct errors from the response (network/API errors)
                if (result?.error) {
                    return {
                        error: {
                            text: result.error,
                            type: AppCallResponseTypes.ERROR,
                            data: {
                                errors: result.errors || {},
                            },
                        },
                    };
                }

                return {
                    data: {
                        type: AppCallResponseTypes.OK,
                    },
                };
            } catch (error) {
                return {
                    error: {
                        type: AppCallResponseTypes.ERROR,
                        text: 'Failed to submit dialog',
                        data: {
                            errors: {
                                form: String(error),
                            },
                        },
                    },
                };
            }
        }, [dialogRequest, actions, currentUserId, currentChannelId, currentTeamId]),

        /* eslint-disable @typescript-eslint/no-unused-vars */
        performLookupCall: useCallback(async (
            _appField: AppField,
            _appValues: AppFormValues,
            _userInput: string,
        ): Promise<DoAppCallResult<AppLookupResponse>> => {
            // Interactive Dialogs don't support lookup calls, return empty results
            return {
                data: {
                    type: AppCallResponseTypes.OK,
                    data: {
                        items: [],
                    } as AppLookupResponse,
                },
            };
        }, []),

        refreshOnSelect: useCallback(async (
            _appField: AppField,
            _appValues: AppFormValues,
        ): Promise<DoAppCallResult<FormResponseData>> => {
            // Interactive Dialogs don't support refresh on select, return no changes
            return {
                data: {
                    type: AppCallResponseTypes.OK,
                    data: {} as FormResponseData,
                },
            };
        }, []),
        /* eslint-enable @typescript-eslint/no-unused-vars */
    };

    const handleHide = () => {
        // const {url, callbackId, state, notifyOnCancel} = props;

        if (dialogRequest.dialog.notify_on_cancel) {
            const dialog: SubmitDialogRequest = {
                type: 'dialog_submission',
                url: dialogRequest.url,
                callback_id: dialogRequest.dialog.callback_id,
                state: dialogRequest.dialog.state,
                cancelled: true,
                user_id: '',
                channel_id: '',
                team_id: '',
                submission: {},
            };

            actions.submitInteractiveDialog(dialog);
        }
    };

    // Render Apps Form with converted data and adapter actions
    return (
        <AppsForm
            form={appForm}
            onExited={onExited}
            onHide={handleHide}
            actions={adapterActions}
            intl={intl}
        />
    );
}

export default injectIntl(InteractiveDialogAdapter);
