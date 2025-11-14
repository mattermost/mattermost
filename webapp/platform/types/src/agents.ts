// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Agent = {
    id: string;
    displayName: string;
    username: string;
    service_id: string;
    service_type: string;
};

export type LLMService = {
    id: string;
    name: string;
    type: string;
};
