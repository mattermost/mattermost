// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import {MarkdownEditor} from 'src/components/markdownEditor'
import {Utils} from 'src/utils'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'

import './text.scss'

const TextContent: ContentType = {
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
        return (
            <div
                className='TextContent'
                data-testid='text'
            >
                <MarkdownEditor
                    autofocus={true}
                    onBlur={(val: string) => {
                        props.onSave(val)
                    }}
                    text={props.value}
                    saveOnEnter={true}
                    onEditorCancel={() => {
                        props.onCancel()
                    }}
                />
            </div>
        )
    },
}

TextContent.runSlashCommand = (changeType: (contentType: ContentType) => void, changeValue: (value: string) => void, ...args: string[]): void => {
    changeType(TextContent)
    changeValue(args.join(' '))
}

export default TextContent
