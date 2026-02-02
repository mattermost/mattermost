// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import OpenAI from 'openai';

import type {
    GenerateOptions,
    ImageInput,
    LLMProvider,
    LLMResponse,
    OllamaConfig,
    ProviderCapabilities,
    ProviderUsageStats,
} from './provider_interface';
import {LLMProviderError, UnsupportedCapabilityError} from './provider_interface';

/**
 * Ollama Provider - Free, local LLM execution
 *
 * Features:
 * - Zero cost (runs locally)
 * - Full privacy (no data leaves your machine)
 * - OpenAI-compatible API
 * - Supports DeepSeek-R1, Llama 4, and other open models
 *
 * Limitations:
 * - No vision support (most models)
 * - Slower inference than cloud APIs (~2-5 sec vs <1 sec)
 * - Requires local installation and model downloads
 *
 * Recommended models:
 * - deepseek-r1:7b - Fast, good quality, low memory (4GB)
 * - deepseek-r1:14b - Better quality, medium memory (8GB)
 * - llama4:13b - High quality, medium memory (8GB)
 * - deepseek-r1:7b-q4 - Quantized for speed, lower quality
 *
 * Setup:
 * 1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh
 * 2. Pull model: ollama pull deepseek-r1:7b
 * 3. Start: ollama serve (runs on localhost:11434)
 */
export class OllamaProvider implements LLMProvider {
    name = 'ollama';
    private client: OpenAI;
    private model: string;
    private stats: ProviderUsageStats;

    capabilities: ProviderCapabilities = {
        vision: false, // Most Ollama models don't support vision
        streaming: true,
        maxTokens: 8000, // Varies by model
        costPer1MInputTokens: 0, // Free!
        costPer1MOutputTokens: 0, // Free!
        supportsTools: true, // DeepSeek, Llama 4 support function calling
        supportsPromptCaching: false,
        typicalResponseTimeMs: 3000, // ~2-5 seconds on decent hardware
    };

    constructor(config: OllamaConfig) {
        // Ollama uses OpenAI-compatible API
        this.client = new OpenAI({
            baseURL: config.baseUrl || 'http://localhost:11434/v1',
            apiKey: 'ollama', // Ollama doesn't require real API key
            timeout: config.timeout || 60000, // 60 second default timeout
        });

        this.model = config.model || 'deepseek-r1:7b';

        // Initialize stats
        this.stats = {
            requestCount: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            averageResponseTimeMs: 0,
            failedRequests: 0,
            startTime: new Date(),
            lastUpdated: new Date(),
        };
    }

    async generateText(prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
        const startTime = Date.now();

        try {
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

            // Add system message if provided
            if (options?.systemPrompt) {
                messages.push({
                    role: 'system',
                    content: options.systemPrompt,
                });
            }

            // Add user prompt
            messages.push({
                role: 'user',
                content: prompt,
            });

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages,
                max_tokens: options?.maxTokens,
                temperature: options?.temperature,
                top_p: options?.topP,
                stop: options?.stopSequences,
            });

            const responseTime = Date.now() - startTime;
            const text = response.choices[0]?.message?.content || '';
            const usage = {
                inputTokens: response.usage?.prompt_tokens || 0,
                outputTokens: response.usage?.completion_tokens || 0,
                totalTokens: response.usage?.total_tokens || 0,
            };

            // Update stats
            this.updateStats(usage, responseTime, 0); // Cost is always 0 for Ollama

