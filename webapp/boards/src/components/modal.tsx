// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useRef, useEffect, useCallback} from 'react'

import IconButton from 'src/widgets/buttons/iconButton'
import CloseIcon from 'src/widgets/icons/close'
import './modal.scss'

type Props = {
    onClose: () => void
    position?: 'top'|'bottom'|'bottom-right'
    children: React.ReactNode
}

const Modal = (props: Props): JSX.Element => {
    const node = useRef<HTMLDivElement>(null)

    const {position, onClose, children} = props

    const closeOnBlur = useCallback((e: Event) => {
        if (e.target && node.current?.contains(e.target as Node)) {
            return
        }
        onClose()
    }, [onClose])

    useEffect(() => {
        document.addEventListener('click', closeOnBlur, true)
        return () => {
            document.removeEventListener('click', closeOnBlur, true)
        }
    }, [closeOnBlur])

    return (
        <div
            className={'Modal ' + (position || 'bottom')}
            ref={node}
        >
            <div className='toolbar hideOnWidescreen'>
                <IconButton
                    onClick={() => onClose()}
                    icon={<CloseIcon/>}
                    title={'Close'}
                />
            </div>
            {children}
        </div>
    )
}

export default React.memo(Modal)
