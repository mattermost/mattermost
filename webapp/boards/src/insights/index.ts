// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type TopBoard = {
    boardID: string
    icon: string
    title: string
    activityCount: number
    activeUsers: string
    createdBy: string
}

export type TopBoardResponse = {
    has_next: boolean
    items: TopBoard[]
}
