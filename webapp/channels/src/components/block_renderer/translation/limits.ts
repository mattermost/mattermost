// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmBlock, MmColumnBlock} from '@mattermost/types/mm_blocks';

export type BlockTranslationLimits = {

    /** Maximum nesting depth for translated `MmBlock` trees (root blocks are depth 1). */
    maxDepth: number;

    /** Maximum total `MmBlock` nodes retained after translation (entire tree). */
    maxTotalBlocks: number;
};

export const BLOCK_TRANSLATION_LIMITS: BlockTranslationLimits = {
    maxDepth: 32,
    maxTotalBlocks: 100,
};

/**
 * Truncates a translated `MmBlock` tree to {@link BLOCK_TRANSLATION_LIMITS}.
 * Applied once after format-specific translation in {@link translatePostProps}.
 */
export function applyBlockTranslationLimits(blocks: MmBlock[]): MmBlock[] {
    const count = {value: 0};
    return limitBlocks(blocks, 1, count);
}

function limitBlocks(blocks: MmBlock[], depth: number, count: {value: number}): MmBlock[] {
    if (depth > BLOCK_TRANSLATION_LIMITS.maxDepth) {
        return [];
    }
    const out: MmBlock[] = [];
    for (const block of blocks) {
        if (count.value >= BLOCK_TRANSLATION_LIMITS.maxTotalBlocks) {
            break;
        }
        const limited = limitBlock(block, depth, count);
        if (limited) {
            out.push(limited);
        }
    }
    return out;
}

function limitBlock(block: MmBlock, depth: number, count: {value: number}): MmBlock | null {
    if (count.value >= BLOCK_TRANSLATION_LIMITS.maxTotalBlocks) {
        return null;
    }
    count.value++;

    switch (block.type) {
    case 'container': {
        const content = limitBlocks(block.content, depth + 1, count);
        if (content.length === 0) {
            count.value--;
            return null;
        }
        return {...block, content};
    }
    case 'column': {
        const items = limitBlocks(block.items, depth + 1, count);
        if (items.length === 0) {
            count.value--;
            return null;
        }
        return {...block, items};
    }
    case 'column_set': {
        const columns: MmColumnBlock[] = [];
        for (const col of block.columns) {
            if (count.value >= BLOCK_TRANSLATION_LIMITS.maxTotalBlocks) {
                break;
            }
            count.value++;
            const items = limitBlocks(col.items, depth + 2, count);
            if (items.length === 0) {
                count.value--;
                continue;
            }
            columns.push({...col, items});
        }
        if (columns.length === 0) {
            count.value--;
            return null;
        }
        return {...block, columns};
    }
    case 'collapsible': {
        const header = limitBlocks(block.header, depth + 1, count);
        const content = limitBlocks(block.content, depth + 1, count);
        if (header.length === 0 || content.length === 0) {
            count.value--;
            return null;
        }
        return {...block, header, content};
    }
    default:
        return block;
    }
}
