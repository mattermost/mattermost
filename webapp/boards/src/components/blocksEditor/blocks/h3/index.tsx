// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef} from 'react'
import {marked} from 'marked'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'

import './h3.scss'

const H3: ContentType = {
    name: 'h3',
    displayName: 'Sub Sub title',
    slashCommand: '/subsubtitle',
    prefix: '### ',
    runSlashCommand: (): void => {},
    editable: true,
    Display: (props: BlockInputProps) => {
        const renderer = new marked.Renderer()
        const html = marked('### ' + props.value, {renderer, breaks: true})

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
                className='H3'
                data-testid='h3'
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

H3.runSlashCommand = (changeType: (contentType: ContentType) => void, changeValue: (value: string) => void, ...args: string[]): void => {
    changeType(H3)
    changeValue(args.join(' '))
}

export default H3
