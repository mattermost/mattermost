// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppForm, AppField, AppFormValue, AppSelectOption, AppFormValues} from '@mattermost/types/apps';
import type {DialogElement} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {escapeHtml} from 'utils/text_formatting';

// Dialog element types (from legacy Interactive Dialog spec)
export const DialogElementTypes = {
    TEXT: 'text',
    TEXTAREA: 'textarea',
    SELECT: 'select',
    BOOL: 'bool',
    RADIO: 'radio',
} as const;

// Dialog element length limits (server-side validation constraints)
const ELEMENT_NAME_MAX_LENGTH = 300;
const ELEMENT_DISPLAY_NAME_MAX_LENGTH = 24;
const ELEMENT_HELP_TEXT_MAX_LENGTH = 150;
const TEXT_FIELD_MAX_LENGTH = 150;
const TEXTAREA_FIELD_MAX_LENGTH = 3000;

export const enum ValidationErrorCode {
    REQUIRED = 'REQUIRED',
    TOO_LONG = 'TOO_LONG',
    TOO_SHORT = 'TOO_SHORT',
    INVALID_TYPE = 'INVALID_TYPE',
    INVALID_FORMAT = 'INVALID_FORMAT',
    CONVERSION_ERROR = 'CONVERSION_ERROR',
}

export type ValidationError = {
    field: string;
    message: string;
    code: ValidationErrorCode;
};

export type ConversionOptions = {

    // Enhanced mode enables stricter validation and error handling
    // When false: Legacy mode with minimal validation (backwards compatible)
    // When true: Enhanced mode with full validation and blocking errors
    // TODO: Default to true in v11/v12 and eventually remove this option
    enhanced: boolean;
};

export type ConversionResult = {
    form: AppForm;
    errors: ValidationError[];
};

/**
 * Sanitize string input to prevent XSS attacks (only for HTML content)
 */
export function sanitizeString(input: unknown): string {
    return escapeHtml(String(input));
}

/**
 * Validate individual dialog element (logs warnings but doesn't block)
 */
export function validateDialogElement(element: DialogElement, index: number, options: ConversionOptions): ValidationError[] {
    const errors: ValidationError[] = [];
    const fieldPrefix = `elements[${index}]`;
    const elementName = element.name || `element_${index}`;

    // Required field validation
    if (!element.name?.trim()) {
        errors.push({
            field: `${fieldPrefix}.name`,
            message: `"${elementName}" field is not valid: Name cannot be empty`,
            code: ValidationErrorCode.REQUIRED,
        });
    }

    if (!element.display_name?.trim()) {
        errors.push({
            field: `${fieldPrefix}.display_name`,
            message: `"${elementName}" field is not valid: DisplayName cannot be empty`,
            code: ValidationErrorCode.REQUIRED,
        });
    }

    if (!element.type?.trim()) {
        errors.push({
            field: `${fieldPrefix}.type`,
            message: `"${elementName}" field is not valid: Type cannot be empty`,
            code: ValidationErrorCode.REQUIRED,
        });
    }

    // Length validation
    if (element.name && element.name.length > ELEMENT_NAME_MAX_LENGTH) {
        errors.push({
            field: `${fieldPrefix}.name`,
            message: `"${elementName}" field is not valid: Name too long (${element.name.length} > ${ELEMENT_NAME_MAX_LENGTH})`,
            code: ValidationErrorCode.TOO_LONG,
        });
    }

    if (element.display_name && element.display_name.length > ELEMENT_DISPLAY_NAME_MAX_LENGTH) {
        errors.push({
            field: `${fieldPrefix}.display_name`,
            message: `"${elementName}" field is not valid: DisplayName too long (${element.display_name.length} > ${ELEMENT_DISPLAY_NAME_MAX_LENGTH})`,
            code: ValidationErrorCode.TOO_LONG,
        });
    }

    if (element.help_text && element.help_text.length > ELEMENT_HELP_TEXT_MAX_LENGTH) {
        errors.push({
            field: `${fieldPrefix}.help_text`,
            message: `"${elementName}" field is not valid: HelpText too long (${element.help_text.length} > ${ELEMENT_HELP_TEXT_MAX_LENGTH})`,
            code: ValidationErrorCode.TOO_LONG,
        });
    }

    // Validation for select/radio options
    if ((element.type === DialogElementTypes.SELECT || element.type === DialogElementTypes.RADIO) && element.options) {
        for (let optIndex = 0; optIndex < element.options.length; optIndex++) {
            const option = element.options[optIndex];

            if (!option.text?.trim()) {
                errors.push({
                    field: `${fieldPrefix}.options[${optIndex}].text`,
                    message: `"${elementName}" field is not valid: Option[${optIndex}] text cannot be empty`,
                    code: ValidationErrorCode.REQUIRED,
                });
            }
            if (option.value === null || option.value === undefined || String(option.value).trim() === '') {
                errors.push({
                    field: `${fieldPrefix}.options[${optIndex}].value`,
                    message: `"${elementName}" field is not valid: Option[${optIndex}] value cannot be empty`,
                    code: ValidationErrorCode.REQUIRED,
                });
            }
        }
    }

    // Validation for text fields
    if (element.type === DialogElementTypes.TEXT || element.type === DialogElementTypes.TEXTAREA) {
        if (element.min_length !== undefined && element.max_length !== undefined) {
            if (element.min_length > element.max_length) {
                errors.push({
                    field: `${fieldPrefix}.min_length`,
                    message: `"${elementName}" field is not valid: MinLength (${element.min_length}) cannot be greater than MaxLength (${element.max_length})`,
                    code: ValidationErrorCode.INVALID_FORMAT,
                });
            }
        }

        const maxLengthLimit = element.type === DialogElementTypes.TEXTAREA ? TEXTAREA_FIELD_MAX_LENGTH : TEXT_FIELD_MAX_LENGTH;
        if (element.max_length !== undefined && element.max_length > maxLengthLimit) {
            errors.push({
                field: `${fieldPrefix}.max_length`,
                message: `"${elementName}" field is not valid: MaxLength too large (${element.max_length} > ${maxLengthLimit}) for ${element.type}`,
                code: ValidationErrorCode.TOO_LONG,
            });
        }
    }

    // Validation for select fields
    if (element.type === DialogElementTypes.SELECT) {
        if (element.options && element.data_source) {
            errors.push({
                field: `${fieldPrefix}.options`,
                message: `"${elementName}" field is not valid: Select element cannot have both options and data_source`,
                code: ValidationErrorCode.INVALID_FORMAT,
            });
        }
    }

    // Log warnings if enhanced mode is enabled
    if (options.enhanced && errors.length > 0) {
        const errorMessages = errors.map((e) => e.message).join(', ');
        // eslint-disable-next-line no-console
        console.warn(`Interactive dialog is invalid: ${errorMessages}`);
    }

    return errors;
}

