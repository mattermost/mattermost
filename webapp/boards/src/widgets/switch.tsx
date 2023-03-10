// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'

import './switch.scss'

type Props = {
    onChanged: (isOn: boolean) => void
    isOn: boolean
    readOnly?: boolean
    size?: string
}

// Switch is an on-off style switch / checkbox
function Switch(props: Props): JSX.Element {
    const switchSize = `size--${props.size === 'medium' ? 'medium' : 'small'}`
    const switchIsOn = props.isOn ? ' on' : ''
    const switchIsReadonly = props.readOnly ? ' readonly' : ''
    const className = `Switch override-main ${switchSize}${switchIsOn}${switchIsReadonly}`
    return (
        <div
            className={className}
            onClick={() => {
                if (!props.readOnly) {
                    props.onChanged(!props.isOn)
                }
            }}
        >
            <div className='octo-switch-inner'/>
        </div>
    )
}

export default React.memo(Switch)
