// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid, format} from 'date-fns';

import type {DialogElement} from '@mattermost/types/integrations';

// date-fns formats for validation
const ISO_DATE_FORMAT_DATEFNS = 'yyyy-MM-dd';
const RFC3339_DATETIME_FORMAT_DATEFNS = "yyyy-MM-dd'T'HH:mm:ss'Z'";

type DialogError = {
    id: string;
    defaultMessage: string;
    values?: any;
};

/**
 * Validates date/datetime field values for format and range constraints
 */
function validateDateTimeValue(value: string, elem: DialogElement): DialogError | null {
    // Handle relative dates first
    const relativePattern = /^(today|tomorrow|yesterday|[+-]\d{1,4}[dwMH])$/;
    if (relativePattern.test(value)) {
        return null; // Relative dates are always valid
    }

    // Use parseISO for consistent validation with stringToMoment
    const parsedDate = parseISO(value);
    if (!isValid(parsedDate)) {
        return {
            id: 'interactive_dialog.error.bad_format',
            defaultMessage: 'Invalid date format',
        };
    }

    // Validate format matches expected storage format
    const isDateField = elem.type === 'date';
    if (isDateField) {
        // Date fields must be exactly YYYY-MM-DD
        try {
            const reformatted = format(parsedDate, ISO_DATE_FORMAT_DATEFNS);
            if (reformatted !== value) {
                return {
                    id: 'interactive_dialog.error.bad_format',
                    defaultMessage: 'Date field must be in YYYY-MM-DD format',
                };
            }
        } catch (error) {
            return {
                id: 'interactive_dialog.error.bad_format',
                defaultMessage: 'Invalid date format',
            };
        }
    } else {
        // DateTime fields must match RFC3339 format exactly
        try {
            const reformatted = format(parsedDate, RFC3339_DATETIME_FORMAT_DATEFNS);
            if (reformatted !== value) {
                return {
                    id: 'interactive_dialog.error.bad_format',
                    defaultMessage: 'DateTime field must be in YYYY-MM-DDTHH:mm:ssZ format',
                };
            }
        } catch (error) {
            return {
                id: 'interactive_dialog.error.bad_format',
                defaultMessage: 'Invalid datetime format',
            };
        }
    }
    return null;
}

export function checkDialogElementForError(elem: DialogElement, value: any): DialogError | undefined | null {
    // Check if value is empty (handles arrays for multiselect)
    let isEmpty;
    if (value === 0) {
        isEmpty = false;
    } else if (Array.isArray(value)) {
        isEmpty = value.length === 0;
    } else {
        isEmpty = !value;
    }

    if (isEmpty && !elem.optional) {
        return {
            id: 'interactive_dialog.error.required',
            defaultMessage: 'This field is required.',
        };
    }

    const type = elem.type;

    if (type === 'text' || type === 'textarea') {
        if (value && value.length < elem.min_length) {
            return {
                id: 'interactive_dialog.error.too_short',
                defaultMessage: 'Minimum input length is {minLength}.',
                values: {minLength: elem.min_length},
            };
        }

        if (elem.subtype === 'email') {
            if (value && !value.includes('@')) {
                return {
                    id: 'interactive_dialog.error.bad_email',
                    defaultMessage: 'Must be a valid email address.',
                };
            }
        }

        if (elem.subtype === 'number') {
            if (value && isNaN(value)) {
                return {
                    id: 'interactive_dialog.error.bad_number',
                    defaultMessage: 'Must be a number.',
                };
            }
        }

        if (elem.subtype === 'url') {
            if (value && !value.includes('http://') && !value.includes('https://')) {
                return {
                    id: 'interactive_dialog.error.bad_url',
                    defaultMessage: 'URL must include http:// or https://.',
                };
            }
        }
    } else if (type === 'radio') {
        const options = elem.options;

        if (typeof value !== 'undefined' && Array.isArray(options) && !options.some((e) => e.value === value)) {
            return {
                id: 'interactive_dialog.error.invalid_option',
                defaultMessage: 'Must be a valid option',
            };
        }
    } else if (type === 'date' || type === 'datetime') {
        // Validate date/datetime format and range constraints
        if (value && typeof value === 'string') {
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
