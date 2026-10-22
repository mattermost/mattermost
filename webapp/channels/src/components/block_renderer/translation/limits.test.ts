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

function countMarkdownText(blocks: MmBlock[]): number {
    let total = 0;
    const walk = (list: MmBlock[]) => {
        for (const block of list) {
            if (block.type === 'text' || block.type === 'button') {
                total += block.text.length;
            }
            switch (block.type) {
            case 'container':
                walk(block.content);
                break;
            case 'column':
                walk(block.items);
                break;
            case 'column_set':
                walk(block.columns);
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
    return total;
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

    it('truncates markdown text to maxMarkdownText across text blocks', () => {
        const first = 'a'.repeat(BLOCK_TRANSLATION_LIMITS.maxMarkdownText - 100);
        const second = 'b'.repeat(200);
        const limited = applyBlockTranslationLimits([
            {type: 'text', text: first},
            {type: 'text', text: second},
        ]);

        expect(limited).toHaveLength(2);
        expect(limited[0]).toEqual({type: 'text', text: first});
        expect(limited[1]).toEqual({type: 'text', text: 'b'.repeat(100)});
        expect(countMarkdownText(limited)).toBe(BLOCK_TRANSLATION_LIMITS.maxMarkdownText);
    });

    it('truncates a single text block when it exceeds maxMarkdownText', () => {
        const text = 'x'.repeat(BLOCK_TRANSLATION_LIMITS.maxMarkdownText + 500);
        const limited = applyBlockTranslationLimits([{type: 'text', text}]);

        expect(limited).toEqual([{type: 'text', text: 'x'.repeat(BLOCK_TRANSLATION_LIMITS.maxMarkdownText)}]);
        expect(countMarkdownText(limited)).toBe(BLOCK_TRANSLATION_LIMITS.maxMarkdownText);
    });

    it('counts button label text toward maxMarkdownText', () => {
        const label = 'Go'.repeat(8000);
        const limited = applyBlockTranslationLimits([
            {type: 'button', text: label, action_id: 'go'},
            {type: 'text', text: 'overflow'},
        ]);

        expect(limited).toHaveLength(1);
        expect(limited[0]).toEqual({type: 'button', text: label.slice(0, BLOCK_TRANSLATION_LIMITS.maxMarkdownText), action_id: 'go'});
        expect(countMarkdownText(limited)).toBe(BLOCK_TRANSLATION_LIMITS.maxMarkdownText);
    });

    it('does not count static_select placeholder toward maxMarkdownText', () => {
        const text = 'a'.repeat(BLOCK_TRANSLATION_LIMITS.maxMarkdownText);
        const limited = applyBlockTranslationLimits([
            {type: 'text', text},
            {
                type: 'static_select',
                action_id: 'pick',
                placeholder: 'Choose an option',
                options: [{text: 'One', value: '1'}],
            },
        ]);

        expect(limited).toHaveLength(2);
        expect(countMarkdownText(limited)).toBe(BLOCK_TRANSLATION_LIMITS.maxMarkdownText);
    });

    it('drops text blocks once maxMarkdownText is exhausted', () => {
        const limited = applyBlockTranslationLimits([
            {type: 'text', text: 'a'.repeat(BLOCK_TRANSLATION_LIMITS.maxMarkdownText)},
            {type: 'text', text: 'more'},
        ]);

        expect(limited).toHaveLength(1);
        expect(countMarkdownText(limited)).toBe(BLOCK_TRANSLATION_LIMITS.maxMarkdownText);
    });
});