/**
 * Get the appropriate AppField type for a dialog element
 */
export function getFieldType(element: DialogElement): string | null {
    switch (element.type) {
    case DialogElementTypes.TEXT:
        return AppFieldTypes.TEXT;
    case DialogElementTypes.TEXTAREA:
        return AppFieldTypes.TEXT;
    case DialogElementTypes.SELECT:
        if (element.data_source === 'users') {
            return AppFieldTypes.USER;
        }
        if (element.data_source === 'channels') {
            return AppFieldTypes.CHANNEL;
        }
        if (element.data_source === 'dynamic') {
            return AppFieldTypes.DYNAMIC_SELECT;
        }
        return AppFieldTypes.STATIC_SELECT;
    case DialogElementTypes.BOOL:
        return AppFieldTypes.BOOL;
    case DialogElementTypes.RADIO:
        return AppFieldTypes.RADIO;
    default:
        return null; // Skip unknown field types
    }
}

/**
 * Get the default value for a dialog element
 */
export function getDefaultValue(element: DialogElement): AppFormValue {
    if (element.default === null || element.default === undefined) {
        return null;
    }

    switch (element.type) {
    case DialogElementTypes.BOOL: {
        if (typeof element.default === 'boolean') {
            return element.default;
        }
        const boolString = String(element.default).toLowerCase().trim();
        return boolString === 'true' || boolString === '1' || boolString === 'yes';
    }

    case DialogElementTypes.SELECT:
    case DialogElementTypes.RADIO: {
        // Handle dynamic selects that use data_source instead of static options
        if (element.type === 'select' && element.data_source === 'dynamic' && element.default) {
            return {
                label: String(element.default),
                value: String(element.default),
            };
        }

        if (element.options && element.default) {
            // Handle multiselect defaults (comma-separated values)
            if (element.type === 'select' && element.multiselect) {
                const defaultValues = Array.isArray(element.default) ?
                    element.default :
                    String(element.default).split(',').map((val) => val.trim());

                const defaultOptions = defaultValues.map((value) => {
                    const option = element.options!.find((opt) => opt.value === value);
                    if (option) {
                        return {
                            label: String(option.text),
                            value: option.value,
                        };
                    }
                    return null;
                }).filter(Boolean) as AppSelectOption[];

                return defaultOptions.length > 0 ? defaultOptions : null;
            }

            // Single select default
            const defaultOption = element.options.find((option) => option.value === element.default);
            if (defaultOption) {
                return {
                    label: String(defaultOption.text),
                    value: defaultOption.value,
                };
            }
        }
        return null;
    }

    case DialogElementTypes.TEXT:
    case DialogElementTypes.TEXTAREA: {
        const defaultValue = element.default ?? null;
        return defaultValue === null ? null : String(defaultValue);
    }

    default:
        return String(element.default);
    }
}

