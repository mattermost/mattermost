// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type LimitsState = {
    serverLimits: ServerLimits;
};

export type ServerLimits = {
    activeUserCount: number;
    maxUsersLimit: number;
};
