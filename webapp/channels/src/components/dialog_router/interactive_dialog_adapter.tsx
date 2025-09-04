// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {injectIntl} from 'react-intl';
import type {WrappedComponentProps} from 'react-intl';

import type {AppForm, AppCallRequest} from '@mattermost/types/apps';
import type {DialogElement, DialogSubmission, SubmitDialogResponse} from '@mattermost/types/integrations';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {makeAsyncComponent} from 'components/async_load';

import {createCallContext} from 'utils/apps';
import {
    convertDialogToAppForm,
    convertAppFormValuesToDialogSubmission,
    type ConversionOptions,
    type ValidationError,
} from 'utils/dialog_conversion';
import type EmojiMap from 'utils/emoji_map';

import type {DoAppCallResult} from 'types/apps';

const AppsFormContainer = makeAsyncComponent('AppsFormContainer', React.lazy(() => import('components/apps_form/apps_form_container')));

type ConversionContext = ConversionOptions;

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
 * - Two modes: Legacy (default) and Enhanced for gradual migration
 * - Enhanced TypeScript interfaces for better type safety
 * - XSS prevention through string sanitization (always enabled)
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
 * // Enhanced mode with full validation for new implementations
 * <InteractiveDialogAdapter
 *   elements={dialogElements}
 *   title="Sample Dialog"
 *   conversionOptions={{
 *     enhanced: true
 *   }}
 *   actions={{ submitInteractiveDialog }}
 *   onExited={() => console.log('Dialog closed')}
 * />
 * ```
 */
class InteractiveDialogAdapter extends React.PureComponent<Props> {
    // Default conversion context - enhanced mode disabled for backwards compatibility
    private readonly conversionContext: ConversionContext = {
        enhanced: false, // Legacy mode: minimal validation, non-blocking errors
        ...this.props.conversionOptions,
    };

    /**
     * Logging utilities for adapter diagnostics
     */
    private logWarn = (message: string, data?: unknown): void => {
        console.warn('[InteractiveDialogAdapter]', message, data || ''); // eslint-disable-line no-console
    };

    private logError = (message: string, error?: unknown): void => {
        console.error('[InteractiveDialogAdapter]', message, error || ''); // eslint-disable-line no-console
    };

    /**
     * Handle validation errors from conversion
     */
    private handleValidationErrors = (errors: ValidationError[]): {error?: string} => {
        if (errors.length === 0) {
            return {};
        }

        if (this.conversionContext.enhanced) {
            const formattedErrors = errors.map((e) => e.message);
            const errorMessage = this.props.intl.formatMessage({
                id: 'interactive_dialog.validation_failed',
                defaultMessage: 'Dialog validation failed: {errors}',
            }, {
                errors: formattedErrors.join(', '),
            });
            return {error: errorMessage};
        }
        this.logWarn('Dialog validation errors detected (non-blocking)', {
            errorCount: errors.length,
            errors: errors.map((e) => ({
                field: e.field,
                message: e.message,
                code: e.code,
            })),
            note: 'These are warnings - processing will continue for backwards compatibility',
        });
        return {};
    };

    private convertToAppForm = (): {form?: AppForm; error?: string} => {
        const {elements, title, introductionText, iconUrl, submitLabel} = this.props;

        const {form, errors} = convertDialogToAppForm(
            elements,
            title,
            introductionText,
            iconUrl,
            submitLabel,
            this.conversionContext,
        );

        const {error} = this.handleValidationErrors(errors);
        if (error) {
            return {error};
        }

        return {form};
    };

    /**
     * Enhanced submission adapter with comprehensive input validation and sanitization
     */
    private submitAdapter = async (call: AppCallRequest): Promise<DoAppCallResult<unknown>> => {
        try {
            // Validate and convert AppCallRequest values back to legacy format
            const values = call.values || {};
            const {submission: convertedValues, errors} = convertAppFormValuesToDialogSubmission(
                values,
                this.props.elements,
                this.conversionContext,
            );

            // Handle validation errors if any
            if (errors.length > 0) {
                this.logWarn('Form submission validation errors', {
                    errorCount: errors.length,
                    errors,
                });
            }

            const legacySubmission: DialogSubmission = {
                url: this.props.url || '',
                callback_id: this.props.callbackId || '',
                state: this.props.state || '',
                submission: convertedValues as {[x: string]: string},
                user_id: '', // Populated by submitInteractiveDialog action
                channel_id: '', // Populated by submitInteractiveDialog action
                team_id: '', // Populated by submitInteractiveDialog action
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
     * Enhanced cancel adapter with proper error handling
     */
    private cancelAdapter = async (): Promise<void> => {
        if (!this.props.notifyOnCancel) {
            return;
        }

        const cancelSubmission: DialogSubmission = {
            url: this.props.url || '',
            callback_id: this.props.callbackId || '',
            state: this.props.state || '',
            cancelled: true,
            user_id: '', // Populated by submitInteractiveDialog action
            channel_id: '', // Populated by submitInteractiveDialog action
            team_id: '', // Populated by submitInteractiveDialog action
            submission: {},
        };

        try {
            const result = await this.props.actions.submitInteractiveDialog(cancelSubmission);

            if (result?.error) {
                this.logError('Failed to notify server of dialog cancellation', {
                    error: result.error,
                    callbackId: this.props.callbackId,
                    url: this.props.url,
                });
            }
        } catch (error) {
            this.logError('Failed to notify server of dialog cancellation', {
                error: error instanceof Error ? error.message : String(error),
                callbackId: this.props.callbackId,
                url: this.props.url,
            });
        }

        // Don't throw here as cancellation should always succeed from UX perspective
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

        // Validate and convert AppCallRequest values back to legacy format
        const values = call.values || {};
        const {submission: convertedValues, errors} = convertAppFormValuesToDialogSubmission(
            values,
            this.props.elements,
            this.conversionContext,
        );

        // Handle validation errors if any
        if (errors.length > 0) {
            this.logWarn('Form submission validation errors', {
                errorCount: errors.length,
                errors,
            });
        }

        // For dynamic select, we need to make a lookup call to get options
        const dialog: DialogSubmission = {
            url: lookupPath || '',
            callback_id: callbackId ?? '',
            state: state ?? '',
            submission: convertedValues as {[x: string]: string},
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
     * No-op refresh adapter for unsupported legacy feature
     */
    private refreshOnSelect = async (): Promise<DoAppCallResult<unknown>> => {
        this.logWarn('Unexpected refresh call in Interactive Dialog adapter - this should not happen');
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

        // Allow HTTP URLs to localhost and 127.0.0.1 for testing scenarios
        if (url.startsWith('http://')) {
            try {
                const parsedURL = new URL(url);
                const host = parsedURL.hostname;
                if (host === 'localhost' || host === '127.0.0.1') {
                    return true;
                }
            } catch {
                return false;
            }
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
        const {form, error} = this.convertToAppForm();

        if (error) {
            this.logError('Failed to convert dialog to app form', error);
            return null;
        }

        if (!form) {
            this.logError('No form generated from dialog conversion');
            return null;
        }

        // Create a minimal context for legacy interactive dialogs
        const context = createCallContext(
            'legacy-interactive-dialog', // app_id for legacy dialogs
            'interactive_dialog', // location
        );

        return (
            <AppsFormContainer
                form={form}
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

export default injectIntl(InteractiveDialogAdapter);
