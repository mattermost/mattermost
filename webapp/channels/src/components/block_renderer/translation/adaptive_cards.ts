// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Microsoft Adaptive Cards (`props.cards`) → mm_blocks

import type {
    MmBlock,
    MmBoolInputBlock,
    MmButtonStyle,
    MmColumnBlock,
    MmContainerBlock,
    MmDateInputBlock,
    MmImageBlock,
    MmImageSize,
    MmSelectInputBlock,
    MmStaticSelectOption,
    MmTextInputBlock,
    MmTextInputSubtype,
} from '@mattermost/types/mm_blocks';
import {ensureString} from '@mattermost/types/utilities';

export function translateAdaptiveCards(cards: unknown[]): MmBlock[] {
    const result: MmBlock[] = [];
    for (const card of cards) {
        if (typeof card !== 'object' || card === null) {
            continue;
        }
        const c = card as Record<string, unknown>;
        if (c.type !== 'AdaptiveCard') {
            continue;
        }

        if (Array.isArray(c.body)) {
            for (const item of c.body) {
                const translated = translateAdaptiveCardItem(item);
                if (translated) {
                    result.push(...(Array.isArray(translated) ? translated : [translated]));
                }
            }
        }

        if (Array.isArray(c.actions)) {
            const actions = translateAdaptiveCardActions(c.actions);
            if (actions) {
                result.push(actions);
            }
        }
    }
    return result;
}

function translateAdaptiveCardItem(
    item: unknown,
): MmBlock | null {
    if (typeof item !== 'object' || item === null) {
        return null;
    }
    const i = item as Record<string, unknown>;

    switch (i.type) {
    case 'TextBlock': {
        if (typeof i.text !== 'string' || !i.text) {
            return null;
        }
        const acSize = ensureString(i.size);
        const size = acSize === 'Small' ? 'small' as const : undefined;
        return {
            type: 'text',
            text: i.text,
            is_subtle: i.isSubtle === true || undefined,
            ...(size ? {size} : {}),
        };
    }
    case 'Container': {
        if (!Array.isArray(i.items)) {
            return null;
        }
        const items: MmBlock[] = [];
        for (const sub of i.items) {
            const translated = translateAdaptiveCardItem(sub);
            if (translated) {
                items.push(...(Array.isArray(translated) ? translated : [translated]));
            }
        }
        if (items.length === 0) {
            return null;
        }
        return {type: 'container', content: items};
    }
    case 'ColumnSet': {
        if (!Array.isArray(i.columns)) {
            return null;
        }
        const columns: MmColumnBlock[] = [];
        for (const col of i.columns) {
            if (typeof col !== 'object' || col === null) {
                continue;
            }
            const colRecord = col as Record<string, unknown>;
            const colItems: MmBlock[] = [];
            if (Array.isArray(colRecord.items)) {
                for (const sub of colRecord.items) {
                    const translated = translateAdaptiveCardItem(sub);
                    if (translated) {
                        colItems.push(...(Array.isArray(translated) ? translated : [translated]));
                    }
                }
            }
            const width = colRecord.width === 'stretch' ? 'stretch' : 'auto';
            columns.push({type: 'column', items: colItems, width});
        }
        if (columns.length === 0) {
            return null;
        }
        return {type: 'column_set', columns};
    }
    case 'Image': {
        if (typeof i.url !== 'string' || !i.url) {
            return null;
        }
        const altText = ensureString(i.altText);
        const size = mapAdaptiveCardImageSize(i.size);
        const maxWidth = parseAdaptiveCardPixelDimension(i.width);
        const maxHeight = parseAdaptiveCardPixelDimension(i.height);
        const horizontalAlignment = mapAdaptiveCardHorizontalAlignment(i.horizontalAlignment);
        const imageBlock: MmImageBlock = {
            type: 'image',
            url: i.url,
            alt_text: altText,
            ...(size ? {size} : {}),
            ...(maxWidth === undefined ? {} : {max_width: maxWidth}),
            ...(maxHeight === undefined ? {} : {max_height: maxHeight}),
            ...(i.style === 'person' ? {image_style: 'person' as const} : {}),
            ...(horizontalAlignment ? {horizontal_alignment: horizontalAlignment} : {}),
        };
        return imageBlock;
    }
    case 'ActionSet': {
        if (!Array.isArray(i.actions)) {
            return null;
        }
        return translateAdaptiveCardActions(i.actions);
    }
    case 'Input.Text': {
        return translateAdaptiveCardTextInput(i);
    }
    case 'Input.Toggle': {
        return translateAdaptiveCardToggleInput(i);
    }
    case 'Input.ChoiceSet': {
        return translateAdaptiveCardChoiceSet(i);
    }
    case 'Input.Date': {
        return translateAdaptiveCardDateInput(i);
    }
    default:
        return null;
    }
}

