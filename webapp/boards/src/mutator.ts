// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IntlShape} from 'react-intl'
import {batch} from 'react-redux'
import cloneDeep from 'lodash/cloneDeep'

import {BlockIcons} from './blockIcons'
import {Block, BlockPatch, createPatchesFromBlocks} from './blocks/block'
import {
    Board,
    BoardMember,
    BoardsAndBlocks,
    IPropertyOption,
    IPropertyTemplate,
    PropertyTypeEnum,
    createBoard,
    createPatchesFromBoards,
    createPatchesFromBoardsAndBlocks,
    createCardPropertiesPatches
} from './blocks/board'
import {
    BoardView,
    ISortOption,
    createBoardView,
    KanbanCalculationFields
} from './blocks/boardView'
import {Card, createCard} from './blocks/card'
import {ContentBlock} from './blocks/contentBlock'
import {CommentBlock} from './blocks/commentBlock'
import {AttachmentBlock} from './blocks/attachmentBlock'
import {FilterGroup} from './blocks/filterGroup'
import octoClient from './octoClient'
import undoManager from './undomanager'
import {Utils, IDType} from './utils'
import {UserSettings} from './userSettings'
import TelemetryClient, {TelemetryCategory, TelemetryActions} from './telemetry/telemetryClient'
import {Category} from './store/sidebar'

/* eslint-disable max-lines */
import {UserConfigPatch, UserPreference} from './user'
import store from './store'
import {updateBoards} from './store/boards'
import {updateViews} from './store/views'
import {updateCards} from './store/cards'
import {updateAttachments} from './store/attachments'
import {updateComments} from './store/comments'
import {updateContents} from './store/contents'
import {addBoardUsers, removeBoardUsersById} from './store/users'

function updateAllBoardsAndBlocks(boards: Board[], blocks: Block[]) {
    return batch(() => {
        store.dispatch(updateBoards(boards.filter((b: Board) => b.deleteAt !== 0) as Board[]))
        store.dispatch(updateViews(blocks.filter((b: Block) => b.type === 'view' || b.deleteAt !== 0) as BoardView[]))
        store.dispatch(updateCards(blocks.filter((b: Block) => b.type === 'card' || b.deleteAt !== 0) as Card[]))
        store.dispatch(updateAttachments(blocks.filter((b: Block) => b.type === 'attachment' || b.deleteAt !== 0) as AttachmentBlock[]))
        store.dispatch(updateComments(blocks.filter((b: Block) => b.type === 'comment' || b.deleteAt !== 0) as CommentBlock[]))
        store.dispatch(updateContents(blocks.filter((b: Block) => b.type !== 'card' && b.type !== 'view' && b.type !== 'board' && b.type !== 'comment') as ContentBlock[]))
    })
}

//
// The Mutator is used to make all changes to server state
// It also ensures that the Undo-manager is called for each action
//
class Mutator {
    private undoGroupId?: string
    private undoDisplayId?: string

    private beginUndoGroup(): string | undefined {
        if (this.undoGroupId) {
            Utils.assertFailure('UndoManager does not support nested groups')
            return undefined
        }
        this.undoGroupId = Utils.createGuid(IDType.None)
        return this.undoGroupId
    }

    private endUndoGroup(groupId: string) {
        if (this.undoGroupId !== groupId) {
            Utils.assertFailure('Mismatched groupId. UndoManager does not support nested groups')
            return
        }
        this.undoGroupId = undefined
    }

    async performAsUndoGroup(actions: () => Promise<void>): Promise<void> {
        const groupId = this.beginUndoGroup()
        try {
            await actions()
        } catch (err) {
            Utils.assertFailure(`ERROR: ${err}`)
        }
        if (groupId) {
            this.endUndoGroup(groupId)
        }
    }

