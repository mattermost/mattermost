// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import type {AppForm, AppField, AppCallRequest, AppFormValue, AppSelectOption, AppFormValues} from '@mattermost/types/apps';
import type {DialogElement, DialogSubmission, SubmitDialogResponse} from '@mattermost/types/integrations';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {createCallContext} from 'utils/apps';
import type EmojiMap from 'utils/emoji_map';

import type {DoAppCallResult} from 'types/apps';

type ValidationError = {
    field: string;
    message: string;
    code: 'REQUIRED' | 'TOO_LONG' | 'TOO_SHORT' | 'INVALID_TYPE' | 'INVALID_FORMAT';
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
    actions: {
        submitInteractiveDialog: (submission: DialogSubmission) => Promise<ActionResult<SubmitDialogResponse>>;
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
     * Validate dialog structure and elements
     */
    private validateDialog = (): ValidationError[] => {
        const errors: ValidationError[] = [];
        const {elements, title} = this.props;

        // Validate dialog properties - relaxed for backwards compatibility
        // Title is not strictly required in legacy dialogs, only warn if too long
        if (title && title.length > 24) { // Server limit is 24 chars, not 64
            errors.push({
                field: 'title',
                message: `Dialog title too long: ${title.length} > 24 characters (server limit)`,
                code: 'TOO_LONG',
            });
        }

        // Validate dialog elements
        elements?.forEach((element, index) => {
            const elementErrors = this.validateDialogElement(element, index);
            errors.push(...elementErrors);
        });

        return errors;
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

        // Additional validation for select options
        if (element.type === 'select' && element.options) {
            element.options.forEach((option, optIndex) => {
                if (!option.text?.trim()) {
                    errors.push({
                        field: `${fieldPrefix}.options[${optIndex}].text`,
                        message: 'Option text is required',
                        code: 'REQUIRED',
                    });
                }
                if (option.value === null || option.value === undefined || String(option.value).trim() === '') {
                    errors.push({
                        field: `${fieldPrefix}.options[${optIndex}].value`,
                        message: 'Option value is required',
                        code: 'REQUIRED',
                    });
                }
            });
        }

        // Validation for radio fields (similar to select)
        if (element.type === 'radio' && element.options) {
            element.options.forEach((option, optIndex) => {
                if (!option.text?.trim()) {
                    errors.push({
                        field: `${fieldPrefix}.options[${optIndex}].text`,
                        message: 'Radio option text is required',
                        code: 'REQUIRED',
                    });
                }
                if (option.value === null || option.value === undefined || String(option.value).trim() === '') {
                    errors.push({
                        field: `${fieldPrefix}.options[${optIndex}].value`,
                        message: 'Radio option value is required',
                        code: 'REQUIRED',
                    });
                }
            });
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

    private convertToAppForm = (): AppForm => {
        const {elements, title, introductionText, iconUrl} = this.props;

        // Validate dialog if validation is enabled
        if (this.conversionContext.validateInputs) {
            const validationErrors = this.validateDialog();
            if (validationErrors.length > 0) {
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
        }

        return {
            title: this.sanitizeString(title || ''),
            icon: iconUrl,
            header: introductionText ? this.sanitizeString(introductionText) : undefined,
            submit: {
                path: '/submit',
                expand: {},
            },
            fields: elements?.map(this.convertElement) || [],
        };
    };

    /**
     * Convert DialogElement to AppField with enhanced type safety and validation
     */
    private convertElement = (element: DialogElement): AppField => {
        // Validate element before conversion
        if (this.conversionContext.validateInputs) {
            const errors = this.validateDialogElement(element, 0);
            if (errors.length > 0 && this.conversionContext.strictMode) {
                const errorMessage = this.props.intl.formatMessage({
                    id: 'interactive_dialog.element_validation_failed',
                    defaultMessage: 'Element validation failed: {errors}',
                }, {
                    errors: errors.map((e) => e.message).join(', '),
                });
                throw new Error(errorMessage);
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
                return AppFieldTypes.STATIC_SELECT;

            case 'bool':
                return AppFieldTypes.BOOL;
            case 'radio':
                return AppFieldTypes.RADIO;
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
                if (element.options && element.default) {
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

            case 'text':
            case 'textarea': {
                // Match original interactive dialog: e.default ?? null
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
        }

        return appField;
    };

    /**
     * Enhanced submission adapter with comprehensive input validation and sanitization
     */
    private submitAdapter = async (call: AppCallRequest): Promise<DoAppCallResult<unknown>> => {
        try {
            // Validate and convert AppCallRequest values back to legacy format
            const values = call.values || {};
            const convertedValues = this.convertAppFormValuesToDialogSubmission(values);

            const legacySubmission: DialogSubmission = {
                url: this.props.url || '',
                callback_id: this.props.callbackId || '',
                state: this.props.state || '',
                submission: convertedValues as {[x: string]: string},
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
     * Convert Apps Form values back to Interactive Dialog submission format with validation
     */
    private convertAppFormValuesToDialogSubmission = (values: AppFormValues): Record<string, unknown> => {
        const {elements} = this.props;
        const submission: Record<string, unknown> = {};

        if (!elements) {
            return submission;
        }

        elements.forEach((element) => {
            const value = values[element.name];

            if (value === null || value === undefined) {
                // Skip null/undefined values unless field is required
                if (!element.optional && this.conversionContext.validateInputs) {
                    this.logWarn('Required field has null/undefined value', {
                        fieldName: element.name,
                        fieldType: element.type,
                        isOptional: element.optional,
                    });
                }
                return;
            }

            // Type-safe value conversion with validation
            switch (element.type) {
            case 'text':
            case 'textarea':
                if (element.subtype === 'number') {
                    // Handle numeric inputs
                    const numValue = Number(value);
                    submission[element.name] = isNaN(numValue) ? this.sanitizeString(value) : numValue;
                } else {
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
                    submission[element.name] = stringValue;
                }
                break;
            case 'bool':
                submission[element.name] = Boolean(value);
                break;

            case 'radio':
                submission[element.name] = this.sanitizeString(value);
                break;

            case 'select':
                if (element.data_source === 'users' || element.data_source === 'channels') {
                    // Handle user/channel selects
                    if (typeof value === 'object' && value !== null && 'value' in value) {
                        submission[element.name] = this.sanitizeString((value as AppSelectOption).value);
                    } else {
                        submission[element.name] = this.sanitizeString(value);
                    }
                }

                // Handle static selects
                if (typeof value === 'object' && value !== null && 'value' in value) {
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
                    submission[element.name] = this.sanitizeString(selectOption.value);
                } else {
                    submission[element.name] = this.sanitizeString(value);
                }
                break;

            default:
                this.logWarn('Unknown element type in submission conversion', {
                    fieldName: element.name,
                    elementType: element.type,
                    fallbackBehavior: 'treating as string',
                });
                submission[element.name] = this.sanitizeString(value);
            }
        });

        return submission;
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
     * No-op lookup adapter for unsupported legacy feature
     * Interactive Dialogs don't support dynamic lookup calls
     */
    private performLookupCall = async (): Promise<DoAppCallResult<unknown>> => {
        if (this.conversionContext.validateInputs) {
            this.logWarn('Lookup calls are not supported in Interactive Dialogs', {
                feature: 'dynamic lookup',
                suggestion: 'Consider migrating to full Apps Framework',
            });
        }
        return {
            data: {
                type: 'ok' as const,
                data: {items: []},
            },
        };
    };

    /**
     * No-op refresh adapter for unsupported legacy feature
     * Interactive Dialogs don't support refresh on select
     */
    private refreshOnSelect = async (): Promise<DoAppCallResult<unknown>> => {
        if (this.conversionContext.validateInputs) {
            this.logWarn('Refresh on select is not supported in Interactive Dialogs', {
                feature: 'refresh on select',
                suggestion: 'Consider migrating to full Apps Framework',
            });
        }
        return {
            data: {
                type: 'ok' as const,
            },
        };
    };

    /**
     * No-op ephemeral response adapter for legacy compatibility
     */
    private postEphemeralCallResponseForContext = (): void => {
        // No-op for legacy dialogs - ephemeral responses not supported
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

    return <AppsFormContainer {...props}/>;
};

export default injectIntl(InteractiveDialogAdapter);
