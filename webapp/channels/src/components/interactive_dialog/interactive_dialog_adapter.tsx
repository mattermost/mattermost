// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppField, AppForm, AppFormValues, AppSelectOption, FormResponseData, AppLookupResponse} from '@mattermost/types/apps';
import type {DialogElement, DialogSubmission} from '@mattermost/types/integrations';

import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

import AppsFormContainer from 'components/apps_form/apps_form_container';

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
                }
            }

            let value: string | AppSelectOption | boolean | null = element.default || '';
            if (element.default && element.options) {
                const defaultOption = element.options.find(
                    (option) => option.value === element.default,
                );
                value = defaultOption ? {label: defaultOption.text, value} : '';
            }

            return {
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

    private handleSubmit = async (submission: {values: AppFormValues}) => {
        const {url, callbackId, state, notifyOnCancel} = this.props;

        // Convert AppSelectOption values to their raw value before submission
        const processedValues = Object.entries(submission.values).reduce((result, [key, value]) => {
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
                context={{}}
                actions={{
                    doAppSubmit: this.handleSubmit,
                    doAppFetchForm: this.props.actions.doAppFetchForm,
                    doAppLookup: this.props.actions.doAppLookup,
                    postEphemeralCallResponseForContext: this.props.actions.postEphemeralCallResponseForContext,
                }}
            />
        );
    }
}
