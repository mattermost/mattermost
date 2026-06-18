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
    default:
        return null;
    }
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
