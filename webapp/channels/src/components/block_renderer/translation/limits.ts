// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmBlock, MmColumnBlock} from '@mattermost/types/mm_blocks';

export type BlockTranslationLimits = {

    /** Maximum nesting depth for translated `MmBlock` trees (root blocks are depth 1). */
    maxDepth: number;

    /** Maximum total `MmBlock` nodes retained after translation (entire tree). */
    maxTotalBlocks: number;

    /** Maximum characters passed to Markdown components across all retained blocks. */
    maxMarkdownText: number;
};

export const BLOCK_TRANSLATION_LIMITS: BlockTranslationLimits = {
    maxDepth: 32,
    maxTotalBlocks: 100,
    maxMarkdownText: 16000,
};

type LimitCounters = {
    blocks: number;
    markdownText: number;
};

/**
 * Truncates a translated `MmBlock` tree to {@link BLOCK_TRANSLATION_LIMITS}.
 * Applied once after format-specific translation in {@link translatePostProps}.
 */
export function applyBlockTranslationLimits(blocks: MmBlock[]): MmBlock[] {
    const counters: LimitCounters = {blocks: 0, markdownText: 0};
    return limitBlocks(blocks, 1, counters);
}

function limitMarkdownText(text: string, counters: LimitCounters): string | null {
    const remaining = BLOCK_TRANSLATION_LIMITS.maxMarkdownText - counters.markdownText;
    if (remaining <= 0) {
        return null;
    }
    if (text.length <= remaining) {
        counters.markdownText += text.length;
        return text;
    }
    const truncated = text.slice(0, remaining);
    counters.markdownText += truncated.length;
    return truncated;
}

function limitBlocks(blocks: MmBlock[], depth: number, counters: LimitCounters): MmBlock[] {
    if (depth > BLOCK_TRANSLATION_LIMITS.maxDepth) {
        return [];
    }
    const out: MmBlock[] = [];
    for (const block of blocks) {
        if (counters.blocks >= BLOCK_TRANSLATION_LIMITS.maxTotalBlocks) {
            break;
        }
        const limited = limitBlock(block, depth, counters);
        if (limited) {
            out.push(limited);
        }
    }
    return out;
}

function limitBlock(block: MmBlock, depth: number, counters: LimitCounters): MmBlock | null {
    if (counters.blocks >= BLOCK_TRANSLATION_LIMITS.maxTotalBlocks) {
        return null;
    }
    counters.blocks++;

    switch (block.type) {
    case 'text': {
        const text = limitMarkdownText(block.text, counters);
        if (!text) {
            counters.blocks--;
            return null;
        }
        return text === block.text ? block : {...block, text};
    }
    case 'button': {
        const text = limitMarkdownText(block.text, counters);
        if (!text) {
            counters.blocks--;
            return null;
        }
        return text === block.text ? block : {...block, text};
    }
    case 'container': {
        const content = limitBlocks(block.content, depth + 1, counters);
        if (content.length === 0) {
            counters.blocks--;
            return null;
        }
        return {...block, content};
    }
    case 'column': {
        const items = limitBlocks(block.items, depth + 1, counters);
        if (items.length === 0) {
            counters.blocks--;
            return null;
        }
        return {...block, items};
    }
    case 'column_set': {
        const columns: MmColumnBlock[] = limitBlocks(block.columns, depth + 1, counters) as MmColumnBlock[];
        if (columns.length === 0) {
            counters.blocks--;
            return null;
        }
        return {...block, columns};
    }
    case 'collapsible': {
        const header = limitBlocks(block.header, depth + 1, counters);
        const content = limitBlocks(block.content, depth + 1, counters);
        if (header.length === 0 || content.length === 0) {
            counters.blocks--;
            return null;
        }
        return {...block, header, content};
    }
    default:
        return block;
    }
}
