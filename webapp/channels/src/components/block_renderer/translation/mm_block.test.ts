// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {translateMMBlocks} from './mm_block';

describe('translateMMBlocks interactive blocks', () => {
    it('rejects button blocks with empty text or action_id', () => {
        expect(translateMMBlocks([
            {type: 'button', text: '   ', action_id: 'ok'},
            {type: 'button', text: 'Go', action_id: ''},
        ])).toEqual([]);
    });

    it('accepts button blocks with non-empty text and action_id', () => {
        expect(translateMMBlocks([
            {type: 'button', text: 'Go', action_id: 'go_action'},
        ])).toEqual([{
            type: 'button',
            text: 'Go',
            action_id: 'go_action',
        }]);
    });

    it('rejects static_select blocks with empty placeholder or action_id', () => {
        expect(translateMMBlocks([
            {
                type: 'static_select',
                action_id: 'sel',
                placeholder: '  ',
                options: [{text: 'A', value: 'a'}],
            },
            {
                type: 'static_select',
                action_id: '   ',
                placeholder: 'Pick',
                options: [{text: 'A', value: 'a'}],
            },
        ])).toEqual([]);
    });

    it('accepts static_select blocks with non-empty placeholder and action_id', () => {
        expect(translateMMBlocks([
            {
                type: 'static_select',
                action_id: 'sel_action',
                placeholder: 'Pick one',
                options: [{text: 'A', value: 'a'}],
            },
        ])).toEqual([{
            type: 'static_select',
            action_id: 'sel_action',
            placeholder: 'Pick one',
            options: [{text: 'A', value: 'a'}],
        }]);
    });
});
