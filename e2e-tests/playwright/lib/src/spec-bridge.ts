// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Spec Bridge - Bridge between PDF specs and Playwright Agent workflow
 *
 * This module converts specification documents (PDF, Markdown, JSON) into
 * Playwright-compatible markdown files that can be consumed by Playwright's
 * native agents (Planner, Generator, Healer).
 *
 * Flow: PDF → SpecParser → Markdown specs → Playwright Planner
 *
 * The Playwright agents (available in Playwright 1.56+) provide production-ready:
 * - Test planning and exploration
 * - Test code generation
 * - Automatic test healing
 *
 * Usage:
 * ```typescript
 * const bridge = new SpecBridge({type: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY});
 * const specPaths = await bridge.convertToPlaywrightSpecs('spec.pdf', 'specs/');
 * // Now use Playwright agents: @planner, @generator, @healer
 * ```
 */

import {writeFileSync, mkdirSync, existsSync} from 'fs';
import {join, basename} from 'path';

import {SpecificationParser} from './autonomous/spec_parser';
import {LLMProviderFactory} from '@mattermost/llm-testing-providers';
import type {LLMProvider, ProviderConfig, HybridConfig} from '@mattermost/llm-testing-providers';
import type {FeatureSpecification, BusinessScenario} from './autonomous/types';

/**
 * Configuration for SpecBridge
 */
export interface SpecBridgeConfig {
    /**
     * LLM provider configuration for PDF parsing
     * Can be a single provider or hybrid config
     */
    llmConfig: ProviderConfig | HybridConfig;

    /**
     * Output directory for generated specs (default: 'specs/')
     */
    outputDir?: string;

    /**
     * Whether to overwrite existing spec files (default: true)
     */
    overwrite?: boolean;
}

/**
 * Result of spec conversion
 */
export interface ConversionResult {
    /**
     * Paths to generated spec files
     */
    specPaths: string[];

    /**
     * Parsed feature specifications
     */
    features: FeatureSpecification[];

    /**
     * Total number of scenarios extracted
     */
    totalScenarios: number;

    /**
     * Any warnings during conversion
     */
    warnings: string[];
}

/**
 * Bridge between PDF/JSON specs and Playwright Agent workflow
 *
 * Converts specification documents into Playwright-compatible markdown
 * that can be consumed by Playwright's native agents.
 */
export class SpecBridge {
    private parser: SpecificationParser;
    private outputDir: string;
    private overwrite: boolean;

    constructor(config: SpecBridgeConfig) {
        // Handle both single provider and hybrid config
        let llmProvider: LLMProvider;
        if ('primary' in config.llmConfig) {
            // It's a HybridConfig
            llmProvider = LLMProviderFactory.createHybrid(config.llmConfig);
        } else {
            // It's a ProviderConfig
            llmProvider = LLMProviderFactory.create(config.llmConfig);
        }
        this.parser = new SpecificationParser(llmProvider);
        this.outputDir = config.outputDir || 'specs';
        this.overwrite = config.overwrite !== false;
    }

    /**
     * Convert a specification file to Playwright-compatible markdown specs
     *
     * @param inputPath - Path to the input specification (PDF, MD, or JSON)
     * @param outputDir - Optional override for output directory
     * @returns Conversion result with paths and metadata
     */
    async convertToPlaywrightSpecs(inputPath: string, outputDir?: string): Promise<ConversionResult> {
        /* eslint-disable no-console */
        const targetDir = outputDir || this.outputDir;
        const warnings: string[] = [];

        console.log(`Converting specification: ${inputPath}`);

        // Parse the specification
        const specs = await this.parser.parse(inputPath, 'file');

        if (specs.length === 0) {
            warnings.push('No features extracted from specification');
            return {
                specPaths: [],
                features: [],
                totalScenarios: 0,
                warnings,
            };
        }

        // Create output directory
        mkdirSync(targetDir, {recursive: true});

        const specPaths: string[] = [];
        let totalScenarios = 0;

        for (const spec of specs) {
            // Validate the spec
            const validation = this.parser.validateSpec(spec);
            if (!validation.valid) {
                warnings.push(`Feature "${spec.name}": ${validation.errors.join(', ')}`);
            }

            // Convert to Playwright markdown format
            const markdown = this.toPlaywrightMarkdown(spec);

            // Generate output filename
            const filename = `${spec.id}.md`;
            const outputPath = join(targetDir, filename);

            // Check for existing file
            if (existsSync(outputPath) && !this.overwrite) {
                warnings.push(`Skipping existing file: ${outputPath}`);
                continue;
            }

            // Write the spec file
            writeFileSync(outputPath, markdown, 'utf-8');
            specPaths.push(outputPath);

            totalScenarios += spec.scenarios.length;

            console.log(`  Created: ${outputPath} (${spec.scenarios.length} scenarios)`);
        }

        console.log(`Converted ${specs.length} feature(s) with ${totalScenarios} scenario(s)`);

        /* eslint-enable no-console */
        return {
            specPaths,
            features: specs,
            totalScenarios,
            warnings,
        };
    }

