// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid, addDays, addWeeks, addMonths, addHours, addMinutes, addSeconds, startOfDay} from 'date-fns';
import {defineMessages} from 'react-intl';

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

const messages = defineMessages({
    badFormat: {
        id: 'interactive_dialog.error.bad_format',
        defaultMessage: 'Invalid date format',
    },
    badDateFormat: {
        id: 'interactive_dialog.error.bad_date_format',
        defaultMessage: 'Date field must be in YYYY-MM-DD format',
    },
    badDatetimeFormat: {
        id: 'interactive_dialog.error.bad_datetime_format',
        defaultMessage: 'DateTime field must be in YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss+HH:MM format',
    },
    beforeMinDate: {
        id: 'interactive_dialog.error.before_min_date',
        defaultMessage: 'Selected time is before the minimum allowed date.',
    },
    afterMaxDate: {
        id: 'interactive_dialog.error.after_max_date',
        defaultMessage: 'Selected time is after the maximum allowed date.',
    },
    required: {
        id: 'interactive_dialog.error.required',
        defaultMessage: 'This field is required.',
    },
    tooShort: {
        id: 'interactive_dialog.error.too_short',
        defaultMessage: 'Minimum input length is {minLength}.',
    },
    tooLong: {
        id: 'interactive_dialog.error.too_long',
        defaultMessage: 'Maximum input length is {maxLength}.',
    },
    badEmail: {
        id: 'interactive_dialog.error.bad_email',
        defaultMessage: 'Must be a valid email address.',
    },
    badNumber: {
        id: 'interactive_dialog.error.bad_number',
        defaultMessage: 'Must be a number.',
    },
    badUrl: {
        id: 'interactive_dialog.error.bad_url',
        defaultMessage: 'URL must include http:// or https://.',
    },
    invalidOption: {
        id: 'interactive_dialog.error.invalid_option',
        defaultMessage: 'Must be a valid option',
    },
    invalidFile: {
        id: 'interactive_dialog.error.invalid_file',
        defaultMessage: 'Invalid file upload.',
    },
});

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
 * Validates date/datetime field values for format and range constraints.
 * `fieldType` is `date` / `datetime` (dialog) or treated the same for mm_blocks date_input / datetime_input.
 */
export function checkDateTimeFieldValue(
    value: string,
    fieldType: 'date' | 'datetime',
    bounds?: {
        min_date?: string;
        max_date?: string;
        datetime_config?: {min_date?: string; max_date?: string};
    },
): DialogError | null {
    const parsedDate = parseISO(value);
    if (!isValid(parsedDate)) {
        return messages.badFormat;
    }

    if (fieldType === 'date') {
        if (!DATE_FORMAT_PATTERN.test(value)) {
            return messages.badDateFormat;
        }
    } else if (!DATETIME_FORMAT_PATTERN.test(value)) {
        return messages.badDatetimeFormat;
    }

    const effectiveMinDate = bounds?.datetime_config?.min_date ?? bounds?.min_date;
    const effectiveMaxDate = bounds?.datetime_config?.max_date ?? bounds?.max_date;
    if (effectiveMinDate) {
        const minDate = resolveBoundToDate(effectiveMinDate);
        if (minDate && parsedDate < minDate) {
            return messages.beforeMinDate;
        }
    }
    if (effectiveMaxDate) {
        const maxDate = resolveBoundToDate(effectiveMaxDate);
        if (maxDate && parsedDate > maxDate) {
            return messages.afterMaxDate;
        }
    }

    return null;
}

function validateDateTimeValue(value: string, elem: DialogElement): DialogError | null {
    const fieldType = elem.type === 'date' ? 'date' : 'datetime';
    return checkDateTimeFieldValue(value, fieldType, {
        min_date: elem.min_date,
        max_date: elem.max_date,
        datetime_config: elem.datetime_config,
    });
}

export function checkDialogElementForError(elem: DialogElement, value: any): DialogError | undefined | null {
    if (elem.type === 'action_button') {
        return null;
    }

    // Check if value is empty (handles arrays for multiselect)
    let isEmpty;
    if (typeof value === 'boolean') {
        // Explicit false is a valid bool value, not "empty".
        isEmpty = false;
    } else if (value === 0) {
        isEmpty = false;
    } else if (Array.isArray(value)) {
        isEmpty = value.length === 0;
    } else {
        isEmpty = !value;
    }

    if (isEmpty && !elem.optional) {
        return messages.required;
    }

    const type = elem.type;

    if (type === 'text' || type === 'textarea') {
        if (value && elem.min_length !== undefined && value.length < elem.min_length) {
            return {
                ...messages.tooShort,
                values: {minLength: elem.min_length},
            };
        }

        if (value && elem.max_length !== undefined && elem.max_length > 0 && value.length > elem.max_length) {
            return {
                ...messages.tooLong,
                values: {maxLength: elem.max_length},
            };
        }

        if (elem.subtype === 'email') {
            if (value && !value.includes('@')) {
                return messages.badEmail;
            }
        }

        if (elem.subtype === 'number') {
            if (value && isNaN(value)) {
                return messages.badNumber;
            }
        }

        if (elem.subtype === 'url') {
            if (value && !value.includes('http://') && !value.includes('https://')) {
                return messages.badUrl;
            }
        }
    } else if (type === 'radio') {
        const options = elem.options;

        if (typeof value !== 'undefined' && Array.isArray(options) && !options.some((e) => e.value === value)) {
            return messages.invalidOption;
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
    } else if (type === 'file') {
        // File elements store file IDs, so we just need to check if file was uploaded
        // The actual validation that file exists will be done server-side
        if (Array.isArray(value) && value.length === 0) {
            // An empty array means no files selected — treat as no value, not invalid.
            return null;
        }
        if (value && typeof value !== 'string') {
            return messages.invalidFile;
        }
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
