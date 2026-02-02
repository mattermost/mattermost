// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {readFileSync, existsSync} from 'fs';
import {join, dirname} from 'path';
import {createHash} from 'crypto';

import {marked, type Tokens} from 'marked';

import type {LLMProvider} from './llm';
import type {BusinessScenario, FeatureSpecification, SpecScreenshot} from './types';

/**
 * Optional cache interface for PDF parsing results
 * Implementations can provide caching to avoid re-parsing PDFs
 */
export interface SpecificationCache {
    isSpecificationCached(path: string, hash: string): boolean;
    getCachedSpecifications(path: string, hash: string): FeatureSpecification[];
    saveSpecification(spec: FeatureSpecification): void;
}

// Type aliases for marked tokens (for compatibility with different marked versions)
type HeadingToken = Tokens.Heading;
type ParagraphToken = Tokens.Paragraph;
type ListToken = Tokens.List;
type ListItemToken = Tokens.ListItem;
type ImageToken = Tokens.Image;

/**
 * Specification Parser
 *
 * Parses user-provided specification documents to guide autonomous testing.
 * Supports multiple formats:
 * - Markdown (.md) with embedded screenshots and Given-When-Then scenarios
 * - JSON (.json) with structured feature definitions
 * - PDF (.pdf) with text, diagrams, and screenshots extracted via LLM
 * - Plain text focus strings (natural language)
 *
 * Extracts:
 * - Feature name, description, priority
 * - Target URLs to prioritize in crawling
 * - Business scenarios (Given-When-Then)
 * - Acceptance criteria
 * - Reference screenshots for visual comparison
 * - UI mockups and wireframes from PDFs
 *
 * The parsed specifications guide:
 * - Crawler URL prioritization
 * - Test scenario generation
 * - Visual regression comparison
 * - Coverage gap detection
 */
export class SpecificationParser {
    private llmProvider: LLMProvider;
    private cache?: SpecificationCache;

    constructor(llmProvider: LLMProvider, cache?: SpecificationCache) {
        this.llmProvider = llmProvider;
        this.cache = cache;
    }

    /**
     * Parse specification from file or string
     */
    async parse(source: string, sourceType: 'file' | 'string' = 'file'): Promise<FeatureSpecification[]> {
        let content: string;
        let sourcePath: string;

        if (sourceType === 'file') {
            if (!existsSync(source)) {
                throw new Error(`Specification file not found: ${source}`);
            }

            sourcePath = source;

            // Determine format from extension
            if (source.endsWith('.md')) {
                content = readFileSync(source, 'utf-8');
                return this.parseMarkdown(content, sourcePath);
            } else if (source.endsWith('.json')) {
                content = readFileSync(source, 'utf-8');
                return this.parseJSON(content, sourcePath);
            } else if (source.endsWith('.pdf')) {
                return this.parsePDF(sourcePath);
            } else {
                throw new Error(`Unsupported specification format: ${source}. Use .md, .json, or .pdf`);
            }
        } else {
            // Plain text focus string - use LLM to interpret
            return this.parseFocusString(source);
        }
    }

