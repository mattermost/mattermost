// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function appendHumanReadableStringsFromMmBlockMap(m: Record<string, unknown>, out: string[]) {
    const typ = m.type;
    if (typeof typ !== 'string') {
        return;
    }
    switch (typ) {
    case 'text':
        if (typeof m.text === 'string') {
            out.push(m.text);
        }
        break;
    case 'container':
        appendHumanReadableStringsFromMmBlocksArray(m.content, out);
        break;
    case 'collapsible':
        appendHumanReadableStringsFromMmBlocksArray(m.header, out);
        appendHumanReadableStringsFromMmBlocksArray(m.content, out);
        break;
    case 'column_set':
        if (Array.isArray(m.columns)) {
            for (const col of m.columns) {
                if (col && typeof col === 'object') {
                    appendHumanReadableStringsFromMmBlockMap(col as Record<string, unknown>, out);
                }
            }
        }
        break;
    case 'column':
        appendHumanReadableStringsFromMmBlocksArray(m.items, out);
        break;
    default:
        break;
    }
}

function appendHumanReadableStringsFromMmBlocksArray(raw: unknown, out: string[]) {
    if (!Array.isArray(raw)) {
        return;
    }
    for (const el of raw) {
        if (el && typeof el === 'object') {
            appendHumanReadableStringsFromMmBlockMap(el as Record<string, unknown>, out);
        }
    }
}

function appendHumanReadableStringsFromMmBlocks(raw: unknown, out: string[]) {
    if (!Array.isArray(raw)) {
        return;
    }
    for (const b of raw) {
        if (b && typeof b === 'object') {
            appendHumanReadableStringsFromMmBlockMap(b as Record<string, unknown>, out);
        }
    }
}

function appendHumanReadableStringsFromBlockKitTree(raw: unknown, out: string[]) {
    if (!Array.isArray(raw)) {
        return;
    }
    for (const block of raw) {
        if (!block || typeof block !== 'object') {
            continue;
        }
        const blockMap = block as Record<string, unknown>;
        const typ = blockMap.type;
        if (typeof typ !== 'string') {
            continue;
        }
        switch (typ) {
        case 'markdown':
            if (typeof blockMap.text === 'string') {
                out.push(blockMap.text);
            }
            break;
        case 'section': {
            const textBlock = blockMap.text;
            if (textBlock && typeof textBlock === 'object' && typeof (textBlock as Record<string, unknown>).text === 'string') {
                out.push((textBlock as Record<string, unknown>).text as string);
            }
            if (Array.isArray(blockMap.fields)) {
                for (const field of blockMap.fields) {
                    if (field && typeof field === 'object' && typeof (field as Record<string, unknown>).text === 'string') {
                        out.push((field as Record<string, unknown>).text as string);
                    }
                }
            }
            break;
        }
        case 'header':
            if (typeof blockMap.text === 'string') {
                out.push(blockMap.text);
            }
            break;
        default:
            break;
        }
    }
}

function appendHumanReadableStringsFromAdaptiveCardsItem(item: unknown, out: string[]) {
    if (!item || typeof item !== 'object') {
        return;
    }
    const itemMap = item as Record<string, unknown>;
    const typ = itemMap.type;
    if (typeof typ !== 'string') {
        return;
    }
    switch (typ) {
    case 'TextBlock':
        if (typeof itemMap.text === 'string') {
            out.push(itemMap.text);
        }
        break;
    case 'Container':
        if (Array.isArray(itemMap.items)) {
            for (const nested of itemMap.items) {
                appendHumanReadableStringsFromAdaptiveCardsItem(nested, out);
            }
        }
        break;
    case 'ColumnSet':
        if (Array.isArray(itemMap.columns)) {
            for (const column of itemMap.columns) {
                if (!column || typeof column !== 'object') {
                    continue;
                }
                const items = (column as Record<string, unknown>).items;
                if (Array.isArray(items)) {
                    for (const nested of items) {
                        appendHumanReadableStringsFromAdaptiveCardsItem(nested, out);
                    }
                }
            }
        }
        break;
    default:
        break;
    }
}

function appendHumanReadableStringsFromAdaptiveCardsTree(raw: unknown, out: string[]) {
    if (!Array.isArray(raw)) {
        return;
    }
    for (const card of raw) {
        if (!card || typeof card !== 'object') {
            continue;
        }
        const body = (card as Record<string, unknown>).body;
        if (!Array.isArray(body)) {
            continue;
        }
        for (const item of body) {
            appendHumanReadableStringsFromAdaptiveCardsItem(item, out);
        }
    }
}

// Mirrors model.appendHumanReadableInteractiveStrings (mm_blocks, Block Kit blocks, Adaptive cards).
export function scanHumanReadableStringsFromInteractiveProps(props: Record<string, unknown> | undefined): string[] {
    const out: string[] = [];
    if (!props) {
        return out;
    }
    if (props.mm_blocks) {
        appendHumanReadableStringsFromMmBlocks(props.mm_blocks, out);
    }
    if (props.blocks) {
        appendHumanReadableStringsFromBlockKitTree(props.blocks, out);
    }
    if (props.cards) {
        appendHumanReadableStringsFromAdaptiveCardsTree(props.cards, out);
    }
    return out;
}
