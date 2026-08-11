// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    MmBlock,
    MmBoolInputBlock,
    MmDateInputBlock,
    MmDateTimeInputBlock,
    MmFileInputBlock,
    MmSelectInputBlock,
    MmTextInputBlock,
} from '@mattermost/types/mm_blocks';

import {checkDateTimeFieldValue} from 'mattermost-redux/utils/integration_utils';

import type {MmBlocksFormValues, MmFormValue} from './form';

export type MmBlocksFormField =
    MmTextInputBlock |
    MmBoolInputBlock |
    MmSelectInputBlock |
    MmDateInputBlock |
    MmDateTimeInputBlock |
    MmFileInputBlock;

export type MmBlocksFormFieldError = {
    id: string;
    defaultMessage: string;
    values?: Record<string, string | number>;
};

function isFormFieldBlock(block: MmBlock): block is MmBlocksFormField {
    switch (block.type) {
    case 'text_input':
    case 'bool_input':
    case 'select':
    case 'date_input':
    case 'datetime_input':
    case 'file_input':
        return true;
    default:
        return false;
    }
}

/** Depth-first collect of form input blocks from an mm_blocks tree. */
export function collectMmBlocksFormFields(blocks: MmBlock[]): MmBlocksFormField[] {
    const out: MmBlocksFormField[] = [];

    const visit = (block: MmBlock) => {
        if (isFormFieldBlock(block)) {
            out.push(block);
            return;
        }
        switch (block.type) {
        case 'container':
            block.content?.forEach(visit);
            break;
        case 'collapsible':
            block.header?.forEach(visit);
            block.content?.forEach(visit);
            break;
        case 'column':
            block.items?.forEach(visit);
            break;
        case 'column_set':
            block.columns?.forEach(visit);
            break;
        default:
            break;
        }
    };

    blocks.forEach(visit);
    return out;
}

/** True when actionId is a button with subtype submit somewhere in the tree. */
export function isMmBlocksSubmitAction(blocks: MmBlock[], actionId: string): boolean {
    if (!actionId) {
        return false;
    }

    const visit = (block: MmBlock): boolean => {
        if (block.type === 'button' && block.subtype === 'submit' && block.action_id === actionId) {
            return true;
        }
        switch (block.type) {
        case 'container':
            return Boolean(block.content?.some(visit));
        case 'collapsible':
            return Boolean(block.header?.some(visit) || block.content?.some(visit));
        case 'column':
            return Boolean(block.items?.some(visit));
        case 'column_set':
            return Boolean(block.columns?.some(visit));
        default:
            return false;
        }
    };

    return blocks.some(visit);
}

function isEmptyFormValue(value: MmFormValue | undefined): boolean {
    if (value === undefined || value === null) {
        return true;
    }
    if (typeof value === 'boolean') {
        // Unchecked checkbox is still an explicit value.
        return false;
    }

    if (typeof value === 'number') {
        // Match interactive dialogs: 0 is a filled value; only non-finite is empty.
        return !Number.isFinite(value);
    }

    if (Array.isArray(value)) {
        return value.length === 0;
    }

    return value === '';
}

/**
 * Validate one mm_blocks form field (required, lengths, subtype, option, date format).
 * Mirrors checkDialogElementForError for the blocks form model.
 */
export function checkMmBlocksFormFieldForError(
    field: MmBlocksFormField,
    value: MmFormValue | undefined,
): MmBlocksFormFieldError | null {
    if (isEmptyFormValue(value) && field.optional !== true) {
        return {
            id: 'interactive_dialog.error.required',
            defaultMessage: 'This field is required.',
        };
    }

    if (isEmptyFormValue(value)) {
        return null;
    }

    switch (field.type) {
    case 'text_input': {
        const stringValue = String(value);
        if (field.min_length !== undefined && stringValue.length < field.min_length) {
            return {
                id: 'interactive_dialog.error.too_short',
                defaultMessage: 'Minimum input length is {minLength}.',
                values: {minLength: field.min_length},
            };
        }
        if (field.max_length !== undefined && field.max_length > 0 && stringValue.length > field.max_length) {
            return {
                id: 'interactive_dialog.error.too_long',
                defaultMessage: 'Maximum input length is {maxLength}.',
                values: {maxLength: field.max_length},
            };
        }
        if (field.subtype === 'email' && !stringValue.includes('@')) {
            return {
                id: 'interactive_dialog.error.bad_email',
                defaultMessage: 'Must be a valid email address.',
            };
        }
        if (field.subtype === 'number' && Number.isNaN(Number(stringValue))) {
            return {
                id: 'interactive_dialog.error.bad_number',
                defaultMessage: 'Must be a number.',
            };
        }
        if (field.subtype === 'url' && !stringValue.includes('http://') && !stringValue.includes('https://')) {
            return {
                id: 'interactive_dialog.error.bad_url',
                defaultMessage: 'URL must include http:// or https://.',
            };
        }
        return null;
    }
    case 'select': {
        if (field.options?.length && typeof value === 'string') {
            const valid = field.options.some((opt) => opt.value === value);
            if (!valid) {
                return {
                    id: 'interactive_dialog.error.invalid_option',
                    defaultMessage: 'Must be a valid option',
                };
            }
        }
        if (field.options?.length && Array.isArray(value)) {
            const invalid = value.some((v) => !field.options!.some((opt) => opt.value === v));
            if (invalid) {
                return {
                    id: 'interactive_dialog.error.invalid_option',
                    defaultMessage: 'Must be a valid option',
                };
            }
        }
        return null;
    }
    case 'date_input':
    case 'datetime_input': {
        if (typeof value !== 'string') {
            return null;
        }
        const fieldType = field.type === 'date_input' ? 'date' : 'datetime';
        const error = checkDateTimeFieldValue(value, fieldType, {
            datetime_config: field.datetime_config,
        });
        if (!error) {
            return null;
        }
        return {
            id: error.id,
            defaultMessage: error.defaultMessage,
            values: error.values,
        };
    }
    case 'file_input':
        if (Array.isArray(value)) {
            return null;
        }
        if (typeof value !== 'string') {
            return {
                id: 'interactive_dialog.error.invalid_file',
                defaultMessage: 'Invalid file upload.',
            };
        }
        return null;
    case 'bool_input':
        return null;
    default:
        return null;
    }
}

/** Validate all form fields in an mm_blocks tree; returns field-name → error descriptor. */
export function validateMmBlocksFormValues(
    blocks: MmBlock[],
    values: MmBlocksFormValues,
): Record<string, MmBlocksFormFieldError> {
    const errors: Record<string, MmBlocksFormFieldError> = {};
    for (const field of collectMmBlocksFormFields(blocks)) {
        if (!field.name) {
            continue;
        }
        const error = checkMmBlocksFormFieldForError(field, values[field.name]);
        if (error) {
            errors[field.name] = error;
        }
    }
    return errors;
}
