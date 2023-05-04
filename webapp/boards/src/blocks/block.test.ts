// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {TestBlockFactory} from 'src/test/testBlockFactory'

import {createBlock, createPatchesFromBlocks} from './block'

describe('block tests', () => {
    const board = TestBlockFactory.createBoard()
    const card = TestBlockFactory.createCard(board)

    describe('correctly generate patches from two blocks', () => {
        it('should generate two empty patches for the same block', () => {
            const textBlock = TestBlockFactory.createText(card)
            const result = createPatchesFromBlocks(textBlock, textBlock)
            expect(result).toMatchSnapshot()
        })

        it('should add fields on the new fields added and remove it in the undo', () => {
            const oldBlock = TestBlockFactory.createText(card)
            const newBlock = createBlock(oldBlock)
            newBlock.fields.newField = 'new field'
            const result = createPatchesFromBlocks(newBlock, oldBlock)
            expect(result).toMatchSnapshot()
        })

        it('should remove field on the new block added and add it again in the undo', () => {
            const oldBlock = TestBlockFactory.createText(card)
            const newBlock = createBlock(oldBlock)
            oldBlock.fields.test = 'test'
            const result = createPatchesFromBlocks(newBlock, oldBlock)
            expect(result).toMatchSnapshot()
        })

        it('should update propertie on the main object and revert it back on the undo', () => {
            const oldBlock = TestBlockFactory.createText(card)
            const newBlock = createBlock(oldBlock)
            oldBlock.parentId = 'old-parent-id'
            newBlock.parentId = 'new-parent-id'
            const result = createPatchesFromBlocks(newBlock, oldBlock)
            expect(result).toMatchSnapshot()
        })
    })
})
