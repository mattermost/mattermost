// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type LimitsState = {
    serverLimits: ServerLimits;
};

export type ServerLimits = {
    activeUserCount: number;
    maxUsersLimit: number;
    maxUsersHardLimit?: number;

    // Post history limit fields
    lastAccessiblePostTime?: number; // Timestamp of the last accessible post (0 if no limits)
    postHistoryLimit?: number; // The actual message history limit value (0 if no limits)
}