    /**
     * Parse Markdown specification
     *
     * Expected format:
     * # Feature: Feature Name
     * **Priority**: High
     * **Target URLs**: /path1, /path2
     *
     * ## Description
     * Feature description...
     *
     * ## Business Scenarios
     * ### Scenario 1: Name
     * - **Given**: Precondition
     * - **When**: Action
     * - **Then**: Expected outcome
     *
     * ## Acceptance Criteria
     * - Criterion 1
     * - Criterion 2
     *
     * ## Screenshots
     * ![Description](path/to/image.png)
     */
    private async parseMarkdown(content: string, sourcePath: string): Promise<FeatureSpecification[]> {
        const tokens = marked.lexer(content);

        const specs: FeatureSpecification[] = [];
        let currentSpec: Partial<FeatureSpecification> | null = null;
        let currentSection: string | null = null;
        let currentScenario: Partial<BusinessScenario> | null = null;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (token.type === 'heading') {
                const headingToken = token as HeadingToken;
                const text = headingToken.text;

                if (headingToken.depth === 1) {
                    // New feature
                    if (currentSpec) {
                        specs.push(this.finalizeSpec(currentSpec, sourcePath));
                    }

                    currentSpec = {
                        name: text.replace(/^Feature:\s*/i, '').trim(),
                        targetUrls: [],
                        scenarios: [],
                        screenshots: [],
                        acceptanceCriteria: [],
                    };
                    currentSection = null;
                } else if (headingToken.depth === 2) {
                    // Section
                    currentSection = text.toLowerCase();
                } else if (headingToken.depth === 3 && currentSection === 'business scenarios') {
                    // New scenario
                    if (currentScenario && currentSpec) {
                        currentSpec.scenarios!.push(this.finalizeScenario(currentScenario));
                    }

                    currentScenario = {
                        name: text.replace(/^Scenario \d+:\s*/i, '').trim(),
                        priority: 'should-have',
                    };
                }
            } else if (token.type === 'paragraph' && currentSpec) {
                const paragraphToken = token as ParagraphToken;
                const text = paragraphToken.text;

                // Extract metadata from bold markers
                const priorityMatch = text.match(/\*\*Priority\*\*:\s*(\w+)/i);
                if (priorityMatch) {
                    currentSpec.priority = priorityMatch[1].toLowerCase() as any;
                }

                const urlsMatch = text.match(/\*\*Target URLs?\*\*:\s*(.+)/i);
                if (urlsMatch) {
                    currentSpec.targetUrls = urlsMatch[1]
                        .split(',')
                        .map((url) => url.trim())
                        .filter(Boolean);
                }

                // Extract scenario details
                if (currentScenario) {
                    const givenMatch = text.match(/\*\*Given\*\*:\s*(.+)/i);
                    const whenMatch = text.match(/\*\*When\*\*:\s*(.+)/i);
                    const thenMatch = text.match(/\*\*Then\*\*:\s*(.+)/i);
                    const priorityMatch = text.match(/\*\*Priority\*\*:\s*(\w+)/i);

                    if (givenMatch) currentScenario.given = givenMatch[1].trim();
                    if (whenMatch) currentScenario.when = whenMatch[1].trim();
                    if (thenMatch) currentScenario.then = thenMatch[1].trim();
                    if (priorityMatch) {
                        const priority = priorityMatch[1].toLowerCase();
                        if (priority.includes('must')) currentScenario.priority = 'must-have';
                        else if (priority.includes('should')) currentScenario.priority = 'should-have';
                        else currentScenario.priority = 'nice-to-have';
                    }
                }

                // Description section
                if (currentSection === 'description') {
                    currentSpec.description = (currentSpec.description || '') + text + ' ';
                }
            } else if (token.type === 'list' && currentSpec) {
                const listToken = token as ListToken;

                if (currentSection === 'acceptance criteria') {
                    // Extract acceptance criteria
                    for (const item of listToken.items) {
                        const itemToken = item as ListItemToken;
                        currentSpec.acceptanceCriteria!.push(itemToken.text);
                    }
                } else if (currentSection === 'business scenarios' && currentScenario) {
                    // Extract Given-When-Then from list items
                    for (const item of listToken.items) {
                        const itemToken = item as ListItemToken;
                        const text = itemToken.text;

                        const givenMatch = text.match(/\*\*Given\*\*:\s*(.+)/i);
                        const whenMatch = text.match(/\*\*When\*\*:\s*(.+)/i);
                        const thenMatch = text.match(/\*\*Then\*\*:\s*(.+)/i);

                        if (givenMatch) currentScenario.given = givenMatch[1].trim();
                        if (whenMatch) currentScenario.when = whenMatch[1].trim();
                        if (thenMatch) currentScenario.then = thenMatch[1].trim();
                    }
                }
            } else if (token.type === 'image' && currentSpec && currentSection === 'screenshots') {
                const imageToken = token as ImageToken;

                // Resolve image path relative to spec file
                const imagePath = this.resolveImagePath(imageToken.href, sourcePath);

                currentSpec.screenshots!.push({
                    path: imagePath,
                    description: imageToken.text || 'Screenshot',
                });
            }
        }

        // Finalize last scenario and spec
        if (currentScenario && currentSpec) {
            currentSpec.scenarios!.push(this.finalizeScenario(currentScenario));
        }

        if (currentSpec) {
            specs.push(this.finalizeSpec(currentSpec, sourcePath));
        }

        // Load screenshot data
        await this.loadScreenshots(specs);

