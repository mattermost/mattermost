// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Block Kit (`props.blocks`) → mm_blocks

import type {
    MmBlock,
    MmColumnBlock,
    MmContainerBlock,
    MmDateInputBlock,
    MmDateTimeInputBlock,
    MmFileInputBlock,
    MmImageSize,
    MmSelectInputBlock,
    MmSelectOptionGroup,
    MmStaticSelectOption,
    MmTextInputBlock,
} from '@mattermost/types/mm_blocks';
import {ensureString} from '@mattermost/types/utilities';

import {parseMmButtonStyle} from '../utils/button';

export function translateBlockKit(blocks: unknown[]): MmBlock[] {
    const result: MmBlock[] = [];
    for (const block of blocks) {
        const translated = translateBlockKitBlock(block);
        if (translated) {
            if (Array.isArray(translated)) {
                result.push(...translated);
            } else {
                result.push(translated);
            }
        }
    }
    return result;
}

function translateBlockKitBlock(
    block: unknown,
): MmBlock | null {
    if (typeof block !== 'object' || !block) {
        return null;
    }
    const b = block as Record<string, unknown>;

    switch (b.type) {
    case 'section': {
        return translateBlockKitSection(b);
    }
    case 'header': {
        const plain = extractBlockKitTextContent(b.text);
        if (!plain) {
            return null;
        }
        return {type: 'text', text: `# ${plain}`};
    }
    case 'markdown': {
        const text = ensureString(b.text);
        if (!text.trim()) {
            return null;
        }
        return {type: 'text', text};
    }
    case 'divider':
        return {type: 'divider'};
    case 'image': {
        return translateBlockKitImagePayload(b, 'large');
    }
    case 'actions': {
        return translateBlockKitActionRows(b.elements);
    }
    case 'input': {
        return translateBlockKitInput(b);
    }
    default:
        return null;
    }
}

function translateBlockKitInput(b: Record<string, unknown>): MmBlock | null {
    const label = extractBlockKitTextContent(b.label);
    if (!label) {
        return null;
    }

    const element = b.element;
    if (typeof element !== 'object' || !element) {
        return null;
    }
    const el = element as Record<string, unknown>;
    const name = ensureString(el.action_id);
    if (!name.trim()) {
        return null;
    }

    switch (el.type) {
    case 'plain_text_input':
        return translateBlockKitPlainTextInput(b, el, name, label);
    case 'datepicker':
        return translateBlockKitDatepicker(b, el, name, label);
    case 'datetimepicker':
        return translateBlockKitDatetimepicker(b, el, name, label);
    case 'file_input':
        return translateBlockKitFileInput(b, el, name, label);
    case 'static_select':
    case 'radio_buttons':
    case 'checkboxes':
    case 'multi_static_select':
        return translateBlockKitSelectInput(b, el, name, label);
    default:
        return null;
    }
}

function applyBlockKitInputSharedProps(
    out: {optional?: boolean; help_text?: string; onChange?: string},
    b: Record<string, unknown>,
    name: string,
) {
    if (b.optional === true) {
        out.optional = true;
    }
    const hint = extractBlockKitTextContent(b.hint);
    if (hint) {
        out.help_text = hint;
    }
    if (b.dispatch_action === true) {
        out.onChange = name;
    }
}

function translateBlockKitDatepicker(
    b: Record<string, unknown>,
    el: Record<string, unknown>,
    name: string,
    label: string,
): MmDateInputBlock {
    const out: MmDateInputBlock = {
        type: 'date_input',
        name,
        label,
    };
    applyBlockKitInputSharedProps(out, b, name);

    const placeholder = extractBlockKitTextContent(el.placeholder);
    if (placeholder) {
        out.placeholder = placeholder;
    }

    const initial = ensureString(el.initial_date);
    if (initial) {
        out.initial_value = initial;
    }

    return out;
}

function translateBlockKitDatetimepicker(
    b: Record<string, unknown>,
    el: Record<string, unknown>,
    name: string,
    label: string,
): MmDateTimeInputBlock {
    const out: MmDateTimeInputBlock = {
        type: 'datetime_input',
        name,
        label,
    };
    applyBlockKitInputSharedProps(out, b, name);

    if (typeof el.initial_date_time === 'number' && Number.isFinite(el.initial_date_time)) {
        out.initial_value = new Date(el.initial_date_time * 1000).toISOString();
    }

    return out;
}

function translateBlockKitFileInput(
    b: Record<string, unknown>,
    el: Record<string, unknown>,
    name: string,
    label: string,
): MmFileInputBlock {
    const out: MmFileInputBlock = {
        type: 'file_input',
        name,
        label,
    };
    applyBlockKitInputSharedProps(out, b, name);

    // Block Kit defaults max_files to 10 when omitted; only an explicit max_files of 1 is single-file.
    if (el.max_files === undefined || (typeof el.max_files === 'number' && el.max_files > 1)) {
        out.allow_multiple = true;
    }

    return out;
}

