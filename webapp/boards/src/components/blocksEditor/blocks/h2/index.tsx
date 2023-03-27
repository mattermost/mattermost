// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useRef, useEffect} from 'react'
import {marked} from 'marked'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'

import './h2.scss'

const H2: ContentType = {
    name: 'h2',
    displayName: 'Sub title',
    slashCommand: '/subtitle',
    prefix: '## ',
    runSlashCommand: (): void => {},
    editable: true,
    Display: (props: BlockInputProps) => {
        const renderer = new marked.Renderer()
        const html = marked('## ' + props.value, {renderer, breaks: true})
        return (
            <div
                dangerouslySetInnerHTML={{__html: html.trim()}}
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
                className='H2'
                data-testid='h2'
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

H2.runSlashCommand = (changeType: (contentType: ContentType) => void, changeValue: (value: string) => void, ...args: string[]): void => {
    changeType(H2)
    changeValue(args.join(' '))
}

export default H2
