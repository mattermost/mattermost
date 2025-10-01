// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid} from 'date-fns';
import {defineMessage} from 'react-intl';

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
        return defineMessage({
            id: 'interactive_dialog.error.required',
            defaultMessage: 'This field is required.',
        });
    }

    const type = elem.type;

    if (type === 'text' || type === 'textarea') {
        if (value && value.length < elem.min_length) {
            return defineMessage({
                id: 'interactive_dialog.error.too_short',
                defaultMessage: 'Minimum input length is {minLength}.',
                values: {minLength: elem.min_length},
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
