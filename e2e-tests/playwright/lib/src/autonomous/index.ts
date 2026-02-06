// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Autonomous E2E Testing System
 *
 * A specification-driven testing system that bridges PDF/Markdown specs
 * with Playwright's native agents for test planning, generation, and healing.
 *
 * Quick Start:
 * ```typescript
 * import {SpecBridge, createAnthropicBridge} from '@mattermost/playwright-lib/autonomous';
 *
 * // Convert a specification to Playwright-compatible markdown
 * const bridge = createAnthropicBridge(process.env.ANTHROPIC_API_KEY);
 * const result = await bridge.convertToPlaywrightSpecs('spec.pdf', 'specs/');
 *
 * // Then use Playwright agents:
 * // @planner explore http://localhost:8065
 * // @generator create tests from specs/
 * // @healer fix failing tests
 * ```
 *
 * Architecture:
 * - SpecificationParser: Parses PDF/MD/JSON specs into structured format
 * - SpecBridge: Converts specs to Playwright Agent-compatible markdown
 * - LLM Providers: Pluggable AI providers (Anthropic, Ollama, OpenAI)
 *
 * The heavy lifting (test generation, execution, healing) is delegated to
 * Playwright's built-in agents which are production-ready and maintained
 * by the Playwright team.
 */

// Core Components
export {SpecificationParser} from './spec_parser';
export type {SpecSummary, SpecificationCache} from './spec_parser';

// LLM Providers (from npm package)
export {LLMProviderFactory, OllamaProvider, AnthropicProvider} from 'e2e-ai-agents';

export type {
    LLMProvider,
    LLMResponse,
    GenerateOptions,
    ImageInput,
    ProviderCapabilities,
    ProviderUsageStats,
    ProviderConfig,
    OllamaConfig,
    AnthropicConfig,
    HybridConfig,
} from 'e2e-ai-agents';

// Type definitions
export type {
    // Specifications
    FeatureSpecification,
    BusinessScenario,
    SpecScreenshot,

    // Generated test metadata (for tracking)
    GeneratedTest,
} from './types';

/**
 * Version info
 */
export const VERSION = '2.0.0';
export const SUPPORTED_PLAYWRIGHT_VERSION = '1.56.0';

/**
 * Feature flags
 */
export const FEATURES = {
    LLM_AGNOSTIC: true,
    SPECIFICATION_DRIVEN: true,
    PLAYWRIGHT_AGENTS: true,
} as const;
