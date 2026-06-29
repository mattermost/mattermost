// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid, addDays, addWeeks, addMonths, addHours, addMinutes, addSeconds, startOfDay} from 'date-fns';
import {defineMessage} from 'react-intl';

import type {DialogElement} from '@mattermost/types/integrations';

// Validation patterns for exact storage format matching
const DATE_FORMAT_PATTERN = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const DATETIME_FORMAT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/; // YYYY-MM-DDTHH:mm:ssZ or with offset

// Relative pattern: [+-]NNN[dwmHMS]
const RELATIVE_PATTERN = /^([+-]\d{1,3})([dwmHMS])$/;

type DialogError = {
    id: string;
    defaultMessage: string;
    values?: any;
};

/**
 * Resolves a min_date/max_date bound string to a Date.
 * Handles relative patterns (+2H, +30M, +7d, etc.) and ISO date/datetime strings.
 * Returns null if the value cannot be resolved.
 */
function resolveBoundToDate(value: string): Date | null {
    // Named relative words
    if (value === 'today') {
        return startOfDay(new Date());
    }
    if (value === 'tomorrow') {
        return startOfDay(addDays(new Date(), 1));
    }
    if (value === 'yesterday') {
        return startOfDay(addDays(new Date(), -1));
    }

    // Dynamic relative patterns: +2H, +30M, +7d, etc.
    const match = value.match(RELATIVE_PATTERN);
    if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2];
        const now = new Date();
        switch (unit) {
        case 'd': return startOfDay(addDays(now, amount));
        case 'w': return startOfDay(addWeeks(now, amount));
        case 'm': return startOfDay(addMonths(now, amount));
        case 'H': return addHours(now, amount);
        case 'M': return addMinutes(now, amount);
        case 'S': return addSeconds(now, amount);
        default: return null;
        }
    }
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
}

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
            defaultMessage: 'DateTime field must be in YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss+HH:MM format',
        });
    }

    // Range validation against min_date / max_date (datetime_config takes precedence over legacy fields)
    const effectiveMinDate = elem.datetime_config?.min_date ?? elem.min_date;
    const effectiveMaxDate = elem.datetime_config?.max_date ?? elem.max_date;
    if (effectiveMinDate) {
        const minDate = resolveBoundToDate(effectiveMinDate);
        if (minDate && parsedDate < minDate) {
            return defineMessage({
                id: 'interactive_dialog.error.before_min_date',
                defaultMessage: 'Selected time is before the minimum allowed date.',
            });
        }
    }
    if (effectiveMaxDate) {
        const maxDate = resolveBoundToDate(effectiveMaxDate);
        if (maxDate && parsedDate > maxDate) {
            return defineMessage({
                id: 'interactive_dialog.error.after_max_date',
                defaultMessage: 'Selected time is after the maximum allowed date.',
            });
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
