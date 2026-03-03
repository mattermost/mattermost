// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';
import * as path from 'path';

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
async function verifyPluginConfigurationOnce(adminClient: Client4): Promise<boolean> {
    const config = await adminClient.getConfig();
    // Plugin config has a nested 'config' key
    const pluginEntry = config.PluginSettings?.Plugins?.[AI_PLUGIN_ID] as Record<string, unknown> | undefined;
    const pluginConfig = pluginEntry?.config as Record<string, unknown> | undefined;

    if (!pluginConfig) {
        return false;
    }

    const services = (pluginConfig.services as Array<{apiKey?: string; id: string}>) || [];
    const bots = (pluginConfig.bots as Array<{serviceID: string}>) || [];

    if (services.length === 0 || bots.length === 0) {
        return false;
    }

    // Check if service has API key configured
    const hasConfiguredService = services.some((s) => s.apiKey && s.apiKey.length > 0);
    if (!hasConfiguredService) {
        return false;
    }

    // Check if bot is linked to a service
    const bot = bots[0];
    const linkedService = services.find((s) => s.id === bot.serviceID);

    return !!linkedService;
}

/**
 * Waits for AI plugin configuration to be valid across cluster nodes.
 * In HA mode, config updates may take time to propagate to all nodes.
 * @param adminClient - Admin client to check configuration
 * @param maxAttempts - Maximum number of attempts (default: 10)
 * @param delayMs - Delay between attempts in milliseconds (default: 1000)
 * @returns Promise<boolean> - true if configuration is valid
 */
async function verifyPluginConfiguration(
    adminClient: Client4,
    maxAttempts: number = 10,
    delayMs: number = 1000,
): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (await verifyPluginConfigurationOnce(adminClient)) {
            return true;
        }

        if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    return false;
}

/**
 * Installs the AI plugin from a local file path.
 * This should be called during test setup to ensure the plugin is available.
 *
 * Environment variables:
 * - PW_AI_PLUGIN_PATH: Path to the AI plugin .tar.gz file
 *
 * @param adminClient - Admin client to install the plugin
 * @returns Promise<boolean> - true if plugin was installed or already exists
 */
export async function installAIPlugin(adminClient: Client4): Promise<boolean> {
    const pluginPath = testConfig.aiPluginPath;

    if (!pluginPath) {
        // No plugin path configured, skip installation
        return false;
    }

    // Check if plugin is already installed
    const statuses: PluginStatus[] = await adminClient.getPluginStatuses();
    const existingPlugin = statuses.find((s: PluginStatus) => s.plugin_id === AI_PLUGIN_ID);

    if (existingPlugin) {
        // eslint-disable-next-line no-console
        console.log(`AI plugin already installed (state: ${existingPlugin.state})`);
        return true;
    }

    // Resolve the plugin path (handle relative paths)
    const resolvedPath = path.isAbsolute(pluginPath) ? pluginPath : path.resolve(process.cwd(), pluginPath);

    if (!fs.existsSync(resolvedPath)) {
        // eslint-disable-next-line no-console
        console.error(`AI plugin file not found at: ${resolvedPath}`);
        return false;
    }

    // eslint-disable-next-line no-console
    console.log(`Installing AI plugin from: ${resolvedPath}`);

    // Read the plugin file and upload it
    const fileBuffer = fs.readFileSync(resolvedPath);
    const fileName = path.basename(resolvedPath);

    // Create FormData for the upload
    const formData = new FormData();
    formData.append('plugin', new Blob([fileBuffer]), fileName);
    formData.append('force', 'true');

    // Upload the plugin using fetch API
    const url = `${testConfig.baseURL}/api/v4/plugins`;
    const token = adminClient.getToken();

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        // eslint-disable-next-line no-console
        console.error(`Failed to install AI plugin: ${response.status} ${errorText}`);
        return false;
    }

    // eslint-disable-next-line no-console
    console.log('AI plugin installed successfully');

    // Enable the plugin
    await adminClient.enablePlugin(AI_PLUGIN_ID);

    // Wait for plugin to be running
    const isRunning = await waitForPluginReady(adminClient);
    if (!isRunning) {
        // eslint-disable-next-line no-console
        console.error('AI plugin failed to start after installation');
        return false;
    }

    // eslint-disable-next-line no-console
    console.log('AI plugin is now running');
    return true;
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

    // Check if AI plugin is installed before attempting to configure
    const statuses: PluginStatus[] = await adminClient.getPluginStatuses();
    const aiPluginStatus = statuses.find((s: PluginStatus) => s.plugin_id === AI_PLUGIN_ID);
    if (!aiPluginStatus) {
        // Plugin is not installed - nothing to configure
        return;
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
                                defaultModel: 'gpt-4o',
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
    await adminClient.updateConfig(aiPluginConfig as any);

    // Verify configuration was saved correctly (with retries for HA cluster sync)
    const configValid = await verifyPluginConfiguration(adminClient);
    if (!configValid) {
        // Get current config state for debugging
        const latestConfig = await adminClient.getConfig();
        const pluginEntry = latestConfig.PluginSettings?.Plugins?.[AI_PLUGIN_ID] as Record<string, unknown> | undefined;
        const pluginConfig = pluginEntry?.config as Record<string, unknown> | undefined;
        const services = (pluginConfig?.services as Array<{apiKey?: string}>) || [];
        const bots = (pluginConfig?.bots as Array<unknown>) || [];
        const debugInfo = {
            hasPluginConfig: !!pluginConfig,
            servicesCount: services.length,
            botsCount: bots.length,
            hasApiKey: services.some((s) => (s.apiKey?.length ?? 0) > 0),
        };
        throw new Error(
            `AI plugin configuration verification failed after 10 retries (HA sync timeout). Debug: ${JSON.stringify(debugInfo)}`,
        );
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
