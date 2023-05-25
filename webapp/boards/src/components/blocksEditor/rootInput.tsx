// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useState} from 'react'
import Select, {StylesConfig} from 'react-select'

import {getSelectBaseStyle} from 'src/theme'

import * as registry from './blocks/'
import {ContentType} from './blocks/types'

type Props = {
    onChange: (value: string) => void
    onChangeType: (blockType: ContentType) => void
    onSave: (value: string, blockType: string) => void
    value: string
}

const baseStyles = getSelectBaseStyle<ContentType>()

const styles: StylesConfig<ContentType> = {
    ...baseStyles,
    control: (provided) => ({
        ...provided,
        width: '100%',
        height: '100%',
        display: 'flex',
        background: 'rgb(var(--center-channel-bg-rgb))',
        color: 'rgb(var(--center-channel-color-rgb))',
        flexDirection: 'row',
    }),
    input: (provided) => ({
        ...provided,
        background: 'rgb(var(--center-channel-bg-rgb))',
        color: 'rgb(var(--center-channel-color-rgb))',
    }),
    menu: (provided) => ({
        ...provided,
        minWidth: '100%',
        width: 'max-content',
        background: 'rgb(var(--center-channel-bg-rgb))',
        left: '0',
        marginBottom: '0',
    }),
    menuPortal: (provided) => ({
        ...provided,
        zIndex: 999,
    }),
}

export default function RootInput(props: Props) {
    const [showMenu, setShowMenu] = useState(false)

    return (
        <Select<ContentType>
            styles={styles}
            components={{DropdownIndicator: () => null, IndicatorSeparator: () => null}}
            className='RootInput'
            placeholder={'Introduce your text or your slash command'}
            autoFocus={true}
            menuIsOpen={showMenu}
            menuPortalTarget={document.getElementById('focalboard-root-portal')}
            menuPosition={'fixed'}
            options={registry.list()}
            getOptionValue={(ct) => ct.slashCommand}
            getOptionLabel={(ct) => ct.slashCommand + ' Creates a new ' + ct.displayName + ' block.'}
            filterOption={(option: any, inputValue: string): boolean => {
                return inputValue.startsWith(option.value) || option.value.startsWith(inputValue)
            }}
            inputValue={props.value}
            onInputChange={(inputValue: string) => {
                props.onChange(inputValue)
                if (inputValue.startsWith('/')) {
                    setShowMenu(true)
                } else {
                    setShowMenu(false)
                }
            }}
            onChange={(ct: ContentType|null) => {
                if (ct) {
                    const args = props.value.split(' ').slice(1)
                    ct.runSlashCommand(props.onChangeType, props.onChange, ...args)
                }
            }}
            onBlur={() => {
                const command = props.value.trimStart().split(' ')[0]
                const block = registry.getBySlashCommandPrefix(command)
                if (command === '' || !block) {
                    props.onSave(props.value, 'text')
                    props.onChange('')
                }
            }}
            onFocus={(e) => {
                const target = e.currentTarget
                target.scrollIntoView({block: 'center'})
            }}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    props.onSave('', 'text')
                    props.onChange('')
                }
                if (e.key === 'Enter') {
                    const command = props.value.trimStart().split(' ')[0]
                    const block = registry.getBySlashCommandPrefix(command)
                    if (command === '' || !block) {
                        e.preventDefault()
                        e.stopPropagation()
                        props.onSave(props.value, 'text')
                        props.onChange('')
                    }
                }
            }}
        />
    )
}

