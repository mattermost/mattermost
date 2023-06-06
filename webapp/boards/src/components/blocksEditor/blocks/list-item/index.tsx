// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef} from 'react'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'

import './list-item.scss'

const ListItem: ContentType = {
    name: 'list-item',
    displayName: 'List item',
    slashCommand: '/list-item',
    prefix: '* ',
    nextType: 'list-item',
    runSlashCommand: (): void => {},
    editable: true,
    Display: (props: BlockInputProps) => <ul><li>{props.value}</li></ul>,
    Input: (props: BlockInputProps) => {
        const ref = useRef<HTMLInputElement|null>(null)
        useEffect(() => {
            ref.current?.focus()
        }, [])

        return (
            <ul>
                <li>
                    <input
                        ref={ref}
                        className='ListItem'
                        data-testid='list-item'
                        onChange={(e) => props.onChange(e.currentTarget.value)}
                        onKeyDown={(e) => {
                            if (props.value === '' && e.key === 'Backspace') {
                                props.onCancel()
                            }
                            if (e.key === 'Enter') {
                                props.onSave(props.value)
                            }
                        }}
                        value={props.value}
                    />
                </li>
            </ul>
        )
    },
}

ListItem.runSlashCommand = (changeType: (contentType: ContentType) => void, changeValue: (value: string) => void, ...args: string[]): void => {
    changeType(ListItem)
    changeValue(args.join(' '))
}

export default ListItem
