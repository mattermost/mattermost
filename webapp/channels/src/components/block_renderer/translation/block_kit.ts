// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Block Kit (`props.blocks`) → mm_blocks

import type {
    MmBlock,
    MmColumnBlock,
    MmContainerBlock,
    MmImageSize,
    MmStaticSelectOption,
} from '@mattermost/types/mm_blocks';

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
): MmBlock | MmBlock[] | null {
    if (typeof block !== 'object' || block === null) {
        return null;
    }
    const b = block as Record<string, unknown>;

    switch (b.type) {
    case 'section': {
        return translateBlockKitSection(b);
    }
    case 'header': {
        const plain = extractBlockKitPlainText(b.text);
        if (!plain) {
            return null;
        }
        return {type: 'text', text: `# ${plain}`};
    }
    case 'markdown': {
        if (typeof b.text !== 'string' || !b.text.trim()) {
            return null;
        }
        return {type: 'text', text: b.text};
    }
    case 'divider':
        return {type: 'divider'};
    case 'image': {
        return translateBlockKitImagePayload(b, 'large');
    }
    case 'actions': {
        return translateBlockKitActionRows(b.elements);
    }
    default:
        return null;
    }
}

function translateBlockKitSection(
    b: Record<string, unknown>,
): MmBlock | MmBlock[] {
    const textContent = extractBlockKitTextContent(b.text);
    const accessory = b.accessory as Record<string, unknown> | undefined;
    const fieldBlocks = sectionFieldsToMmBlocks(b.fields);

    let main: MmBlock | null = null;

    if (accessory && textContent !== null) {
        const textColumn: MmColumnBlock = {
            type: 'column',
            width: 'stretch',
            items: [{type: 'text', text: textContent}],
        };
        const accessoryBlock = translateBlockKitAccessory(accessory);
        const accessoryColumn: MmColumnBlock = {
            type: 'column',
            width: 'auto',
            items: accessoryBlock ? [accessoryBlock] : [],
        };
        if (accessoryColumn.items.length === 0) {
            main = {type: 'text', text: textContent};
        } else {
            main = {type: 'column_set', columns: [textColumn, accessoryColumn]};
        }
    } else if (textContent !== null) {
        main = {type: 'text', text: textContent};
    }

    if (main && fieldBlocks.length > 0) {
        return [main, ...fieldBlocks];
    }
    if (main) {
        return main;
    }
    if (fieldBlocks.length > 0) {
        return fieldBlocks;
    }
    return [];
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
        if (content !== null) {
            texts.push(content);
        }
    }
    if (texts.length === 0) {
        return [];
    }
    const out: MmBlock[] = [];
    let pending: string | null = null;
    for (const content of texts) {
        if (pending === null) {
            pending = content;
        } else {
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
        }
    }
    if (pending !== null) {
        out.push({
            type: 'text',
            text: pending,
        });
    }
    return out;
}

function translateBlockKitAccessory(
    accessory: Record<string, unknown>,
): MmBlock | null {
    if (accessory.type === 'button') {
        const text = extractBlockKitPlainText(accessory.text);
        if (!text || typeof accessory.action_id !== 'string' || !accessory.action_id) {
            return null;
        }
        return {
            type: 'button',
            action_id: accessory.action_id,
            text,
            style: parseMmButtonStyle(typeof accessory.style === 'string' ? accessory.style : undefined),
        };
    }
    if (accessory.type === 'image') {
        return translateBlockKitImagePayload(accessory, 'small');
    }
    return null;
}

/** Block Kit `image` block or `image` element (e.g. section accessory): `image_url`, `alt_text`, optional `title`. */
function translateBlockKitImagePayload(
    payload: Record<string, unknown>,
    size: MmImageSize,
): MmBlock | null {
    const imageUrl = typeof payload.image_url === 'string' ? payload.image_url : '';
    const altText = typeof payload.alt_text === 'string' ? payload.alt_text : '';
    if (!imageUrl || !altText) {
        return null;
    }
    const title = extractBlockKitPlainText(payload.title) ?? undefined;
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
    for (const el of elements) {
        if (typeof el !== 'object' || el === null) {
            continue;
        }
        const e = el as Record<string, unknown>;
        if (e.type === 'button') {
            const text = extractBlockKitPlainText(e.text);
            if (!text || typeof e.action_id !== 'string' || !e.action_id) {
                continue;
            }
            result.content.push({
                type: 'button',
                action_id: e.action_id,
                text,
                style: parseMmButtonStyle(typeof e.style === 'string' ? e.style : undefined),
            });
        } else if (e.type === 'static_select') {
            const placeholder = extractBlockKitPlainText(e.placeholder);
            if (!placeholder || typeof e.action_id !== 'string' || !e.action_id) {
                continue;
            }
            const options = translateBlockKitSelectOptions(e.options);
            if (options.length === 0) {
                continue;
            }
            result.content.push({
                type: 'static_select',
                action_id: e.action_id,
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
        if (typeof opt !== 'object' || opt === null) {
            continue;
        }
        const o = opt as Record<string, unknown>;
        const text = extractBlockKitPlainText(o.text);
        if (text && typeof o.value === 'string' && o.value) {
            result.push({text, value: o.value});
        }
    }
    return result;
}

function extractBlockKitTextContent(textObj: unknown): string | null {
    if (typeof textObj !== 'object' || textObj === null) {
        return null;
    }
    const t = textObj as Record<string, unknown>;
    if (typeof t.text === 'string' && t.text) {
        return t.text;
    }
    return null;
}

function extractBlockKitPlainText(textObj: unknown): string | null {
    if (typeof textObj === 'string') {
        return textObj || null;
    }
    if (typeof textObj !== 'object' || textObj === null) {
        return null;
    }
    const t = textObj as Record<string, unknown>;
    if (typeof t.text === 'string' && t.text) {
        return t.text;
    }
    return null;
}
