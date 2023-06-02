// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useEffect, useRef, useState} from 'react'

type TextInputOptionProps = {
    initialValue: string
    onConfirmValue: (value: string) => void
    onValueChanged: (value: string) => void
}

function TextInputOption(props: TextInputOptionProps): JSX.Element {
    const nameTextbox = useRef<HTMLInputElement>(null)
    const [value, setValue] = useState(props.initialValue)

    useEffect(() => {
        nameTextbox.current?.focus()
        nameTextbox.current?.setSelectionRange(0, value.length)
    }, [])

    return (
        <input
            ref={nameTextbox}
            type='text'
            className='PropertyMenu menu-textbox menu-option'
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
                setValue(e.target.value)
                props.onValueChanged(value)
            }}
            value={value}
            title={value}
            onBlur={() => props.onConfirmValue(value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    props.onConfirmValue(value)
                    e.stopPropagation()
                    if (e.key === 'Enter') {
                        e.target.dispatchEvent(new Event('menuItemClicked'))
                    }
                }
            }}
            spellCheck={true}
        />
    )
}

export default React.memo(TextInputOption)
