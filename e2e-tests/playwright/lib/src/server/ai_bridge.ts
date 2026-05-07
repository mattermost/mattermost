// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';
import type {AdminConfig} from '@mattermost/types/config';

import {getRandomId} from '@/util';

type AIBridgeOperation = 'recap_summary' | 'rewrite';

export type AIBridgeMockStatus = {
    available: boolean;
    reason?: string;
};

export type AIBridgeMockAgent = {
    id: string;
    displayName: string;
    username: string;
    service_id: string;
    service_type: string;
    is_default?: boolean;
};

export type AIBridgeMockService = {
    id: string;
    name: string;
    type: string;
};

export type AIBridgeMockCompletion = {
    completion?: string;
    error?: string;
    status_code?: number;
};

export type AIBridgeMockMessage = {
    role: string;
    message: string;
    file_ids?: string[];
};

export type AIBridgeMockRecordedRequest = {
    operation: AIBridgeOperation | string;
    client_operation?: string;
    operation_sub_type?: string;
    session_user_id?: string;
    user_id?: string;
    channel_id?: string;
    agent_id?: string;
    service_id?: string;
    messages: AIBridgeMockMessage[];
    json_output_format?: Record<string, unknown>;
};

export type AIBridgeMockConfig = {
    status?: AIBridgeMockStatus;
    agents?: AIBridgeMockAgent[];
    services?: AIBridgeMockService[];
    agent_completions?: Partial<Record<AIBridgeOperation | string, AIBridgeMockCompletion[]>>;
    feature_flags?: {
        enable_ai_plugin_bridge?: boolean;
        enable_ai_recaps?: boolean;
    };
    record_requests?: boolean;
};

export type AIBridgeMockState = AIBridgeMockConfig & {
    record_requests: boolean;
    recorded_requests: AIBridgeMockRecordedRequest[];
};

type EnableAIBridgeTestModeOptions = {
    enableRecaps?: boolean;
};

type CreateMockAIAgentOverrides = {
    agent?: Partial<AIBridgeMockAgent>;
    service?: Partial<AIBridgeMockService>;
    status?: AIBridgeMockStatus;
    record_requests?: boolean;
};

const AI_BRIDGE_TEST_HELPER_ROUTE = '/system/e2e/ai_bridge';

async function doAdminFetch<T>(adminClient: Client4, method: 'GET' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
    const route = `${adminClient.getBaseRoute()}${AI_BRIDGE_TEST_HELPER_ROUTE}`;

    return (adminClient as any).doFetch(route, {
        method,
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
}

function upsertById<T extends {id: string}>(items: T[], item: T): T[] {
    const existingIndex = items.findIndex((existingItem) => existingItem.id === item.id);

    if (existingIndex === -1) {
        return [...items, item];
    }

    const nextItems = [...items];
    nextItems[existingIndex] = item;
    return nextItems;
}

export async function enableAIBridgeTestMode(
    adminClient: Client4,
    {enableRecaps = false}: EnableAIBridgeTestModeOptions = {},
): Promise<AdminConfig> {
    await adminClient.patchConfig({
        ServiceSettings: {
            EnableTesting: true,
        },
    });

    await configureAIBridgeMock(adminClient, {
        feature_flags: {
            enable_ai_plugin_bridge: true,
            ...(enableRecaps ? {enable_ai_recaps: true} : {}),
        },
    });

    return adminClient.getConfig();
}

export async function configureAIBridgeMock(
    adminClient: Client4,
    config: AIBridgeMockConfig,
): Promise<AIBridgeMockState> {
    return doAdminFetch<AIBridgeMockState>(adminClient, 'PUT', config);
}

export async function getAIBridgeMock(adminClient: Client4): Promise<AIBridgeMockState> {
    return doAdminFetch<AIBridgeMockState>(adminClient, 'GET');
}

export async function resetAIBridgeMock(adminClient: Client4): Promise<void> {
    await doAdminFetch(adminClient, 'DELETE');
}

export async function createMockAIAgent(
    adminClient: Client4,
    overrides: CreateMockAIAgentOverrides = {},
): Promise<{agent: AIBridgeMockAgent; service: AIBridgeMockService; state: AIBridgeMockState}> {
    const state = await getAIBridgeMock(adminClient);
    const randomId = getRandomId();

    const service: AIBridgeMockService = {
        id: overrides.service?.id ?? overrides.agent?.service_id ?? `mock-service-${randomId}`,
        name: overrides.service?.name ?? 'Mock AI Service',
        type: overrides.service?.type ?? overrides.agent?.service_type ?? 'openaicompatible',
    };

    const agent: AIBridgeMockAgent = {
        id: overrides.agent?.id ?? `mock-agent-${randomId}`,
        displayName: overrides.agent?.displayName ?? 'Mock AI Agent',
        username: overrides.agent?.username ?? `mock.ai.${randomId}`,
        service_id: overrides.agent?.service_id ?? service.id,
        service_type: overrides.agent?.service_type ?? service.type,
        is_default: overrides.agent?.is_default ?? (state.agents ?? []).length === 0,
    };

    const nextState = await configureAIBridgeMock(adminClient, {
        status: overrides.status ?? state.status,
        agents: upsertById(state.agents ?? [], agent),
        services: upsertById(state.services ?? [], service),
        agent_completions: state.agent_completions,
        record_requests: overrides.record_requests ?? state.record_requests,
    });

    return {agent, service, state: nextState};
}

export function rewriteCompletion(text: string): AIBridgeMockCompletion {
    return {
        completion: JSON.stringify({rewritten_text: text}),
    };
}

export function recapCompletion({
    highlights,
    actionItems,
}: {
    highlights: string[];
    actionItems: string[];
}): AIBridgeMockCompletion {
    return {
        completion: JSON.stringify({
            highlights,
            action_items: actionItems,
        }),
    };
}
