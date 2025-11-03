// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type AIAgent = {
    id: string;
    displayName: string;
    username: string;
    service_id: string;
    service_type: string;
};

export type AgentsResponse = {
    agents: AIAgent[];
};

export type AIService = {
    id: string;
    name: string;
    type: string;
};

export type ServicesResponse = {
    services: AIService[];
};