        return specs;
    }

    /**
     * Parse JSON specification
     */
    private parseJSON(content: string, sourcePath: string): FeatureSpecification[] {
        try {
            const data = JSON.parse(content);

            // Support both single spec and array of specs
            const specsData = Array.isArray(data) ? data : [data];

            const specs: FeatureSpecification[] = specsData.map((specData) => {
                const scenarios: BusinessScenario[] = (specData.scenarios || []).map((s: any) => ({
                    name: s.name,
                    given: s.given,
                    when: s.when,
                    then: s.then,
                    priority: s.priority || 'should-have',
                }));

                const screenshots: SpecScreenshot[] = (specData.screenshots || []).map((s: any) => {
                    if (typeof s === 'string') {
                        return {path: this.resolveImagePath(s, sourcePath), description: 'Screenshot'};
                    }
                    return {
                        path: this.resolveImagePath(s.path, sourcePath),
                        description: s.description || 'Screenshot',
                    };
                });

                return {
                    id: this.generateSpecId(specData.feature || specData.name),
                    name: specData.feature || specData.name,
                    description: specData.description || '',
                    priority: specData.priority || 'medium',
                    targetUrls: specData.targetUrls || specData.urls || [],
                    scenarios,
                    screenshots,
                    acceptanceCriteria: specData.acceptanceCriteria || [],
                    sourcePath,
                };
            });

            // Load screenshot data
            this.loadScreenshots(specs);

            return specs;
        } catch (error) {
            throw new Error(
                `Failed to parse JSON specification: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Parse PDF specification using LLM vision
     *
     * PDFs can contain:
     * - Product requirement documents (PRDs)
     * - Feature specifications with screenshots
     * - UI mockups and wireframes
     * - User flow diagrams
     * - Acceptance criteria and test plans
     *
     * The LLM will extract structured information including:
     * - Feature name and description
     * - Business scenarios
     * - Target URLs (inferred from screenshots/mockups)
     * - Acceptance criteria
     * - Screenshots/mockups for visual comparison
     */
    private async parsePDF(pdfPath: string): Promise<FeatureSpecification[]> {
        /* eslint-disable no-console */
        // Console output is expected for PDF parsing progress
        console.log(`📄 Parsing PDF specification: ${pdfPath}`);

        // Read PDF file first to calculate hash
        const pdfBuffer = readFileSync(pdfPath);
        const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex');

        // Check if already cached
        if (this.cache && this.cache.isSpecificationCached(pdfPath, pdfHash)) {
            console.log(`   ✓ Using cached PDF specification (hash: ${pdfHash.substring(0, 8)}...)`);
            const cachedSpecs = this.cache.getCachedSpecifications(pdfPath, pdfHash);
            console.log(`✅ Loaded ${cachedSpecs.length} feature(s) from cache`);

            // Print scenario count for each feature
            for (const spec of cachedSpecs) {
                const priority = spec.priority === 'critical' ? 'critical' : spec.priority;
                console.log(`   ✓ Loaded 1 specifications`);
                console.log(`     - ${spec.name} (${priority}): ${spec.scenarios.length} scenarios`);
            }

            return cachedSpecs;
        }

        // Check if provider supports vision (required for PDF parsing)
        if (!this.llmProvider.capabilities.vision) {
            throw new Error(
                'PDF parsing requires a vision-capable LLM provider (e.g., Anthropic Claude). ' +
                    'Current provider does not support vision. ' +
                    'Use --llm-provider anthropic or --llm-provider hybrid',
            );
        }

        // SECURITY WARNING: PDF will be sent to external LLM
        console.warn('');
        console.warn('⚠️  SECURITY WARNING: PDF Document Transmission ⚠️');
        console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.warn('The PDF specification will be sent to an external LLM provider.');
        console.warn('');
        console.warn('Ensure the PDF does NOT contain:');
        console.warn('  • Internal API keys or credentials');
        console.warn('  • Sensitive architecture details');
        console.warn('  • Production URLs or IP addresses');
        console.warn('  • Personal Identifying Information (PII)');
        console.warn('  • Proprietary business information');
        console.warn('');
        console.warn('The LLM provider may retain this data per their policy.');
        console.warn('For Anthropic: https://www.anthropic.com/legal/privacy');
        console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.warn('');

        // Check if user has consented (via environment variable)
        if (!process.env.AUTONOMOUS_ALLOW_PDF_UPLOAD) {
            console.error('❌ PDF upload blocked for security.');
            console.error('❌ To proceed, set environment variable:');
            console.error('❌   AUTONOMOUS_ALLOW_PDF_UPLOAD=true');
            console.error('❌ Only set this if you have reviewed the PDF for sensitive data.');
            throw new Error('PDF upload requires explicit consent via AUTONOMOUS_ALLOW_PDF_UPLOAD=true');
        }

        try {
            console.log(`📄 Extracting text from PDF... (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

            // Parse PDF to extract text content (dynamic import with named export)
            const {PDFParse} = await import('pdf-parse');
            const parser = new PDFParse({data: pdfBuffer});
            const pdfData = await parser.getText();
            const pdfText = pdfData.text;
            await parser.destroy();

            console.log(`   ✓ Extracted ${pdfText.length} characters, ${pdfData.total} pages`);

            // Use LLM for semantic parsing (text-only, no vision)
            const prompt = `
You are a test specification parser. Parse this UX/product specification document and extract structured, machine-operable testing information.

The document describes features, user flows, permissions, edge cases, and acceptance criteria.

Extract the following in JSON format (this schema is optimized for test automation):

{
  "features": [
    {
      "name": "Feature Name (e.g., Auto-translation)",
      "scope": "MVP|v1|v2",
      "description": "What this feature does",
      "priority": "critical|high|medium|low",

      "roles": {
        "role_name": {
          "permissions": ["permission1", "permission2"]
        }
      },

      "enablement": {
        "location_type": {
          "enabled_by": "who can enable",
          "default_state": "on|off",
          "side_effects": ["system_message", "label_visible"]
        }
      },

      "scenarios": [
        {
          "name": "Scenario name",
          "given": "Precondition",
          "when": "Action",
          "then": "Expected outcome",
          "priority": "must-have|should-have|nice-to-have"
        }
      ],

      "acceptanceCriteria": [
        "Testable criterion"
      ],

      "stateMachines": {
        "message_lifecycle": {
          "states": ["translating", "translated", "failed"],
          "transitions": ["new_message -> translating", "translating -> translated"]
        }
      },

      "uiIndicators": {
        "location": "visual_indicator"
      },

      "edgeCases": [
        "What happens when X"
      ],

      "platformDifferences": {
        "desktop": "behavior",
        "mobile": "behavior"
      },

      "nonGoals": [
        "Out of scope items"
      ]
    }
  ]
}

IMPORTANT:
- Extract ALL features, flows, roles, and permissions
- Map state machines if described
- Identify edge cases and failure modes
- List platform differences
- Capture non-goals/out-of-scope items
- DO NOT infer or generate target URLs - feature specs describe behavior, not routes
- Be precise with permissions and access control
- For MVP features or P0 features, set priority to "critical"
- For must-have scenarios in MVP features, set scenario priority to "must-have"

Respond with ONLY valid JSON, no markdown formatting.

DOCUMENT TEXT:
${pdfText}
            `.trim();

            // Call LLM with text (no vision)
            // Use higher maxTokens for complex documents (16K for large specs)
            const response = await this.llmProvider.generateText(prompt, {
                maxTokens: 16000,
                temperature: 0.1, // Very low temperature for structured extraction
            });

            // Parse LLM response
            let jsonText = response.text.trim();

            // Remove markdown code blocks if present (handle various formats)
            // Try multiple patterns to be more robust
            const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1].trim();
            } else if (jsonText.startsWith('```')) {
                // Fallback: remove all triple backticks
                jsonText = jsonText
                    .replace(/```[^\n]*\n?/g, '')
                    .replace(/```\s*$/g, '')
                    .trim();
            }

            let data;
            try {
                data = JSON.parse(jsonText);
            } catch (parseError) {
                // Log the problematic JSON for debugging
                console.error('Failed to parse LLM response as JSON');
                console.error('First 500 chars:', jsonText.substring(0, 500));
                console.error('Last 500 chars:', jsonText.substring(Math.max(0, jsonText.length - 500)));

                // Try to repair common JSON issues
                console.log('Attempting to repair JSON...');
                let repairedJson = jsonText;

                // Common fixes:
                // 1. Fix unquoted property names (e.g., {name: "value"} -> {"name": "value"})
                repairedJson = repairedJson.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

                // 2. Fix single quotes to double quotes
                repairedJson = repairedJson.replace(/'/g, '"');

                // 3. Remove trailing commas
                repairedJson = repairedJson.replace(/,(\s*[}\]])/g, '$1');

                // 4. Fix missing quotes around string values (this is tricky, skip for now)

                try {
                    data = JSON.parse(repairedJson);
                    console.log('✓ JSON repair successful!');
                } catch {
                    // If repair failed, ask LLM to fix it
                    console.log('JSON repair failed, requesting LLM to fix the JSON...');
                    const fixPrompt = `
The following JSON is malformed. Please fix it and return ONLY valid JSON with no markdown formatting:

${jsonText}

Error: ${parseError instanceof Error ? parseError.message : String(parseError)}

Return the corrected JSON:`.trim();

                    const fixResponse = await this.llmProvider.generateText(fixPrompt, {
                        maxTokens: 16000,
                        temperature: 0,
                    });

                    let fixedJson = fixResponse.text.trim();

                    // Remove markdown code blocks again
                    const fixedMatch = fixedJson.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
                    if (fixedMatch) {
                        fixedJson = fixedMatch[1].trim();
                    } else if (fixedJson.startsWith('```')) {
                        fixedJson = fixedJson
                            .replace(/```[^\n]*\n?/g, '')
                            .replace(/```\s*$/g, '')
                            .trim();
                    }

                    try {
                        data = JSON.parse(fixedJson);
                        console.log('✓ LLM successfully fixed the JSON!');
                    } catch (finalError) {
                        console.error('Failed to parse even after LLM repair');
                        console.error('Original error:', parseError);
                        console.error('Repair error:', finalError);
                        throw parseError; // Throw original error
                    }
                }
            }

            if (!data.features || !Array.isArray(data.features)) {
                throw new Error('Invalid PDF parse response: missing features array');
            }

            console.log(`✅ Extracted ${data.features.length} feature(s) from PDF`);

            // Convert to FeatureSpecification format
            const specs: FeatureSpecification[] = data.features.map((feature: any) => {
                const scenarios: BusinessScenario[] = (feature.scenarios || []).map((s: any) => ({
                    name: s.name,
                    given: s.given || '',
                    when: s.when || '',
                    then: s.then || '',
                    priority: s.priority || 'should-have',
                }));

                // Store screenshot metadata (page numbers for extraction)
                const screenshots: SpecScreenshot[] = (feature.screenshots || []).map((s: any) => ({
                    path: `${pdfPath}#page=${s.pageNumber}`,
                    description: s.description || `Page ${s.pageNumber}`,
                    pageNumber: s.pageNumber,
                }));

                const spec: any = {
                    id: this.generateSpecId(feature.name),
                    name: feature.name,
                    description: feature.description || '',
                    priority: feature.priority || 'medium',
                    targetUrls: feature.targetUrls || [],
                    scenarios,
                    screenshots,
                    acceptanceCriteria: feature.acceptanceCriteria || [],
                    sourcePath: pdfPath,
                    sourceHash: pdfHash,
                    metadata: {
                        uiElements: feature.uiElements || [],
                        userFlows: feature.userFlows || [],
                        extractedFrom: 'pdf',
                    },
                };

                return spec;
            });

            // Save to cache if knowledge base is available
            if (this.cache) {
                for (const spec of specs) {
                    this.cache.saveSpecification(spec);
                }
            }

            /* eslint-enable no-console */
            return specs;
        } catch (error) {
            if (error instanceof Error && error.message.includes('vision')) {
                throw error; // Re-throw vision capability errors
            }

            throw new Error(
                `Failed to parse PDF specification: ${error instanceof Error ? error.message : String(error)}. ` +
                    'Ensure the PDF contains readable text and images. ' +
                    'For scanned PDFs, ensure they have been OCR processed.',
            );
        }
    }

    /**
     * Parse natural language focus string using LLM
     */
    private async parseFocusString(focusString: string): Promise<FeatureSpecification[]> {
        const prompt = `
You are a test specification generator. Given a natural language focus string, extract:
1. Feature name (infer from the focus string)
2. Target URLs (guess likely URLs based on feature names)
3. Business scenarios (generate 2-3 test scenarios)
4. Priority (infer from words like "critical", "thoroughly", etc.)

Focus string: "${focusString}"

Respond with valid JSON in this format:
{
  "feature": "Feature Name",
  "priority": "high|medium|low",
  "targetUrls": ["/url1", "/url2"],
  "scenarios": [
    {
      "name": "Scenario name",
      "given": "Precondition",
      "when": "Action",
      "then": "Expected result",
      "priority": "must-have|should-have|nice-to-have"
    }
  ],
  "acceptanceCriteria": ["criterion 1", "criterion 2"]
}
        `.trim();

        try {
            const response = await this.llmProvider.generateText(prompt, {
                maxTokens: 1000,
                temperature: 0.3,
            });

            // Extract JSON from response (might have markdown code blocks)
            let jsonText = response.text.trim();
            // Try multiple patterns to be more robust
            const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1].trim();
            } else if (jsonText.startsWith('```')) {
                // Fallback: remove all triple backticks
                jsonText = jsonText
                    .replace(/```[^\n]*\n?/g, '')
                    .replace(/```\s*$/g, '')
                    .trim();
            }

            const data = JSON.parse(jsonText);

            const scenarios: BusinessScenario[] = (data.scenarios || []).map((s: any) => ({
                name: s.name,
                given: s.given,
                when: s.when,
                then: s.then,
                priority: s.priority || 'should-have',
            }));

            return [
                {
                    id: this.generateSpecId(data.feature),
                    name: data.feature,
                    description: `Generated from focus string: ${focusString}`,
                    priority: data.priority || 'medium',
                    targetUrls: data.targetUrls || [],
                    scenarios,
                    screenshots: [],
                    acceptanceCriteria: data.acceptanceCriteria || [],
                    sourcePath: 'focus-string',
                },
            ];
        } catch (error) {
            throw new Error(
                `Failed to parse focus string with LLM: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Finalize partial spec
     */
    private finalizeSpec(partial: Partial<FeatureSpecification>, sourcePath: string): FeatureSpecification {
        return {
            id: this.generateSpecId(partial.name || 'unknown'),
            name: partial.name || 'Unnamed Feature',
            description: (partial.description || '').trim(),
            priority: partial.priority || 'medium',
            targetUrls: partial.targetUrls || [],
            scenarios: partial.scenarios || [],
            screenshots: partial.screenshots || [],
            acceptanceCriteria: partial.acceptanceCriteria || [],
            sourcePath,
        };
    }

    /**
     * Finalize partial scenario
     */
    private finalizeScenario(partial: Partial<BusinessScenario>): BusinessScenario {
        return {
            name: partial.name || 'Unnamed Scenario',
            given: partial.given || '',
            when: partial.when || '',
            then: partial.then || '',
            priority: partial.priority || 'should-have',
        };
    }

    /**
     * Generate spec ID from name
     */
    private generateSpecId(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Resolve image path relative to spec file
     */
    private resolveImagePath(imagePath: string, specPath: string): string {
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath; // Absolute URL
        }

        if (imagePath.startsWith('/')) {
            return imagePath; // Absolute path
        }

        // Relative path - resolve relative to spec file
        const specDir = dirname(specPath);
        return join(specDir, imagePath);
    }

    /**
     * Load screenshot data from files
     */
    private async loadScreenshots(specs: FeatureSpecification[]): Promise<void> {
        for (const spec of specs) {
            for (const screenshot of spec.screenshots) {
                try {
                    if (existsSync(screenshot.path)) {
                        const imageData = readFileSync(screenshot.path);
                        screenshot.data = imageData.toString('base64');
                    } else {
                        // eslint-disable-next-line no-console
                        console.warn(`Screenshot not found: ${screenshot.path}`);
                    }
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.warn(`Failed to load screenshot ${screenshot.path}:`, error);
                }
            }
        }
    }

    /**
     * Validate parsed specification
     */
    validateSpec(spec: FeatureSpecification): {valid: boolean; errors: string[]} {
        const errors: string[] = [];

        if (!spec.name || spec.name.trim().length === 0) {
            errors.push('Feature name is required');
        }

        if (spec.scenarios.length === 0) {
            errors.push('At least one scenario is required');
        }

        for (let i = 0; i < spec.scenarios.length; i++) {
            const scenario = spec.scenarios[i];
            if (!scenario.given || !scenario.when || !scenario.then) {
                errors.push(`Scenario ${i + 1} is incomplete (missing given/when/then)`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Get spec coverage summary
     */
    getSpecSummary(spec: FeatureSpecification): SpecSummary {
        return {
            id: spec.id,
            name: spec.name,
            priority: spec.priority,
            targetUrlCount: spec.targetUrls.length,
            scenarioCount: spec.scenarios.length,
            mustHaveScenarios: spec.scenarios.filter((s) => s.priority === 'must-have').length,
            shouldHaveScenarios: spec.scenarios.filter((s) => s.priority === 'should-have').length,
            niceToHaveScenarios: spec.scenarios.filter((s) => s.priority === 'nice-to-have').length,
            acceptanceCriteriaCount: spec.acceptanceCriteria.length,
            hasScreenshots: spec.screenshots.length > 0,
        };
    }
}

/**
 * Specification summary
 */
export interface SpecSummary {
    id: string;
    name: string;
    priority: string;
    targetUrlCount: number;
    scenarioCount: number;
    mustHaveScenarios: number;
    shouldHaveScenarios: number;
    niceToHaveScenarios: number;
    acceptanceCriteriaCount: number;
    hasScreenshots: boolean;
}