function translateBlockKitPlainTextInput(
    b: Record<string, unknown>,
    el: Record<string, unknown>,
    name: string,
    label: string,
): MmTextInputBlock {
    const out: MmTextInputBlock = {
        type: 'text_input',
        name,
        label,
    };
    applyBlockKitInputSharedProps(out, b, name);

    if (el.multiline === true) {
        out.multiline = true;
    }

    const placeholder = extractBlockKitTextContent(el.placeholder);
    if (placeholder) {
        out.placeholder = placeholder;
    }

    const initialValue = ensureString(el.initial_value);
    if (initialValue) {
        out.initial_value = initialValue;
    }

    if (typeof el.min_length === 'number' && Number.isFinite(el.min_length)) {
        out.min_length = el.min_length;
    }
    if (typeof el.max_length === 'number' && Number.isFinite(el.max_length)) {
        out.max_length = el.max_length;
    }

    return out;
}

function translateBlockKitSelectInput(
    b: Record<string, unknown>,
    el: Record<string, unknown>,
    name: string,
    label: string,
): MmSelectInputBlock | null {
    const options = translateBlockKitSelectOptions(el.options);
    const optionGroups = translateBlockKitOptionGroups(el.option_groups);
    if (options.length > 0 && optionGroups.length > 0) {
        return null;
    }
    if (options.length === 0 && optionGroups.length === 0) {
        return null;
    }

    const out: MmSelectInputBlock = {
        type: 'select',
        name,
        label,
    };
    applyBlockKitInputSharedProps(out, b, name);

    const placeholder = extractBlockKitTextContent(el.placeholder);
    if (placeholder) {
        out.placeholder = placeholder;
    }

    if (options.length > 0) {
        out.options = options;
    }
    if (optionGroups.length > 0) {
        out.option_groups = optionGroups;
    }

    if (el.type === 'radio_buttons' || el.type === 'checkboxes') {
        out.style = 'expanded';
    }
    if (el.type === 'checkboxes' || el.type === 'multi_static_select') {
        out.multiselect = true;
    }

    const initialOption = translateBlockKitInitialOptionValue(el.initial_option);
    if (initialOption) {
        out.initial_option = initialOption;
    }

    const initialOptions = translateBlockKitInitialOptionsValues(el.initial_options);
    if (initialOptions.length > 0) {
        out.initial_options = initialOptions;
    }

    return out;
}

function translateBlockKitOptionGroups(raw: unknown): MmSelectOptionGroup[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const result: MmSelectOptionGroup[] = [];
    for (const group of raw) {
        if (typeof group !== 'object' || !group) {
            continue;
        }
        const g = group as Record<string, unknown>;
        const groupLabel = extractBlockKitTextContent(g.label);
        const options = translateBlockKitSelectOptions(g.options);
        if (groupLabel && options.length > 0) {
            result.push({label: groupLabel, options});
        }
    }
    return result;
}

function translateBlockKitInitialOptionValue(raw: unknown): string {
    if (typeof raw !== 'object' || !raw) {
        return '';
    }
    return ensureString((raw as Record<string, unknown>).value);
}

function translateBlockKitInitialOptionsValues(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const result: string[] = [];
    for (const opt of raw) {
        const value = translateBlockKitInitialOptionValue(opt);
        if (value) {
            result.push(value);
        }
    }
    return result;
}

function translateBlockKitSection(
    b: Record<string, unknown>,
): MmContainerBlock | null {
    const textContent = extractBlockKitTextContent(b.text);
    const accessory = b.accessory;
    const fieldBlocks = sectionFieldsToMmBlocks(b.fields);

    if (!textContent && !fieldBlocks.length) {
        return null;
    }

    const content: MmBlock[] = [];

    let accessoryColumn;
    if (accessory) {
        const accessoryBlock = translateBlockKitAccessory(accessory);
        if (accessoryBlock) {
            accessoryColumn = {
                type: 'column' as const,
                width: 'auto' as const,
                items: [accessoryBlock],
            };
        }
    }

    if (accessoryColumn) {
        const mainColumn: MmColumnBlock = {
            type: 'column',
            width: 'stretch',
            items: [],
        };
        if (textContent) {
            mainColumn.items.push({type: 'text', text: textContent});
        }
        mainColumn.items.push(...fieldBlocks);
        if (mainColumn.items.length > 0) {
            content.push({type: 'column_set', columns: [mainColumn, accessoryColumn]});
        }
    } else {
        if (textContent) {
            content.push({type: 'text', text: textContent});
        }
        content.push(...fieldBlocks);
    }

    if (content.length === 0) {
        return null;
    }

    return {
        type: 'container',
        content,
    };
}

