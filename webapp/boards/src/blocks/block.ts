// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import difference from 'lodash/difference'

import {Utils} from 'src/utils'

const contentBlockTypes = ['text', 'image', 'divider', 'checkbox', 'h1', 'h2', 'h3', 'list-item', 'attachment', 'quote', 'video'] as const

// ToDo: remove type board
const blockTypes = [...contentBlockTypes, 'board', 'view', 'card', 'comment', 'attachment', 'unknown'] as const
type ContentBlockTypes = typeof contentBlockTypes[number]
type BlockTypes = typeof blockTypes[number]

interface BlockPatch {
    parentId?: string
    schema?: number
    type?: BlockTypes
    title?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedFields?: Record<string, any>
    deletedFields?: string[]
    deleteAt?: number
}

interface Block {
    id: string
    boardId: string
    parentId: string
    createdBy: string
    modifiedBy: string

    schema: number
    type: BlockTypes
    title: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: Record<string, any>

    createAt: number
    updateAt: number
    deleteAt: number

    limited?: boolean
}

interface FileInfo {
    url?: string
    archived?: boolean
    extension?: string
    name?: string
    size?: number
}

function createBlock(block?: Block): Block {
    const now = Date.now()
    return {
        id: block?.id || Utils.createGuid(Utils.blockTypeToIDType(block?.type)),
        schema: 1,
        boardId: block?.boardId || '',
        parentId: block?.parentId || '',
        createdBy: block?.createdBy || '',
        modifiedBy: block?.modifiedBy || '',
        type: block?.type || 'unknown',
        fields: block?.fields ? {...block?.fields} : {},
        title: block?.title || '',
        createAt: block?.createAt || now,
        updateAt: block?.updateAt || now,
        deleteAt: block?.deleteAt || 0,
        limited: Boolean(block?.limited),
    }
}

// createPatchesFromBlocks creates two BlockPatch instances, one that
// contains the delta to update the block and another one for the undo
// action, in case it happens
function createPatchesFromBlocks(newBlock: Block, oldBlock: Block): BlockPatch[] {
    const newDeletedFields = difference(Object.keys(newBlock.fields), Object.keys(oldBlock.fields))
    const newUpdatedFields: Record<string, any> = {}
    const newUpdatedData: Record<string, any> = {}
    Object.keys(newBlock.fields).forEach((val) => {
        if (oldBlock.fields[val] !== newBlock.fields[val]) {
            newUpdatedFields[val] = newBlock.fields[val]
        }
    })
    Object.keys(newBlock).forEach((val) => {
        if (val !== 'fields' && (oldBlock as any)[val] !== (newBlock as any)[val]) {
            newUpdatedData[val] = (newBlock as any)[val]
        }
    })

    const oldDeletedFields = difference(Object.keys(oldBlock.fields), Object.keys(newBlock.fields))
    const oldUpdatedFields: Record<string, any> = {}
    const oldUpdatedData: Record<string, any> = {}
    Object.keys(oldBlock.fields).forEach((val) => {
        if (oldBlock.fields[val] !== newBlock.fields[val]) {
            oldUpdatedFields[val] = oldBlock.fields[val]
        }
    })
    Object.keys(oldBlock).forEach((val) => {
        if (val !== 'fields' && (oldBlock as any)[val] !== (newBlock as any)[val]) {
            oldUpdatedData[val] = (oldBlock as any)[val]
        }
    })

    return [
        {
            ...newUpdatedData,
            updatedFields: newUpdatedFields,
            deletedFields: oldDeletedFields,
        },
        {
            ...oldUpdatedData,
            updatedFields: oldUpdatedFields,
            deletedFields: newDeletedFields,
        },
    ]
}

export type {ContentBlockTypes, BlockTypes, FileInfo}
export {blockTypes, contentBlockTypes, Block, BlockPatch, createBlock, createPatchesFromBlocks}
