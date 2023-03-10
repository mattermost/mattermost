// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useRef, useEffect} from 'react'
import {marked} from 'marked'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'

import './checkbox.scss'

type ValueType = {
    value: string
    checked: boolean
}

const Checkbox: ContentType<ValueType> = {
    name: 'checkbox',
    displayName: 'Checkbox',
    slashCommand: '/checkbox',
    prefix: '[ ] ',
    nextType: 'checkbox',
    runSlashCommand: (): void => {},
    editable: true,
    Display: (props: BlockInputProps<ValueType>) => {
        const renderer = new marked.Renderer()
        const html = marked(props.value.value || '', {renderer, breaks: true})
        return (
            <div className='CheckboxView'>
                <input
                    data-testid='checkbox-check'
                    type='checkbox'
                    onChange={(e) => {
                        const newValue = {checked: Boolean(e.target.checked), value: props.value.value || ''}
                        props.onSave(newValue)
                    }}
                    checked={props.value.checked || false}
                    onClick={(e) => e.stopPropagation()}
                />
                <div
                    dangerouslySetInnerHTML={{__html: html.trim()}}
                />
            </div>
        )
    },
    Input: (props: BlockInputProps<ValueType>) => {
        const ref = useRef<HTMLInputElement|null>(null)
        useEffect(() => {
            ref.current?.focus()
        }, [])
        return (
            <div className='Checkbox'>
                <input
                    type='checkbox'
                    data-testid='checkbox-check'
                    className='inputCheck'
                    onChange={(e) => {
                        let newValue = {checked: false, value: props.value.value || ''}
                        if (e.target.checked) {
                            newValue = {checked: true, value: props.value.value || ''}
                        }
                        props.onChange(newValue)
                        ref.current?.focus()
                    }}
                    checked={props.value.checked || false}
                />
                <input
                    ref={ref}
                    data-testid='checkbox-input'
                    className='inputText'
                    onChange={(e) => {
                        props.onChange({checked: Boolean(props.value.checked), value: e.currentTarget.value})
                    }}
                    onKeyDown={(e) => {
                        if ((props.value.value || '') === '' && e.key === 'Backspace') {
                            props.onCancel()
                        }
                        if (e.key === 'Enter') {
                            props.onSave(props.value || {checked: false, value: ''})
                        }
                    }}
                    value={props.value.value || ''}
                />
            </div>
        )
    },
}

Checkbox.runSlashCommand = (changeType: (contentType: ContentType<ValueType>) => void, changeValue: (value: ValueType) => void, ...args: string[]): void => {
    changeType(Checkbox)
    changeValue({checked: false, value: args.join(' ')})
}

export default Checkbox
