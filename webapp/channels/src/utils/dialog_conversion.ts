// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isAppSelectOption, type AppForm, type AppField, type AppFormValue, type AppSelectOption, type AppFormValues, type DateTimeConfig} from '@mattermost/types/apps';
import type {DialogElement} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {stringToMoment} from 'utils/date_utils';

// Dialog element types (from legacy Interactive Dialog spec)
export const DialogElementTypes = {
    TEXT: 'text',
    TEXTAREA: 'textarea',
    SELECT: 'select',
    BOOL: 'bool',
    RADIO: 'radio',
    DATE: 'date',
    DATETIME: 'datetime',
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

// Server dialog response structure
type ServerDialogResponse = {
    elements?: DialogElement[];
    title?: string;
    introduction_text?: string;
    icon_url?: string;
    submit_label?: string;
    source_url?: string;
    callback_id?: string;
    notify_on_cancel?: boolean;
    state?: string;
};

// Transformed dialog props structure
type TransformedDialogProps = {
    elements?: DialogElement[];
    title: string;
    introductionText?: string;
    iconUrl?: string;
    submitLabel?: string;
    sourceUrl?: string;
    callbackId?: string;
    notifyOnCancel?: boolean;
    state?: string;
};

export type ConversionOptions = {

    // Enhanced mode enables stricter validation and error handling
    // When false: Legacy mode with minimal validation (backwards compatible)
    // When true: Enhanced mode with full validation and blocking errors
    enhanced: boolean;
};

export type ConversionResult = {
    form: AppForm;
    errors: ValidationError[];
};

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
    case DialogElementTypes.DATE:
        return AppFieldTypes.DATE;
    case DialogElementTypes.DATETIME:
        return AppFieldTypes.DATETIME;
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

    case DialogElementTypes.RADIO: {
        // Radio values are always plain strings (RadioSetting.onChange returns e.target.value).
        // Normalize to string from the start so the value shape never changes after user interaction.
        if (element.options && element.default) {
            const match = element.options.find((opt) => opt.value === element.default);
            return match ? match.value : null;
        }
        return element.default ? String(element.default) : null;
    }

    case DialogElementTypes.SELECT: {
        // Handle dynamic selects that use data_source instead of static options
        if (element.data_source === 'dynamic' && element.default) {
            if (element.multiselect) {
                const values = Array.isArray(element.default) ?
                    element.default :
                    String(element.default).split(',');
                const normalizedValues = values.
                    map((val) => String(val).trim()).
                    filter((val) => val.length > 0);
                return normalizedValues.length > 0 ? normalizedValues.map((v) => ({label: v, value: v})) : null;
            }
            return {
                label: String(element.default),
                value: String(element.default),
            };
        }

        if (element.options && element.default) {
            // Handle multiselect defaults (comma-separated values)
            if (element.multiselect) {
                const defaultValues = Array.isArray(element.default) ? element.default : String(element.default).split(',').map((val) => val.trim());

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

    case DialogElementTypes.DATE:
    case DialogElementTypes.DATETIME: {
        // Date and datetime values should be passed through as strings (ISO format)
        const defaultValue = element.default;
        if (defaultValue === null || defaultValue === undefined) {
            return null;
        }

        // Validate the default value is a valid date/datetime string
        const stringValue = String(defaultValue);

        // If empty string, return it as-is
        if (stringValue === '') {
            return stringValue;
        }

        const testMoment = stringToMoment(stringValue);

        // If invalid, return null instead of passing invalid data
        return testMoment?.isValid() ? stringValue : null;
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

        // Copy refresh property for dynamic field updates
        if (element.refresh !== undefined) {
            appField.refresh = element.refresh;
        }
    }

    // Add refresh support for bool fields
    if (element.type === DialogElementTypes.BOOL) {
        if (element.refresh !== undefined) {
            appField.refresh = element.refresh;
        }
    }

    // Add date/datetime specific properties
    if (element.type === DialogElementTypes.DATE || element.type === DialogElementTypes.DATETIME) {
        // Merge datetime_config over deprecated top-level fields (datetime_config takes precedence)
        const minDate = element.datetime_config?.min_date ?? element.min_date;
        const maxDate = element.datetime_config?.max_date ?? element.max_date;
        const timeInterval = element.datetime_config?.time_interval ?? element.time_interval;

        const mergedConfig: DateTimeConfig = {};
        if (element.datetime_config?.location_timezone) {
            mergedConfig.location_timezone = element.datetime_config.location_timezone;
        }

        // manual_time_entry supersedes the deprecated allow_manual_time_entry. OR-merge
        // the two sources into a single normalized key so downstream consumers don't
        // need to repeat the precedence logic.
        if (element.datetime_config?.manual_time_entry || element.datetime_config?.allow_manual_time_entry) {
            mergedConfig.manual_time_entry = true;
        }
        if (minDate !== undefined) {
            mergedConfig.min_date = String(minDate);
        }
        if (maxDate !== undefined) {
            mergedConfig.max_date = String(maxDate);
        }
        if (timeInterval !== undefined && element.type === DialogElementTypes.DATETIME) {
            mergedConfig.time_interval = Number(timeInterval);
        }

        if (Object.keys(mergedConfig).length > 0) {
            appField.datetime_config = mergedConfig;
        }

        // Also set deprecated top-level fields for backward compatibility with consumers
        if (minDate !== undefined) {
            appField.min_date = String(minDate);
        }
        if (maxDate !== undefined) {
            appField.max_date = String(maxDate);
        }
        if (timeInterval !== undefined && element.type === DialogElementTypes.DATETIME) {
            appField.time_interval = Number(timeInterval);
        }

        if (element.refresh !== undefined) {
            appField.refresh = element.refresh;
        }
    }

    return {field: appField, errors};
}

/**
 * Transform server dialog response format (snake_case) to props format (camelCase)
 * Uses the same transformation pattern as mapStateToProps in interactive_dialog/index.tsx
 */
export function transformServerDialogToProps(serverDialog: ServerDialogResponse): TransformedDialogProps {
    return {
        elements: serverDialog.elements,
        title: serverDialog.title || '',
        introductionText: serverDialog.introduction_text,
        iconUrl: serverDialog.icon_url,
        submitLabel: serverDialog.submit_label,
        sourceUrl: serverDialog.source_url,
        callbackId: serverDialog.callback_id,
        notifyOnCancel: serverDialog.notify_on_cancel,
        state: serverDialog.state,
    };
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
    sourceUrl: string,
    dialogState: string,
    options: ConversionOptions,
): ConversionResult {
    const allErrors: ValidationError[] = [];
    const convertedFields: AppField[] = [];

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
        header: introductionText ? String(introductionText) : undefined,
        submit_label: submitLabel ? String(submitLabel) : undefined,
        submit: {
            path: '/submit',
            expand: {},
            state: dialogState || undefined,
        },
        fields: convertedFields,
    };

    // Set source if sourceUrl is provided or if any fields have refresh enabled
    const hasRefreshFields = convertedFields.some((field) => field.refresh === true);
    if ((sourceUrl && sourceUrl.trim()) || hasRefreshFields) {
        form.source = {
            path: sourceUrl || '/refresh',
            expand: {},
            state: dialogState || undefined,
        };
    }

    return {form, errors: allErrors};
}

/**
 * Extract primitive values from form field objects for storage/submission
 * Converts select option objects {label: "Text", value: "val"} to primitive "val"
 * Filters out null, undefined, empty, and "<nil>" values unless clearEmptyFields is true,
 * in which case empty/null fields are emitted as '' or [] so they can overwrite prior values.
 */
export function extractPrimitiveValues(values: Record<string, any>, clearEmptyFields = false): Record<string, any> {
    const isMeaningful = (v: any): v is string | boolean => v != null && v !== '' && v !== '<nil>';

    return Object.entries(values).reduce<Record<string, any>>((acc, [key, value]) => {
        if (Array.isArray(value)) {
            const extracted = value.
                map((item) => (isAppSelectOption(item) ? item.value : item)).
                filter(isMeaningful);

            if (extracted.length > 0 || clearEmptyFields) {
                acc[key] = extracted;
            }
        } else if (isAppSelectOption(value)) {
            if (isMeaningful(value.value)) {
                acc[key] = value.value;
            } else if (clearEmptyFields) {
                acc[key] = '';
            }
        } else if (isMeaningful(value)) {
            acc[key] = value;
        } else if (clearEmptyFields) {
            acc[key] = '';
        }
        return acc;
    }, {});
}

/**
 * Convert server dialog response directly to AppForm
 * Combines server response transformation with dialog-to-form conversion
 */
export function convertServerDialogResponseToAppForm(
    serverResponse: any,
    options: ConversionOptions,
): ConversionResult {
    // Transform server response format to props format
    const transformedDialog = transformServerDialogToProps(serverResponse);

    const {form, errors} = convertDialogToAppForm(
        transformedDialog.elements,
        transformedDialog.title,
        transformedDialog.introductionText,
        transformedDialog.iconUrl,
        transformedDialog.submitLabel,
        transformedDialog.sourceUrl || '',
        transformedDialog.state || '',
        options,
    );

    return {form, errors};
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
            // Radio values are normally plain strings, but accept {label, value}
            // objects for backwards compatibility with older code paths.
            if (isAppSelectOption(value)) {
                submission[element.name] = value.value;
            } else {
                submission[element.name] = String(value);
            }
            break;

        case DialogElementTypes.SELECT:
            // Values are already converted to primitives by extractPrimitiveValues
            // Only validate that the values exist in the options list
            if (Array.isArray(value)) {
                if (element.multiselect) {
                    // Validate each value in multiselect array
                    const validatedValues = element.options ? value.filter((val) => {
                        const isValid = element.options!.some((opt) => opt.value === val);
                        if (!isValid) {
                            errors.push({
                                field: element.name,
                                message: `"${element.name}" field is not valid: Selected value not found in options: ${val}`,
                                code: ValidationErrorCode.INVALID_FORMAT,
                            });
                        }
                        return isValid;
                    }) : value;
                    submission[element.name] = validatedValues;
                } else {
                    // Single select with array - take first value and validate
                    const firstValue = value[0];
                    if (firstValue !== undefined && element.options) {
                        const isValid = element.options.some((opt) => opt.value === firstValue);
                        if (isValid) {
                            submission[element.name] = firstValue;
                        } else {
                            errors.push({
                                field: element.name,
                                message: `"${element.name}" field is not valid: Selected value not found in options: ${firstValue}`,
                                code: ValidationErrorCode.INVALID_FORMAT,
                            });
                            submission[element.name] = null;
                        }
                    } else {
                        submission[element.name] = firstValue || null;
                    }
                }
            } else {
                // Single primitive value - validate if options exist
                if (element.options && options.enhanced && value !== null && value !== undefined) {
                    const isValid = element.options.some((opt) => opt.value === value);
                    if (!isValid) {
                        errors.push({
                            field: element.name,
                            message: `"${element.name}" field is not valid: Selected value not found in options: ${value}`,
                            code: ValidationErrorCode.INVALID_FORMAT,
                        });
                    }
                }
                submission[element.name] = value;
            }
            break;

        case DialogElementTypes.DATE:
        case DialogElementTypes.DATETIME:
            // Date and datetime values should be passed through as strings (ISO format)
            submission[element.name] = String(value);
            break;
        default:
            submission[element.name] = String(value);
        }
    });

    return {submission, errors};
}
