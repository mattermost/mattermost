// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {useEffect} from 'react'

import {getCurrentBoard} from 'src/store/boards'
import {getCurrentView} from 'src/store/views'
import {useAppSelector} from 'src/store/hooks'

const SetWindowTitleAndIcon = (): null => {
    const board = useAppSelector(getCurrentBoard)
    const activeView = useAppSelector(getCurrentView)

    useEffect(() => {
        if (board) {
            let title = `${board.title}`
            if (activeView?.title) {
                title += ` | ${activeView.title}`
            }
            document.title = title
        } else {
            document.title = 'Boards - Mattermost'
        }
    }, [board?.title, activeView?.title])

    return null
}

export default SetWindowTitleAndIcon
