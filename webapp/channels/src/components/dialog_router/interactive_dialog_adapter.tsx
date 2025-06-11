// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import type {AppForm, AppField, AppCallRequest, AppFormValue} from '@mattermost/types/apps';
import type {DialogElement, DialogSubmission} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {createCallContext} from 'utils/apps';
import type EmojiMap from 'utils/emoji_map';

import type {DoAppCallResult} from 'types/apps';

type Props = {

    // Legacy InteractiveDialog props
    elements?: DialogElement[];
    title?: string;
    introductionText?: string;
    iconUrl?: string;
    submitLabel?: string;
    url?: string;
    callbackId?: string;
    state?: string;
    notifyOnCancel?: boolean;
    emojiMap?: EmojiMap;
    onExited?: () => void;
    actions: {
        submitInteractiveDialog: (submission: DialogSubmission) => Promise<any>;
    };
} & WrappedComponentProps;

class InteractiveDialogAdapter extends React.PureComponent<Props> {
    private convertToAppForm = (): AppForm => {
        const {elements, title, introductionText, iconUrl} = this.props;

        return {
            title: title || '',
            icon: iconUrl,
            header: introductionText,
            submit: {
                path: '/submit',
                expand: {},
            },
            fields: elements?.map(this.convertElement) || [],
        };
    };

    private convertElement = (element: DialogElement): AppField => {
        // Type mapping
        let type: string;
        switch (element.type) {
        case 'text':
        case 'textarea':
            type = AppFieldTypes.TEXT;
            break;
        case 'select':
            if (element.data_source === 'users') {
                type = AppFieldTypes.USER;
            } else if (element.data_source === 'channels') {
                type = AppFieldTypes.CHANNEL;
            } else {
                type = AppFieldTypes.STATIC_SELECT;
            }
            break;
        case 'bool':
            type = AppFieldTypes.BOOL;
            break;
        case 'radio':
            type = AppFieldTypes.RADIO;
            break;
        default:
            type = AppFieldTypes.TEXT;
        }

        // Handle default values
        let defaultValue: AppFormValue = element.default || null;

        // For select/radio fields, find the matching option if default is provided
        if ((element.type === 'select' || element.type === 'radio') && element.default && element.options) {
            const defaultOption = element.options.find((option) => option.value === element.default);
            if (defaultOption) {
                defaultValue = {
                    label: defaultOption.text,
                    value: defaultOption.value,
                };
            }
        }

        // For boolean fields, ensure proper boolean conversion
        if (element.type === 'bool' && element.default !== undefined) {
            defaultValue = String(element.default).toLowerCase() === 'true';
        }

        return {
            name: element.name,
            type,
            subtype: element.subtype || (element.type === 'textarea' ? 'textarea' : undefined),
            label: element.display_name,
            description: element.help_text,
            hint: element.placeholder,
            is_required: !element.optional,
            max_length: element.max_length,
            options: element.options?.map((o) => ({
                label: o.text,
                value: o.value,
            })),
            value: defaultValue,
            readonly: false,
        };
    };

    private submitAdapter = async (call: AppCallRequest): Promise<DoAppCallResult<any>> => {
        // Convert AppCallRequest back to legacy DialogSubmission format
        const legacySubmission: DialogSubmission = {
            url: this.props.url || '',
            callback_id: this.props.callbackId || '',
            state: this.props.state || '',
            submission: call.values as { [x: string]: string },
            user_id: '',
            channel_id: '',
            team_id: '',
            cancelled: false,
        };

        try {
            const result = await this.props.actions.submitInteractiveDialog(legacySubmission);

            // Convert legacy response to AppsForm format
            if (result?.data?.error || result?.data?.errors) {
                return {
                    error: {
                        type: 'error' as const,
                        text: result.data.error,
                        data: {
                            errors: result.data.errors,
                        },
                    },
                };
            }

            // Success response
            return {
                data: {
                    type: 'ok' as const,
                    text: '',
                },
            };
        } catch (error) {
            return {
                error: {
                    type: 'error' as const,
                    text: 'Submission failed',
                    data: {},
                },
            };
        }
    };

    private cancelAdapter = () => {
        if (this.props.notifyOnCancel) {
            const cancelSubmission: DialogSubmission = {
                url: this.props.url || '',
                callback_id: this.props.callbackId || '',
                state: this.props.state || '',
                cancelled: true,
                user_id: '',
                channel_id: '',
                team_id: '',
                submission: {},
            };

            this.props.actions.submitInteractiveDialog(cancelSubmission);
        }
    };

    // No-op adapters for unsupported legacy features
    private performLookupCall = async (): Promise<DoAppCallResult<any>> => {
        return {data: {type: 'ok' as const, data: {items: []}}};
    };

    private refreshOnSelect = async (): Promise<DoAppCallResult<any>> => {
        return {data: {type: 'ok' as const}};
    };

    private postEphemeralCallResponseForContext = () => {
        // No-op for legacy dialogs
    };

    render() {
        const appForm = this.convertToAppForm();

        // Create a minimal context for legacy interactive dialogs
        const context = createCallContext(
            'legacy-interactive-dialog', // app_id for legacy dialogs
            'interactive_dialog', // location
        );

        // Dynamic import of AppsFormContainer to avoid circular dependency
        return (
            <DynamicAppsFormContainer
                form={appForm}
                context={context}
                onExited={this.props.onExited || (() => {})}
                onHide={this.cancelAdapter}
                actions={{
                    doAppSubmit: this.submitAdapter,
                    doAppFetchForm: this.refreshOnSelect,
                    doAppLookup: this.performLookupCall,
                    postEphemeralCallResponseForContext: this.postEphemeralCallResponseForContext,
                }}
            />
        );
    }
}

// Dynamic wrapper component for AppsFormContainer to avoid circular dependency
const DynamicAppsFormContainer: React.FC<any> = (props) => {
    const [AppsFormContainer, setAppsFormContainer] = React.useState<React.ComponentType<any> | null>(null);

    React.useEffect(() => {
        const loadComponent = async () => {
            const {default: Component} = await import('components/apps_form/apps_form_container');
            setAppsFormContainer(() => Component);
        };
        loadComponent();
    }, []);

    if (!AppsFormContainer) {
        return null; // Loading state
    }

    return <AppsFormContainer {...props} />;
};

export default injectIntl(InteractiveDialogAdapter);