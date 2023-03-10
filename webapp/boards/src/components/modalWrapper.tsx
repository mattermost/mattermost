// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react'
import './modalWrapper.scss'

type Props = {
    children: React.ReactNode
}

const ModalWrapper = (props: Props) => {
    return (
        <div className='ModalWrapper'>
            {props.children}
        </div>
    )
}

export default React.memo(ModalWrapper)
