// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Block} from './blocks/block'
import {OctoUtils} from './octoUtils'

import {TestBlockFactory} from './test/testBlockFactory'

test('duplicateBlockTree: Card', async () => {
    const [blocks, sourceBlock] = createCardTree()

    const [newBlocks, newSourceBlock, idMap] = OctoUtils.duplicateBlockTree(blocks, sourceBlock.id)

    expect(newBlocks.length).toBe(blocks.length)
    expect(newSourceBlock.id).not.toBe(sourceBlock.id)
    expect(newSourceBlock.type).toBe(sourceBlock.type)

    // When duplicating a non-root block, the boardId should not be re-mapped
    expect(newSourceBlock.boardId).toBe(sourceBlock.boardId)
    expect(idMap[sourceBlock.id]).toBe(newSourceBlock.id)

    for (const newBlock of newBlocks) {
        expect(newBlock.boardId).toBe(newSourceBlock.boardId)
    }

    for (const textBlock of newBlocks.filter((o) => o.type === 'text')) {
        expect(textBlock.parentId).toBe(newSourceBlock.id)
    }
})

test('filterConditionValidOrDefault', async () => {
    // Test 'options'
    expect(OctoUtils.filterConditionValidOrDefault('options', 'includes')).toBe('includes')
    expect(OctoUtils.filterConditionValidOrDefault('options', 'notIncludes')).toBe('notIncludes')
    expect(OctoUtils.filterConditionValidOrDefault('options', 'isEmpty')).toBe('isEmpty')
    expect(OctoUtils.filterConditionValidOrDefault('options', 'isNotEmpty')).toBe('isNotEmpty')
    expect(OctoUtils.filterConditionValidOrDefault('options', 'is')).toBe('includes')

    expect(OctoUtils.filterConditionValidOrDefault('boolean', 'isSet')).toBe('isSet')
    expect(OctoUtils.filterConditionValidOrDefault('boolean', 'isNotSet')).toBe('isNotSet')
    expect(OctoUtils.filterConditionValidOrDefault('boolean', 'includes')).toBe('isSet')

    expect(OctoUtils.filterConditionValidOrDefault('text', 'is')).toBe('is')
    expect(OctoUtils.filterConditionValidOrDefault('text', 'contains')).toBe('contains')
    expect(OctoUtils.filterConditionValidOrDefault('text', 'notContains')).toBe('notContains')
    expect(OctoUtils.filterConditionValidOrDefault('text', 'startsWith')).toBe('startsWith')
    expect(OctoUtils.filterConditionValidOrDefault('text', 'notStartsWith')).toBe('notStartsWith')
    expect(OctoUtils.filterConditionValidOrDefault('text', 'endsWith')).toBe('endsWith')
    expect(OctoUtils.filterConditionValidOrDefault('text', 'notEndsWith')).toBe('notEndsWith')
    expect(OctoUtils.filterConditionValidOrDefault('text', 'isEmpty')).toBe('is')

    expect(OctoUtils.filterConditionValidOrDefault('date', 'is')).toBe('is')
    expect(OctoUtils.filterConditionValidOrDefault('date', 'isBefore')).toBe('isBefore')
    expect(OctoUtils.filterConditionValidOrDefault('date', 'isAfter')).toBe('isAfter')
    expect(OctoUtils.filterConditionValidOrDefault('date', 'isSet')).toBe('isSet')
    expect(OctoUtils.filterConditionValidOrDefault('date', 'isNotSet')).toBe('isNotSet')
    expect(OctoUtils.filterConditionValidOrDefault('date', 'isEmpty')).toBe('is')
})

function createCardTree(): [Block[], Block] {
    const blocks: Block[] = []

    const card = TestBlockFactory.createCard()
    card.id = 'card1'
    card.boardId = 'board1'
    blocks.push(card)

    for (let i = 0; i < 5; i++) {
        const textBlock = TestBlockFactory.createText(card)
        textBlock.id = `text${i}`
        blocks.push(textBlock)
    }

    return [blocks, card]
}
