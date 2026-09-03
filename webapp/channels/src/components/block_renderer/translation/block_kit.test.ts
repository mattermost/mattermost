// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmButtonBlock, MmColumnSetBlock, MmContainerBlock} from '@mattermost/types/mm_blocks';

import {translateBlockKit} from './block_kit';

describe('translateBlockKit section accessory button', () => {
    it('should require a non-empty action_id', () => {
        const blocks = translateBlockKit([{
            type: 'section',
            text: {type: 'plain_text', text: 'Body'},
            accessory: {
                type: 'button',
                text: {type: 'plain_text', text: 'Go'},
                action_id: '',
            },
        }]);
        expect(blocks).toEqual([{
            type: 'container',
            content: [{type: 'text', text: 'Body'}],
        }]);
    });

    it('should keep accessory button when action_id is present', () => {
        const blocks = translateBlockKit([{
            type: 'section',
            text: {type: 'plain_text', text: 'Body'},
            accessory: {
                type: 'button',
                text: {type: 'plain_text', text: 'Go'},
                action_id: 'go_action',
                style: 'primary',
            },
        }]);
        const container = blocks[0] as MmContainerBlock;
        const columnSet = container.content[0] as MmColumnSetBlock;
        const button = columnSet.columns[1].items[0] as MmButtonBlock;
        expect(button).toMatchObject({
            type: 'button',
            action_id: 'go_action',
            text: 'Go',
            style: 'primary',
        });
    });
});
