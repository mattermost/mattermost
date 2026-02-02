// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * LLM Provider Interface - Core abstraction for pluggable AI models
 *
 * Enables the autonomous testing system to work with any LLM:
 * - Ollama (free, local)
 * - Anthropic Claude (premium, vision support)
 * - OpenAI (premium)
 * - Custom providers (any OpenAI-compatible API)
 *
 * Design Philosophy:
 * - Provider-agnostic: Switch LLMs without changing test logic
 * - Capability-aware: System adapts based on provider features
 * - Cost-conscious: Track token usage and costs
 * - Hybrid-friendly: Mix free and premium providers
 */

/**
 * Core LLM provider interface - all providers must implement this
 */
export interface LLMProvider {
    /**
     * Unique identifier for this provider
     * Examples: 'anthropic', 'ollama', 'openai', 'custom'
     */
    name: string;

    /**
     * Generate text from a prompt
     * Primary method for most LLM operations
     */
    generateText(prompt: string, options?: GenerateOptions): Promise<LLMResponse>;

    /**
     * Analyze images with vision models (optional - not all providers support)
     * Used for spec screenshot comparison and visual bug detection
     */
    analyzeImage?(images: ImageInput[], prompt: string, options?: GenerateOptions): Promise<LLMResponse>;

    /**
     * Stream text generation (optional - for real-time UI feedback)
     * Yields text chunks as they're generated
     */
    streamText?(prompt: string, options?: GenerateOptions): AsyncGenerator<string, void, unknown>;

    /**
     * Provider capabilities - what this LLM can do
     */
    capabilities: ProviderCapabilities;

    /**
     * Get usage statistics for cost tracking and monitoring
     */
    getUsageStats(): ProviderUsageStats;

    /**
     * Reset usage statistics (typically called at start of new cycle)
     */
    resetUsageStats(): void;
}

/**
 * Options for text generation
 */
export interface GenerateOptions {
    /**
     * Maximum tokens to generate in response
     * Helps control costs and response length
     */
    maxTokens?: number;

    /**
     * Temperature (0.0 - 1.0)
     * Lower = more focused/deterministic, Higher = more creative/random
     */
    temperature?: number;

    /**
     * System prompt to set context/behavior
     */
    systemPrompt?: string;

    /**
     * Stop sequences - generation stops when these are encountered
     */
    stopSequences?: string[];

    /**
     * Top-p sampling (0.0 - 1.0)
     * Alternative to temperature for controlling randomness
     */
    topP?: number;

    /**
     * Timeout for request in milliseconds
     */
    timeout?: number;
}

/**
 * Image input for vision analysis
 * Also supports PDF documents for specification parsing
 */
export interface ImageInput {
    /**
     * Base64-encoded image or document data
     */
    data?: string; // For PDFs and other documents
    base64?: string; // Backward compatibility for images

    /**
     * Media type (e.g., 'image/png', 'image/jpeg', 'application/pdf')
     */
    mimeType?: 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';
    mediaType?: 'image/png' | 'image/jpeg' | 'image/webp'; // Backward compatibility

    /**
     * Optional description of what the image shows
     */
    description?: string;
}

/**
 * Response from LLM generation
 */
export interface LLMResponse {
    /**
     * Generated text content
     */
    text: string;

    /**
     * Token usage for this request
     */
    usage: TokenUsage;

    /**
     * Calculated cost in USD
     */
    cost: number;

    /**
     * Optional confidence score (0.0 - 1.0) if provider supports it
     */
    confidence?: number;

    /**
     * Raw response metadata from provider (for debugging)
     */
    metadata?: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
    /**
     * Tokens in the prompt/input
     */
    inputTokens: number;

    /**
     * Tokens in the generated output
     */
    outputTokens: number;

    /**
     * Total tokens (input + output)
     */
    totalTokens: number;

    /**
     * Cached tokens (if provider supports caching)
     */
    cachedTokens?: number;
}

/**
 * Provider capabilities - what features this LLM supports
 */
export interface ProviderCapabilities {
    /**
     * Supports image analysis (vision models)
     */
    vision: boolean;

