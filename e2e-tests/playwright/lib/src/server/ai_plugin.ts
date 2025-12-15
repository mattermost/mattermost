// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

import {testConfig} from '@/test_config';

const AI_PLUGIN_ID = 'mattermost-ai';

interface PluginStatus {
    plugin_id: string;
    state: number;
    error?: string;
}

/**
 * Verifies the AI plugin is running by checking plugin statuses.
 * @param adminClient - Admin client to check plugin status
 * @returns Promise<boolean> - true if plugin is running
 */
async function verifyPluginRunning(adminClient: Client4): Promise<boolean> {
    const statuses: PluginStatus[] = await adminClient.getPluginStatuses();
    const aiPluginStatus = statuses.find((s: PluginStatus) => s.plugin_id === AI_PLUGIN_ID);

    if (!aiPluginStatus) {
        return false;
    }

    // Plugin states from server/public/model/plugin_status.go:
    // 0 = NotRunning, 1 = Starting (unused), 2 = Running, 3 = FailedToStart, 4 = FailedToStayRunning
    return aiPluginStatus.state === 2;
}

/**
 * Waits for the AI plugin to reach running state.
 * @param adminClient - Admin client to check plugin status
 * @param maxAttempts - Maximum number of attempts (default: 15)
 * @param delayMs - Delay between attempts in milliseconds (default: 2000)
 * @returns Promise<boolean> - true if plugin reached running state
 */
async function waitForPluginReady(
    adminClient: Client4,
    maxAttempts: number = 15,
    delayMs: number = 2000,
): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (await verifyPluginRunning(adminClient)) {
            return true;
        }

        if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    return false;
}

/**
 * Verifies the AI plugin configuration is valid.
 * @param adminClient - Admin client to check configuration
 * @returns Promise<boolean> - true if configuration is valid
 */
async function verifyPluginConfiguration(adminClient: Client4): Promise<boolean> {
    const config = await adminClient.getConfig();
    const pluginConfig = config.PluginSettings?.Plugins?.[AI_PLUGIN_ID]?.config;

    if (!pluginConfig) {
        return false;
    }

    const services = pluginConfig.services || [];
    const bots = pluginConfig.bots || [];

    if (services.length === 0 || bots.length === 0) {
        return false;
    }

    // Check if service has API key configured
    const hasConfiguredService = services.some((s: {apiKey?: string}) => s.apiKey && s.apiKey.length > 0);
    if (!hasConfiguredService) {
        return false;
    }

    // Check if bot is linked to a service
    const bot = bots[0];
    const linkedService = services.find((s: {id: string}) => s.id === bot.serviceID);

    return !!linkedService;
}

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
 * @throws Error if plugin fails to configure or start
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
                [AI_PLUGIN_ID]: {
                    Enable: true,
                },
            },
            Plugins: {
                ...currentConfig.PluginSettings?.Plugins,
                [AI_PLUGIN_ID]: {
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

    // Save configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await adminClient.updateConfig(aiPluginConfig as any);

    // Verify configuration was saved correctly
    const configValid = await verifyPluginConfiguration(adminClient);
    if (!configValid) {
        throw new Error('AI plugin configuration verification failed - configuration not saved correctly');
    }

    // Disable then enable plugin to ensure it restarts with new config
    try {
        await adminClient.disablePlugin(AI_PLUGIN_ID);
        await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch {
        // Plugin might not be running, ignore
    }

    await adminClient.enablePlugin(AI_PLUGIN_ID);

    // Wait for plugin to be running
    const isRunning = await waitForPluginReady(adminClient);
    if (!isRunning) {
        // Get plugin status for error details
        const statuses: PluginStatus[] = await adminClient.getPluginStatuses();
        const aiStatus = statuses.find((s) => s.plugin_id === AI_PLUGIN_ID);
        const errorMsg = aiStatus?.error || 'Unknown error';
        throw new Error(`AI plugin failed to start. Status: ${aiStatus?.state}, Error: ${errorMsg}`);
    }
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
