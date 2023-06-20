// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect} from 'react'

import {BlockInputProps, ContentType} from 'src/components/blocksEditor/blocks/types'

import './divider.scss'

const Divider: ContentType = {
    name: 'divider',
    displayName: 'Divider',
    slashCommand: '/divider',
    prefix: '--- ',
    runSlashCommand: (): void => {},
    editable: false,
    Display: () => <hr className='Divider'/>,
    Input: (props: BlockInputProps) => {
        useEffect(() => {
            props.onSave(props.value)
        }, [])

        return null
    },
}

Divider.runSlashCommand = (changeType: (contentType: ContentType) => void, changeValue: (value: string) => void, ...args: string[]): void => {
    changeType(Divider)
    changeValue(args.join(' '))
}

export default Divider