    /**
     * Supports streaming responses
     */
    streaming: boolean;

    /**
     * Maximum context window in tokens
     */
    maxTokens: number;

    /**
     * Cost per 1 million input tokens (USD)
     */
    costPer1MInputTokens: number;

    /**
     * Cost per 1 million output tokens (USD)
     */
    costPer1MOutputTokens: number;

    /**
     * Supports function/tool calling
     */
    supportsTools: boolean;

    /**
     * Supports prompt caching to reduce costs
     */
    supportsPromptCaching: boolean;

    /**
     * Typical response time in milliseconds
     */
    typicalResponseTimeMs: number;
}

/**
 * Cumulative usage statistics for a provider
 */
export interface ProviderUsageStats {
    /**
     * Total number of requests made
     */
    requestCount: number;

    /**
     * Total input tokens used
     */
    totalInputTokens: number;

    /**
     * Total output tokens generated
     */
    totalOutputTokens: number;

    /**
     * Total tokens (input + output)
     */
    totalTokens: number;

    /**
     * Total cost in USD
     */
    totalCost: number;

    /**
     * Average response time in milliseconds
     */
    averageResponseTimeMs: number;

    /**
     * Number of failed requests
     */
    failedRequests: number;

    /**
     * When stats tracking started
     */
    startTime: Date;

    /**
     * When stats were last updated
     */
    lastUpdated: Date;
}

/**
 * Configuration for creating a provider
 */
export interface ProviderConfig {
    /**
     * Provider type
     */
    type: 'anthropic' | 'ollama' | 'openai' | 'custom';

    /**
     * Provider-specific configuration
     */
    config: AnthropicConfig | OllamaConfig | OpenAIConfig | CustomConfig;
}

/**
 * Anthropic (Claude) provider configuration
 */
export interface AnthropicConfig {
    /**
     * Anthropic API key
     */
    apiKey: string;

    /**
     * Model to use (default: claude-sonnet-4-5-20250929)
     */
    model?: string;

    /**
     * API base URL (for testing/proxies)
     */
    baseUrl?: string;

    /**
     * Default max tokens for requests
     */
    defaultMaxTokens?: number;
}

/**
 * Ollama (local/free) provider configuration
 */
export interface OllamaConfig {
    /**
     * Ollama API base URL (default: http://localhost:11434)
     */
    baseUrl?: string;

    /**
     * Model to use (default: deepseek-r1:7b)
     * Other options: llama4:13b, deepseek-r1:14b
     */
    model?: string;

    /**
     * Request timeout in milliseconds
     */
    timeout?: number;
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIConfig {
    /**
     * OpenAI API key
     */
    apiKey: string;

    /**
     * Model to use (default: gpt-4)
     */
    model?: string;

    /**
     * API base URL (for custom endpoints)
     */
    baseUrl?: string;

    /**
     * Organization ID (optional)
     */
    organizationId?: string;
}

/**
 * Custom provider configuration
 */
export interface CustomConfig {
    /**
     * API endpoint URL
     */
    baseUrl: string;

    /**
     * Authentication headers
     */
    auth: Record<string, string>;

    /**
     * Model identifier
     */
    model: string;

    /**
     * Request format ('openai' | 'anthropic' | 'custom')
     */
    requestFormat: 'openai' | 'anthropic' | 'custom';

    /**
     * Custom request transformer (if format is 'custom')
     */
    transformRequest?: (prompt: string, options?: GenerateOptions) => unknown;

    /**
     * Custom response transformer (if format is 'custom')
     */
    transformResponse?: (response: unknown) => LLMResponse;
}

/**
 * Error thrown by LLM providers
 */
export class LLMProviderError extends Error {
    constructor(
        message: string,
        public readonly provider: string,
        public readonly statusCode?: number,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'LLMProviderError';
    }
}

/**
 * Error thrown when a required capability is not supported
 */
export class UnsupportedCapabilityError extends LLMProviderError {
    constructor(
        provider: string,
        capability: string,
    ) {
        super(
            `Provider '${provider}' does not support capability: ${capability}`,
            provider,
        );
        this.name = 'UnsupportedCapabilityError';
    }
}
