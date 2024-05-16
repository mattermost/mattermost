// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type LimitsState = {
    usersLimits: UsersLimits;
};

export type UsersLimits = {
    activeUserCount: number;
    maxUsersLimit: number;
};