function translateAdaptiveCardDateInput(i: Record<string, unknown>): MmDateInputBlock | null {
    const name = ensureString(i.id);
    if (!name.trim()) {
        return null;
    }

    const label = ensureString(i.label) || ensureString(i.placeholder) || name;

    const out: MmDateInputBlock = {
        type: 'date_input',
        name,
        label,
    };

    if (i.isRequired !== true) {
        out.optional = true;
    }

    const placeholder = ensureString(i.placeholder);
    if (placeholder) {
        out.placeholder = placeholder;
    }

    const value = ensureString(i.value);
    if (value) {
        out.initial_value = value;
    }

    const min = ensureString(i.min);
    const max = ensureString(i.max);
    if (min || max) {
        out.datetime_config = {
            ...(min ? {min_date: min} : {}),
            ...(max ? {max_date: max} : {}),
        };
    }

    if (i.isEnabled === false) {
        out.disabled = true;
    }

    return out;
}

function translateAdaptiveCardTextInput(i: Record<string, unknown>): MmTextInputBlock | null {
    const name = ensureString(i.id);
    if (!name.trim()) {
        return null;
    }

    const label = ensureString(i.label) || ensureString(i.placeholder) || name;

    const out: MmTextInputBlock = {
        type: 'text_input',
        name,
        label,
    };

    // Adaptive Cards inputs are optional unless `isRequired` is true.
    if (i.isRequired !== true) {
        out.optional = true;
    }

    const placeholder = ensureString(i.placeholder);
    if (placeholder) {
        out.placeholder = placeholder;
    }

    if (i.isMultiline === true) {
        out.multiline = true;
    }

    const initialValue = ensureString(i.value);
    if (initialValue) {
        out.initial_value = initialValue;
    }

    if (typeof i.maxLength === 'number' && Number.isFinite(i.maxLength)) {
        out.max_length = i.maxLength;
    }

    const subtype = mapAdaptiveCardTextInputStyle(i.style);
    if (subtype && subtype !== 'text') {
        out.subtype = subtype;
    }

    if (i.isEnabled === false) {
        out.disabled = true;
    }

    return out;
}

function translateAdaptiveCardToggleInput(i: Record<string, unknown>): MmBoolInputBlock | null {
    const name = ensureString(i.id);
    if (!name.trim()) {
        return null;
    }

    const title = ensureString(i.title);
    const label = ensureString(i.label);

    const out: MmBoolInputBlock = {
        type: 'bool_input',
        name,
        label,
    };

    // Adaptive Cards inputs are optional unless `isRequired` is true.
    if (i.isRequired !== true) {
        out.optional = true;
    }

    if (title) {
        out.placeholder = title;
    }

    const valueOn = ensureString(i.valueOn) || 'true';
    const rawValue = ensureString(i.value);
    if (rawValue) {
        out.initial_value = rawValue === valueOn;
    }

    if (i.isEnabled === false) {
        out.disabled = true;
    }

    return out;
}

