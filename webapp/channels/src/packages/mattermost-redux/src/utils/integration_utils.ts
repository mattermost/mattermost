// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid} from 'date-fns';
import {defineMessage} from 'react-intl';

import {isDateTimeRangeValue} from '@mattermost/types/apps';
import type {DialogElement} from '@mattermost/types/integrations';

// Validation patterns for exact storage format matching
const DATE_FORMAT_PATTERN = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const DATETIME_FORMAT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/; // YYYY-MM-DDTHH:mm:ssZ

type DialogError = {
    id: string;
    defaultMessage: string;
    values?: any;
};

/**
 * Validates date/datetime field values for format and range constraints
 */
function validateDateTimeValue(value: string, elem: DialogElement): DialogError | null {
    const parsedDate = parseISO(value);
    if (!isValid(parsedDate)) {
        return defineMessage({
            id: 'interactive_dialog.error.bad_format',
            defaultMessage: 'Invalid date format',
        });
    }

    const isDateField = elem.type === 'date';
    if (isDateField) {
        if (!DATE_FORMAT_PATTERN.test(value)) {
            return defineMessage({
                id: 'interactive_dialog.error.bad_date_format',
                defaultMessage: 'Date field must be in YYYY-MM-DD format',
            });
        }
    } else if (!DATETIME_FORMAT_PATTERN.test(value)) {
        return defineMessage({
            id: 'interactive_dialog.error.bad_datetime_format',
            defaultMessage: 'DateTime field must be in YYYY-MM-DDTHH:mm:ssZ format',
        });
    }
    return null;
}

export function checkDialogElementForError(elem: DialogElement, value: any): DialogError | undefined | null {
    // Check if value is empty (handles arrays for multiselect, structured ranges, and primitives)
    let isEmpty;
    if (value === 0) {
        isEmpty = false;
    } else if (Array.isArray(value)) {
        isEmpty = value.length === 0;
    } else if (isDateTimeRangeValue(value)) {
        // DateTimeRangeValue — not empty if start is present
        isEmpty = !value.start;
    } else {
        isEmpty = !value;
    }

    if (isEmpty && !elem.optional) {
        return defineMessage({
            id: 'interactive_dialog.error.required',
            defaultMessage: 'This field is required.',
        });
    }

    // Check if required range field has both start and end.
    // Optional range fields can be submitted with a partial value (start only)
    // or null — the server should handle both cases.
    if (!elem.optional && elem.datetime_config?.is_range) {
        const isValidRange = isDateTimeRangeValue(value) && value.start && value.end;
        if (!isValidRange) {
            return defineMessage({
                id: 'interactive_dialog.error.range_incomplete',
                defaultMessage: 'Both start and end dates are required.',
            });
        }
    }

    const type = elem.type;

    if (type === 'text' || type === 'textarea') {
        if (value && value.length < elem.min_length) {
            return defineMessage({
                id: 'interactive_dialog.error.too_short',

                // minLength provided by InteractiveDialog
                // eslint-disable-next-line formatjs/enforce-placeholders
                defaultMessage: 'Minimum input length is {minLength}.',
            });
        }

        if (elem.subtype === 'email') {
            if (value && !value.includes('@')) {
                return defineMessage({
                    id: 'interactive_dialog.error.bad_email',
                    defaultMessage: 'Must be a valid email address.',
                });
            }
        }

        if (elem.subtype === 'number') {
            if (value && isNaN(value)) {
                return defineMessage({
                    id: 'interactive_dialog.error.bad_number',
                    defaultMessage: 'Must be a number.',
                });
            }
        }

        if (elem.subtype === 'url') {
            if (value && !value.includes('http://') && !value.includes('https://')) {
                return defineMessage({
                    id: 'interactive_dialog.error.bad_url',
                    defaultMessage: 'URL must include http:// or https://.',
                });
            }
        }
    } else if (type === 'radio') {
        const options = elem.options;

        if (typeof value !== 'undefined' && Array.isArray(options) && !options.some((e) => e.value === value)) {
            return defineMessage({
                id: 'interactive_dialog.error.invalid_option',
                defaultMessage: 'Must be a valid option',
            });
        }
    } else if (type === 'date' || type === 'datetime') {
        // Validate date/datetime format and range constraints
        if (isDateTimeRangeValue(value)) {
            // Validate both start and end strings individually
            const startError = validateDateTimeValue(value.start, elem);
            if (startError) {
                return startError;
            }
            if (value.end) {
                const endError = validateDateTimeValue(value.end, elem);
                if (endError) {
                    return endError;
                }
            }
        } else if (value && typeof value === 'string') {
            const validationError = validateDateTimeValue(value, elem);
            if (validationError) {
                return validationError;
            }
        }
        return null;
    }

    return null;
}

// If we're returned errors that don't match any of the elements we have,
// ignore them and complete the dialog

export function checkIfErrorsMatchElements(errors: Record<string, string> = {}, elements: DialogElement[] = []) {
    for (const name in errors) {
        if (!Object.hasOwn(errors, name)) {
            continue;
        }
        for (const elem of elements) {
            if (elem.name === name) {
                return true;
            }
        }
    }

    return false;
}
