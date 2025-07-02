// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import type {AppForm, AppField, AppCallRequest, AppFormValue, AppSelectOption, AppFormValues, AppContext} from '@mattermost/types/apps';
import type {DialogElement, DialogSubmission, SubmitDialogResponse} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {createCallContext} from 'utils/apps';
import type EmojiMap from 'utils/emoji_map';

import type {DoAppCallResult} from 'types/apps';

type ValidationError = {
    field: string;
    message: string;
    code: 'REQUIRED' | 'TOO_LONG' | 'TOO_SHORT' | 'INVALID_TYPE' | 'INVALID_FORMAT' | 'CONVERSION_ERROR';
};

// Server dialog response structure (snake_case format from server)
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

// Transformed dialog props structure (camelCase format for components)
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

// Dialog data that can be used for conversion (common subset of Props and TransformedDialogProps)
type DialogDataForConversion = {
    elements?: DialogElement[];
    title?: string;
    introductionText?: string;
    iconUrl?: string;
    submitLabel?: string;
    sourceUrl?: string;
    state?: string;
};

type ConversionContext = {
    validateInputs: boolean;
    sanitizeStrings: boolean;
    strictMode: boolean;
    enableDebugLogging: boolean;
};

// Enhanced Props interface with better type safety
interface Props extends WrappedComponentProps {

    // Legacy InteractiveDialog props (now properly typed)
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
    sourceUrl?: string; // NEW: Optional URL for form refresh functionality
    actions: {
        submitInteractiveDialog: (submission: DialogSubmission) => Promise<ActionResult<SubmitDialogResponse>>;
        lookupInteractiveDialog: (submission: DialogSubmission) => Promise<ActionResult<{items: Array<{text: string; value: string}>}>>;
    };

    // Enhanced configuration options
    conversionOptions?: Partial<ConversionContext>;
}

/**
 * Enhanced InteractiveDialogAdapter with comprehensive validation and type safety
 *
 * This adapter converts legacy InteractiveDialog components to use the modern AppsForm
 * system while maintaining backward compatibility. It includes:
 *
 * - Optional comprehensive input validation (disabled by default for backwards compatibility)
 * - Enhanced TypeScript interfaces for better type safety
 * - XSS prevention through string sanitization (enabled by default)
 * - Configurable validation and conversion options
 * - Detailed error handling and logging
 * - Backwards compatible with existing InteractiveDialog implementations
 *
 * @example
 * ```tsx
 * // Backwards compatible - works with existing dialogs
 * <InteractiveDialogAdapter
 *   elements={dialogElements}
 *   title="Sample Dialog"
 *   actions={{ submitInteractiveDialog }}
 *   onExited={() => console.log('Dialog closed')}
 * />
 *
 * // Enhanced with validation for new implementations
 * <InteractiveDialogAdapter
 *   elements={dialogElements}
 *   title="Sample Dialog"
 *   conversionOptions={{
 *     validateInputs: true,
 *     strictMode: false,
 *     enableDebugLogging: true
 *   }}
 *   actions={{ submitInteractiveDialog }}
 *   onExited={() => console.log('Dialog closed')}
 * />
 * ```
 */
class InteractiveDialogAdapter extends React.PureComponent<Props> {
    // Default conversion context with enhanced options
    // NOTE: validateInputs defaults to false for backwards compatibility
    private readonly conversionContext: ConversionContext = {
        validateInputs: false, // Default to false for backwards compatibility
        sanitizeStrings: true,
        strictMode: false,
        enableDebugLogging: false,
        ...this.props.conversionOptions,
    };

    // Track current dialog elements for validation
    private currentDialogElements: DialogElement[] | undefined;

    /**
     * Logging utility following Mattermost webapp conventions
     * Uses standard console methods with ESLint disable comments
     */
    private logDebug = (message: string, data?: unknown): void => {
        if (this.conversionContext.enableDebugLogging) {
            console.debug('[InteractiveDialogAdapter]', message, data || ''); // eslint-disable-line no-console
        }
    };

    private logWarn = (message: string, data?: unknown): void => {
        if (this.conversionContext.validateInputs) {
            console.warn('[InteractiveDialogAdapter]', message, data || ''); // eslint-disable-line no-console
        }
    };

    private logError = (message: string, error?: unknown): void => {
        // Always log errors regardless of settings
        console.error('[InteractiveDialogAdapter]', message, error || ''); // eslint-disable-line no-console
    };

