// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmBlock} from '@mattermost/types/mm_blocks';

import {applyBlockTranslationLimits, BLOCK_TRANSLATION_LIMITS} from './limits';

function countBlocks(blocks: MmBlock[]): number {
    let count = 0;
    const walk = (list: MmBlock[]) => {
        for (const block of list) {
            count++;
            switch (block.type) {
            case 'container':
                walk(block.content);
                break;
            case 'column':
                walk(block.items);
                break;
            case 'column_set':
                for (const col of block.columns) {
                    count++;
                    walk(col.items);
                }
                break;
            case 'collapsible':
                walk(block.header);
                walk(block.content);
                break;
            default:
                break;
            }
        }
    };
    walk(blocks);
    return count;
}

describe('applyBlockTranslationLimits', () => {
    it('truncates deeply nested mm_blocks', () => {
        let inner: MmBlock = {type: 'text', text: 'leaf'};
        for (let i = 0; i < BLOCK_TRANSLATION_LIMITS.maxDepth + 5; i++) {
            inner = {type: 'container', content: [inner]};
        }
        expect(applyBlockTranslationLimits([inner])).toEqual([]);
    });

    it('truncates total mm_blocks count', () => {
        const blocks = Array.from({length: BLOCK_TRANSLATION_LIMITS.maxTotalBlocks + 10}, (_, i) => ({
            type: 'text' as const,
            text: `line ${i}`,
        }));
        const limited = applyBlockTranslationLimits(blocks);
        expect(limited).toHaveLength(BLOCK_TRANSLATION_LIMITS.maxTotalBlocks);
        expect(countBlocks(limited)).toBe(BLOCK_TRANSLATION_LIMITS.maxTotalBlocks);
    });
});