            return {
                text,
                usage,
                cost: 0, // Free!
                metadata: {
                    model: this.model,
                    responseTimeMs: responseTime,
                    finishReason: response.choices[0]?.finish_reason,
                },
            };
        } catch (error) {
            this.stats.failedRequests++;
            throw new LLMProviderError(
                `Ollama generation failed: ${error instanceof Error ? error.message : String(error)}`,
                this.name,
                undefined,
                error,
            );
        }
    }

    /**
     * Ollama does not support vision by default
     * This method throws an error to help users understand the limitation
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async analyzeImage(images: ImageInput[], prompt: string, options?: GenerateOptions): Promise<LLMResponse> {
        throw new UnsupportedCapabilityError(this.name, 'vision');
    }

    /**
     * Stream text generation for real-time feedback
     */
    async *streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string, void, unknown> {
        try {
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

            if (options?.systemPrompt) {
                messages.push({
                    role: 'system',
                    content: options.systemPrompt,
                });
            }

            messages.push({
                role: 'user',
                content: prompt,
            });

            const stream = await this.client.chat.completions.create({
                model: this.model,
                messages,
                max_tokens: options?.maxTokens,
                temperature: options?.temperature,
                top_p: options?.topP,
                stop: options?.stopSequences,
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    yield content;
                }
            }

            // Note: Streaming doesn't provide detailed usage stats
            // We increment request count but can't track exact tokens
            this.stats.requestCount++;
            this.stats.lastUpdated = new Date();
        } catch (error) {
            this.stats.failedRequests++;
            throw new LLMProviderError(
                `Ollama streaming failed: ${error instanceof Error ? error.message : String(error)}`,
                this.name,
                undefined,
                error,
            );
        }
    }

    getUsageStats(): ProviderUsageStats {
        return {...this.stats};
    }

    resetUsageStats(): void {
        this.stats = {
            requestCount: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            averageResponseTimeMs: 0,
            failedRequests: 0,
            startTime: new Date(),
            lastUpdated: new Date(),
        };
    }

    private updateStats(
        usage: {inputTokens: number; outputTokens: number; totalTokens: number},
        responseTime: number,
        cost: number,
    ): void {
        this.stats.requestCount++;
        this.stats.totalInputTokens += usage.inputTokens;
        this.stats.totalOutputTokens += usage.outputTokens;
        this.stats.totalTokens += usage.totalTokens;
        this.stats.totalCost += cost;

        // Update rolling average response time
        const totalRequests = this.stats.requestCount;
        this.stats.averageResponseTimeMs =
            (this.stats.averageResponseTimeMs * (totalRequests - 1) + responseTime) / totalRequests;

        this.stats.lastUpdated = new Date();
    }

    /**
     * Check if Ollama is running and accessible
     */
    async checkHealth(): Promise<{healthy: boolean; message: string}> {
        try {
            // Try a simple request
            await this.client.models.list();
            return {
                healthy: true,
                message: `Ollama is running with model: ${this.model}`,
            };
        } catch (error) {
            return {
                healthy: false,
                message:
                    `Ollama not accessible: ${error instanceof Error ? error.message : String(error)}. ` +
                    'Make sure Ollama is installed and running (ollama serve)',
            };
        }
    }

    /**
     * List available models in Ollama
     */
    async listModels(): Promise<string[]> {
        try {
            const response = await this.client.models.list();
            return response.data.map((model) => model.id);
        } catch (error) {
            throw new LLMProviderError(
                `Failed to list Ollama models: ${error instanceof Error ? error.message : String(error)}`,
                this.name,
                undefined,
                error,
            );
        }
    }
}

/**
 * Helper function to check if Ollama is installed and suggest setup
 */
export async function checkOllamaSetup(): Promise<{
    installed: boolean;
    running: boolean;
    modelAvailable: boolean;
    setupInstructions: string;
}> {
    const provider = new OllamaProvider({});

    try {
        const health = await provider.checkHealth();
        const models = await provider.listModels();

        return {
            installed: true,
            running: health.healthy,
            modelAvailable: models.length > 0,
            setupInstructions: health.healthy ? 'Ollama is ready to use!' : 'Run: ollama serve',
        };
    } catch {
        return {
            installed: false,
            running: false,
            modelAvailable: false,
            setupInstructions: `
Ollama is not installed. To set up:

1. Install Ollama:
   curl -fsSL https://ollama.com/install.sh | sh

2. Pull a model (choose one):
   ollama pull deepseek-r1:7b          # Recommended: Fast, 4GB RAM
   ollama pull deepseek-r1:14b         # Better quality, 8GB RAM
   ollama pull llama4:13b              # Alternative, 8GB RAM

3. Start Ollama:
   ollama serve

For more info: https://ollama.com
            `.trim(),
        };
    }
}
