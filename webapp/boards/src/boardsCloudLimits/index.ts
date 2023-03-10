// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const LimitUnlimited = 0

export interface BoardsCloudLimits {
    cards: number
    used_cards: number
    card_limit_timestamp: number
    views: number
}