/**
 * Get the options for a dialog element
 */
export function getOptions(element: DialogElement): AppSelectOption[] | undefined {
    if (!element.options) {
        return undefined;
    }

    return element.options.map((option) => ({
        label: String(option.text || ''),
        value: option.value || '',
    }));
}

/**
 * Convert DialogElement to AppField
 */
export function convertElement(element: DialogElement, options: ConversionOptions): {field: AppField | null; errors: ValidationError[]} {
    const errors: ValidationError[] = [];

    // Validate element if requested
    if (options.enhanced) {
        errors.push(...validateDialogElement(element, 0, options));
    }

    const fieldType = getFieldType(element);
    if (fieldType === null) {
        // Add error for unknown field type
        errors.push({
            field: element.name || 'unnamed',
            message: `"${element.name || 'unnamed'}" field is not valid: Unknown field type: ${element.type}`,
            code: ValidationErrorCode.INVALID_TYPE,
        });

        // In enhanced mode, skip unknown field types entirely
        if (options.enhanced) {
            return {field: null, errors};
        }

        // In legacy mode, create a fallback text field
        const fallbackField: AppField = {
            name: String(element.name),
            type: AppFieldTypes.TEXT,
            label: String(element.display_name),
            description: 'This field could not be converted properly',
            is_required: !element.optional,
            readonly: false,
            value: getDefaultValue(element),
        };
        return {field: fallbackField, errors};
    }

    const appField: AppField = {
        name: String(element.name),
        type: fieldType,
        label: String(element.display_name),
        description: element.help_text ? String(element.help_text) : undefined,
        hint: element.placeholder ? String(element.placeholder) : undefined,
        is_required: !element.optional,
        readonly: false,
        value: getDefaultValue(element),
    };

    // Add type-specific properties
    if (element.type === DialogElementTypes.TEXTAREA) {
        appField.subtype = 'textarea';
    } else if (element.type === DialogElementTypes.TEXT && element.subtype) {
        appField.subtype = element.subtype;
    }

    // Add length constraints for text fields
    if (element.type === DialogElementTypes.TEXT || element.type === DialogElementTypes.TEXTAREA) {
        if (element.min_length !== undefined) {
            appField.min_length = Math.max(0, element.min_length);
        }
        if (element.max_length !== undefined) {
            appField.max_length = Math.max(0, element.max_length);
        }
    }

    // Add options for select and radio fields
    if (element.type === DialogElementTypes.SELECT || element.type === DialogElementTypes.RADIO) {
        appField.options = getOptions(element);

        // Add multiselect support for select fields
        if (element.type === 'select' && element.multiselect) {
            appField.multiselect = true;
        }

        // Add lookup support for dynamic selects
        if (element.type === DialogElementTypes.SELECT && element.data_source === 'dynamic') {
            appField.lookup = {
                path: element.data_source_url || '',
                expand: {},
            };
        }
    }

    return {field: appField, errors};
}

/**
 * Convert Interactive Dialog to App Form
 */
export function convertDialogToAppForm(
    elements: DialogElement[] | undefined,
    title: string | undefined,
    introductionText: string | undefined,
    iconUrl: string | undefined,
    submitLabel: string | undefined,
    options: ConversionOptions,
): ConversionResult {
    const convertedFields: AppField[] = [];
    const allErrors: ValidationError[] = [];

    // Validate title if validation is enabled
    if (options.enhanced && !title?.trim()) {
        allErrors.push({
            field: 'title',
            message: 'Dialog title is required',
            code: ValidationErrorCode.REQUIRED,
        });
    }

    // Convert elements
    elements?.forEach((element, index) => {
        try {
            const {field, errors} = convertElement(element, options);
            allErrors.push(...errors);

            // Don't skip fields with validation errors - just log them
            // Validation is non-blocking like the server

            // Only add field if conversion was successful
            if (field) {
                convertedFields.push(field);
            }
        } catch (error) {
            if (options.enhanced) {
                allErrors.push({
                    field: `elements[${index}]`,
                    message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    code: ValidationErrorCode.CONVERSION_ERROR,
                });
            }

            // In non-strict mode, continue with a placeholder field
            if (!options.enhanced) {
                convertedFields.push({
                    name: element.name || `element_${index}`,
                    type: AppFieldTypes.TEXT,
                    label: element.display_name || 'Invalid Field',
                    description: 'This field could not be converted properly',
                });
            }
        }
    });

    const form: AppForm = {
        title: String(title || ''),
        icon: iconUrl,
        header: introductionText ? sanitizeString(introductionText) : undefined,
        submit_label: submitLabel ? String(submitLabel) : undefined,
        submit: {
            path: '/submit',
            expand: {},
        },
        fields: convertedFields,
    };

    return {form, errors: allErrors};
}

