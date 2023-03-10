// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import difference from 'lodash/difference'

import {Utils, IDType} from 'src/utils'

import {Block, BlockPatch, createPatchesFromBlocks} from './block'
import {Card} from './card'

const BoardTypeOpen = 'O'
const BoardTypePrivate = 'P'
const boardTypes = [BoardTypeOpen, BoardTypePrivate]
type BoardTypes = typeof boardTypes[number]

enum MemberRole {
    Viewer = 'viewer',
    Commenter = 'commenter',
    Editor = 'editor',
    Admin = 'admin',
    None = '',
}

type Board = {
    id: string
    teamId: string
    channelId?: string
    createdBy: string
    modifiedBy: string
    type: BoardTypes
    minimumRole: MemberRole

    title: string
    description: string
    icon?: string
    showDescription: boolean
    isTemplate: boolean
    templateVersion: number
    properties: Record<string, string | string[]>
    cardProperties: IPropertyTemplate[]

    createAt: number
    updateAt: number
    deleteAt: number
}

type BoardPatch = {
    type?: BoardTypes
    minimumRole?: MemberRole
    title?: string
    description?: string
    icon?: string
    showDescription?: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedProperties?: Record<string, any>
    deletedProperties?: string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedCardProperties?: IPropertyTemplate[]
    deletedCardProperties?: string[]
}

type BoardMember = {
    boardId: string
    userId: string
    roles?: string
    minimumRole: MemberRole
    schemeAdmin: boolean
    schemeEditor: boolean
    schemeCommenter: boolean
    schemeViewer: boolean
    synthetic: boolean
}

type BoardsAndBlocks = {
    boards: Board[]
    blocks: Block[]
}

type BoardsAndBlocksPatch = {
    boardIDs: string[]
    boardPatches: BoardPatch[]
    blockIDs: string[]
    blockPatches: BlockPatch[]
}

type PropertyTypeEnum = 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'person' | 'multiPerson' | 'file' | 'checkbox' | 'url' | 'email' | 'phone' | 'createdTime' | 'createdBy' | 'updatedTime' | 'updatedBy' | 'unknown'

interface IPropertyOption {
    id: string
    value: string
    color: string
}

// A template for card properties attached to a board
interface IPropertyTemplate {
    id: string
    name: string
    type: PropertyTypeEnum
    options: IPropertyOption[]
}

function createBoard(board?: Board): Board {
    const now = Date.now()
    let cardProperties: IPropertyTemplate[] = []
    const selectProperties = cardProperties.find((o) => o.type === 'select')
    if (!selectProperties) {
        const property: IPropertyTemplate = {
            id: Utils.createGuid(IDType.BlockID),
            name: 'Status',
            type: 'select',
            options: [],
        }
        cardProperties.push(property)
    }

    if (board?.cardProperties) {
        // Deep clone of card properties and their options
        cardProperties = board?.cardProperties.map((o: IPropertyTemplate) => {
            return {
                id: o.id,
                name: o.name,
                type: o.type,
                options: o.options ? o.options.map((option) => ({...option})) : [],
            }
        })
    }

    return {
        id: board?.id || Utils.createGuid(IDType.Board),
        teamId: board?.teamId || '',
        channelId: board?.channelId || '',
        createdBy: board?.createdBy || '',
        modifiedBy: board?.modifiedBy || '',
        type: board?.type || BoardTypePrivate,
        minimumRole: board?.minimumRole || MemberRole.None,
        title: board?.title || '',
        description: board?.description || '',
        icon: board?.icon || '',
        showDescription: board?.showDescription || false,
        isTemplate: board?.isTemplate || false,
        templateVersion: board?.templateVersion || 0,
        properties: board?.properties || {},
        cardProperties,
        createAt: board?.createAt || now,
        updateAt: board?.updateAt || now,
        deleteAt: board?.deleteAt || 0,
    }
}

type BoardGroup = {
    option: IPropertyOption
    cards: Card[]
}

// getPropertiesDifference returns a list of the property IDs that are
// contained in propsA but are not contained in propsB
function getPropertiesDifference(propsA: IPropertyTemplate[], propsB: IPropertyTemplate[]): string[] {
    const diff: string[] = []
    propsA.forEach((val) => {
        if (!propsB.find((p) => p.id === val.id)) {
            diff.push(val.id)
        }
    })

    return diff
}

// isPropertyEqual checks that both the contents of the property and
// its options are equal
function isPropertyEqual(propA: IPropertyTemplate, propB: IPropertyTemplate): boolean {
    for (const val of Object.keys(propA)) {
        if (val !== 'options' && (propA as any)[val] !== (propB as any)[val]) {
            return false
        }
    }

    if (propA.options.length !== propB.options.length) {
        return false
    }

    for (const opt of propA.options) {
        const optionB = propB.options.find((o) => o.id === opt.id)
        if (!optionB) {
            return false
        }

        for (const val of Object.keys(opt)) {
            if ((opt as any)[val] !== (optionB as any)[val]) {
                return false
            }
        }
    }

    return true
}