/**
 * Section `fields`: up to 10 text objects laid out in two columns (row-major).
 * Same pairing model as legacy attachment `short` fields → column_set + full-width remainder.
 */
function sectionFieldsToMmBlocks(fields: unknown): MmBlock[] {
    if (!Array.isArray(fields)) {
        return [];
    }
    const texts: string[] = [];
    for (const field of fields) {
        const content = extractBlockKitTextContent(field);
        if (content) {
            texts.push(content);
        }
    }
    if (texts.length === 0) {
        return [];
    }
    const out: MmBlock[] = [];
    let pending: string | null = null;
    for (const content of texts) {
        if (pending) {
            const left: MmColumnBlock = {
                type: 'column',
                width: 'stretch',
                items: [{type: 'text', text: pending}],
            };
            const right: MmColumnBlock = {
                type: 'column',
                width: 'stretch',
                items: [{type: 'text', text: content}],
            };
            out.push({type: 'column_set', columns: [left, right]});
            pending = null;
        } else {
            pending = content;
        }
    }
    if (pending) {
        out.push({
            type: 'text',
            text: pending,
        });
    }
    return out;
}

function translateBlockKitAccessory(
    accessory: unknown,
): MmBlock | null {
    if (typeof accessory !== 'object' || !accessory) {
        return null;
    }
    const a = accessory as Record<string, unknown>;
    if (a.type === 'button') {
        const text = extractBlockKitTextContent(a.text);
        const actionId = ensureString(a.action_id);
        if (!text || !actionId) {
            return null;
        }
        return {
            type: 'button',
            action_id: actionId,
            text,
            style: parseMmButtonStyle(ensureString(a.style)),
        };
    }
    if (a.type === 'image') {
        return translateBlockKitImagePayload(a, 'small');
    }
    return null;
}

/** Block Kit `image` block or `image` element (e.g. section accessory): `image_url`, `alt_text`, optional `title`. */
function translateBlockKitImagePayload(
    payload: Record<string, unknown>,
    size: MmImageSize,
): MmBlock | null {
    const imageUrl = ensureString(payload.image_url);
    const altText = ensureString(payload.alt_text);
    if (!imageUrl || !altText) {
        return null;
    }
    const title = extractBlockKitTextContent(payload.title) || undefined;
    return {
        type: 'image',
        url: imageUrl,
        alt_text: altText,
        title,
        size,
    };
}

function translateBlockKitActionRows(elements: unknown): MmContainerBlock | null {
    if (!Array.isArray(elements)) {
        return null;
    }
    const result: MmContainerBlock = {
        type: 'container',
        flow: 'horizontal',
        content: [],
    };
    for (const el of elements as unknown[]) {
        if (typeof el !== 'object' || !el) {
            continue;
        }
        const e = el as Record<string, unknown>;
        if (e.type === 'button') {
            const text = extractBlockKitTextContent(e.text);
            const actionId = ensureString(e.action_id);
            if (!text || !actionId) {
                continue;
            }
            result.content.push({
                type: 'button',
                action_id: actionId,
                text,
                style: parseMmButtonStyle(ensureString(e.style)),
            });
        } else if (e.type === 'static_select') {
            const placeholder = extractBlockKitTextContent(e.placeholder);
            const actionId = ensureString(e.action_id);
            if (!placeholder || !actionId) {
                continue;
            }
            const options = translateBlockKitSelectOptions(e.options);
            if (options.length === 0) {
                continue;
            }
            result.content.push({
                type: 'static_select',
                action_id: actionId,
                placeholder,
                options,
            });
        }
    }
    if (result.content.length === 0) {
        return null;
    }
    return result;
}

function translateBlockKitSelectOptions(options: unknown): MmStaticSelectOption[] {
    if (!Array.isArray(options)) {
        return [];
    }
    const result: MmStaticSelectOption[] = [];
    for (const opt of options) {
        if (typeof opt !== 'object' || !opt) {
            continue;
        }
        const o = opt as Record<string, unknown>;
        const text = extractBlockKitTextContent(o.text);
        const value = ensureString(o.value);
        if (text && value) {
            result.push({text, value});
        }
    }
    return result;
}

function extractBlockKitTextContent(textObj: unknown): string {
    if (typeof textObj !== 'object' || !textObj) {
        return '';
    }
    const t = textObj as Record<string, unknown>;
    const text = ensureString(t.text);
    if (text) {
        return text;
    }
    return '';
}
