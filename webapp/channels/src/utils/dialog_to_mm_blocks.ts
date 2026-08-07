// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DialogElement} from '@mattermost/types/integrations';
import type {MmBlock, MmDateTimeConfig, MmTextInputSubtype} from '@mattermost/types/mm_blocks';

import {DialogElementTypes, validateDialogElement, ValidationErrorCode, type ConversionOptions, type ValidationError} from './dialog_conversion';

/** Synthetic action id for the dialog submit button (legacy Interactive Dialog path). */
export const DIALOG_SUBMIT_ACTION_ID = 'dialog_submit';

export type DialogToMmBlocksResult = {
    blocks: MmBlock[];
    errors: ValidationError[];
};

function boolDefault(value: string | undefined): boolean | undefined {
    if (value === undefined || value === '') {
        return undefined;
    }
    const lower = String(value).toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === '1') {
        return true;
    }
    if (lower === 'false' || lower === 'no' || lower === '0') {
        return false;
    }
    return undefined;
}

function selectOptions(element: DialogElement): Array<{text: string; value: string}> | undefined {
    if (!element.options?.length) {
        return undefined;
    }
    return element.options.map((opt) => ({
        text: String(opt.text ?? ''),
        value: String(opt.value ?? ''),
    }));
}

function textSubtype(subtype: string | undefined): MmTextInputSubtype | undefined {
    if (!subtype) {
        return undefined;
    }
    switch (subtype) {
    case 'email':
    case 'number':
    case 'password':
    case 'tel':
    case 'url':
        return subtype;
    default:
        return 'text';
    }
}

/**
 * Merge datetime_config over deprecated top-level dialog fields (datetime_config wins).
 * Matches the Apps Form conversion path in dialog_conversion.ts.
 */
