// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

interface ISharing {
    id: string
    enabled: boolean
    token: string
    modifiedBy?: string
    updateAt?: number
}

export {ISharing}
