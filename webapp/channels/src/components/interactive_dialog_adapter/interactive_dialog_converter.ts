// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppForm, AppField, AppFormValues, AppFormValue, AppSelectOption} from '@mattermost/types/apps';
import type {Dialog, DialogElement, SubmitDialogResponse} from '@mattermost/types/integrations';

// Extended Dialog type using intersection types - makes callback_id required and adds adapter-specific properties
type ExtendedDialog = Omit<Dialog, 'callback_id'> & {
    callback_id: string; // Override to make required
    url?: string; // Adapter-specific: webhook URL for submission
    trigger_id?: string; // Adapter-specific: dialog trigger tracking
};

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

export class InteractiveDialogConverter {
    /**
     * Convert Interactive Dialog to Apps Form
     */
    static dialogToAppForm(dialog: ExtendedDialog): AppForm {
        if (!dialog || !dialog.title) {
            throw new Error('Invalid dialog: missing required title');
        }

        return {
            title: dialog.title,
            header: dialog.introduction_text,
            icon: dialog.icon_url,
            submit_buttons: dialog.submit_label || 'Submit',
            cancel_button: true,
            submit_on_cancel: dialog.notify_on_cancel,
            fields: dialog.elements?.map(this.dialogElementToAppField) || [],
        };
    }

    /**
     * Convert Dialog Element to App Field
     */
    static dialogElementToAppField(element: DialogElement): AppField {
        if (!element?.name?.trim() || !element?.display_name?.trim() || !element?.type?.trim()) {
            throw new Error('Invalid dialog element: missing required fields (name, display_name, type)');
        }

        // Additional validation
        if (element.name.length > 64) {
            throw new Error(`Dialog element name too long: ${element.name.length} > 64 characters`);
        }
        let value: AppFormValue = element.default || null;
        if (element.default && element.options && element.type === 'select') {
            if (element.multiselect) {
                // Handle multiselect defaults (comma-separated values)
                const defaultValues = element.default.split(',').map((v) => v.trim());
                const matchedOptions = element.options.filter(
                    (option) => defaultValues.includes(option.value),
                ).map((option) => ({label: option.text, value: option.value}));
                value = matchedOptions.length > 0 ? matchedOptions : null;
            } else {
                // Handle single select defaults
                const defaultOption = element.options.find(
                    (option) => option.value === element.default,
                );
                value = defaultOption ? {label: defaultOption.text, value: defaultOption.value} : null;
            }
        }

        const baseField: Partial<AppField> = {
            name: element.name,
            label: element.display_name,
            description: element.help_text,
            hint: element.placeholder,
            is_required: !element.optional,
            value,
        };

        switch (element.type) {
        case 'text':
            return {
                ...baseField,
                type: AppFieldTypes.TEXT,
                subtype: element.subtype || 'text',
                min_length: element.min_length,
                max_length: element.max_length,
            } as AppField;

        case 'textarea':
            return {
                ...baseField,
                type: AppFieldTypes.TEXTAREA,
                min_length: element.min_length,
                max_length: element.max_length,
            } as AppField;

        case 'select':
            if (element.data_source === 'users') {
                return {
                    ...baseField,
                    type: AppFieldTypes.USER,
                } as AppField;
            } else if (element.data_source === 'channels') {
                return {
                    ...baseField,
                    type: AppFieldTypes.CHANNEL,
                } as AppField;
            }
            return {
                ...baseField,
                type: AppFieldTypes.STATIC_SELECT,
                options: element.options?.map((opt) => ({
                    label: opt.text,
                    value: opt.value,
                })) || [],
            } as AppField;
        case 'bool':
            return {
                ...baseField,
                type: AppFieldTypes.BOOL,
                value: element.default === 'true',
            } as AppField;

        case 'radio':
            return {
                ...baseField,
                type: AppFieldTypes.RADIO,
                options: element.options?.map((opt) => ({
                    label: opt.text,
                    value: opt.value,
                })) || [],
            } as AppField;

        default:
            // Fallback to text for unknown types (logging handled by calling code)
            return {
                ...baseField,
                type: AppFieldTypes.TEXT,
            } as AppField;
        }
    }

    /**
     * Convert Apps Form values back to Interactive Dialog submission format
     */
    static appFormToDialogSubmission(
        values: AppFormValues,
        originalDialog: ExtendedDialog,
    ): Record<string, any> {
        const submission: Record<string, any> = {};

        originalDialog.elements?.forEach((element) => {
            const value = values[element.name];

            if (value === null || value === undefined) {
                return;
            }

            // Sanitize string values to prevent XSS
            const sanitizeString = (val: unknown): string => {
                if (typeof val === 'string') {
                    return val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                }
                return String(val);
            };

            switch (element.type) {
            case 'text':
                // Handle number subtype specially for backward compatibility
                if (element.subtype === 'number') {
                    // Convert to number for backward compatibility
                    const numValue = Number(value);
                    submission[element.name] = isNaN(numValue) ? String(value) : numValue;
                } else {
                    submission[element.name] = sanitizeString(value);
                }
                break;

            case 'textarea':
                submission[element.name] = sanitizeString(value);
                break;

            case 'bool':
                submission[element.name] = Boolean(value);
                break;

            case 'radio':
                submission[element.name] = sanitizeString(value);
                break;

            case 'select':
                // if (element.multiselect && Array.isArray(value)) {
                //     // Handle multiselect - extract array of values
                //     submission[element.name] = value.map((item: AppSelectOption) => item.value);
                // } else if (element.data_source === 'users' || element.data_source === 'channels') {
                if (element.data_source === 'users' || element.data_source === 'channels') {
                    // Extract value from single AppSelectOption
                    submission[element.name] = typeof value === 'object' && value !== null ?
                        (value as AppSelectOption).value :
                        sanitizeString(value);
                } else {
                    // Static single select
                    submission[element.name] = typeof value === 'object' && value !== null ?
                        (value as AppSelectOption).value :
                        sanitizeString(value);
                }
                break;

            default:
                submission[element.name] = sanitizeString(value);
            }
        });

        return submission;
    }

    /**
     * Convert Dialog response back to Apps Form response format
     */
    static dialogResponseToAppFormResponse(response: SubmitDialogResponse): any {
        if (response.error) {
            return {
                data: {
                    errors: {
                        form: response.error,
                    },
                },
            };
        }

        if (response.errors) {
            return {
                data: {
                    errors: response.errors,
                },
            };
        }

        // Success response
        return {
            data: {},
        };
    }
}
