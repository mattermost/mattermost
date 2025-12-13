// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E Test Parser
 *
 * Parses existing E2E test files to extract metadata for Zephyr test case creation.
 * Supports reverse workflow: E2E test → Zephyr test case.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ParsedE2ETest {
    filePath: string;
    fileName: string;
    testName: string;
    objective: string;
    precondition?: string;
    steps: ParsedTestStep[];
    category: string;
    tags: string[];
    priority: string;
    hasZephyrKey?: string; // If test already linked to Zephyr
}

export interface ParsedTestStep {
    index: number;
    description: string;
    expectedResult: string;
    type: 'action' | 'verification';
}

/**
 * Parse an E2E test file and extract test metadata
 */
export function parseE2ETestFile(filePath: string): ParsedE2ETest[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    const tests: ParsedE2ETest[] = [];

    // Extract all test blocks
    const testPattern =
        /test(?:\.(?:skip|only))?\s*\(\s*['"`](.+?)['"`]\s*(?:,\s*\{[^}]*tag:\s*['"`]([^'"`]+)['"`][^}]*\})?\s*,\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}\);/g;

    let match;
    while ((match = testPattern.exec(content)) !== null) {
        const testName = match[1];
        const tag = match[2] || '';
        const testBody = match[3];

        // Extract JSDoc comment before the test
        const testStartIndex = match.index;
        const precedingContent = content.substring(0, testStartIndex);
        const jsdocPattern = /\/\*\*\s*([\s\S]*?)\*\//g;
        let jsdocMatch;
        let lastJSDoc = null;

        while ((jsdocMatch = jsdocPattern.exec(precedingContent)) !== null) {
            lastJSDoc = jsdocMatch[1];
        }

        // Extract objective and precondition from JSDoc
        let objective = '';
        let precondition: string | undefined;
        let existingZephyrKey: string | undefined;

        if (lastJSDoc) {
            const objectiveMatch = lastJSDoc.match(/@objective\s+(.+?)(?:\n|$)/);
            if (objectiveMatch) {
                objective = objectiveMatch[1].trim();
            }

            const preconditionMatch = lastJSDoc.match(/@precondition\s+(.+?)(?:\n|$)/);
            if (preconditionMatch) {
                precondition = preconditionMatch[1].trim();
            }

            const zephyrMatch = lastJSDoc.match(/@zephyr\s+(MM-T\d+)/);
            if (zephyrMatch) {
                existingZephyrKey = zephyrMatch[1];
            }
        }

        // If no objective in JSDoc, infer from test name or first comment
        if (!objective) {
            objective = inferObjectiveFromTestName(testName);
        }

        // Parse test steps from test body
        const steps = parseTestSteps(testBody);

        // Determine category from file path
        const category = inferCategory(filePath);

        // Extract tags
        const tags = extractTags(tag, category);

        // Infer priority from file path or test content
        const priority = inferPriority(filePath, testName);

        tests.push({
            filePath,
            fileName,
            testName,
            objective,
            precondition,
            steps,
            category,
            tags,
            priority,
            hasZephyrKey: existingZephyrKey,
        });
    }

    return tests;
}

/**
 * Parse test steps from test body
 */
function parseTestSteps(testBody: string): ParsedTestStep[] {
    const steps: ParsedTestStep[] = [];
    const lines = testBody.split('\n');

    let actionIndex = 0;
    let verificationIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Action step (// #)
        if (line.startsWith('// #')) {
            const description = line.replace('// #', '').trim();
            if (description && !description.startsWith('Log in') && !description.startsWith('Setup')) {
                steps.push({
                    index: steps.length + 1,
                    description: description,
                    expectedResult: '', // Will be filled by next verification or inferred
                    type: 'action',
                });
                actionIndex = steps.length - 1;
            }
        }

        // Verification step (// *)
        if (line.startsWith('// *')) {
            const description = line.replace('// *', '').trim();
            if (description) {
                // If we have a pending action, add this as its expected result
                if (
                    steps.length > 0 &&
                    steps[actionIndex] &&
                    steps[actionIndex].type === 'action' &&
                    !steps[actionIndex].expectedResult
                ) {
                    steps[actionIndex].expectedResult = description;
                } else {
                    // Otherwise, create a new verification step
                    steps.push({
                        index: steps.length + 1,
                        description: 'Verify: ' + description,
                        expectedResult: description,
                        type: 'verification',
                    });
                    verificationIndex = steps.length - 1;
                }
            }
        }
    }

    // For actions without explicit expected results, infer from context
    steps.forEach((step, index) => {
        if (step.type === 'action' && !step.expectedResult) {
            step.expectedResult = inferExpectedResult(step.description);
        }
    });

    // If no steps found, extract from code structure
    if (steps.length === 0) {
        steps.push(...extractStepsFromCode(testBody));
    }

    return steps;
}

/**
 * Extract steps from code structure when comments are minimal
 */
function extractStepsFromCode(testBody: string): ParsedTestStep[] {
    const steps: ParsedTestStep[] = [];
    const lines = testBody.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Extract await statements as steps
        if (trimmed.startsWith('await')) {
            // Skip setup/initialization
            if (trimmed.includes('initSetup') || trimmed.includes('login')) {
                continue;
            }

            // Extract meaningful actions
            let description = '';
            if (trimmed.includes('.click(')) {
                description = 'Click ' + extractSelector(trimmed);
            } else if (trimmed.includes('.fill(') || trimmed.includes('.type(')) {
                description = 'Enter text in ' + extractSelector(trimmed);
            } else if (trimmed.includes('.goto(')) {
                description = 'Navigate to page';
            } else if (trimmed.includes('.press(')) {
                const keyMatch = trimmed.match(/press\(['"`](.+?)['"`]\)/);
                if (keyMatch) {
                    description = `Press ${keyMatch[1]} key`;
                }
            } else if (trimmed.includes('postMessage')) {
                description = 'Post a message';
            } else if (trimmed.includes('openAThread')) {
                description = 'Open thread';
            }

            if (description) {
                steps.push({
                    index: steps.length + 1,
                    description,
                    expectedResult: inferExpectedResult(description),
                    type: 'action',
                });
            }
        }

        // Extract expect statements as verifications
        if (trimmed.includes('expect(')) {
            let description = '';
            if (trimmed.includes('.toBeVisible()')) {
                description = 'Element is visible';
            } else if (trimmed.includes('.toContainText(')) {
                const textMatch = trimmed.match(/toContainText\(['"`](.+?)['"`]\)/);
                if (textMatch) {
                    description = `Text "${textMatch[1]}" is displayed`;
                }
            } else if (trimmed.includes('.toHaveCount(')) {
                description = 'Correct number of elements displayed';
            }

            if (description && steps.length > 0) {
                // Add as expected result to previous step
                steps[steps.length - 1].expectedResult = description;
            }
        }
    }

    return steps;
}

/**
 * Extract selector from code line
 */
function extractSelector(line: string): string {
    const dataTestIdMatch = line.match(/data-testid=['"](.+?)['"]/);
    if (dataTestIdMatch) {
        return dataTestIdMatch[1].replace(/-/g, ' ');
    }

    const ariaLabelMatch = line.match(/aria-label=['"](.+?)['"]/);
    if (ariaLabelMatch) {
        return ariaLabelMatch[1];
    }

    return 'element';
}

/**
 * Infer objective from test name
 */
function inferObjectiveFromTestName(testName: string): string {
    // Convert test name to objective
    // "Should be able to change threads with arrow keys" → "Verify user can navigate threads using keyboard arrow keys"

    if (testName.toLowerCase().startsWith('should')) {
        return 'Verify that ' + testName.substring(7).trim();
    }

    return 'Verify: ' + testName;
}

/**
 * Infer expected result from action description
 */
function inferExpectedResult(action: string): string {
    if (action.toLowerCase().includes('click')) {
        return 'Action completes successfully and UI updates accordingly';
    }
    if (action.toLowerCase().includes('enter') || action.toLowerCase().includes('type')) {
        return 'Text is entered correctly';
    }
    if (action.toLowerCase().includes('navigate')) {
        return 'Page loads successfully';
    }
    if (action.toLowerCase().includes('press')) {
        return 'Keyboard action is processed correctly';
    }

    return 'Step completes successfully';
}

/**
 * Infer category from file path
 */
function inferCategory(filePath: string): string {
    if (filePath.includes('/system_console/')) {
        return 'system_console';
    }
    if (filePath.includes('/channels/')) {
        return 'channels';
    }
    if (filePath.includes('/messaging/')) {
        return 'messaging';
    }
    if (filePath.includes('/auth/')) {
        return 'authentication';
    }
    if (filePath.includes('/threads/')) {
        return 'threads';
    }
    if (filePath.includes('/playbooks/')) {
        return 'playbooks';
    }
    if (filePath.includes('/integrations/')) {
        return 'integrations';
    }

    return 'functional';
}

/**
 * Extract tags from tag string and category
 */
function extractTags(tagString: string, category: string): string[] {
    const tags = ['playwright-automated', 'e2e'];

    if (tagString) {
        // Remove @ prefix if present
        const cleanTag = tagString.replace(/^@/, '');
        tags.push(cleanTag);
    }

    // Add category tag
    if (category && !tags.includes(category)) {
        tags.push(category);
    }

    return tags;
}

/**
 * Infer priority from file path or test name
 */
function inferPriority(filePath: string, testName: string): string {
    // Check if path or name indicates priority
    if (filePath.includes('/critical/') || testName.toLowerCase().includes('critical')) {
        return 'High';
    }

    if (filePath.includes('/smoke/') || testName.toLowerCase().includes('smoke')) {
        return 'High';
    }

    return 'Normal';
}

/**
 * Check if test already has Zephyr key
 */
export function hasZephyrKey(filePath: string): string | null {
    const content = fs.readFileSync(filePath, 'utf-8');
    const zephyrMatch = content.match(/@zephyr\s+(MM-T\d+)/);
    return zephyrMatch ? zephyrMatch[1] : null;
}

/**
 * Parse multiple test files
 */
export function parseMultipleE2ETestFiles(filePaths: string[]): ParsedE2ETest[] {
    const allTests: ParsedE2ETest[] = [];

    for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️  File not found: ${filePath}`);
            continue;
        }

        try {
            const tests = parseE2ETestFile(filePath);
            allTests.push(...tests);
        } catch (error: any) {
            console.error(`❌ Failed to parse ${filePath}:`, error.message);
        }
    }

    return allTests;
}
