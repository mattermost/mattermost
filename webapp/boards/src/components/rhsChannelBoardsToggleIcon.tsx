// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ElementRef, useRef} from 'react'

import {useSelector} from 'react-redux'
import {GlobalState} from '@mattermost/types/store'

import FocalboardIcon from 'src/widgets/icons/logo'

type Props = {
    boardsRhsId: string
}

type ViewsState = {views: {rhs: {isSidebarOpen: boolean, pluggableId: string}, rhsSuppressed: boolean}}

const RhsChannelBoardsToggleIcon = ({boardsRhsId}: Props) => {
    const iconRef = useRef<ElementRef<typeof FocalboardIcon>>(null)
    const isOpen = useSelector(({views: {rhs, rhsSuppressed}}: GlobalState & ViewsState) => (
        rhs.isSidebarOpen &&
        !rhsSuppressed &&
        rhs.pluggableId === boardsRhsId
    ))

    // If it has been mounted, we know our parent is always a button.
    const parent = iconRef?.current ? iconRef?.current?.parentNode as HTMLButtonElement : null
    parent?.classList.toggle('channel-header__icon--active-inverted', isOpen)

    return (
        <FocalboardIcon
            ref={iconRef}
        />
    )
}

export default RhsChannelBoardsToggleIcon