function dialogDateTimeConfig(element: DialogElement): MmDateTimeConfig | undefined {
    const minDate = element.datetime_config?.min_date ?? element.min_date;
    const maxDate = element.datetime_config?.max_date ?? element.max_date;
    const timeInterval = element.datetime_config?.time_interval ?? element.time_interval;

    const merged: MmDateTimeConfig = {};
    if (element.datetime_config?.location_timezone) {
        merged.location_timezone = element.datetime_config.location_timezone;
    }
    if (element.datetime_config?.manual_time_entry || element.datetime_config?.allow_manual_time_entry) {
        merged.manual_time_entry = true;
    }
    if (minDate !== undefined && minDate !== '') {
        merged.min_date = String(minDate);
    }
    if (maxDate !== undefined && maxDate !== '') {
        merged.max_date = String(maxDate);
    }
    if (timeInterval !== undefined && element.type === DialogElementTypes.DATETIME) {
        merged.time_interval = Number(timeInterval);
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Convert a single DialogElement into an mm_blocks form/control block.
 * Returns null when the element cannot be converted.
 */
export function convertDialogElementToMmBlock(element: DialogElement): MmBlock | null {
    if (!element?.name || !element.type) {
        return null;
    }

    const base = {
        name: String(element.name),
        label: String(element.display_name || element.name),
        help_text: element.help_text ? String(element.help_text) : undefined,
        optional: Boolean(element.optional),
        onChange: element.refresh ? String(element.name) : undefined,
    };

    switch (element.type) {
    case DialogElementTypes.TEXT:
        return {
            type: 'text_input',
            ...base,
            subtype: textSubtype(element.subtype),
            placeholder: element.placeholder || undefined,
            initial_value: element.default || undefined,
            min_length: element.min_length || undefined,
            max_length: element.max_length || undefined,
        };
    case DialogElementTypes.TEXTAREA:
        return {
            type: 'text_input',
            ...base,
            multiline: true,
            placeholder: element.placeholder || undefined,
            initial_value: element.default || undefined,
            min_length: element.min_length || undefined,
            max_length: element.max_length || undefined,
        };
    case DialogElementTypes.BOOL:
        return {
            type: 'bool_input',
            ...base,
            placeholder: element.placeholder || undefined,
            initial_value: boolDefault(element.default),
        };
    case DialogElementTypes.RADIO:
        return {
            type: 'select',
            ...base,
            style: 'expanded',
            options: selectOptions(element),
            initial_option: element.default || undefined,
            placeholder: element.placeholder || undefined,
        };
    case DialogElementTypes.SELECT: {
        const dataSource = element.data_source || undefined;
        const block: MmBlock = {
            type: 'select',
            ...base,
            placeholder: element.placeholder || undefined,
            multiselect: element.multiselect || undefined,
            options: dataSource ? undefined : selectOptions(element),
            data_source: dataSource,
            data_source_action: dataSource === 'dynamic' ? String(element.name) : undefined,
            initial_option: element.default && !element.multiselect ? String(element.default) : undefined,
            initial_options: element.multiselect && element.default ?
                String(element.default).split(',').map((v) => v.trim()).filter(Boolean) :
                undefined,
        };
        return block;
    }
    case DialogElementTypes.DATE:
        return {
            type: 'date_input',
            ...base,
            placeholder: element.placeholder || undefined,
            initial_value: element.default || undefined,
            datetime_config: dialogDateTimeConfig(element),
        };
    case DialogElementTypes.DATETIME:
        return {
            type: 'datetime_input',
            ...base,
            placeholder: element.placeholder || undefined,
            initial_value: element.default || undefined,
            datetime_config: dialogDateTimeConfig(element),
        };
    case DialogElementTypes.FILE:
        return {
            type: 'file_input',
            ...base,
            placeholder: element.placeholder || undefined,
            allow_multiple: element.allow_multiple || undefined,
            initial_value: element.default || undefined,
        };
    case DialogElementTypes.ACTION_BUTTON:
        return {
            type: 'button',
            text: String(element.display_name || element.name),
            action_id: String(element.name),
            subtype: 'execute',
            query: {
                ...(element.action_button?.context || {}),
                __dialog_action_button: '1',
                ...(element.action_button?.url ? {__dialog_action_url: element.action_button.url} : {}),
            },
        };
    default:
        return null;
    }
}

/**
 * Convert a legacy Interactive Dialog definition into mm_blocks for BlockRenderer.
 * Submit/cancel chrome belongs in the dialog footer (see BlocksDialogShell), not in blocks.
 */
export function convertDialogToMmBlocks(
    elements: DialogElement[] | undefined,
    introductionText: string | undefined,
    _submitLabel?: string | undefined,
    options: ConversionOptions = {enhanced: false},
): DialogToMmBlocksResult {
    const errors: ValidationError[] = [];
    const blocks: MmBlock[] = [];

    if (introductionText?.trim()) {
        blocks.push({
            type: 'text',
            text: String(introductionText),
        });
    }

    elements?.forEach((element, index) => {
        errors.push(...validateDialogElement(element, index, options));
        const block = convertDialogElementToMmBlock(element);
        if (block) {
            blocks.push(block);
        } else if (options.enhanced) {
            errors.push({
                field: `elements[${index}]`,
                message: `Unsupported dialog element type: ${element.type}`,
                code: ValidationErrorCode.CONVERSION_ERROR,
            });
        }
    });

    return {blocks, errors};
}

/**
 * Whether the dialog modal footer should show a Submit button.
 * Action-button-only dialogs omit Submit unless submit_label is set.
 */
export function dialogShouldShowSubmitChrome(
    elements: DialogElement[] | undefined,
    submitLabel: string | undefined,
): boolean {
    const hasFormFields = elements?.some((el) => el.type !== DialogElementTypes.ACTION_BUTTON) ?? false;
    const actionButtonsOnly = (elements?.length ?? 0) > 0 && !hasFormFields;
    return !actionButtonsOnly || Boolean(submitLabel);
}
