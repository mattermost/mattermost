// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

import {testConfig} from '@/test_config';

/**
 * Configures the AI plugin (mattermost-ai) with the provided API keys from environment variables.
 * This should only be called in tests that specifically need AI functionality.
 *
 * Environment variables required:
 * - PW_AI_PLUGIN_ENABLED: Set to 'true' to enable AI plugin configuration
 * - PW_AI_PLUGIN_OPENAI_KEY: OpenAI API key (format: sk-...)
 * - PW_AI_PLUGIN_ANTHROPIC_KEY: (Optional) Anthropic API key (format: sk-ant-...)
 *
 * @param adminClient - Admin client to update plugin configuration
 * @returns Promise<void>
 */
export async function configureAIPlugin(adminClient: Client4): Promise<void> {
    if (!testConfig.aiPluginEnabled) {
        return;
    }

    if (!testConfig.aiPluginApiKey) {
        throw new Error('OpenAI API key is not configured. Set PW_AI_PLUGIN_OPENAI_KEY environment variable.');
    }

    // Get current config
    const currentConfig = await adminClient.getConfig();

    // Read anthropic key from env if available
    const anthropicKey = process.env.PW_AI_PLUGIN_ANTHROPIC_KEY || '';

    // Configure AI plugin based on actual server config structure
    const aiPluginConfig = {
        ...currentConfig,
        PluginSettings: {
            ...currentConfig.PluginSettings,
            PluginStates: {
                ...currentConfig.PluginSettings?.PluginStates,
                'mattermost-ai': {
                    Enable: true,
                },
            },
            Plugins: {
                ...currentConfig.PluginSettings?.Plugins,
                'mattermost-ai': {
                    config: {
                        allowUnsafeLinks: false,
                        allowedUpstreamHostnames: '',
                        bots: [
                            {
                                channelAccessLevel: 0,
                                channelIDs: [],
                                customInstructions: '',
                                disableTools: false,
                                displayName: 'Writing Assistant',
                                enableVision: true,
                                enabledNativeTools: [],
                                id: '8cda55f8-1caf-4dab-981c-e70201408754',
                                name: 'writing_assistant',
                                reasoningEffort: 'medium',
                                reasoningEnabled: true,
                                serviceID: '618606d0-65e0-4855-af4f-55e2dff5c99c',
                                teamIDs: [],
                                thinkingBudget: 0,
                                userAccessLevel: 0,
                                userIDs: [],
                            },
                        ],
                        defaultBotName: 'writing_assistant',
                        embeddingSearchConfig: {
                            chunkingOptions: {
                                chunkOverlap: 0,
                                chunkSize: 0,
                                chunkingStrategy: '',
                                minChunkSize: 0,
                            },
                            dimensions: 0,
                            embeddingProvider: {
                                parameters: null,
                                type: '',
                            },
                            parameters: null,
                            type: '',
                            vectorStore: {
                                parameters: null,
                                type: '',
                            },
                        },
                        enableLLMTrace: false,
                        enableTokenUsageLogging: false,
                        mcp: {
                            embeddedServer: {
                                enabled: false,
                            },
                            enablePluginServer: false,
                            enabled: false,
                            idleTimeoutMinutes: 0,
                            servers: null,
                        },
                        services: [
                            {
                                apiKey: testConfig.aiPluginApiKey,
                                apiURL: '',
                                defaultModel: 'gpt-4',
                                id: '618606d0-65e0-4855-af4f-55e2dff5c99c',
                                name: 'OpenAI Service',
                                orgId: '',
                                outputTokenLimit: 0,
                                sendUserID: false,
                                streamingTimeoutSeconds: 0,
                                tokenLimit: 100,
                                type: 'openai',
                                useResponsesAPI: false,
                            },
                            ...(anthropicKey
                                ? [
                                      {
                                          apiKey: anthropicKey,
                                          apiURL: '',
                                          defaultModel: 'claude-sonnet-4-5',
                                          id: '4c06d0f4-3a92-4cd6-ba56-bd23484da537',
                                          name: 'Anthropic Service',
                                          orgId: '',
                                          outputTokenLimit: 0,
                                          sendUserId: false,
                                          streamingTimeoutSeconds: 0,
                                          tokenLimit: 0,
                                          type: 'anthropic',
                                          useResponsesAPI: false,
                                      },
                                  ]
                                : []),
                        ],
                        transcriptBackend: '',
                    },
                },
            },
        },
    };

    await adminClient.updateConfig(aiPluginConfig as any);
}

/**
 * Checks if AI plugin tests can run based on environment configuration.
 * Use this in test.skip() conditions.
 *
 * @returns boolean - true if AI plugin tests should be skipped
 */
export function shouldSkipAITests(): boolean {
    return !testConfig.aiPluginEnabled || !testConfig.aiPluginApiKey;
}
