// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelWithTeamData} from './channels';
import type {UserProfile} from './users';
export type AccessControlPolicy = {
    id: string;
    name: string;
    type: string;
    revision?: number;
    created_at?: number;
    version?: string;
    active?: boolean;
    imports?: string[];
    props?: Record<string, unknown[]>;
    rules: AccessControlPolicyRule[];
}

export type AccessControlPolicyCursor = {
    id: string;
}

export type AccessControlPoliciesResult = {
    policies: AccessControlPolicy[];
    total: number;
}

export type AccessControlPolicySearchOpts = {
    term: string;
    type: string;
    cursor: AccessControlPolicyCursor;
    limit: number;
}

export type AccessControlPolicyChannelsResult = {
    channels: ChannelWithTeamData[];
    total: number;
}

export type AccessControlPolicyRule = {
    actions?: string[];
    expression: string;
}

export type CELExpressionError = {
    message: string;
    line: number;
    column: number;
}

export type AccessControlTestResult = {
    users: UserProfile[];
    attributes: string[];
}

export type AccessControlEntity = {
    name: string;
    attributes: AccessControlAttribute[];
}

export type AccessControlAttribute = {
    name: string;
    values: string[];
}
