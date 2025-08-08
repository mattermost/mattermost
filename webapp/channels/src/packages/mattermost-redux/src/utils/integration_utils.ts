// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DialogElement} from '@mattermost/types/integrations';

type DialogError = {
    id: string;
    defaultMessage: string;
    values?: any;
};
export function checkDialogElementForError(elem: DialogElement, value: any): DialogError | undefined | null {
    if ((!value && value !== 0) && !elem.optional) {
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
        // Import date utilities for validation
        const {stringToMoment, resolveRelativeDate} = require('utils/date_utils');
        
        // Validate min_date format if present
        if (elem.min_date) {
            const minDateResolved = resolveRelativeDate(elem.min_date);
            const minDateMoment = stringToMoment(minDateResolved);
            if (!minDateMoment) {
                return {
                    id: 'interactive_dialog.error.invalid_min_date',
                    defaultMessage: 'Invalid min_date format',
                };
            }
        }
        
        // Validate max_date format if present
        if (elem.max_date) {
            const maxDateResolved = resolveRelativeDate(elem.max_date);
            const maxDateMoment = stringToMoment(maxDateResolved);
            if (!maxDateMoment) {
                return {
                    id: 'interactive_dialog.error.invalid_max_date',
                    defaultMessage: 'Invalid max_date format',
                };
            }
        }
        
        if (value) {
            const date = stringToMoment(value);
            if (!date) {
                return {
                    id: 'interactive_dialog.error.invalid_date',
                    defaultMessage: 'Invalid date format',
                };
            }

            // Check min_date constraint
            if (elem.min_date) {
                const min = stringToMoment(resolveRelativeDate(elem.min_date));
                if (min && date.isBefore(min, 'day')) {
                    return {
                        id: 'interactive_dialog.error.date_too_early',
                        defaultMessage: 'Date must be after {minDate}',
                        values: {minDate: min.format('YYYY-MM-DD')},
                    };
                }
            }

            // Check max_date constraint
            if (elem.max_date) {
                const max = stringToMoment(resolveRelativeDate(elem.max_date));
                if (max && date.isAfter(max, 'day')) {
                    return {
                        id: 'interactive_dialog.error.date_too_late',
                        defaultMessage: 'Date must be before {maxDate}',
                        values: {maxDate: max.format('YYYY-MM-DD')},
                    };
                }
            }
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
