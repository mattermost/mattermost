// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * LLM Provider Module
 *
 * Pluggable AI provider architecture for autonomous testing.
 * Switch between free (Ollama) and premium (Claude) LLMs seamlessly.
 */

// Core interfaces and types
export type {
    LLMProvider,
    GenerateOptions,
    ImageInput,
    LLMResponse,
    TokenUsage,
    ProviderCapabilities,
    ProviderUsageStats,
    ProviderConfig,
    AnthropicConfig,
    OllamaConfig,
    OpenAIConfig,
    CustomConfig,
} from './provider_interface';

export {LLMProviderError, UnsupportedCapabilityError} from './provider_interface';

// Provider implementations
export {AnthropicProvider, checkAnthropicSetup} from './anthropic_provider';
export {OllamaProvider, checkOllamaSetup} from './ollama_provider';

// Factory
export {LLMProviderFactory, validateProviderSetup} from './provider_factory';
export type {HybridConfig} from './provider_factory';
