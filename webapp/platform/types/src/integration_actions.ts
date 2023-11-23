// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type PostAction = {
    id?: string;
    type?: string;
    name?: string;
    disabled?: boolean;
    style?: string;
    data_source?: string;
    options?: PostActionOption[];
    default_option?: string;
    integration?: PostActionIntegration;
    cookie?: string;
};

export type PostActionOption = {
    text: string;
    value: string;
};

export type PostActionIntegration = {
    url?: string;
    context?: Record<string, any>;
}

export type PostActionResponse = {
    status: string;
    trigger_id: string;
};
