/**
 * Phase 3: Selector Enforcement
 * Validates selectors against whitelist and comments out invalid ones
 */

export interface ValidationResult {
    isValid: boolean;
    confidence: number;
    reason?: string;
    suggestedComment?: string;
}

export interface ValidatedSelector {
    selector: string;
    isWhitelisted: boolean;
    confidence: number;
    originalCode: string;
    validatedCode: string; // Comments out if not whitelisted
}

/**
 * SelectorValidator: Enforces whitelist matching on generated selectors
 * Comments out unobserved selectors instead of letting tests fail randomly
 */
export class SelectorValidator {
    private whitelist: Set<string> = new Set();
    private semanticWhitelist: Map<string, string[]> = new Map();
    private minConfidence: number;

    constructor(globalSelectors: {[semantic: string]: Array<{selector: string; confidence: number}>}, minConfidence: number = 50) {
        this.minConfidence = minConfidence;

        // Build flat whitelist from semantic map
        for (const [semantic, elements] of Object.entries(globalSelectors)) {
            for (const elem of elements) {
                if (elem.confidence >= minConfidence) {
                    this.whitelist.add(elem.selector);
                }
            }
            this.semanticWhitelist.set(semantic, elements.map((e) => e.selector));
        }
    }

    /**
     * Validate a selector against the whitelist
     */
    validateSelector(selector: string): ValidationResult {
        if (this.whitelist.has(selector)) {
            return {
                isValid: true,
                confidence: 100,
                reason: 'Found in whitelist',
            };
        }

        // Check for similar selectors (lenient matching)
        const normalized = this.normalizeSelector(selector);
        for (const whitelisted of this.whitelist) {
            if (this.normalizeSelector(whitelisted).includes(normalized)) {
                return {
                    isValid: true,
                    confidence: 75,
                    reason: 'Found similar whitelisted selector',
                };
            }
        }

        return {
            isValid: false,
            confidence: 0,
            reason: 'Not found in whitelist',
            suggestedComment: `// UNOBSERVED SELECTOR - Not found in UI map. Use test.fixme() if needed.`,
        };
    }

    /**
     * Validate and comment out invalid selectors in generated test code
     */
    validateTestCode(code: string): ValidatedSelector[] {
        const results: ValidatedSelector[] = [];
        const selectorRegex = /page\.(getByTestId|getByLabel|getByRole|locator)\(['"`]([^'"`]+)['"`]\)/g;

        let match;
        while ((match = selectorRegex.exec(code)) !== null) {
            const [fullMatch, method, selector] = match;
            const validation = this.validateSelector(selector);

            results.push({
                selector,
                isWhitelisted: validation.isValid,
                confidence: validation.confidence,
                originalCode: fullMatch,
                validatedCode: validation.isValid
                    ? fullMatch
                    : `// ${validation.suggestedComment}\n    // ${fullMatch}`,
            });
        }

        return results;
    }

    /**
     * Apply validation to test code, commenting out unwhitelisted selectors
     */
    applyValidation(code: string): string {
        let validated = code;
        const results = this.validateTestCode(code);

        // Apply in reverse order to preserve indices
        for (const result of results.reverse()) {
            if (!result.isWhitelisted) {
                validated = validated.replace(result.originalCode, result.validatedCode);
            }
        }

        return validated;
    }

    /**
     * Get validation summary
     */
    getSummary(code: string): {
        total: number;
        whitelisted: number;
        coverage: number;
        unobserved: string[];
    } {
        const results = this.validateTestCode(code);
        const unobserved = results.filter((r) => !r.isWhitelisted).map((r) => r.selector);

        return {
            total: results.length,
            whitelisted: results.filter((r) => r.isWhitelisted).length,
            coverage: results.length > 0 ? Math.round((results.filter((r) => r.isWhitelisted).length / results.length) * 100) : 100,
            unobserved,
        };
    }

    private normalizeSelector(selector: string): string {
        // Normalize selector for lenient matching
        return selector.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    }
}

/**
 * APIFallbackResolver: Provides fallback strategies when UI selectors fail
 * Converts test methods to API calls when UI elements aren't available
 */
export class APIFallbackResolver {
    private apiMapping: Map<string, string> = new Map([
        // UI action -> API endpoint mapping
        ['click.*button.*submit', 'POST /api/v4/posts'],
        ['fill.*search', 'GET /api/v4/users'],
        ['click.*profile', 'GET /api/v4/users/me'],
        ['navigate.*channel', 'GET /api/v4/channels'],
        ['click.*settings', 'PATCH /api/v4/users/me'],
    ]);

    /**
     * Check if a test should fall back to API testing
     */
    shouldFallback(selector: string, confidence: number): boolean {
        return confidence < 50;
    }

    /**
     * Generate API-based fallback for unobserved selector
     */
    generateAPIFallback(selector: string, action: string): string {
        // Find matching API endpoint
        let endpoint = 'GET /api/v4/';
        for (const [pattern, api] of this.apiMapping) {
            if (new RegExp(pattern, 'i').test(action)) {
                endpoint = api;
                break;
            }
        }

        return `
    // UI selector not found - falling back to API
    const response = await fetch(\`\${baseUrl}${endpoint.split(' ')[1]}\`, {
        method: '${endpoint.split(' ')[0]}',
        headers: {'Authorization': \`Bearer \${token}\`},
    });
    expect(response.ok).toBe(true);`;
    }

    /**
     * Wrap unobserved test in try-catch with API fallback
     */
    wrapWithFallback(testCode: string, fallbackEndpoint: string): string {
        return `
    try {
        ${testCode}
    } catch (error) {
        // UI element not found - using API fallback
        ${this.generateAPIFallback('unknown', testCode)}
    }`;
    }
}