/**
 * Convert Apps Form values back to Interactive Dialog submission format
 */
export function convertAppFormValuesToDialogSubmission(
    values: AppFormValues,
    elements: DialogElement[] | undefined,
    options: ConversionOptions,
): {submission: Record<string, unknown>; errors: ValidationError[]} {
    const submission: Record<string, unknown> = {};
    const errors: ValidationError[] = [];

    if (!elements) {
        return {submission, errors};
    }

    elements.forEach((element) => {
        const value = values[element.name];

        if (value === null || value === undefined) {
            if (!element.optional && options.enhanced) {
                errors.push({
                    field: element.name,
                    message: `"${element.name}" field is not valid: Required field has null/undefined value`,
                    code: ValidationErrorCode.REQUIRED,
                });
            }
            return;
        }

        switch (element.type) {
        case DialogElementTypes.TEXT:
        case DialogElementTypes.TEXTAREA:
            if (element.subtype === 'number') {
                const numValue = Number(value);
                submission[element.name] = isNaN(numValue) ? String(value) : numValue;
            } else {
                const stringValue = String(value);

                if (options.enhanced) {
                    if (element.min_length !== undefined && stringValue.length < element.min_length) {
                        errors.push({
                            field: element.name,
                            message: `"${element.name}" field is not valid: Field value too short (${stringValue.length} < ${element.min_length})`,
                            code: ValidationErrorCode.TOO_SHORT,
                        });
                    }
                    if (element.max_length !== undefined && stringValue.length > element.max_length) {
                        errors.push({
                            field: element.name,
                            message: `"${element.name}" field is not valid: Field value too long (${stringValue.length} > ${element.max_length})`,
                            code: ValidationErrorCode.TOO_LONG,
                        });
                    }
                }
                submission[element.name] = stringValue;
            }
            break;

        case DialogElementTypes.BOOL:
            submission[element.name] = Boolean(value);
            break;

        case DialogElementTypes.RADIO:
            submission[element.name] = String(value);
            break;

        case DialogElementTypes.SELECT:
            if (Array.isArray(value)) {
                if (element.multiselect) {
                    // For multiselect, convert array of AppSelectOption to array of values
                    const multiValues = value.map((item) => {
                        if (!element.options) {
                            return item.value;
                        }
                        const validOption = element.options.find((opt) => opt.value === item.value);
                        if (!validOption) {
                            errors.push({
                                field: element.name,
                                message: `"${element.name}" field is not valid: Selected value not found in options: ${item.value}`,
                                code: ValidationErrorCode.INVALID_FORMAT,
                            });
                            return null;
                        }
                        return validOption.value;
                    }).filter(Boolean);
                    submission[element.name] = multiValues;
                } else {
                    // For single select with array input, take the first value
                    const firstValue = value[0];
                    if (firstValue && element.options) {
                        const validOption = element.options.find((opt) => opt.value === firstValue.value);
                        if (validOption) {
                            submission[element.name] = validOption.value;
                        } else {
                            errors.push({
                                field: element.name,
                                message: `"${element.name}" field is not valid: Selected value not found in options: ${firstValue.value}`,
                                code: ValidationErrorCode.INVALID_FORMAT,
                            });
                            submission[element.name] = null;
                        }
                    } else {
                        submission[element.name] = firstValue?.value || null;
                    }
                }
            } else if (typeof value === 'object' && value !== null && 'value' in value) {
                // Handle single AppSelectOption
                const selectOption = value as AppSelectOption;

                if (options.enhanced && element.options) {
                    const validOption = element.options.find((opt) => opt.value === selectOption.value);
                    if (!validOption) {
                        errors.push({
                            field: element.name,
                            message: `"${element.name}" field is not valid: Selected value not found in options: ${selectOption.value}`,
                            code: ValidationErrorCode.INVALID_FORMAT,
                        });
                    }
                }
                submission[element.name] = selectOption.value;
            } else {
                // Handle primitive values
                submission[element.name] = value;
            }
            break;

        default:
            submission[element.name] = String(value);
        }
    });

    return {submission, errors};
}
