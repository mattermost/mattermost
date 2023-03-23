// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import {useDrag, useDrop} from 'react-dnd'

import GripIcon from 'src/widgets/icons/grip'

import AddIcon from 'src/widgets/icons/add'

import Editor from './editor'
import * as registry from './blocks'
import {BlockData} from './blocks/types'

import './blockContent.scss'

type Props = {
    boardId?: string
    block: BlockData
    contentOrder: string[]
    editing: BlockData|null
    setEditing: (block: BlockData|null) => void
    setAfterBlock: (block: BlockData|null) => void
    onSave: (block: BlockData) => Promise<BlockData|null>
    onMove: (block: BlockData, beforeBlock: BlockData|null, afterBlock: BlockData|null) => Promise<void>
}

function BlockContent(props: Props) {
    const {block, editing, setEditing, onSave, contentOrder, boardId} = props

    const [{isDragging}, drag, preview] = useDrag(() => ({
        type: 'block',
        item: block,
        collect: (monitor) => ({
            isDragging: Boolean(monitor.isDragging()),
        }),
    }), [block, contentOrder])
    const [{isOver, draggingUp}, drop] = useDrop(
        () => ({
            accept: 'block',
            drop: (item: BlockData) => {
                if (item.id !== block.id) {
                    if (contentOrder.indexOf(item.id || '') > contentOrder.indexOf(block.id || '')) {
                        props.onMove(item, block, null)
                    } else {
                        props.onMove(item, null, block)
                    }
                }
            },
            collect: (monitor) => ({
                isOver: Boolean(monitor.isOver()) && (monitor.getItem() as BlockData).id! !== block.id,
                draggingUp: (monitor.getItem() as BlockData)?.id && contentOrder.indexOf((monitor.getItem() as BlockData).id!) > contentOrder.indexOf(block.id || ''),
            }),
        }),
        [block, props.onMove, contentOrder],
    )

    if (editing && editing.id === block.id) {
        return (
            <Editor
                onSave={async (b) => {
                    const updatedBlock = await onSave(b)
                    props.setEditing(null)
                    props.setAfterBlock(updatedBlock)
                    return updatedBlock
                }}
                id={block.id}
                initialValue={block.value}
                initialContentType={block.contentType}
            />
        )
    }

    const contentType = registry.get(block.contentType)
    if (contentType && contentType.Display) {
        const DisplayContent = contentType.Display
        return (
            <div
                ref={drop}
                data-testid='block-content'
                className={`BlockContent ${isOver && draggingUp ? 'over-up' : ''}  ${isOver && !draggingUp ? 'over-down' : ''}`}
                key={block.id}
                style={{
                    opacity: isDragging ? 0.5 : 1,
                }}
                onClick={() => {
                    setEditing(block)
                }}
            >
                <span
                    className='action'
                    data-testid='add-action'
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        props.setAfterBlock(block)
                    }}
                >
                    <AddIcon/>
                </span>
                <span
                    className='action'
                    ref={drag}
                >
                    <GripIcon/>
                </span>
                <div
                    className='content'
                    ref={preview}
                >
                    <DisplayContent
                        value={block.value}
                        onChange={() => null}
                        onCancel={() => null}
                        onSave={(value) => onSave({...block, value})}
                        currentBoardId={boardId}
                    />
                </div>
            </div>
        )
    }
    return null
}

export default BlockContent
