// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AnthropicProvider} from './anthropic_provider';
import {OllamaProvider} from './ollama_provider';
import type {
    AnthropicConfig,
    GenerateOptions,
    ImageInput,
    LLMProvider,
    LLMResponse,
    OllamaConfig,
    ProviderConfig,
    ProviderUsageStats,
} from './provider_interface';
import {UnsupportedCapabilityError} from './provider_interface';

/**
 * LLM Provider Factory
 *
 * Creates and configures LLM providers based on configuration.
 * Supports multiple strategies:
 * - Single provider (Ollama, Anthropic, etc.)
 * - Hybrid provider (free primary + premium fallback)
 * - Auto-selection based on environment
 *
 * Usage:
 *
 * // Create single provider
 * const provider = LLMProviderFactory.create({
 *   type: 'ollama',
 *   config: { model: 'deepseek-r1:7b' }
 * });
 *
 * // Create hybrid provider
 * const provider = LLMProviderFactory.createHybrid({
 *   primary: { type: 'ollama', config: { model: 'deepseek-r1:7b' } },
 *   fallback: { type: 'anthropic', config: { apiKey: '...' } },
 *   useFallbackFor: ['vision']
 * });
 *
 * // Auto-detect from environment
 * const provider = LLMProviderFactory.createFromEnv();
 */
export class LLMProviderFactory {
    /**
     * Create a single LLM provider
     */
    static create(config: ProviderConfig): LLMProvider {
        switch (config.type) {
            case 'ollama':
                return new OllamaProvider(config.config as OllamaConfig);

            case 'anthropic':
                return new AnthropicProvider(config.config as AnthropicConfig);

            case 'openai':
                throw new Error('OpenAI provider not yet implemented');

            case 'custom':
                throw new Error('Custom provider not yet implemented');

            default:
                throw new Error(`Unknown provider type: ${(config as any).type}`);
        }
    }

    /**
     * Create a hybrid provider (free primary + premium fallback)
     *
     * Use cases:
     * - Most operations use free Ollama
     * - Vision tasks fall back to Claude
     * - Complex diagnosis falls back to Claude
     *
     * This gives best cost/quality balance:
     * - ~$20/month instead of $80/month (75% cost reduction)
     * - Still get premium quality for vision and complex tasks
     */
    static createHybrid(config: HybridConfig): LLMProvider {
        const primary = this.create(config.primary);
        const fallback = this.create(config.fallback);

        return new HybridProvider({
            primary,
            fallback,
            useFallbackFor: config.useFallbackFor || ['vision'],
        });
    }

    /**
     * Auto-detect provider from environment variables
     *
     * Priority:
     * 1. LLM_PROVIDER env var (ollama, anthropic, openai)
     * 2. ANTHROPIC_API_KEY exists → Anthropic
     * 3. Ollama running locally → Ollama
     * 4. Error (no provider available)
     */
    static async createFromEnv(): Promise<LLMProvider> {
        const providerType = process.env.LLM_PROVIDER?.toLowerCase();

        if (providerType === 'ollama') {
            return new OllamaProvider({
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
                model: process.env.OLLAMA_MODEL || 'deepseek-r1:7b',
            });
        }

        if (providerType === 'anthropic' || process.env.ANTHROPIC_API_KEY) {
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('ANTHROPIC_API_KEY environment variable is required for Anthropic provider');
            }

            return new AnthropicProvider({
                apiKey: process.env.ANTHROPIC_API_KEY,
                model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
            });
        }

        // Try Ollama as default
        const ollama = new OllamaProvider({});
        const health = await ollama.checkHealth();

        if (health.healthy) {
            // eslint-disable-next-line no-console
            console.log('Auto-detected Ollama provider (free, local)');
            return ollama;
        }

