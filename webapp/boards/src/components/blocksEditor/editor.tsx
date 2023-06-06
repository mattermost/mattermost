// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useState} from 'react'

import * as contentBlocks from './blocks/'
import {BlockData, ContentType} from './blocks/types'
import RootInput from './rootInput'

import './editor.scss'

type Props = {
    boardId?: string
    onSave: (block: BlockData) => Promise<BlockData|null>
    id?: string
    initialValue?: string
    initialContentType?: string
}

export default function Editor(props: Props) {
    const [value, setValue] = useState(props.initialValue || '')
    const [currentBlockType, setCurrentBlockType] = useState<ContentType|null>(contentBlocks.get(props.initialContentType || '') || null)

    useEffect(() => {
        if (!currentBlockType) {
            const block = contentBlocks.getByPrefix(value)
            if (block) {
                setValue('')
                setCurrentBlockType(block)
            } else if (value !== '' && !contentBlocks.isSubPrefix(value) && !value.startsWith('/')) {
                setCurrentBlockType(contentBlocks.get('text'))
            }
        }
    }, [value, currentBlockType])

    const CurrentBlockInput = currentBlockType?.Input

    return (
        <div className='Editor'>
            {currentBlockType === null &&
                <RootInput
                    onChange={setValue}
                    onChangeType={setCurrentBlockType}
                    value={value}
                    onSave={async (val: string, blockType: string) => {
                        if (blockType === null && val === '') {
                            return
                        }
                        await props.onSave({value: val, contentType: blockType, id: props.id})
                        setValue('')
                        setCurrentBlockType(null)
                    }}
                />}
            {CurrentBlockInput &&
                <CurrentBlockInput
                    onChange={setValue}
                    value={value}
                    onCancel={() => {
                        setValue('')
                        setCurrentBlockType(null)
                    }}
                    onSave={async (val: string) => {
                        const newBlock = await props.onSave({value: val, contentType: currentBlockType.name, id: props.id})
                        setValue('')
                        const createdContentType = contentBlocks.get(newBlock?.contentType || '')
                        setCurrentBlockType(contentBlocks.get(createdContentType?.nextType || '') || null)
                    }}
                    currentBoardId={props.boardId}
                />}
        </div>
    )
}
