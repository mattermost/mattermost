// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useRef, useEffect} from 'react'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'
import {Utils} from 'src/utils'

import './text.scss'

const Text: ContentType = {
    name: 'text',
    displayName: 'Text',
    slashCommand: '/text',
    prefix: '',
    runSlashCommand: (): void => {},
    editable: true,
    Display: (props: BlockInputProps) => {
        const html: string = Utils.htmlFromMarkdown(props.value || '')
        return (
            <div
                dangerouslySetInnerHTML={{__html: html}}
                className={props.value ? 'octo-editor-preview' : 'octo-editor-preview octo-placeholder'}
            />
        )
    },
    Input: (props: BlockInputProps) => {
        const ref = useRef<HTMLInputElement|null>(null)
        useEffect(() => {
            ref.current?.focus()
        }, [])
        return (
            <input
                ref={ref}
                className='Text'
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
        )
    },
}

Text.runSlashCommand = (changeType: (contentType: ContentType) => void, changeValue: (value: string) => void, ...args: string[]): void => {
    changeType(Text)
    changeValue(args.join(' '))
}

export default Text