    async updateBlock(boardId: string, newBlock: Block, oldBlock: Block, description: string): Promise<void> {
        const [updatePatch, undoPatch] = createPatchesFromBlocks(newBlock, oldBlock)
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, newBlock.id, updatePatch)
            },
            async () => {
                await octoClient.patchBlock(boardId, oldBlock.id, undoPatch)
            },
            description,
            this.undoGroupId,
        )
    }

    private async updateBlocks(boardId: string, newBlocks: Block[], oldBlocks: Block[], description: string): Promise<void> {
        if (newBlocks.length !== oldBlocks.length) {
            throw new Error('new and old blocks must have the same length when updating blocks')
        }

        const updatePatches = [] as BlockPatch[]
        const undoPatches = [] as BlockPatch[]

        newBlocks.forEach((newBlock, i) => {
            const [updatePatch, undoPatch] = createPatchesFromBlocks(newBlock, oldBlocks[i])
            updatePatches.push(updatePatch)
            undoPatches.push(undoPatch)
        })

        return undoManager.perform(
            async () => {
                await Promise.all(
                    updatePatches.map((patch, i) => octoClient.patchBlock(boardId, newBlocks[i].id, patch)),
                )
            },
            async () => {
                await Promise.all(
                    undoPatches.map((patch, i) => octoClient.patchBlock(boardId, newBlocks[i].id, patch)),
                )
            },
            description,
            this.undoGroupId,
        )
    }

    //eslint-disable-next-line no-shadow
    async insertBlock(boardId: string, block: Block, description = 'add', afterRedo?: (block: Block) => Promise<void>, beforeUndo?: (block: Block) => Promise<void>): Promise<Block> {
        return undoManager.perform(
            async () => {
                const res = await octoClient.insertBlock(boardId, block)
                const jsonres = await res.json()
                const newBlock = jsonres[0] as Block
                await afterRedo?.(newBlock)
                return newBlock
            },
            async (newBlock: Block) => {
                await beforeUndo?.(newBlock)
                await octoClient.deleteBlock(boardId, newBlock.id)
            },
            description,
            this.undoGroupId,
        )
    }

    //eslint-disable-next-line no-shadow
    async insertBlocks(boardId: string, blocks: Block[], description = 'add', afterRedo?: (blocks: Block[]) => Promise<void>, beforeUndo?: () => Promise<void>, sourceBoardID?: string) {
        return undoManager.perform(
            async () => {
                const res = await octoClient.insertBlocks(boardId, blocks, sourceBoardID)
                const newBlocks = (await res.json()) as Block[]
                updateAllBoardsAndBlocks([], newBlocks)
                await afterRedo?.(newBlocks)
                return newBlocks
            },
            async (newBlocks: Block[]) => {
                await beforeUndo?.()
                const awaits = []
                for (const block of newBlocks) {
                    awaits.push(octoClient.deleteBlock(boardId, block.id))
                }
                await Promise.all(awaits)
            },
            description,
            this.undoGroupId,
        )
    }

    async deleteBlock(block: Block, description?: string, beforeRedo?: () => Promise<void>, afterUndo?: () => Promise<void>) {
        const actualDescription = description || `delete ${block.type}`

        await undoManager.perform(
            async () => {
                await beforeRedo?.()
                await octoClient.deleteBlock(block.boardId, block.id)
            },
            async () => {
                await octoClient.undeleteBlock(block.boardId, block.id)
                await afterUndo?.()
            },
            actualDescription,
            this.undoGroupId,
        )
    }

    async createBoardsAndBlocks(bab: BoardsAndBlocks, description = 'add', afterRedo?: (b: BoardsAndBlocks) => Promise<void>, beforeUndo?: (b: BoardsAndBlocks) => Promise<void>): Promise<BoardsAndBlocks> {
        return undoManager.perform(
            async () => {
                const res = await octoClient.createBoardsAndBlocks(bab)
                const newBab = (await res.json()) as BoardsAndBlocks
                await afterRedo?.(newBab)
                return newBab
            },
            async (newBab: BoardsAndBlocks) => {
                await beforeUndo?.(newBab)

                const boardIds = newBab.boards.map((b) => b.id)
                const blockIds = newBab.blocks.map((b) => b.id)
                await octoClient.deleteBoardsAndBlocks(boardIds, blockIds)
            },
            description,
            this.undoGroupId,
        )
    }

    async updateBoard(newBoard: Board, oldBoard: Board, description: string): Promise<void> {
        const [updatePatch, undoPatch] = createPatchesFromBoards(newBoard, oldBoard)
        await undoManager.perform(
            async () => {
                await octoClient.patchBoard(newBoard.id, updatePatch)
            },
            async () => {
                await octoClient.patchBoard(oldBoard.id, undoPatch)
            },
            description,
            this.undoGroupId,
        )
    }

    async deleteBoard(board: Board, description?: string, afterRedo?: (b: Board) => Promise<void>, beforeUndo?: (b: Board) => Promise<void>) {
        await undoManager.perform(
            async () => {
                await octoClient.deleteBoard(board.id)
                await afterRedo?.(board)
            },
            async () => {
                await beforeUndo?.(board)
                await octoClient.undeleteBoard(board.id)
            },
            description,
            this.undoGroupId,
        )
    }

    async changeBlockTitle(boardId: string, blockId: string, oldTitle: string, newTitle: string, description = 'change block title') {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, blockId, {title: newTitle})
            },
            async () => {
                await octoClient.patchBlock(boardId, blockId, {title: oldTitle})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeBoardTitle(boardId: string, oldTitle: string, newTitle: string, description = 'change board title') {
        await undoManager.perform(
            async () => {
                await octoClient.patchBoard(boardId, {title: newTitle})
            },
            async () => {
                await octoClient.patchBoard(boardId, {title: oldTitle})
            },
            description,
            this.undoGroupId,
        )
    }

    async setDefaultTemplate(boardId: string, blockId: string, oldTemplateId: string, templateId: string, description = 'set default template') {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, blockId, {updatedFields: {defaultTemplateId: templateId}})
            },
            async () => {
                await octoClient.patchBlock(boardId, blockId, {updatedFields: {defaultTemplateId: oldTemplateId}})
            },
            description,
            this.undoGroupId,
        )
    }

    async clearDefaultTemplate(boardId: string, blockId: string, oldTemplateId: string, description = 'set default template') {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, blockId, {updatedFields: {defaultTemplateId: ''}})
            },
            async () => {
                await octoClient.patchBlock(boardId, blockId, {updatedFields: {defaultTemplateId: oldTemplateId}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeBoardIcon(boardId: string, oldIcon: string|undefined, icon: string, description = 'change board icon') {
        await undoManager.perform(
            async () => {
                await octoClient.patchBoard(boardId, {icon})
            },
            async () => {
                await octoClient.patchBoard(boardId, {icon: oldIcon})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeBlockIcon(boardId: string, blockId: string, oldIcon: string|undefined, icon: string, description = 'change block icon') {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, blockId, {updatedFields: {icon}})
            },
            async () => {
                await octoClient.patchBlock(boardId, blockId, {updatedFields: {icon: oldIcon}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeBoardDescription(boardId: string, blockId: string, oldBlockDescription: string|undefined, blockDescription: string, description = 'change description') {
        await undoManager.perform(
            async () => {
                await octoClient.patchBoard(boardId, {description: blockDescription})
            },
            async () => {
                await octoClient.patchBoard(boardId, {description: oldBlockDescription})
            },
            description,
            this.undoGroupId,
        )
    }

    async showBoardDescription(boardId: string, oldShowDescription: boolean, showDescription = true, description?: string) {
        let actionDescription = description
        if (!actionDescription) {
            actionDescription = showDescription ? 'show description' : 'hide description'
        }

        await undoManager.perform(
            async () => {
                await octoClient.patchBoard(boardId, {showDescription})
            },
            async () => {
                await octoClient.patchBoard(boardId, {showDescription: oldShowDescription})
            },
            actionDescription,
            this.undoGroupId,
        )
    }

    async changeCardContentOrder(boardId: string, cardId: string, oldContentOrder: Array<string | string[]>, contentOrder: Array<string | string[]>, description = 'reorder'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, cardId, {updatedFields: {contentOrder}})
            },
            async () => {
                await octoClient.patchBlock(boardId, cardId, {updatedFields: {contentOrder: oldContentOrder}})
            },
            description,
            this.undoGroupId,
        )
    }

    // Board Members

    async createBoardMember(member: BoardMember, description = 'create board member'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.createBoardMember(member)
            },
            async () => {
                await octoClient.deleteBoardMember(member)
            },
            description,
            this.undoGroupId,
        )
    }

    async updateBoardMember(newMember: BoardMember, oldMember: BoardMember, description = 'update board member'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.updateBoardMember(newMember)
            },
            async () => {
                await octoClient.updateBoardMember(oldMember)
            },
            description,
            this.undoGroupId,
        )
    }

    async deleteBoardMember(member: BoardMember, description = 'delete board member'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.deleteBoardMember(member)
                store.dispatch(removeBoardUsersById([member.userId]))
            },
            async () => {
                await octoClient.createBoardMember(member)
                const user = await octoClient.getUser(member.userId)
                if (user) {
                    store.dispatch(addBoardUsers([user]))
                }
            },
            description,
            this.undoGroupId,
        )
    }

    // Property Templates

    async insertPropertyTemplate(board: Board, activeView: BoardView, index = -1, template?: IPropertyTemplate): Promise<string> {
        if (!activeView) {
            Utils.assertFailure('insertPropertyTemplate: no activeView')
            return ''
        }

        const newTemplate = template || {
            id: Utils.createGuid(IDType.BlockID),
            name: 'New Property',
            type: 'text',
            options: [],
        }

        const oldBlocks: Block[] = []
        const oldBoard: Board = board
        const newBoard = createBoard(board)

        const startIndex = (index >= 0) ? index : board.cardProperties.length
        if (index >= 0) {
            newBoard.cardProperties.splice(startIndex, 0, newTemplate)
        } else {
            newBoard.cardProperties.push(newTemplate)
        }

        if (activeView.fields.viewType === 'table') {
            const changedBlocks: Block[] = []
            const changedBlockIDs: string[] = []

            oldBlocks.push(activeView)

            const newActiveView = createBoardView(activeView)

            // insert in proper location in activeview.fields.visiblePropetyIds
            const viewIndex = index > 0 ? index : activeView.fields.visiblePropertyIds.length
            newActiveView.fields.visiblePropertyIds.splice(viewIndex, 0, newTemplate.id)
            changedBlocks.push(newActiveView)
            changedBlockIDs.push(activeView.id)

            const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(newBoard, oldBoard, changedBlockIDs, changedBlocks, oldBlocks)
            await undoManager.perform(
                async () => {
                    await octoClient.patchBoardsAndBlocks(updatePatch)
                },
                async () => {
                    await octoClient.patchBoardsAndBlocks(undoPatch)
                },
                'add column',
                this.undoGroupId,
            )
        } else {
            this.updateBoard(newBoard, oldBoard, 'add property')
        }

        return newTemplate.id
    }

    async duplicatePropertyTemplate(board: Board, activeView: BoardView, propertyId: string) {
        if (!activeView) {
            Utils.assertFailure('duplicatePropertyTemplate: no activeView')
        }

        const oldBlocks: Block[] = []
        const oldBoard: Board = board

        const newBoard = createBoard(board)
        const changedBlocks: Block[] = []
        const changedBlockIDs: string[] = []
        const index = newBoard.cardProperties.findIndex((o: IPropertyTemplate) => o.id === propertyId)
        if (index === -1) {
            Utils.assertFailure(`Cannot find template with id: ${propertyId}`)
            return
        }
        const srcTemplate = newBoard.cardProperties[index]
        const newTemplate: IPropertyTemplate = {
            id: Utils.createGuid(IDType.BlockID),
            name: `${srcTemplate.name} copy`,
            type: srcTemplate.type,
            options: srcTemplate.options.slice(),
        }
        newBoard.cardProperties.splice(index + 1, 0, newTemplate)

        let description = 'duplicate property'
        if (activeView.fields.viewType === 'table') {
            oldBlocks.push(activeView)

            const newActiveView = createBoardView(activeView)
            newActiveView.fields.visiblePropertyIds.push(newTemplate.id)
            changedBlocks.push(newActiveView)
            changedBlockIDs.push(newActiveView.id)

            description = 'duplicate column'
            const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(newBoard, oldBoard, changedBlockIDs, changedBlocks, oldBlocks)
            await undoManager.perform(
                async () => {
                    await octoClient.patchBoardsAndBlocks(updatePatch)
                },
                async () => {
                    await octoClient.patchBoardsAndBlocks(undoPatch)
                },
                description,
                this.undoGroupId,
            )
        } else {
            this.updateBoard(newBoard, oldBoard, description)
        }
    }

    async changePropertyTemplateOrder(board: Board, template: IPropertyTemplate, destIndex: number) {
        const templates = board.cardProperties
        const newValue = templates.slice()

        const srcIndex = templates.indexOf(template)
        Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`)
        newValue.splice(destIndex, 0, newValue.splice(srcIndex, 1)[0])

        const newBoard = createBoard(board)
        newBoard.cardProperties = newValue

        await this.updateBoard(newBoard, board, 'reorder properties')
    }

    async deleteProperty(board: Board, views: BoardView[], cards: Card[], propertyId: string) {
        const newBoard = createBoard(board)
        newBoard.cardProperties = board.cardProperties.filter((o: IPropertyTemplate) => o.id !== propertyId)

        const oldBlocks: Block[] = []
        const changedBlocks: Block[] = []
        const changedBlockIDs: string[] = []

        views.forEach((view) => {
            if (view.fields.visiblePropertyIds.includes(propertyId)) {
                oldBlocks.push(view)

                const newView = createBoardView(view)
                newView.fields.visiblePropertyIds = view.fields.visiblePropertyIds.filter((o: string) => o !== propertyId)
                changedBlocks.push(newView)
                changedBlockIDs.push(newView.id)
            }
        })
        cards.forEach((card) => {
            if (card.fields.properties[propertyId]) {
                oldBlocks.push(card)

                const newCard = createCard(card)
                delete newCard.fields.properties[propertyId]
                changedBlocks.push(newCard)
                changedBlockIDs.push(newCard.id)
            }
        })

        const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(newBoard, board, changedBlockIDs, changedBlocks, oldBlocks)
        await undoManager.perform(
            async () => {
                await octoClient.patchBoardsAndBlocks(updatePatch)
            },
            async () => {
                await octoClient.patchBoardsAndBlocks(undoPatch)
            },
            'delete property',
            this.undoGroupId,
        )
    }

    // Properties

    async updateBoardCardProperties(boardId: string, oldProperties: IPropertyTemplate[], newProperties: IPropertyTemplate[], description = 'update card properties') {
        const [updatePatch, undoPatch] = createCardPropertiesPatches(newProperties, oldProperties)
        await undoManager.perform(
            async () => {
                await octoClient.patchBoard(boardId, updatePatch)
            },
            async () => {
                await octoClient.patchBoard(boardId, undoPatch)
            },
            description,
            this.undoGroupId,
        )
    }

    async insertPropertyOption(boardId: string, oldCardProperties: IPropertyTemplate[], template: IPropertyTemplate, option: IPropertyOption, description = 'add option') {
        Utils.assert(oldCardProperties.includes(template))

        const newCardProperties: IPropertyTemplate[] = cloneDeep(oldCardProperties)
        const newTemplate = newCardProperties.find((o: IPropertyTemplate) => o.id === template.id)!
        newTemplate.options.push(option)

        await this.updateBoardCardProperties(boardId, oldCardProperties, newCardProperties, description)
    }

    async deletePropertyOption(boardId: string, oldCardProperties: IPropertyTemplate[], template: IPropertyTemplate, option: IPropertyOption) {
        const newCardProperties: IPropertyTemplate[] = cloneDeep(oldCardProperties)
        const newTemplate = newCardProperties.find((o: IPropertyTemplate) => o.id === template.id)!
        newTemplate.options = newTemplate.options.filter((o) => o.id !== option.id)

        await this.updateBoardCardProperties(boardId, oldCardProperties, newCardProperties, 'delete option')
    }

    async changePropertyOptionOrder(boardId: string, oldCardProperties: IPropertyTemplate[], template: IPropertyTemplate, option: IPropertyOption, destIndex: number) {
        const srcIndex = template.options.indexOf(option)
        Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`)

        const newCardProperties: IPropertyTemplate[] = cloneDeep(oldCardProperties)
        const newTemplate = newCardProperties.find((o: IPropertyTemplate) => o.id === template.id)!
        newTemplate.options.splice(destIndex, 0, newTemplate.options.splice(srcIndex, 1)[0])

        await this.updateBoardCardProperties(boardId, oldCardProperties, newCardProperties, 'reorder option')
    }

    async changePropertyOptionValue(boardId: string, oldCardProperties: IPropertyTemplate[], propertyTemplate: IPropertyTemplate, option: IPropertyOption, value: string) {
        const newCardProperties: IPropertyTemplate[] = cloneDeep(oldCardProperties)
        const newTemplate = newCardProperties.find((o: IPropertyTemplate) => o.id === propertyTemplate.id)!
        const newOption = newTemplate.options.find((o) => o.id === option.id)!
        newOption.value = value

        await this.updateBoardCardProperties(boardId, oldCardProperties, newCardProperties, 'rename option')

        return newCardProperties
    }

    async changePropertyOptionColor(boardId: string, oldCardProperties: IPropertyTemplate[], template: IPropertyTemplate, option: IPropertyOption, color: string) {
        const newCardProperties: IPropertyTemplate[] = cloneDeep(oldCardProperties)
        const newTemplate = newCardProperties.find((o: IPropertyTemplate) => o.id === template.id)!
        const newOption = newTemplate.options.find((o) => o.id === option.id)!
        newOption.color = color
        await this.updateBoardCardProperties(boardId, oldCardProperties, newCardProperties, 'rename option')
    }

    async changePropertyValue(boardId: string, card: Card, propertyId: string, value?: string | string[], description = 'change property') {
        const oldValue = card.fields.properties[propertyId]

        // dont save anything if property value was not changed.
        if (oldValue === value) {
            return
        }

        const newCard = createCard(card)
        if (value) {
            newCard.fields.properties[propertyId] = value
        } else {
            delete newCard.fields.properties[propertyId]
        }
        await this.updateBlock(boardId, newCard, card, description)
        TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.EditCardProperty, {board: card.boardId, card: card.id})
    }

    async changePropertyTypeAndName(board: Board, cards: Card[], propertyTemplate: IPropertyTemplate, newType: PropertyTypeEnum, newName: string) {
        if (propertyTemplate.type === newType && propertyTemplate.name === newName) {
            return
        }

        const oldBoard: Board = board
        const newBoard = createBoard(board)
        const newTemplate = newBoard.cardProperties.find((o: IPropertyTemplate) => o.id === propertyTemplate.id)!

        if (propertyTemplate.type !== newType) {
            newTemplate.options = []
        }

        newTemplate.type = newType
        newTemplate.name = newName

        const oldBlocks: Block[] = []
        const newBlocks: Block[] = []
        const newBlockIDs: string[] = []

        if (propertyTemplate.type !== newType) {
            const isNewTypeSelectOrMulti = newType === 'select' || newType === 'multiSelect'
            const isNewTypePersonOrMulti = newType === 'person' || newType === 'multiPerson'

            const isOldTypeSelectOrMulti = propertyTemplate.type === 'select' || propertyTemplate.type === 'multiSelect'
            const isOldTypePersonOrMulti = propertyTemplate.type === 'person' || propertyTemplate.type === 'multiPerson'

            // If the old type was either select/multiselect or person/multiperson
            if (isOldTypeSelectOrMulti || isOldTypePersonOrMulti) {
                for (const card of cards) {
                    // if array get first value, if exists
                    const oldValue = Array.isArray(card.fields.properties[propertyTemplate.id]) ? (card.fields.properties[propertyTemplate.id].length > 0 && card.fields.properties[propertyTemplate.id][0] as string) : card.fields.properties[propertyTemplate.id] as string
                    if (oldValue) {
                        let newValue: string | undefined
                        if (isOldTypePersonOrMulti) {
                            if (isNewTypePersonOrMulti) {
                                newValue = oldValue
                            }
                        } else if (isNewTypeSelectOrMulti) {
                            if (isOldTypeSelectOrMulti) {
                                newValue = propertyTemplate.options.find((o) => o.id === oldValue)?.id
                            } else {
                                newValue = propertyTemplate.options.find((o) => o.id === oldValue)?.value
                            }
                        }
                        const newCard = createCard(card)
                        if (newValue) {
                            if (newType === 'multiSelect' || newType === 'multiPerson') {
                                newCard.fields.properties[propertyTemplate.id] = [newValue]
                            } else {
                                newCard.fields.properties[propertyTemplate.id] = newValue
                            }
                        } else {
                            // This was an invalid select option or old person id, so delete it
                            delete newCard.fields.properties[propertyTemplate.id]
                        }

                        newBlocks.push(newCard)
                        newBlockIDs.push(newCard.id)
                        oldBlocks.push(card)
                    }

                    if (isNewTypeSelectOrMulti) {
                        newTemplate.options = propertyTemplate.options
                    }
                }
            } else if (isNewTypeSelectOrMulti) { // if the new type is either select or multiselect - old type is other
                // Map values to new template option IDs
                for (const card of cards) {
                    const oldValue = card.fields.properties[propertyTemplate.id] as string
                    if (oldValue) {
                        let option = newTemplate.options.find((o: IPropertyOption) => o.value === oldValue)
                        if (!option) {
                            option = {
                                id: Utils.createGuid(IDType.None),
                                value: oldValue,
                                color: 'propColorDefault',
                            }
                            newTemplate.options.push(option)
                        }

                        const newCard = createCard(card)
                        newCard.fields.properties[propertyTemplate.id] = newType === 'multiSelect' ? [option.id] : option.id

                        newBlocks.push(newCard)
                        newBlockIDs.push(newCard.id)
                        oldBlocks.push(card)
                    }
                }
            } else if (isNewTypePersonOrMulti) { // if the new type is either person or multiperson - old type is other
                // Clear old values
                for (const card of cards) {
                    const oldValue = card.fields.properties[propertyTemplate.id] as string
                    if (oldValue) {
                        const newCard = createCard(card)
                        delete newCard.fields.properties[propertyTemplate.id]
                        newBlocks.push(newCard)
                        newBlockIDs.push(newCard.id)
                        oldBlocks.push(card)
                    }
                }
            }
        }

        if (newBlockIDs.length > 0) {
            const [updatePatch, undoPatch] = createPatchesFromBoardsAndBlocks(newBoard, board, newBlockIDs, newBlocks, oldBlocks)
            await undoManager.perform(
                async () => {
                    await octoClient.patchBoardsAndBlocks(updatePatch)
                },
                async () => {
                    await octoClient.patchBoardsAndBlocks(undoPatch)
                },
                'change property type and name',
                this.undoGroupId,
            )
        } else {
            this.updateBoard(newBoard, oldBoard, 'change property name')
        }
    }

    // Views

    async changeViewSortOptions(boardId: string, viewId: string, oldSortOptions: ISortOption[], sortOptions: ISortOption[]): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {sortOptions}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {sortOptions: oldSortOptions}})
            },
            'sort',
            this.undoGroupId,
        )
    }

    async changeViewFilter(boardId: string, viewId: string, oldFilter: FilterGroup, filter: FilterGroup): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {filter}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {filter: oldFilter}})
            },
            'filter',
            this.undoGroupId,
        )
    }

    async changeViewGroupById(boardId: string, viewId: string, oldGroupById: string|undefined, groupById: string): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {groupById}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {groupById: oldGroupById}})
            },
            'group by',
            this.undoGroupId,
        )
    }

    async changeViewDateDisplayPropertyId(boardId: string, viewId: string, oldDateDisplayPropertyId: string|undefined, dateDisplayPropertyId: string): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {dateDisplayPropertyId}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {dateDisplayPropertyId: oldDateDisplayPropertyId}})
            },
            'display by',
            this.undoDisplayId,
        )
    }

    async changeViewVisiblePropertiesOrder(boardId: string, view: BoardView, template: IPropertyTemplate, destIndex: number, description = 'change property order'): Promise<void> {
        const oldVisiblePropertyIds = view.fields.visiblePropertyIds
        const newOrder = oldVisiblePropertyIds.slice()

        const srcIndex = oldVisiblePropertyIds.indexOf(template.id)
        Utils.log(`srcIndex: ${srcIndex}, destIndex: ${destIndex}`)

        newOrder.splice(destIndex, 0, newOrder.splice(srcIndex, 1)[0])

        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, view.id, {updatedFields: {visiblePropertyIds: newOrder}})
            },
            async () => {
                await octoClient.patchBlock(boardId, view.id, {updatedFields: {visiblePropertyIds: oldVisiblePropertyIds}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeViewVisibleProperties(boardId: string, viewId: string, oldVisiblePropertyIds: string[], visiblePropertyIds: string[], description = 'show / hide property'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {visiblePropertyIds}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {visiblePropertyIds: oldVisiblePropertyIds}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeViewVisibleOptionIds(boardId: string, viewId: string, oldVisibleOptionIds: string[], visibleOptionIds: string[], description = 'reorder'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {visibleOptionIds}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {visibleOptionIds: oldVisibleOptionIds}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeViewHiddenOptionIds(boardId: string, viewId: string, oldHiddenOptionIds: string[], hiddenOptionIds: string[], description = 'reorder'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {hiddenOptionIds}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {hiddenOptionIds: oldHiddenOptionIds}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeViewKanbanCalculations(boardId: string, viewId: string, oldCalculations: Record<string, KanbanCalculationFields>, calculations: Record<string, KanbanCalculationFields>, description = 'updated kanban calculations'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {kanbanCalculations: calculations}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {kanbanCalculations: oldCalculations}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeViewColumnCalculations(boardId: string, viewId: string, oldCalculations: Record<string, string>, calculations: Record<string, string>, description = 'updated kanban calculations'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {columnCalculations: calculations}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {columnCalculations: oldCalculations}})
            },
            description,
            this.undoGroupId,
        )
    }

    async changeViewCardOrder(boardId: string, viewId: string, oldCardOrder: string[], cardOrder: string[], description = 'reorder'): Promise<void> {
        await undoManager.perform(
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {cardOrder}})
            },
            async () => {
                await octoClient.patchBlock(boardId, viewId, {updatedFields: {cardOrder: oldCardOrder}})
            },
            description,
            this.undoGroupId,
        )
    }

    async hideViewColumns(boardId: string, view: BoardView, columnOptionIds: string[]): Promise<void> {
        if (columnOptionIds.every((o) => view.fields.hiddenOptionIds.includes(o))) {
            return
        }

        const newView = createBoardView(view)
        newView.fields.visibleOptionIds = newView.fields.visibleOptionIds.filter((o) => !columnOptionIds.includes(o))
        newView.fields.hiddenOptionIds = [...newView.fields.hiddenOptionIds, ...columnOptionIds]
        await this.updateBlock(boardId, newView, view, 'hide column')
    }

    async hideViewColumn(boardId: string, view: BoardView, columnOptionId: string): Promise<void> {
        return this.hideViewColumns(boardId, view, [columnOptionId])
    }

    async unhideViewColumns(boardId: string, view: BoardView, columnOptionIds: string[]): Promise<void> {
        if (columnOptionIds.every((o) => view.fields.visibleOptionIds.includes(o))) {
            return
        }

        const newView = createBoardView(view)
        newView.fields.hiddenOptionIds = newView.fields.hiddenOptionIds.filter((o) => !columnOptionIds.includes(o))

        // Put the columns at the end of the visible list
        newView.fields.visibleOptionIds = newView.fields.visibleOptionIds.filter((o) => !columnOptionIds.includes(o))
        newView.fields.visibleOptionIds = [...newView.fields.visibleOptionIds, ...columnOptionIds]
        await this.updateBlock(boardId, newView, view, 'show column')
    }

    async unhideViewColumn(boardId: string, view: BoardView, columnOptionId: string): Promise<void> {
        return this.unhideViewColumns(boardId, view, [columnOptionId])
    }

    async createCategory(category: Category): Promise<void> {
        await octoClient.createSidebarCategory(category)
    }

    async deleteCategory(teamID: string, categoryID: string): Promise<void> {
        await octoClient.deleteSidebarCategory(teamID, categoryID)
    }

    async updateCategory(category: Category): Promise<void> {
        await octoClient.updateSidebarCategory(category)
    }

    async moveBoardToCategory(teamID: string, blockID: string, toCategoryID: string, fromCategoryID: string): Promise<void> {
        await octoClient.moveBoardToCategory(teamID, blockID, toCategoryID, fromCategoryID)
    }

    async followBlock(blockId: string, blockType: string, userId: string) {
        await undoManager.perform(
            async () => {
                await octoClient.followBlock(blockId, blockType, userId)
            },
            async () => {
                await octoClient.unfollowBlock(blockId, blockType, userId)
            },
            'follow block',
            this.undoGroupId,
        )
    }

    async unfollowBlock(blockId: string, blockType: string, userId: string) {
        await undoManager.perform(
            async () => {
                await octoClient.unfollowBlock(blockId, blockType, userId)
            },
            async () => {
                await octoClient.followBlock(blockId, blockType, userId)
            },
            'follow block',
            this.undoGroupId,
        )
    }

    async patchUserConfig(userID: string, patch: UserConfigPatch): Promise<UserPreference[] | undefined> {
        return octoClient.patchUserConfig(userID, patch)
    }

    // Duplicate

    async duplicateCard(
        cardId: string,
        boardId: string,
        fromTemplate = false,
        description = 'duplicate card',
        asTemplate = false,
        propertyOverrides?: Record<string, string>,
        afterRedo?: (newCardId: string) => Promise<void>,
        beforeUndo?: () => Promise<void>,
    ): Promise<[Block[], string]> {
        return undoManager.perform(
            async () => {
                const blocks = await octoClient.duplicateBlock(boardId, cardId, asTemplate)
                const newRootBlock = blocks && blocks[0]
                if (!newRootBlock) {
                    Utils.log('Unable to duplicate card')
                    return [[], '']
                }
                if (asTemplate === fromTemplate) {
                    // Copy template
                    newRootBlock.title = `${newRootBlock.title} copy`
                } else if (asTemplate) {
                    // Template from card
                    newRootBlock.title = 'New card template'
                } else {
                    // Card from template
                    newRootBlock.title = ''

                    // If the template doesn't specify an icon, initialize it to a random one
                    if (!newRootBlock.fields.icon && UserSettings.prefillRandomIcons) {
                        newRootBlock.fields.icon = BlockIcons.shared.randomIcon()
                    }
                }
                const patch = {
                    updatedFields: {
                        icon: newRootBlock.fields.icon,
                        properties: {...newRootBlock.fields.properties, ...propertyOverrides},
                    },
                    title: newRootBlock.title,
                }
                await octoClient.patchBlock(newRootBlock.boardId, newRootBlock.id, patch)
                if (blocks) {
                    updateAllBoardsAndBlocks([], blocks)
                    await afterRedo?.(newRootBlock.id)
                }
                return [blocks, newRootBlock.id]
            },
            async (newBlocks: Block[]) => {
                await beforeUndo?.()
                const newRootBlock = newBlocks && newBlocks[0]
                if (newRootBlock) {
                    await octoClient.deleteBlock(newRootBlock.boardId, newRootBlock.id)
                }
            },
            description,
            this.undoGroupId,
        )
    }

    async duplicateBoard(
        boardId: string,
        description = 'duplicate board',
        asTemplate = false,
        afterRedo?: (newBoardId: string) => Promise<void>,
        beforeUndo?: () => Promise<void>,
        toTeam?: string,
    ): Promise<BoardsAndBlocks> {
        return undoManager.perform(
            async () => {
                const boardsAndBlocks = await octoClient.duplicateBoard(boardId, asTemplate, toTeam)
                if (boardsAndBlocks) {
                    updateAllBoardsAndBlocks(boardsAndBlocks.boards, boardsAndBlocks.blocks)
                    await afterRedo?.(boardsAndBlocks.boards[0]?.id)
                }
                return boardsAndBlocks
            },
            async (boardsAndBlocks: BoardsAndBlocks) => {
                await beforeUndo?.()
                const awaits = []
                for (const block of boardsAndBlocks.blocks) {
                    awaits.push(octoClient.deleteBlock(block.boardId, block.id))
                }
                for (const board of boardsAndBlocks.boards) {
                    awaits.push(octoClient.deleteBoard(board.id))
                }
                await Promise.all(awaits)
            },
            description,
            this.undoGroupId,
        )
    }

    async moveContentBlock(blockId: string, dstBlockId: string, where: 'after'|'before', srcBlockId: string, srcWhere: 'after'|'before', description: string): Promise<void> {
        return undoManager.perform(
            async () => {
                await octoClient.moveBlockTo(blockId, where, dstBlockId)
            },
            async () => {
                await octoClient.moveBlockTo(blockId, srcWhere, srcBlockId)
            },
            description,
            this.undoGroupId,
        )
    }

    async addBoardFromTemplate(
        teamId: string,
        intl: IntlShape,
        afterRedo: (id: string) => Promise<void>,
        beforeUndo: () => Promise<void>,
        boardTemplateId: string,
        toTeam?: string,
    ): Promise<BoardsAndBlocks> {
        const asTemplate = false
        const actionDescription = intl.formatMessage({id: 'Mutator.new-board-from-template', defaultMessage: 'new board from template'})
        return mutator.duplicateBoard(boardTemplateId, actionDescription, asTemplate, afterRedo, beforeUndo, toTeam)
    }

    async addEmptyBoard(
        teamId: string,
        intl: IntlShape,
        afterRedo?: (id: string) => Promise<void>,
        beforeUndo?: () => Promise<void>,
    ): Promise<BoardsAndBlocks> {
        const board = createBoard()
        board.teamId = teamId

        const view = createBoardView()
        view.fields.viewType = 'board'
        view.parentId = board.id
        view.boardId = board.id
        view.title = intl.formatMessage({id: 'View.NewBoardTitle', defaultMessage: 'Board view'})

        return mutator.createBoardsAndBlocks(
            {boards: [board], blocks: [view]},
            'add board',
            async (bab: BoardsAndBlocks) => {
                const newBoard = bab.boards[0]
                TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CreateBoard, {board: newBoard?.id})
                afterRedo && await afterRedo(newBoard?.id || '')
            },
            beforeUndo,
        )
    }

    async addEmptyBoardTemplate(
        teamId: string,
        intl: IntlShape,
        afterRedo: (id: string) => Promise<void>,
        beforeUndo: () => Promise<void>,
    ): Promise<BoardsAndBlocks> {
        const boardTemplate = createBoard()
        boardTemplate.isTemplate = true
        boardTemplate.teamId = teamId
        boardTemplate.title = intl.formatMessage({id: 'View.NewTemplateDefaultTitle', defaultMessage: 'Untitled Template'})

        const view = createBoardView()
        view.fields.viewType = 'board'
        view.parentId = boardTemplate.id
        view.boardId = boardTemplate.id
        view.title = intl.formatMessage({id: 'View.NewBoardTitle', defaultMessage: 'Board view'})

        return mutator.createBoardsAndBlocks(
            {boards: [boardTemplate], blocks: [view]},
            'add board template',
            async (bab: BoardsAndBlocks) => {
                const newBoard = bab.boards[0]
                TelemetryClient.trackEvent(TelemetryCategory, TelemetryActions.CreateBoardTemplate, {board: newBoard?.id})
                afterRedo(newBoard?.id || '')
            },
            beforeUndo,
        )
    }

    // Other methods

    // Not a mutator, but convenient to put here since Mutator wraps OctoClient
    async exportBoardArchive(boardID: string): Promise<Response> {
        return octoClient.exportBoardArchive(boardID)
    }

    // Not a mutator, but convenient to put here since Mutator wraps OctoClient
    async exportFullArchive(teamID: string): Promise<Response> {
        return octoClient.exportFullArchive(teamID)
    }

    // Not a mutator, but convenient to put here since Mutator wraps OctoClient
    async importFullArchive(file: File): Promise<Response> {
        return octoClient.importFullArchive(file)
    }

    get canUndo(): boolean {
        return undoManager.canUndo
    }

    get canRedo(): boolean {
        return undoManager.canRedo
    }

    get undoDescription(): string | undefined {
        return undoManager.undoDescription
    }

    get redoDescription(): string | undefined {
        return undoManager.redoDescription
    }

    async undo() {
        await undoManager.undo()
    }

    async redo() {
        await undoManager.redo()
    }
}

const mutator = new Mutator()
export default mutator

export {mutator}