    /**
     * Convert a FeatureSpecification to Playwright Agent markdown format
     *
     * The format is designed to be consumed by Playwright's Planner and Generator agents.
     * It includes structured test scenarios in Given-When-Then format.
     */
    private toPlaywrightMarkdown(spec: FeatureSpecification): string {
        const lines: string[] = [];

        // Header
        lines.push(`# ${spec.name}`);
        lines.push('');

        // Metadata
        lines.push(`**Priority**: ${spec.priority}`);
        if (spec.targetUrls.length > 0) {
            lines.push(`**Target URLs**: ${spec.targetUrls.join(', ')}`);
        }
        lines.push('');

        // Description
        if (spec.description) {
            lines.push('## Description');
            lines.push('');
            lines.push(spec.description);
            lines.push('');
        }

        // Test Scenarios
        if (spec.scenarios.length > 0) {
            lines.push('## Test Scenarios');
            lines.push('');

            for (const scenario of spec.scenarios) {
                lines.push(this.formatScenario(scenario));
                lines.push('');
            }
        }

        // Acceptance Criteria
        if (spec.acceptanceCriteria.length > 0) {
            lines.push('## Acceptance Criteria');
            lines.push('');
            for (const criterion of spec.acceptanceCriteria) {
                lines.push(`- ${criterion}`);
            }
            lines.push('');
        }

        // Screenshots reference (if any)
        if (spec.screenshots.length > 0) {
            lines.push('## Reference Screenshots');
            lines.push('');
            for (const screenshot of spec.screenshots) {
                lines.push(`- ${screenshot.description}: \`${screenshot.path}\``);
            }
            lines.push('');
        }

        // Metadata footer
        lines.push('---');
        lines.push(`*Generated from: ${basename(spec.sourcePath)}*`);
        lines.push(`*Feature ID: ${spec.id}*`);

        return lines.join('\n');
    }

    /**
     * Format a business scenario in Playwright-friendly markdown
     */
    private formatScenario(scenario: BusinessScenario): string {
        const lines: string[] = [];

        lines.push(`### ${scenario.name}`);
        lines.push('');
        lines.push(`**Priority**: ${scenario.priority}`);
        lines.push('');

        if (scenario.given) {
            lines.push(`**Given**: ${scenario.given}`);
        }
        if (scenario.when) {
            lines.push(`**When**: ${scenario.when}`);
        }
        if (scenario.then) {
            lines.push(`**Then**: ${scenario.then}`);
        }

        return lines.join('\n');
    }

    /**
     * Parse a spec file without writing output
     * Useful for validation or inspection
     */
    async parseSpec(inputPath: string): Promise<FeatureSpecification[]> {
        return this.parser.parse(inputPath, 'file');
    }

    /**
     * Validate a specification file
     */
    async validateSpec(
        inputPath: string,
    ): Promise<{valid: boolean; errors: string[]; features: number; scenarios: number}> {
        const specs = await this.parser.parse(inputPath, 'file');
        const allErrors: string[] = [];
        let totalScenarios = 0;

        for (const spec of specs) {
            const validation = this.parser.validateSpec(spec);
            if (!validation.valid) {
                allErrors.push(...validation.errors.map((e) => `${spec.name}: ${e}`));
            }
            totalScenarios += spec.scenarios.length;
        }

        return {
            valid: allErrors.length === 0,
            errors: allErrors,
            features: specs.length,
            scenarios: totalScenarios,
        };
    }

    /**
     * Get a summary of the specification
     */
    async getSpecSummary(inputPath: string): Promise<string> {
        const specs = await this.parser.parse(inputPath, 'file');
        const lines: string[] = [];

        lines.push(`Specification Summary: ${basename(inputPath)}`);
        lines.push('='.repeat(50));
        lines.push('');

        for (const spec of specs) {
            const summary = this.parser.getSpecSummary(spec);
            lines.push(`Feature: ${summary.name}`);
            lines.push(`  Priority: ${summary.priority}`);
            lines.push(`  Scenarios: ${summary.scenarioCount}`);
            lines.push(`    - Must-have: ${summary.mustHaveScenarios}`);
            lines.push(`    - Should-have: ${summary.shouldHaveScenarios}`);
            lines.push(`    - Nice-to-have: ${summary.niceToHaveScenarios}`);
            lines.push(`  Acceptance Criteria: ${summary.acceptanceCriteriaCount}`);
            lines.push(`  Has Screenshots: ${summary.hasScreenshots ? 'Yes' : 'No'}`);
            lines.push('');
        }

        return lines.join('\n');
    }
}

/**
 * Create a SpecBridge with Anthropic provider
 * Convenience function for common use case
 */
export function createAnthropicBridge(apiKey?: string, outputDir?: string): SpecBridge {
    return new SpecBridge({
        llmConfig: {
            type: 'anthropic',
            config: {
                apiKey: apiKey || process.env.ANTHROPIC_API_KEY || '',
            },
        },
        outputDir,
    });
}

/**
 * Create a SpecBridge with Ollama provider (free, local)
 * Convenience function for local development
 */
export function createOllamaBridge(model?: string, outputDir?: string): SpecBridge {
    return new SpecBridge({
        llmConfig: {
            type: 'ollama',
            config: {
                model: model || 'deepseek-r1:7b',
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            },
        },
        outputDir,
    });
}