    /**
     * Validate individual dialog element
     */
    private validateDialogElement = (element: DialogElement, index: number): ValidationError[] => {
        const errors: ValidationError[] = [];
        const fieldPrefix = `elements[${index}]`;

        // Required field validation - only for truly required fields
        if (!element.name?.trim()) {
            errors.push({
                field: `${fieldPrefix}.name`,
                message: 'Element name is required',
                code: 'REQUIRED',
            });
        }

        if (!element.display_name?.trim()) {
            errors.push({
                field: `${fieldPrefix}.display_name`,
                message: 'Element display_name is required',
                code: 'REQUIRED',
            });
        }

        if (!element.type?.trim()) {
            errors.push({
                field: `${fieldPrefix}.type`,
                message: 'Element type is required',
                code: 'REQUIRED',
            });
        }

        // Length validation based on server-side limits
        if (element.name && element.name.length > 300) { // Server limit is 300 chars
            errors.push({
                field: `${fieldPrefix}.name`,
                message: `Element name too long: ${element.name.length} > 300 characters (server limit)`,
                code: 'TOO_LONG',
            });
        }

        if (element.display_name && element.display_name.length > 24) { // Server limit is 24 chars
            errors.push({
                field: `${fieldPrefix}.display_name`,
                message: `Element display_name too long: ${element.display_name.length} > 24 characters (server limit)`,
                code: 'TOO_LONG',
            });
        }

        // Validate help text length if present
        if (element.help_text && element.help_text.length > 150) { // Server limit is 150 chars
            errors.push({
                field: `${fieldPrefix}.help_text`,
                message: `Element help_text too long: ${element.help_text.length} > 150 characters (server limit)`,
                code: 'TOO_LONG',
            });
        }

        // Optimized validation for select/radio options
        if ((element.type === 'select' || element.type === 'radio') && element.options) {
            const optionType = element.type === 'radio' ? 'Radio option' : 'Option';

            for (let optIndex = 0; optIndex < element.options.length; optIndex++) {
                const option = element.options[optIndex];

                if (!option.text?.trim()) {
                    errors.push({
                        field: `${fieldPrefix}.options[${optIndex}].text`,
                        message: `${optionType} text is required`,
                        code: 'REQUIRED',
                    });
                }
                if (option.value === null || option.value === undefined || String(option.value).trim() === '') {
                    errors.push({
                        field: `${fieldPrefix}.options[${optIndex}].value`,
                        message: `${optionType} value is required`,
                        code: 'REQUIRED',
                    });
                }
            }
        }

        // Validation for text fields with proper server limits
        if (element.type === 'text' || element.type === 'textarea') {
            // Validate min/max length relationship
            if (element.min_length !== undefined && element.max_length !== undefined) {
                if (element.min_length > element.max_length) {
                    errors.push({
                        field: `${fieldPrefix}.min_length`,
                        message: 'min_length cannot be greater than max_length',
                        code: 'INVALID_FORMAT',
                    });
                }
            }

            // Validate against server limits
            const maxLengthLimit = element.type === 'textarea' ? 3000 : 150;
            if (element.max_length !== undefined && element.max_length > maxLengthLimit) {
                errors.push({
                    field: `${fieldPrefix}.max_length`,
                    message: `max_length too large: ${element.max_length} > ${maxLengthLimit} (server limit for ${element.type})`,
                    code: 'TOO_LONG',
                });
            }
        }

        // Validation for select fields
        if (element.type === 'select') {
            // Warn if both options and data_source are provided
            if (element.options && element.data_source) {
                errors.push({
                    field: `${fieldPrefix}.options`,
                    message: 'Select element cannot have both options and data_source',
                    code: 'INVALID_FORMAT',
                });
            }

            // Validate max_length for select fields (server limit is 3000)
            if (element.max_length !== undefined && element.max_length > 3000) {
                errors.push({
                    field: `${fieldPrefix}.max_length`,
                    message: `max_length too large: ${element.max_length} > 3000 (server limit for select)`,
                    code: 'TOO_LONG',
                });
            }
        }

        // Log warning for multiselect on non-select elements
        if (element.multiselect && element.type !== 'select') {
            this.logWarn('multiselect property ignored for non-select element', {
                fieldName: element.name,
                elementType: element.type,
                note: 'multiselect only applies to select elements',
            });
        }

        // Validation for bool fields
        if (element.type === 'bool') {
            // Validate max_length for bool fields (server limit is 150)
            if (element.max_length !== undefined && element.max_length > 150) {
                errors.push({
                    field: `${fieldPrefix}.max_length`,
                    message: `max_length too large: ${element.max_length} > 150 (server limit for bool)`,
                    code: 'TOO_LONG',
                });
            }
        }

        return errors;
    };

