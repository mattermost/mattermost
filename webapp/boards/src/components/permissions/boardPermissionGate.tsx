// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react'

import {useAppSelector} from 'src/store/hooks'
import {getCurrentBoardId} from 'src/store/boards'
import {getCurrentTeam} from 'src/store/teams'
import {Permission} from 'src/constants'
import {useHasPermissions} from 'src/hooks/permissions'

type Props = {
    boardId?: string
    teamId?: string
    permissions: Permission[]
    invert?: boolean
    children: React.ReactNode
}

const BoardPermissionGate = (props: Props): React.ReactElement|null => {
    const currentTeam = useAppSelector(getCurrentTeam)
    const currentBoardId = useAppSelector(getCurrentBoardId)

    const boardId = props.boardId || currentBoardId || ''
    const teamId = props.teamId || currentTeam?.id || ''

    let allowed = useHasPermissions(teamId, boardId, props.permissions)

    if (props.invert) {
        allowed = !allowed
    }

    if (allowed) {
        return (<>{props.children}</>)
    }

    return null
}

export default React.memo(BoardPermissionGate)