// createCardPropertiesPatches creates two BoardPatch instances, one that
// contains the delta to update the board cardProperties and another one for
// the undo action, in case it happens
function createCardPropertiesPatches(newCardProperties: IPropertyTemplate[], oldCardProperties: IPropertyTemplate[]): BoardPatch[] {
    const newDeletedCardProperties = getPropertiesDifference(newCardProperties, oldCardProperties)
    const oldDeletedCardProperties = getPropertiesDifference(oldCardProperties, newCardProperties)
    const newUpdatedCardProperties: IPropertyTemplate[] = []
    newCardProperties.forEach((val) => {
        const oldCardProperty = oldCardProperties.find((o) => o.id === val.id)
        if (!oldCardProperty || !isPropertyEqual(val, oldCardProperty)) {
            newUpdatedCardProperties.push(val)
        }
    })
    const oldUpdatedCardProperties: IPropertyTemplate[] = []
    oldCardProperties.forEach((val) => {
        const newCardProperty = newCardProperties.find((o) => o.id === val.id)
        if (!newCardProperty || !isPropertyEqual(val, newCardProperty)) {
            oldUpdatedCardProperties.push(val)
        }
    })

    return [
        {
            updatedCardProperties: newUpdatedCardProperties,
            deletedCardProperties: oldDeletedCardProperties,
        },
        {
            updatedCardProperties: oldUpdatedCardProperties,
            deletedCardProperties: newDeletedCardProperties,
        },
    ]
}

// createPatchesFromBoards creates two BoardPatch instances, one that
// contains the delta to update the board and another one for the undo
// action, in case it happens
function createPatchesFromBoards(newBoard: Board, oldBoard: Board): BoardPatch[] {
    const newDeletedProperties = difference(Object.keys(newBoard.properties || {}), Object.keys(oldBoard.properties || {}))

    const newUpdatedProperties: Record<string, any> = {}
    Object.keys(newBoard.properties || {}).forEach((val) => {
        if (oldBoard.properties[val] !== newBoard.properties[val]) {
            newUpdatedProperties[val] = newBoard.properties[val]
        }
    })

    const newData: Record<string, any> = {}
    Object.keys(newBoard).forEach((val) => {
        if (val !== 'properties' &&
            val !== 'cardProperties' &&
            (oldBoard as any)[val] !== (newBoard as any)[val]) {
            newData[val] = (newBoard as any)[val]
        }
    })

    const oldDeletedProperties = difference(Object.keys(oldBoard.properties || {}), Object.keys(newBoard.properties || {}))

    const oldUpdatedProperties: Record<string, any> = {}
    Object.keys(oldBoard.properties || {}).forEach((val) => {
        if (newBoard.properties[val] !== oldBoard.properties[val]) {
            oldUpdatedProperties[val] = oldBoard.properties[val]
        }
    })

    const oldData: Record<string, any> = {}
    Object.keys(oldBoard).forEach((val) => {
        if (val !== 'properties' &&
            val !== 'cardProperties' &&
            (newBoard as any)[val] !== (oldBoard as any)[val]) {
            oldData[val] = (oldBoard as any)[val]
        }
    })

    const [cardPropertiesPatch, cardPropertiesUndoPatch] = createCardPropertiesPatches(newBoard.cardProperties, oldBoard.cardProperties)

    return [
        {
            ...newData,
            ...cardPropertiesPatch,
            updatedProperties: newUpdatedProperties,
            deletedProperties: oldDeletedProperties,
        },
        {
            ...oldData,
            ...cardPropertiesUndoPatch,
            updatedProperties: oldUpdatedProperties,
            deletedProperties: newDeletedProperties,
        },
    ]
}

function createPatchesFromBoardsAndBlocks(updatedBoard: Board, oldBoard: Board, updatedBlockIDs: string[], updatedBlocks: Block[], oldBlocks: Block[]): BoardsAndBlocksPatch[] {
    const blockUpdatePatches = [] as BlockPatch[]
    const blockUndoPatches = [] as BlockPatch[]
    updatedBlocks.forEach((newBlock, i) => {
        const [updatePatch, undoPatch] = createPatchesFromBlocks(newBlock, oldBlocks[i])
        blockUpdatePatches.push(updatePatch)
        blockUndoPatches.push(undoPatch)
    })

    const [boardUpdatePatch, boardUndoPatch] = createPatchesFromBoards(updatedBoard, oldBoard)

    const updatePatch: BoardsAndBlocksPatch = {
        blockIDs: updatedBlockIDs,
        blockPatches: blockUpdatePatches,
        boardIDs: [updatedBoard.id],
        boardPatches: [boardUpdatePatch],
    }

    const undoPatch: BoardsAndBlocksPatch = {
        blockIDs: updatedBlockIDs,
        blockPatches: blockUndoPatches,
        boardIDs: [updatedBoard.id],
        boardPatches: [boardUndoPatch],
    }

    return [updatePatch, undoPatch]
}

export {
    Board,
    BoardPatch,
    BoardMember,
    BoardsAndBlocks,
    BoardsAndBlocksPatch,
    PropertyTypeEnum,
    IPropertyOption,
    IPropertyTemplate,
    BoardGroup,
    createBoard,
    BoardTypes,
    BoardTypeOpen,
    BoardTypePrivate,
    MemberRole,
    createPatchesFromBoards,
    createPatchesFromBoardsAndBlocks,
    createCardPropertiesPatches,
}