    /**
     * Sanitize string input to prevent XSS attacks
     */
    private sanitizeString = (input: unknown): string => {
        if (!this.conversionContext.sanitizeStrings) {
            return String(input);
        }

        const str = String(input);

        // Remove script tags and other potentially dangerous content
        return str.
            replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').
            replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '').
            replace(/javascript:/gi, '').
            replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
    };

    /**
     * Transform server dialog response format (snake_case) to props format (camelCase)
     * Uses the same transformation pattern as mapStateToProps in interactive_dialog/index.tsx
     */
    private transformServerDialogToProps = (serverDialog: ServerDialogResponse): TransformedDialogProps => {
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
    };

    private convertToAppForm = (dialogData?: DialogDataForConversion): AppForm => {
        // Use provided dialog data or fall back to props
        const data: DialogDataForConversion = dialogData || this.props;
        const {elements, title, introductionText, iconUrl, submitLabel, sourceUrl} = data;

        // Store current dialog elements for validation
        this.currentDialogElements = elements;

        // Convert elements with validation done per element
        const convertedFields: AppField[] = [];
        const validationErrors: ValidationError[] = [];

        // Validate title upfront if validation is enabled
        if (this.conversionContext.validateInputs) {
            if (!title?.trim()) {
                validationErrors.push({
                    field: 'title',
                    message: 'Dialog title is required',
                    code: 'REQUIRED',
                });
            }
        }

        // Convert elements with single validation pass
        elements?.forEach((element: DialogElement, index: number) => {
            try {
                const convertedField = this.convertElement(element, index);
                convertedFields.push(convertedField);
            } catch (error) {
                if (this.conversionContext.validateInputs) {
                    validationErrors.push({
                        field: `elements[${index}]`,
                        message: error instanceof Error ? error.message : 'Conversion failed',
                        code: 'CONVERSION_ERROR',
                    });
                }

                // In non-strict mode, continue with a placeholder field
                if (!this.conversionContext.strictMode) {
                    convertedFields.push({
                        name: element.name || `element_${index}`,
                        type: AppFieldTypes.TEXT,
                        label: element.display_name || 'Invalid Field',
                        description: 'This field could not be converted properly',
                    });
                }
            }
        });

        // Handle validation errors if any
        if (validationErrors.length > 0 && this.conversionContext.validateInputs) {
            this.logWarn('Dialog validation errors detected (non-blocking)', {
                errorCount: validationErrors.length,
                errors: validationErrors,
                note: 'These are warnings - processing will continue for backwards compatibility',
            });
            if (this.conversionContext.strictMode) {
                const errorMessage = this.props.intl.formatMessage({
                    id: 'interactive_dialog.validation_failed',
                    defaultMessage: 'Dialog validation failed: {errors}',
                }, {
                    errors: validationErrors.map((e) => e.message).join(', '),
                });
                throw new Error(errorMessage);
            }
        }

        const appForm: AppForm = {
            title: this.sanitizeString(title || ''),
            icon: iconUrl,
            header: introductionText ? this.sanitizeString(introductionText) : undefined,
            submit_label: submitLabel ? this.sanitizeString(submitLabel) : undefined,
            submit: {
                path: '/submit',
                expand: {},
                state: data.state, // Simple state for legacy compatibility
            },
            fields: convertedFields,
        };

        // Add source for form refresh functionality if sourceUrl is provided
        if (sourceUrl) {
            appForm.source = {
                path: sourceUrl,
                expand: {},
                state: data.state, // Simple state for field refresh calls
            };
        }

        return appForm;
    };

    /**
     * Convert DialogElement to AppField with enhanced type safety and validation
     */
    private convertElement = (element: DialogElement, index?: number): AppField => {
        // Validate element before conversion (single validation pass)
        if (this.conversionContext.validateInputs) {
            const errors = this.validateDialogElement(element, index ?? 0);
            if (errors.length > 0) {
                if (this.conversionContext.strictMode) {
                    const errorMessage = this.props.intl.formatMessage({
                        id: 'interactive_dialog.element_validation_failed',
                        defaultMessage: 'Element validation failed: {errors}',
                    }, {
                        errors: errors.map((e) => e.message).join(', '),
                    });
                    throw new Error(errorMessage);
                } else {
                    // Log validation errors in non-strict mode but continue conversion
                    this.logWarn(`Element validation errors for ${element.name || 'unnamed'}`, {
                        errors,
                        element: element.name,
                        index,
                    });
                }
            }
        }

        // Enhanced type mapping with comprehensive coverage
        const getFieldType = (): string => {
            switch (element.type) {
            case 'text':
                return AppFieldTypes.TEXT;
            case 'textarea':
                return AppFieldTypes.TEXT; // Use TEXT type with textarea subtype
            case 'select':
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
            case 'bool':
                return AppFieldTypes.BOOL;
            case 'radio':
                return AppFieldTypes.RADIO;
            case 'date':
                return AppFieldTypes.DATE;
            case 'datetime':
                return AppFieldTypes.DATETIME;
            default:
                this.logWarn('Unknown dialog element type encountered', {
                    elementType: element.type,
                    elementName: element.name,
                    fallbackType: 'TEXT',
                });
                return AppFieldTypes.TEXT;
            }
        };

        // Enhanced default value handling with type safety
        const getDefaultValue = (): AppFormValue => {
            if (element.default === null || element.default === undefined) {
                return null;
            }

            switch (element.type) {
            case 'bool': {
                // Comprehensive boolean conversion
                if (typeof element.default === 'boolean') {
                    return element.default;
                }
                const boolString = String(element.default).toLowerCase().trim();
                return boolString === 'true' || boolString === '1' || boolString === 'yes';
            }

            case 'select':
            case 'radio': {
                // Handle dynamic selects that use data_source instead of static options
                if (element.type === 'select' && element.data_source === 'dynamic' && element.default) {
                    return {
                        label: this.sanitizeString(element.default),
                        value: this.sanitizeString(element.default),
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
                                    label: this.sanitizeString(option.text),
                                    value: this.sanitizeString(option.value),
                                };
                            }
                            this.logWarn('Default multiselect value not found in options', {
                                elementName: element.name,
                                defaultValue: value,
                                availableOptions: element.options?.map((opt) => opt.value),
                            });
                            return null;
                        }).filter(Boolean) as AppSelectOption[];

                        return defaultOptions.length > 0 ? defaultOptions : null;
                    }

                    // Single select default
                    const defaultOption = element.options.find((option) => option.value === element.default);
                    if (defaultOption) {
                        return {
                            label: this.sanitizeString(defaultOption.text),
                            value: this.sanitizeString(defaultOption.value),
                        };
                    }
                    this.logWarn('Default value not found in options', {
                        elementName: element.name,
                        defaultValue: element.default,
                        availableOptions: element.options?.map((opt) => opt.value),
                    });
                }
                return null;
            }

            case 'dynamic_select': {
                // For dynamic selects, default value should be a simple AppSelectOption
                // Since options are loaded dynamically, we can't validate against static options
                if (element.default) {
                    // If default is a string, create a basic option with the same label/value
                    // The actual label will be resolved when the field is loaded
                    return {
                        label: this.sanitizeString(element.default),
                        value: this.sanitizeString(element.default),
                    };
                }
                return null;
            }

            case 'text':
            case 'textarea': {
                // Match original interactive dialog: e.default ?? null
                const defaultValue = element.default ?? null;
                return defaultValue === null ? null : this.sanitizeString(defaultValue);
            }

            case 'date':
            case 'datetime': {
                // Date and datetime values should be passed through as strings (ISO format)
                const defaultValue = element.default ?? null;
                return defaultValue === null ? null : this.sanitizeString(defaultValue);
            }

            default:
                return this.sanitizeString(element.default);
            }
        };

        // Enhanced options mapping with validation
        const getOptions = (): AppSelectOption[] | undefined => {
            if (!element.options) {
                return undefined;
            }

            return element.options.map((option, index) => {
                if (!option.text?.trim() && this.conversionContext.validateInputs) {
                    this.logWarn('Empty option text detected', {
                        elementName: element.name,
                        optionIndex: index,
                        optionValue: option.value,
                    });
                }
                if (!option.value?.trim() && this.conversionContext.validateInputs) {
                    this.logWarn('Empty option value detected', {
                        elementName: element.name,
                        optionIndex: index,
                        optionText: option.text,
                    });
                }

                return {
                    label: this.sanitizeString(option.text || ''),
                    value: this.sanitizeString(option.value || ''),
                };
            });
        };

        // Build the AppField with comprehensive validation
        const appField: AppField = {
            name: this.sanitizeString(element.name),
            type: getFieldType(),
            label: this.sanitizeString(element.display_name),
            description: element.help_text ? this.sanitizeString(element.help_text) : undefined,
            hint: element.placeholder ? this.sanitizeString(element.placeholder) : undefined,
            is_required: !element.optional,
            readonly: false,
            value: getDefaultValue(),
        };

        // Add refresh functionality for field-level form updates
        if (element.refresh !== undefined) {
            appField.refresh = element.refresh;
        }

        // Add type-specific properties
        if (element.type === 'textarea') {
            appField.subtype = 'textarea';
        } else if (element.type === 'text' && element.subtype) {
            appField.subtype = element.subtype;
        }

        // Add length constraints for text fields
        if (element.type === 'text' || element.type === 'textarea') {
            if (element.min_length !== undefined) {
                appField.min_length = Math.max(0, element.min_length);
            }
            if (element.max_length !== undefined) {
                appField.max_length = Math.max(0, element.max_length);
            }
        }

        // Add options for select and radio fields
        if (element.type === 'select' || element.type === 'radio') {
            appField.options = getOptions();

            // Add multiselect support for select fields
            if (element.type === 'select' && element.multiselect) {
                appField.multiselect = true;
            }

            if (element.type === 'select' && element.data_source === 'dynamic') {
                appField.lookup = {
                    path: element.data_source_url || '',
                };
            }
        }

        return appField;
    };

    /**
     * Enhanced submission adapter with comprehensive input validation and sanitization
     */
    private submitAdapter = async (call: AppCallRequest): Promise<DoAppCallResult<unknown>> => {
        try {
            // Validate and convert AppCallRequest values back to legacy format
            const currentValues = call.values || {};
            const convertedCurrentValues = this.convertAppFormValuesToDialogSubmission(currentValues);

            // Use simple state directly - revert to working approach
            const stepState = call.state || this.props.state || '';

            const legacySubmission: DialogSubmission = {
                url: this.props.url || '',
                callback_id: this.props.callbackId || '',
                state: stepState, // Simple state for legacy dialog compatibility
                submission: convertedCurrentValues as {[x: string]: string},
                user_id: '',
                channel_id: '',
                team_id: '',
                cancelled: false,
            };

            const result = await this.props.actions.submitInteractiveDialog(legacySubmission);

            // Handle server-side validation errors from the response data (like original dialog)
            if (result?.data?.error || result?.data?.errors) {
                return {
                    error: {
                        type: 'error' as const,
                        text: result.data.error || this.props.intl.formatMessage({
                            id: 'interactive_dialog.submission_failed_validation',
                            defaultMessage: 'Submission failed with validation errors',
                        }),
                        data: {
                            errors: result.data.errors || {},
                        },
                    },
                };
            }

            // Handle network/action-level errors
            if (result?.error) {
                return {
                    error: {
                        type: 'error' as const,
                        text: this.props.intl.formatMessage({
                            id: 'interactive_dialog.submission_failed',
                            defaultMessage: 'Submission failed',
                        }),
                        data: {
                            errors: {},
                        },
                    },
                };
            }

            // Check if the response contains a new form (multi-step functionality)
            if (result?.data?.type === 'form' && result?.data?.form) {
                // Transform server response format to props format (same as mapStateToProps)
                const transformedDialog = this.transformServerDialogToProps(result.data.form);

                // Convert the legacy dialog form to AppForm format using existing method
                const newAppForm = this.convertToAppForm(transformedDialog);

                return {
                    data: {
                        type: 'form' as const,
                        form: newAppForm,
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
            this.logError('Dialog submission failed', {
                error: error instanceof Error ? error.message : String(error),
                callbackId: this.props.callbackId,
                url: this.props.url,
            });
            return {
                error: {
                    type: 'error' as const,
                    text: error instanceof Error ? error.message : this.props.intl.formatMessage({
                        id: 'interactive_dialog.submission_failed',
                        defaultMessage: 'Submission failed',
                    }),
                    data: {
                        errors: {
                            form: String(error),
                        },
                    },
                },
            };
        }
    };

    /**
     * Convert Apps Form values back to Interactive Dialog submission format
     * Includes ALL accumulated values, validates only those that exist in current dialog
     */
    private convertAppFormValuesToDialogSubmission = (values: AppFormValues): Record<string, unknown> => {
        const dialogElements = this.currentDialogElements || this.props.elements;
        const submission: Record<string, unknown> = {};

        // Create a map of current dialog elements for validation
        const elementMap = new Map<string, DialogElement>();
        if (dialogElements) {
            dialogElements.forEach((element) => {
                elementMap.set(element.name, element);
            });
        }

        // Process ALL values from the accumulated form state
        Object.keys(values).forEach((fieldName) => {
            const value = values[fieldName];
            const element = elementMap.get(fieldName);

            // Skip null/undefined values
            if (value === null || value === undefined) {
                return;
            }

            // If this field exists in current dialog, validate and convert according to its type
            if (element) {
                submission[fieldName] = this.convertFieldValue(value, element);
            } else {
                // Field is from a previous step - include it as-is with basic sanitization
                submission[fieldName] = this.convertUnknownFieldValue(value);
            }
        });

        return submission;
    };

    /**
     * Convert a field value according to its dialog element type with validation
     */
    private convertFieldValue = (value: AppFormValue, element: DialogElement): unknown => {
        switch (element.type) {
        case 'text':
        case 'textarea': {
            if (element.subtype === 'number') {
                // Handle numeric inputs
                const numValue = Number(value);
                return isNaN(numValue) ? this.sanitizeString(value) : numValue;
            }
            const stringValue = this.sanitizeString(value);

            // Validate length constraints
            if (this.conversionContext.validateInputs) {
                if (element.min_length !== undefined && stringValue.length < element.min_length) {
                    this.logWarn('Field value too short', {
                        fieldName: element.name,
                        actualLength: stringValue.length,
                        minLength: element.min_length,
                    });
                }
                if (element.max_length !== undefined && stringValue.length > element.max_length) {
                    this.logWarn('Field value too long', {
                        fieldName: element.name,
                        actualLength: stringValue.length,
                        maxLength: element.max_length,
                    });
                }
            }
            return stringValue;
        }
        case 'bool':
            return Boolean(value);

        case 'radio':
            return this.sanitizeString(value);

        case 'select':
            // Handle multiselect arrays
            if (Array.isArray(value)) {
                if (element.multiselect) {
                    // For multiselect, convert array of AppSelectOption to array of values
                    const multiValues = value.map((item) => {
                        if (typeof item === 'object' && item !== null && 'value' in item) {
                            return this.sanitizeString((item as AppSelectOption).value);
                        }
                        return this.sanitizeString(item);
                    });
                    return multiValues;
                }
                this.logWarn('Received array value for non-multiselect field', {
                    fieldName: element.name,
                    valueType: 'array',
                    multiselect: element.multiselect,
                });

                // Fallback: use first value
                return value.length > 0 ? this.sanitizeString(value[0]) : '';
            }

            // Single value handling
            if (!Array.isArray(value)) {
                if (element.data_source === 'users' || element.data_source === 'channels' || element.data_source === 'dynamic') {
                    // Handle user/channel selects
                    if (typeof value === 'object' && value !== null && 'value' in value) {
                        return this.sanitizeString((value as AppSelectOption).value);
                    }
                    return this.sanitizeString(value);
                } else if (typeof value === 'object' && value !== null && 'value' in value) {
                    // Handle static selects
                    const selectOption = value as AppSelectOption;

                    // Validate that the selected option exists in the original options
                    if (this.conversionContext.validateInputs && element.options) {
                        const validOption = element.options.find((opt) => opt.value === selectOption.value);
                        if (!validOption) {
                            this.logWarn('Selected value not found in options', {
                                fieldName: element.name,
                                selectedValue: selectOption.value,
                                availableOptions: element.options.map((opt) => opt.value),
                            });
                        }
                    }
                    return this.sanitizeString(selectOption.value);
                }
                return this.sanitizeString(value);
            }
            return this.sanitizeString(value);

        case 'date':
        case 'datetime':
            // Date and datetime values should be passed through as strings (ISO format)
            return this.sanitizeString(value);

        default:
            this.logWarn('Unknown element type in submission conversion', {
                fieldName: element.name,
                elementType: element.type,
                fallbackBehavior: 'treating as string',
            });
            return this.sanitizeString(value);
        }
    };

    /**
     * Convert a field value from previous steps with basic sanitization
     */
    private convertUnknownFieldValue = (value: AppFormValue): unknown => {
        // Handle different value types from previous steps
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number') {
            return value;
        }

        if (typeof value === 'object' && value !== null && 'value' in value) {
            // This was likely a select option from a previous step
            return this.sanitizeString((value as AppSelectOption).value);
        }

        // Default: sanitize as string
        return this.sanitizeString(value);
    };

    /**
     * Enhanced cancel adapter with proper error handling
     */
    private cancelAdapter = async (): Promise<void> => {
        if (!this.props.notifyOnCancel) {
            return;
        }

        try {
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

            await this.props.actions.submitInteractiveDialog(cancelSubmission);
        } catch (error) {
            this.logError('Failed to notify server of dialog cancellation', {
                error: error instanceof Error ? error.message : String(error),
                callbackId: this.props.callbackId,
                url: this.props.url,
            });

            // Don't throw here as cancellation should always succeed from UX perspective
        }
    };

    /**
     * Handles dynamic lookup requests for interactive dialog select fields.
     * Validates the lookup URL, processes form values, and makes the lookup call
     * to fetch dynamic options for select elements.
     *
     * @param call - The app call request containing lookup parameters
     * @returns Promise resolving to lookup response with options or error
     */
    private performLookupCall = async (call: AppCallRequest): Promise<DoAppCallResult<unknown>> => {
        const {url, callbackId, state} = this.props;

        // Get the lookup path from the call or field configuration
        let lookupPath = call.path;

        // If the field has a lookup path defined, use that instead
        if (!lookupPath && call.selected_field) {
            const field = this.props.elements?.find((element) => element.name === call.selected_field);
            if (field?.data_source === 'dynamic' && field?.data_source_url) {
                lookupPath = field.data_source_url;
            }
        }

        // If still no path, fall back to the dialog URL
        if (!lookupPath) {
            lookupPath = url || '';
        }

        // Validate URL for security
        if (!lookupPath) {
            return {
                error: {
                    type: 'error' as const,
                    text: 'No lookup URL provided',
                },
            };
        }

        if (!lookupPath || !this.isValidLookupURL(lookupPath)) {
            return {
                error: {
                    type: 'error' as const,
                    text: 'Invalid lookup URL: must be HTTPS URL or /plugins/ path',
                },
            };
        }

        // Convert AppSelectOption values to their raw value before submission
        const processedValues = this.convertAppFormValuesToDialogSubmission(call.values || {});

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
                        type: 'ok' as const,
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
                        type: 'error' as const,
                        text: response.error.message || 'Lookup failed',
                    },
                };
            }

            return {
                data: {
                    type: 'ok' as const,
                    data: {
                        items: [],
                    },
                },
            };
        } catch (error) {
            // Log the full error for debugging but return a sanitized message to the user
            this.logError('Lookup request failed', error);

            return {
                error: {
                    type: 'error' as const,
                    text: this.getSafeErrorMessage(error),
                },
            };
        }
    };

    /**
     * Field refresh adapter for Interactive Dialogs
     * Handles form refresh when fields with refresh=true are changed
     */
    private refreshOnSelect = async (call: AppCallRequest): Promise<DoAppCallResult<unknown>> => {
        try {
            // Check if we have a source URL for field refresh
            if (!this.props.sourceUrl) {
                this.logWarn('Field refresh requested but no sourceUrl provided', {
                    fieldName: call.selected_field,
                    suggestion: 'Add sourceUrl to dialog definition',
                });
                return {
                    data: {
                        type: 'ok' as const,
                    },
                };
            }

            // Prepare the refresh request with current form values
            const currentValues = call.values || {};
            const convertedCurrentValues = this.convertAppFormValuesToDialogSubmission(currentValues);

            const refreshSubmission: DialogSubmission = {
                url: this.props.sourceUrl,
                callback_id: this.props.callbackId || '',
                state: call.state || this.props.state || '',
                submission: convertedCurrentValues as {[x: string]: string},
                user_id: '',
                channel_id: '',
                team_id: '',
                cancelled: false,
                type: 'refresh', // Indicate this is a field refresh request
            };

            const result = await this.props.actions.submitInteractiveDialog(refreshSubmission);

            // Handle server-side validation errors
            if (result?.data?.error || result?.data?.errors) {
                return {
                    error: {
                        type: 'error' as const,
                        text: result.data.error || this.props.intl.formatMessage({
                            id: 'interactive_dialog.refresh_failed_validation',
                            defaultMessage: 'Field refresh failed with validation errors',
                        }),
                        data: {
                            errors: result.data.errors || {},
                        },
                    },
                };
            }

            // Handle network/action-level errors
            if (result?.error) {
                return {
                    error: {
                        type: 'error' as const,
                        text: this.props.intl.formatMessage({
                            id: 'interactive_dialog.refresh_failed',
                            defaultMessage: 'Field refresh failed',
                        }),
                        data: {
                            errors: {},
                        },
                    },
                };
            }

            // Check if the response contains a refreshed form
            if (result?.data?.type === 'form' && result?.data?.form) {
                // Transform server response format to props format
                const transformedDialog = this.transformServerDialogToProps(result.data.form);

                // Convert to AppForm format
                const refreshedAppForm = this.convertToAppForm(transformedDialog);

                return {
                    data: {
                        type: 'form' as const,
                        form: refreshedAppForm,
                    },
                };
            }

            // Default success response (no form changes)
            return {
                data: {
                    type: 'ok' as const,
                },
            };
        } catch (error) {
            this.logError('Field refresh failed', {
                error: error instanceof Error ? error.message : String(error),
                fieldName: call.selected_field,
                sourceUrl: this.props.sourceUrl,
            });
            return {
                error: {
                    type: 'error' as const,
                    text: error instanceof Error ? error.message : this.props.intl.formatMessage({
                        id: 'interactive_dialog.refresh_failed',
                        defaultMessage: 'Field refresh failed',
                    }),
                    data: {
                        errors: {
                            field_refresh: String(error),
                        },
                    },
                },
            };
        }
    };

    /**
     * No-op ephemeral response adapter for legacy compatibility
     */
    private postEphemeralCallResponseForContext = (): void => {
        // No-op for legacy dialogs - ephemeral responses not supported
    };

    /**
     * Validates if a URL is safe for lookup operations
     */
    private isValidLookupURL = (url: string): boolean => {
        if (!url) {
            return false;
        }

        // Only allow HTTPS for external URLs (more secure than HTTP)
        if (url.startsWith('https://')) {
            return true; // Simple check, full validation happens server-side
        }

        // Only allow plugin paths that start with /plugins/
        if (url.startsWith('/plugins/')) {
            // Additional validation for plugin paths - ensure no path traversal
            if (url.includes('..') || url.includes('//')) {
                return false;
            }
            return true;
        }

        return false;
    };

    /**
     * Gets a safe error message for display to users
     */
    private getSafeErrorMessage = (error: unknown): string => {
        if (error instanceof Error) {
            return error.message;
        }
        return this.props.intl.formatMessage({
            id: 'interactive_dialog.lookup_failed',
            defaultMessage: 'Lookup failed',
        });
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

// Props type for AppsFormContainer (based on the actual component usage)
type AppsFormContainerProps = {
    form: AppForm;
    context: AppContext;
    onExited: () => void;
    onHide: () => Promise<void>;
    actions: {
        doAppSubmit: (call: AppCallRequest) => Promise<DoAppCallResult<unknown>>;
        doAppFetchForm: (call: AppCallRequest) => Promise<DoAppCallResult<unknown>>;
        doAppLookup: (call: AppCallRequest) => Promise<DoAppCallResult<unknown>>;
        postEphemeralCallResponseForContext: () => void;
    };
};

// Dynamic wrapper component for AppsFormContainer to avoid circular dependency
const DynamicAppsFormContainer: React.FC<AppsFormContainerProps> = (props) => {
    const [AppsFormContainer, setAppsFormContainer] = React.useState<React.ComponentType<AppsFormContainerProps> | null>(null);

    React.useEffect(() => {
        const loadComponent = async () => {
            const {default: Component} = await import('components/apps_form/apps_form_container');
            setAppsFormContainer(Component as React.ComponentType<AppsFormContainerProps>);
        };
        loadComponent();
    }, []);

    if (!AppsFormContainer) {
        return null; // Loading state
    }

    return <AppsFormContainer {...props}/>;
};

export default injectIntl(InteractiveDialogAdapter);