function translateAdaptiveCardChoiceSet(i: Record<string, unknown>): MmSelectInputBlock | null {
    const name = ensureString(i.id);
    if (!name.trim()) {
        return null;
    }

    const label = ensureString(i.label) || ensureString(i.placeholder) || name;
    const options = translateAdaptiveCardChoices(i.choices);
    if (options.length === 0) {
        return null;
    }

    const out: MmSelectInputBlock = {
        type: 'select',
        name,
        label,
        options,
    };

    if (i.isRequired !== true) {
        out.optional = true;
    }

    const placeholder = ensureString(i.placeholder);
    if (placeholder) {
        out.placeholder = placeholder;
    }

    if (i.style === 'expanded') {
        out.style = 'expanded';
    }

    if (i.isMultiSelect === true) {
        out.multiselect = true;
    }

    const rawValue = ensureString(i.value);
    if (rawValue) {
        if (out.multiselect) {
            out.initial_options = rawValue.split(',').map((v) => v.trim()).filter(Boolean);
        } else {
            out.initial_option = rawValue;
        }
    }

    if (i.isEnabled === false) {
        out.disabled = true;
    }

    return out;
}

function translateAdaptiveCardChoices(raw: unknown): MmStaticSelectOption[] {
    if (!Array.isArray(raw)) {
        return [];
    }
    const out: MmStaticSelectOption[] = [];
    for (const el of raw) {
        if (typeof el !== 'object' || !el) {
            continue;
        }
        const choice = el as Record<string, unknown>;
        const text = ensureString(choice.title);
        const value = ensureString(choice.value);
        if (text && value) {
            out.push({text, value});
        }
    }
    return out;
}

function mapAdaptiveCardTextInputStyle(v: unknown): MmTextInputSubtype | undefined {
    if (typeof v !== 'string') {
        return undefined;
    }
    switch (v.toLowerCase()) {
    case 'text':
        return 'text';
    case 'tel':
        return 'tel';
    case 'url':
        return 'url';
    case 'email':
        return 'email';
    case 'password':
        return 'password';
    default:
        return undefined;
    }
}

function translateAdaptiveCardActions(actions: unknown[]) {
    const result: MmContainerBlock = {
        type: 'container',
        flow: 'horizontal',
        content: [],
    };
    for (const action of actions) {
        if (typeof action !== 'object' || action === null) {
            continue;
        }
        const ac = action as Record<string, unknown>;
        if (ac.type === 'Action.Submit') {
            const title = ensureString(ac.title);
            if (!title) {
                continue;
            }
            const actionId = ensureString(ac.id);
            if (!actionId) {
                continue;
            }
            const rawStyle = ensureString(ac.style);
            const style = adaptiveCardStyleToMm(rawStyle);
            result.content.push({
                type: 'button',
                action_id: actionId,
                text: title,
                style,
            });
        }
    }
    if (result.content.length === 0) {
        return null;
    }
    return result;
}

function adaptiveCardStyleToMm(style: string | undefined): MmButtonStyle {
    switch (style) {
    case 'positive':
        return 'primary';
    case 'destructive':
        return 'danger';
    default:
        return 'default';
    }
}

function mapAdaptiveCardImageSize(v: unknown): MmImageSize | undefined {
    if (typeof v !== 'string') {
        return undefined;
    }
    const byName = {
        Auto: 'auto',
        Small: 'small',
        Medium: 'medium',
        Large: 'large',
        Stretch: 'stretch',
    } as const;

    if (!Object.hasOwn(byName, v)) {
        return undefined;
    }

    return byName[v as keyof typeof byName];
}

function parseAdaptiveCardPixelDimension(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        return Math.round(v);
    }
    if (typeof v !== 'string' || !v) {
        return undefined;
    }
    const trimmed = v.trim();
    const px = (/^(\d+)px$/i).exec(trimmed);
    if (px) {
        return parseInt(px[1], 10);
    }
    if (!(/^\d+(\.\d+)?$/).test(trimmed)) {
        return undefined;
    }
    const num = Number.parseFloat(trimmed);
    if (Number.isFinite(num) && num > 0) {
        return Math.round(num);
    }
    return undefined;
}

function mapAdaptiveCardHorizontalAlignment(v: unknown): 'left' | 'center' | 'right' | undefined {
    if (typeof v !== 'string') {
        return undefined;
    }
    const byName = {
        Left: 'left',
        Center: 'center',
        Right: 'right',
    } as const;

    if (!Object.hasOwn(byName, v)) {
        return undefined;
    }

    return byName[v as keyof typeof byName];
}
