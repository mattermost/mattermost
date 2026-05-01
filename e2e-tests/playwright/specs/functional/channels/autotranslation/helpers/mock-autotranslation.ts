// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Disposable, Page} from '@playwright/test';

interface MockTranslateRequest {
    q?: string;
    text?: string;
    source?: string;
    target?: string;
}

interface MockTranslateResponse {
    translatedText: string;
    detectedLanguage: {language: string; confidence: number};
}

/**
 * Tracks the source language for mock translation responses
 * Used to simulate language detection behavior
 */
let mockSourceLanguage = 'es';

/**
 * Simple language detection from text content
 * Simulates how real LibreTranslate detects language from actual message text
 */
function detectLanguageFromText(text: string): string {
    if (!text) return mockSourceLanguage;

    const lowerText = text.toLowerCase();

    // Spanish patterns
    const spanishIndicators = [
        'el ',
        'la ',
        'de ',
        'que ',
        'para ',
        'con ',
        'una ',
        'este ',
        'está',
        'muy',
        'en ',
        'aquí',
        'gracias',
        'hola',
        'adiós',
    ];
    const spanishMatches = spanishIndicators.filter((indicator) => lowerText.includes(indicator)).length;

    // English patterns
    const englishIndicators = [
        'the ',
        'and ',
        'is ',
        'to ',
        'of ',
        'that ',
        'this ',
        'for ',
        'with ',
        'hello',
        'thanks',
        'please',
        'translation',
    ];
    const englishMatches = englishIndicators.filter((indicator) => lowerText.includes(indicator)).length;

    // French patterns
    const frenchIndicators = [
        'le ',
        'la ',
        'de ',
        'est ',
        'que ',
        'pour ',
        'avec ',
        'un ',
        'une ',
        'ça',
        'bonjour',
        'merci',
    ];
    const frenchMatches = frenchIndicators.filter((indicator) => lowerText.includes(indicator)).length;

    // Return the language with most matches
    if (spanishMatches > englishMatches && spanishMatches > frenchMatches) return 'es';
    if (englishMatches > frenchMatches) return 'en';
    if (frenchMatches > 0) return 'fr';

    // Default to configured mock language
    return mockSourceLanguage;
}

/**
 * Set the source language that the mock will detect
 * Useful for testing language detection and filtering logic
 */
export function setMockSourceLanguage(language: string): void {
    mockSourceLanguage = language;
}

/**
 * Get the current mock source language
 */
export function getMockSourceLanguage(): string {
    return mockSourceLanguage;
}

/**
 * Reset mock source language to default
 */
export function resetMockSourceLanguage(): void {
    mockSourceLanguage = 'es';
}

/**
 * Mock the autotranslation API route using Playwright's route interception.
 * This replaces the need for an external mock server.
 *
 * Returns a `Disposable` to remove the mock routes. Use with `await using`
 * for automatic cleanup or call `.dispose()` manually:
 *
 * ```ts
 * await using mock = await mockAutotranslationRoute(page);
 * ```
 *
 * @param page - Playwright Page object
 * @param options - Optional configuration
 * @param options.sourceLanguage - Initial detected source language (default: 'es')
 * @param options.supportedLanguages - List of supported target languages (default: ['en', 'es', 'fr', 'de'])
 */
export async function mockAutotranslationRoute(
    page: Page,
    options?: {
        sourceLanguage?: string;
        supportedLanguages?: string[];
    },
): Promise<Disposable> {
    // Reset mockSourceLanguage to avoid state leakage between tests
    mockSourceLanguage = options?.sourceLanguage || 'es';

    const supportedLanguages = options?.supportedLanguages || ['en', 'es', 'fr', 'de'];

    // Mock LibreTranslate API endpoint
    // Handles both /translate and /detect endpoints
    const translateRoute = await page.route('**/api/translate', async (route) => {
        const request = route.request();
        const method = request.method();

        if (method === 'POST') {
            let postData: MockTranslateRequest;
            try {
                postData = (await request.postDataJSON()) as MockTranslateRequest;
            } catch {
                // If POST data is not JSON, try to parse as form-encoded data
                const postDataBuffer = request.postData();
                if (!postDataBuffer) {
                    await route.abort('failed');
                    return;
                }
                // Parse form-encoded data (application/x-www-form-urlencoded)
                const formData = new URLSearchParams(postDataBuffer.toString());
                postData = {
                    q: formData.get('q') || undefined,
                    text: formData.get('text') || undefined,
                    source: formData.get('source') || undefined,
                    target: formData.get('target') || undefined,
                };
            }

            const textToTranslate = postData.q || postData.text || '';
            // When source is empty or "auto", detect language from text (simulates real LibreTranslate)
            // Otherwise use the provided source language
            const sourceLanguage =
                postData.source && postData.source !== 'auto'
                    ? postData.source
                    : detectLanguageFromText(textToTranslate);
            const targetLanguage = postData.target || 'en';

            // Validate target language is supported
            if (!supportedLanguages.includes(targetLanguage)) {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: `Target language '${targetLanguage}' is not supported`,
                    }),
                });
                return;
            }

            // Mock response: only "translate" if source differs from target
            let translatedText = textToTranslate;
            const shouldTranslate = sourceLanguage !== targetLanguage;

            if (shouldTranslate) {
                // Prepend language code to simulate translation
                translatedText = `[${targetLanguage}] ${textToTranslate}`;
            }

            const response: MockTranslateResponse = {
                translatedText,
                detectedLanguage: {
                    language: sourceLanguage,
                    confidence: 0.95,
                },
            };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
            });
        } else if (method === 'GET') {
            // Handle GET requests (e.g., /translate?q=hello&source=es&target=en)
            const url = new URL(request.url());
            const textToTranslate = url.searchParams.get('q') || '';
            const sourceParam = url.searchParams.get('source');
            // When source is empty or "auto", detect language from text (simulates real LibreTranslate)
            const sourceLanguage =
                sourceParam && sourceParam !== 'auto' ? sourceParam : detectLanguageFromText(textToTranslate);
            const targetLanguage = url.searchParams.get('target') || 'en';

            if (!supportedLanguages.includes(targetLanguage)) {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: `Target language '${targetLanguage}' is not supported`,
                    }),
                });
                return;
            }

            let translatedText = textToTranslate;
            const shouldTranslate = sourceLanguage !== targetLanguage;

            if (shouldTranslate) {
                translatedText = `[${targetLanguage}] ${textToTranslate}`;
            }

            const response: MockTranslateResponse = {
                translatedText,
                detectedLanguage: {
                    language: sourceLanguage,
                    confidence: 0.95,
                },
            };

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(response),
            });
        } else {
            await route.abort('failed');
        }
    });

    // Mock language detection endpoint (if used separately)
    const detectRoute = await page.route('**/api/detect', async (route) => {
        // Language detection is mocked to always return the configured source language
        // regardless of the input text

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                result: [
                    {
                        language: mockSourceLanguage,
                        confidence: 0.95,
                    },
                ],
                detectedLanguage: {language: mockSourceLanguage, confidence: 0.95},
            }),
        });
    });

    return {
        async dispose() {
            await translateRoute.dispose();
            await detectRoute.dispose();
        },
        async [Symbol.asyncDispose]() {
            await translateRoute.dispose();
            await detectRoute.dispose();
        },
    };
}