        throw new Error(
            'No LLM provider available. Please either:\n' +
                '1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh\n' +
                '2. Set ANTHROPIC_API_KEY environment variable\n' +
                '3. Set LLM_PROVIDER environment variable',
        );
    }

    /**
     * Create provider from simple string format
     *
     * Examples:
     * - "ollama" → Ollama with defaults
     * - "ollama:deepseek-r1:14b" → Ollama with specific model
     * - "anthropic" → Anthropic with env API key
     * - "anthropic:claude-opus-4-5" → Anthropic with specific model
     */
    static createFromString(providerString: string): LLMProvider {
        const [type, model] = providerString.split(':');

        switch (type.toLowerCase()) {
            case 'ollama':
                return new OllamaProvider({
                    model: model || 'deepseek-r1:7b',
                });

            case 'anthropic':
                if (!process.env.ANTHROPIC_API_KEY) {
                    throw new Error('ANTHROPIC_API_KEY environment variable is required');
                }
                return new AnthropicProvider({
                    apiKey: process.env.ANTHROPIC_API_KEY,
                    model: model || 'claude-sonnet-4-5-20250929',
                });

            default:
                throw new Error(`Unknown provider type: ${type}`);
        }
    }
}

/**
 * Hybrid Provider Configuration
 */
export interface HybridConfig {
    /**
     * Primary provider (used for most operations)
     * Typically a free provider like Ollama
     */
    primary: ProviderConfig;

    /**
     * Fallback provider (used for specific capabilities)
     * Typically a premium provider like Anthropic
     */
    fallback: ProviderConfig;

    /**
     * When to use fallback provider
     * Options: 'vision', 'complex-diagnosis', 'high-confidence-needed'
     */
    useFallbackFor?: Array<'vision' | 'complex-diagnosis' | 'high-confidence-needed'>;
}

/**
 * Hybrid Provider - Mix free and premium providers
 *
 * Strategy:
 * - Use free provider (Ollama) for most operations (~80% of requests)
 * - Fall back to premium (Claude) only when needed (~20% of requests)
 *
 * Cost savings example:
 * - Pure Claude: $80/month
 * - Pure Ollama: $0/month but no vision
 * - Hybrid: $20/month (75% cost reduction, keeps vision)
 */
class HybridProvider implements LLMProvider {
    name = 'hybrid';
    private primary: LLMProvider;
    private fallback: LLMProvider;
    private useFallbackFor: Set<string>;

    capabilities = {
        // Report combined capabilities
        vision: true, // Fallback provides vision
        streaming: true, // Both support streaming
        maxTokens: 0, // Will be set in constructor
        costPer1MInputTokens: 0, // Variable cost
        costPer1MOutputTokens: 0, // Variable cost
        supportsTools: true,
        supportsPromptCaching: false,
        typicalResponseTimeMs: 0, // Variable
    };

    constructor(config: {primary: LLMProvider; fallback: LLMProvider; useFallbackFor: string[]}) {
        this.primary = config.primary;
        this.fallback = config.fallback;
        this.useFallbackFor = new Set(config.useFallbackFor);

        // Set combined capabilities
        this.capabilities.maxTokens = Math.max(
            this.primary.capabilities.maxTokens,
            this.fallback.capabilities.maxTokens,
        );
        this.capabilities.typicalResponseTimeMs = this.primary.capabilities.typicalResponseTimeMs;
    }

    async generateText(prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
        // Use primary for text generation (free)
        // eslint-disable-next-line no-console
        console.log(`[Hybrid] Using ${this.primary.name} for text generation`);
        return await this.primary.generateText(prompt, options);
    }

    async analyzeImage(images: ImageInput[], prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
        // Check if vision is a fallback trigger
        if (this.useFallbackFor.has('vision')) {
            // Use fallback if primary doesn't support vision
            if (!this.primary.capabilities.vision) {
                // eslint-disable-next-line no-console
                console.log(
                    `[Hybrid] Using ${this.fallback.name} for vision analysis (primary doesn't support vision)`,
                );
                if (!this.fallback.analyzeImage) {
                    throw new UnsupportedCapabilityError(this.name, 'vision');
                }
                return await this.fallback.analyzeImage(images, prompt, options);
            }
        }

        // Try primary first
        if (this.primary.analyzeImage) {
            // eslint-disable-next-line no-console
            console.log(`[Hybrid] Using ${this.primary.name} for vision analysis`);
            return await this.primary.analyzeImage(images, prompt, options);
        }

        throw new UnsupportedCapabilityError(this.name, 'vision');
    }

