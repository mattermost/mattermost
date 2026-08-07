// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmBlock} from '@mattermost/types/mm_blocks';

import {
    createDefaultBlock,
    getBlockAt,
    insertBlockAt,
    moveBlockAt,
    parsePathKey,
    pathKey,
    propertyFieldsForBlock,
    remapPathAfterMove,
    removeBlockAt,
    sameParentList,
    serializeMmBlocks,
    setPropertyValue,
    updateBlockAt,
} from './mm_blocks_editor_utils';

describe('mm_blocks_editor_utils', () => {
    const sample: MmBlock[] = [
        {type: 'text', text: 'Hello'},
        {
            type: 'container',
            content: [{type: 'divider'}],
        },
    ];

    test('getBlockAt resolves nested path', () => {
        const path = [{list: 'root', index: 1}, {list: 'content', index: 0}] as const;
        expect(getBlockAt(sample, [...path])?.type).toBe('divider');
    });

    test('updateBlockAt changes block text', () => {
        const path = [{list: 'root' as const, index: 0}];
        const next = updateBlockAt(sample, path, {type: 'text', text: 'Updated'});
        expect(getBlockAt(next, path)).toEqual({type: 'text', text: 'Updated'});
    });

    test('removeBlockAt removes root block', () => {
        const path = [{list: 'root' as const, index: 0}];
        const next = removeBlockAt(sample, path);
        expect(next).toHaveLength(1);
        expect(next[0].type).toBe('container');
    });

    test('insertBlockAt adds sibling', () => {
        const path = [{list: 'root' as const, index: 0}];
        const next = insertBlockAt(sample, path, {type: 'divider'}, 'sibling');
        expect(next).toHaveLength(3);
        expect(next[1].type).toBe('divider');
    });

    test('serializeMmBlocks produces formatted JSON', () => {
        expect(serializeMmBlocks([{type: 'text', text: 'x'}])).toContain('\n');
    });

    test('pathKey is stable', () => {
        expect(pathKey([{list: 'root', index: 0}, {list: 'content', index: 1}])).toBe('root:0/content:1');
    });

    test('createDefaultBlock returns valid shapes', () => {
        expect(createDefaultBlock('column_set').type).toBe('column_set');
        expect(createDefaultBlock('text_input')).toMatchObject({type: 'text_input', name: 'field_name', label: 'Label'});
        expect(createDefaultBlock('bool_input').type).toBe('bool_input');
        expect(createDefaultBlock('select').type).toBe('select');
        expect(createDefaultBlock('date_input').type).toBe('date_input');
        expect(createDefaultBlock('datetime_input').type).toBe('datetime_input');
        expect(createDefaultBlock('file_input').type).toBe('file_input');
    });

    test('form inputs expose shared property fields', () => {
        const date = createDefaultBlock('date_input');
        const fields = propertyFieldsForBlock(date);
        expect(fields.map((f) => f.key)).toEqual(expect.arrayContaining([
            'name', 'label', 'help_text', 'optional', 'disabled', 'onChange', 'placeholder', 'initial_value', 'datetime_config',
        ]));

        const file = createDefaultBlock('file_input');
        expect(propertyFieldsForBlock(file).map((f) => f.key)).toEqual(expect.arrayContaining([
            'placeholder', 'allow_multiple', 'initial_value',
        ]));
    });

    test('button exposes subtype enum with execute and submit', () => {
        const button = createDefaultBlock('button');
        expect(button.type === 'button' && button.subtype).toBeUndefined();

        const subtypeField = propertyFieldsForBlock(button).find((f) => f.key === 'subtype');
        expect(subtypeField).toEqual({
            key: 'subtype',
            label: 'subtype',
            type: 'enum',
            options: ['execute', 'submit'],
        });

        const updated = setPropertyValue(button, 'subtype', 'submit', subtypeField!);
        expect(updated.type === 'button' && updated.subtype).toBe('submit');
    });

    test('column exposes gap in the property editor', () => {
        const column = createDefaultBlock('column');
        const fields = propertyFieldsForBlock(column);
        const gapField = fields.find((f) => f.key === 'gap');
        expect(gapField?.type).toBe('enum');
        const updated = setPropertyValue(column, 'gap', 'large', gapField!);
        expect(updated.type === 'column' && updated.gap).toBe('large');
    });

    test('column_set exposes gap in the property editor', () => {
        const columnSet = createDefaultBlock('column_set');
        const fields = propertyFieldsForBlock(columnSet);
        const gapField = fields.find((f) => f.key === 'gap');
        expect(gapField?.type).toBe('enum');
        const updated = setPropertyValue(columnSet, 'gap', 'small', gapField!);
        expect(updated.type === 'column_set' && updated.gap).toBe('small');
    });

    test('parsePathKey round-trips pathKey', () => {
        const path = [{list: 'root', index: 1}, {list: 'content', index: 0}] as const;
        expect(parsePathKey(pathKey([...path]))).toEqual([...path]);
    });

    test('sameParentList detects siblings', () => {
        expect(sameParentList(
            [{list: 'root', index: 0}],
            [{list: 'root', index: 1}],
        )).toBe(true);
        expect(sameParentList(
            [{list: 'root', index: 0}, {list: 'content', index: 0}],
            [{list: 'root', index: 0}, {list: 'content', index: 1}],
        )).toBe(true);
        expect(sameParentList(
            [{list: 'root', index: 0}],
            [{list: 'root', index: 0}, {list: 'content', index: 0}],
        )).toBe(false);
    });

    test('moveBlockAt reorders within a list', () => {
        const blocks: MmBlock[] = [
            {type: 'text', text: 'A'},
            {type: 'text', text: 'B'},
            {type: 'text', text: 'C'},
        ];
        const from = [{list: 'root' as const, index: 0}];
        const next = moveBlockAt(blocks, from, 2);
        expect(next.map((b) => (b as {text: string}).text)).toEqual(['B', 'C', 'A']);
    });

    test('remapPathAfterMove updates moved and shifted paths', () => {
        const from = [{list: 'root' as const, index: 0}];
        expect(remapPathAfterMove(from, from, 2)).toEqual([{list: 'root', index: 2}]);
        expect(remapPathAfterMove([{list: 'root', index: 2}], from, 2)).toEqual([{list: 'root', index: 1}]);
    });
});
