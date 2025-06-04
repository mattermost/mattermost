// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppCallRequest, AppField, AppForm, AppFormValues, AppSelectOption, AppLookupResponse} from '@mattermost/types/apps';
import type {DialogElement, DialogSubmission} from '@mattermost/types/integrations';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import AppsFormContainer from './apps_form/apps_form_container';

import type {PropsFromRedux} from './index';

type Props = {
    onExited?: () => void;
} & PropsFromRedux;

export default class InteractiveDialogAdapter extends React.PureComponent<Props> {
    private convertElementsToFields(elements?: DialogElement[]): AppField[] {
        if (!elements) {
            return [];
        }

        return elements.map((element) => {
            let type = element.type;
            if (element.type === 'select') {
                type = 'static_select';
                if (element.data_source === 'users') {
                    type = 'user';
                } else if (element.data_source === 'channels') {
                    type = 'channel';
                } else if (element.data_source === 'dynamic') {
                    type = 'dynamic_select';
                }
            }

            let value: string | AppSelectOption | boolean | null = element.default || '';
            if (element.default && element.options) {
                const defaultOption = element.options.find(
                    (option) => option.value === element.default,
                );
                value = defaultOption ? {label: defaultOption.text, value} : '';
            }

            const field: AppField = {
                name: element.name,
                type,
                subtype: element.subtype,
                modal_label: element.display_name,
                hint: element.placeholder,
                description: element.help_text,
                is_required: !element.optional,
                max_length: element.max_length,
                min_length: element.min_length,
                options: element.options?.map((opt) => ({
                    label: opt.text,
                    value: opt.value,
                })),
                multiselect: element.multiselect,
                readonly: false,
                value,
            };

            // Add lookup configuration for dynamic select
            if (type === 'dynamic_select') {
                field.lookup = {
                    path: element.data_source_url || this.props.url || '',
                };
                
                // Ensure the path is properly formatted for plugins
                if (field.lookup.path && !field.lookup.path.startsWith('http') && !field.lookup.path.startsWith('/')) {
                    field.lookup.path = '/' + field.lookup.path;
                }
            }

            return field;
        });
    }

    private convertToAppForm(): AppForm {
        const {
            title,
            introductionText,
            iconUrl,
            submitLabel,
            elements,
        } = this.props;

        return {
            title: title || '',
            header: introductionText || '',
            icon: iconUrl,
            submit: {
                path: this.props.url || '',
            },
            fields: this.convertElementsToFields(elements),
            submit_label: submitLabel,
        };
    }

    private handleSubmit = async (call: AppCallRequest) => {
        const {url, callbackId, state} = this.props;
        const submissionValues = call.values as AppFormValues;

        // Convert AppSelectOption values to their raw value before submission
        const processedValues = Object.entries(submissionValues).reduce((result, [key, value]) => {
            if (value && typeof value === 'object' && 'value' in value) {
                result[key] = value.value;
            } else {
                result[key] = value;
            }
            return result;
        }, {} as Record<string, any>);

        const dialog: DialogSubmission = {
            url,
            callback_id: callbackId ?? '',
            state: state ?? '',
            submission: processedValues as { [x: string]: string },
            user_id: '',
            channel_id: '',
            team_id: '',
            cancelled: false,
        };

        const response = await this.props.actions.submitInteractiveDialog(dialog);

        // Convert the response to the format expected by AppsFormContainer
        if (response?.data?.error) {
            return {
                error: {
                    text: response.data.error,
                    type: AppCallResponseTypes.ERROR,
                    data: {
                        errors: response.data.errors,
                    },
                },
            };
        }

        return {
            data: {
                type: AppCallResponseTypes.OK,
            },
        };
    };

    private handleLookup = async (call: AppCallRequest) => {
        const {url, callbackId, state} = this.props;
        const submissionValues = call.values as AppFormValues;
        
        // Get the lookup path from the call or field configuration
        let lookupPath = call.path;

        // If the field has a lookup path defined, use that instead
        if (!lookupPath && call.selected_field) {
            const field = this.props.elements?.find(element => element.name === call.selected_field);
            if (field?.data_source === 'dynamic' && field?.data_source_url) {
                lookupPath = field.data_source_url;
            }
        }

        // If still no path, fall back to the dialog URL
        if (!lookupPath) {
            lookupPath = url;
        }

        // Validate URL for security
        if (lookupPath && !lookupPath.startsWith('/') && !lookupPath.startsWith('http')) {
            return {
                error: {
                    type: AppCallResponseTypes.ERROR,
                    text: 'Invalid lookup URL format',
                },
            };
        }

        // Convert AppSelectOption values to their raw value before submission
        const processedValues = Object.entries(submissionValues).reduce((result, [key, value]) => {
            if (value && typeof value === 'object' && 'value' in value) {
                result[key] = value.value;
            } else {
                result[key] = value;
            }
            return result;
        }, {} as Record<string, any>);

        // For dynamic select, we need to make a lookup call to get options
        const dialog: DialogSubmission = {
            url: lookupPath || '',
            callback_id: callbackId ?? '',
            state: state ?? '',
            submission: processedValues as { [x: string]: string },
            user_id: '',
            channel_id: '',
            team_id: '',
            cancelled: false,
        };

        // Add the query and selected field to the submission
        if (call.query) {
            dialog.submission.query = call.query;
        }

        if (call.selected_field) {
            dialog.submission.selected_field = call.selected_field;
        }

        try {
            const response = await this.props.actions.lookupInteractiveDialog(dialog);

            // Convert the response to the format expected by AppsFormContainer
            if (response?.data?.items) {
                return {
                    data: {
                        type: AppCallResponseTypes.OK,
                        data: {
                            items: response.data.items.map((item) => ({
                                label: item.text,
                                value: item.value,
                            })),
                        },
                    },
                };
            }

            if (response?.error) {
                return {
                    error: {
                        type: AppCallResponseTypes.ERROR,
                        text: response.error,
                    },
                };
            }

            return {
                data: {
                    type: AppCallResponseTypes.OK,
                    data: {
                        items: [],
                    },
                },
            };
        } catch (error) {
            return {
                error: {
                    type: AppCallResponseTypes.ERROR,
                    text: error instanceof Error ? `Failed to perform lookup: ${error.message}` : 'Failed to perform lookup',
                },
            };
        }
    };

    private handleHide = () => {
        const {url, callbackId, state, notifyOnCancel} = this.props;

        if (notifyOnCancel) {
            const dialog: DialogSubmission = {
                url,
                callback_id: callbackId ?? '',
                state: state ?? '',
                cancelled: true,
                user_id: '',
                channel_id: '',
                team_id: '',
                submission: {},
            };

            this.props.actions.submitInteractiveDialog(dialog);
        }
    };

    render() {
        const form = this.convertToAppForm();

        return (
            <AppsFormContainer
                form={form}
                onExited={this.props.onExited}
                onHide={this.handleHide}
                context={{app_id: ''}}
                actions={{
                    doAppSubmit: this.handleSubmit,
                    doAppFetchForm: this.props.actions.doAppFetchForm,
                    doAppLookup: this.handleLookup,
                    postEphemeralCallResponseForContext: this.props.actions.postEphemeralCallResponseForContext,
                }}
            />
        );
    }
}