    async *streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string, void, unknown> {
        // Use primary for streaming (free)
        if (!this.primary.streamText) {
            throw new UnsupportedCapabilityError(this.primary.name, 'streaming');
        }

        // eslint-disable-next-line no-console
        console.log(`[Hybrid] Using ${this.primary.name} for streaming`);
        yield* this.primary.streamText(prompt, options);
    }

    getUsageStats(): ProviderUsageStats {
        const primaryStats = this.primary.getUsageStats();
        const fallbackStats = this.fallback.getUsageStats();

        // Combine stats
        return {
            requestCount: primaryStats.requestCount + fallbackStats.requestCount,
            totalInputTokens: primaryStats.totalInputTokens + fallbackStats.totalInputTokens,
            totalOutputTokens: primaryStats.totalOutputTokens + fallbackStats.totalOutputTokens,
            totalTokens: primaryStats.totalTokens + fallbackStats.totalTokens,
            totalCost: primaryStats.totalCost + fallbackStats.totalCost,
            averageResponseTimeMs:
                (primaryStats.averageResponseTimeMs * primaryStats.requestCount +
                    fallbackStats.averageResponseTimeMs * fallbackStats.requestCount) /
                (primaryStats.requestCount + fallbackStats.requestCount),
            failedRequests: primaryStats.failedRequests + fallbackStats.failedRequests,
            startTime: new Date(Math.min(primaryStats.startTime.getTime(), fallbackStats.startTime.getTime())),
            lastUpdated: new Date(Math.max(primaryStats.lastUpdated.getTime(), fallbackStats.lastUpdated.getTime())),
        };
    }

    resetUsageStats(): void {
        this.primary.resetUsageStats();
        this.fallback.resetUsageStats();
    }

    /**
     * Get breakdown of which provider was used for what
     */
    getProviderBreakdown(): {
        primary: {name: string; stats: ProviderUsageStats};
        fallback: {name: string; stats: ProviderUsageStats};
        costSavings: string;
    } {
        const primaryStats = this.primary.getUsageStats();
        const fallbackStats = this.fallback.getUsageStats();

        // Calculate what it would cost if we used only fallback
        const totalRequests = primaryStats.requestCount + fallbackStats.requestCount;
        const fallbackCostPerRequest =
            fallbackStats.requestCount > 0 ? fallbackStats.totalCost / fallbackStats.requestCount : 0;
        const hypotheticalFullCost = totalRequests * fallbackCostPerRequest;
        const actualCost = primaryStats.totalCost + fallbackStats.totalCost;
        const savings = hypotheticalFullCost - actualCost;

        return {
            primary: {
                name: this.primary.name,
                stats: primaryStats,
            },
            fallback: {
                name: this.fallback.name,
                stats: fallbackStats,
            },
            costSavings: `$${savings.toFixed(2)} saved (${((savings / hypotheticalFullCost) * 100).toFixed(1)}% reduction)`,
        };
    }
}

/**
 * Helper to validate provider setup
 */
export async function validateProviderSetup(provider: LLMProvider): Promise<{
    valid: boolean;
    message: string;
    capabilities: string[];
}> {
    const capabilities: string[] = [];

    if (provider.capabilities.vision) {
        capabilities.push('✓ Vision support (screenshot comparison)');
    } else {
        capabilities.push('✗ No vision support');
    }

    if (provider.capabilities.streaming) {
        capabilities.push('✓ Streaming responses');
    }

    if (provider.capabilities.supportsTools) {
        capabilities.push('✓ Function calling');
    }

    capabilities.push(`✓ ${provider.capabilities.maxTokens.toLocaleString()} token context window`);
    capabilities.push(`✓ Cost: $${provider.capabilities.costPer1MOutputTokens}/1M tokens`);

    try {
        // Try a simple request
        const response = await provider.generateText('Say "OK" if you can read this', {
            maxTokens: 10,
        });

        return {
            valid: response.text.length > 0,
            message: `Provider '${provider.name}' is working correctly`,
            capabilities,
        };
    } catch (error) {
        return {
            valid: false,
            message: `Provider '${provider.name}' validation failed: ${error instanceof Error ? error.message : String(error)}`,
            capabilities,
        };
    }
}
