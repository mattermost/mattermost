// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Microsoft Adaptive Cards (`props.cards`) → mm_blocks

import type {
    MmBlock,
    MmButtonStyle,
    MmColumnBlock,
    MmColumnSetBlock,
    MmContainerBlock,
    MmImageBlock,
    MmImageSize,
} from '@mattermost/types/mm_blocks';

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
): MmBlock | MmBlock[] | null {
    if (typeof item !== 'object' || item === null) {
        return null;
    }
    const i = item as Record<string, unknown>;

    switch (i.type) {
    case 'TextBlock': {
        if (typeof i.text !== 'string' || !i.text) {
            return null;
        }
        const acSize = typeof i.size === 'string' ? i.size : '';
        const size = acSize === 'Small' || acSize === 'small' ? 'small' as const : undefined;
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
        const columns: MmBlock[] = [];
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
        return {type: 'column_set', columns: columns as MmColumnBlock[]} as MmColumnSetBlock;
    }
    case 'Image': {
        if (typeof i.url !== 'string' || !i.url) {
            return null;
        }
        const altText = typeof i.altText === 'string' ? i.altText : '';
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
    default:
        return null;
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
            const title = typeof ac.title === 'string' ? ac.title : '';
            if (!title) {
                continue;
            }
            const actionId = typeof ac.id === 'string' ? ac.id : '';
            const rawStyle = typeof ac.style === 'string' ? ac.style : undefined;
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
    const byName: Record<string, MmImageSize> = {
        Auto: 'auto',
        auto: 'auto',
        Small: 'small',
        small: 'small',
        Medium: 'medium',
        medium: 'medium',
        Large: 'large',
        large: 'large',
        Stretch: 'stretch',
        stretch: 'stretch',
    };
    return byName[v];
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
    const byName: Record<string, 'left' | 'center' | 'right'> = {
        Left: 'left',
        Center: 'center',
        Right: 'right',
    };
    return byName[v];
}
