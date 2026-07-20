// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const InlineEntityTypes = {
    POST: 'POST',
    CHANNEL: 'CHANNEL',
    TEAM: 'TEAM',
} as const;

export type InlineEntityType = typeof InlineEntityTypes[keyof typeof InlineEntityTypes];

