// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type DataRetentionCustomPolicy = {
    id: string;
    display_name: string;
    post_duration: number;
    team_count: number;
    channel_count: number;
};

export type CreateDataRetentionCustomPolicy = {
    display_name: string;
    post_duration: number;
    channel_ids: string[];
    team_ids: string[];
};

export type PatchDataRetentionCustomPolicy = {
    display_name: string;
    post_duration: number;
}

export type PatchDataRetentionCustomPolicyTeams = {
    team_ids: string[];
}

export type PatchDataRetentionCustomPolicyChannels = {
    channel_ids: string[];
}

export type DataRetentionCustomPolicies = {
    [x: string]: DataRetentionCustomPolicy;
};

export type GetDataRetentionCustomPoliciesRequest = {
    policies: DataRetentionCustomPolicy[];
    total_count: number;
};
