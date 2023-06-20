// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DialogElement} from '@mattermost/types/integrations';

type DialogError = {
    id: string;
    defaultMessage: string;
    values?: any;
};
export function checkDialogElementForError(elem: DialogElement, value: any): DialogError | undefined | null {
    if (!value && !elem.optional) {
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
    }

    return null;
}

// If we're returned errors that don't match any of the elements we have,
// ignore them and complete the dialog

export function checkIfErrorsMatchElements(errors: {
    [x: string]: DialogError;
} = {}, elements: DialogElement[] = []) {
    for (const name in errors) {
        if (!errors.hasOwnProperty(name)) {
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
