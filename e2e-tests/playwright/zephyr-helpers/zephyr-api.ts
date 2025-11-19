// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Zephyr API Wrapper
 *
 * Provides methods to interact with Zephyr test management system via API.
 */

import {zephyrConfig, zephyrCustomFields} from './zephyr.config';

export interface ZephyrTestCase {
    key: string;
    name: string;
    priority: string;
    status: string;
    folder: string;
    customFields?: Record<string, any>;
    testScript?: {
        type: string;
        steps: ZephyrTestStep[];
    };
}

export interface ZephyrTestStep {
    index: number;
    description: string;
    expectedResult: string;
}

export interface ZephyrSearchQuery {
    projectKey: string;
    query?: string;
    folder?: string;
    priority?: string;
    automationStatus?: string;
}

export class ZephyrAPI {
    private baseUrl: string;
    private apiToken: string;
    private projectKey: string;

    constructor() {
        const config = zephyrConfig();
        this.baseUrl = config.baseUrl;
        this.apiToken = config.apiToken;
        this.projectKey = config.projectKey;
    }

    /**
     * Get a single test case by key
     * @param testCaseKey - Test case key (e.g., MM-T5382)
     * @returns Test case data
     */
    async getTestCase(testCaseKey: string): Promise<ZephyrTestCase> {
        // Zephyr Scale Cloud API v2 endpoint
        const url = `${this.baseUrl}/testcases/${testCaseKey}`;

        const response = await this.makeRequest(url, 'GET');

        // Also get test steps
        const testScript = await this.getTestSteps(testCaseKey);

        return {
            key: response.key,
            name: response.name,
            priority: response.priority?.name || 'Normal',
            status: response.status?.name || 'Draft',
            folder: response.folder?.name || 'Root',
            customFields: response.customFields,
            testScript,
        };
    }

    /**
     * Get test steps for a test case
     * @param testCaseKey - Test case key
     * @returns Test steps
     */
    async getTestSteps(testCaseKey: string): Promise<{type: string; steps: ZephyrTestStep[]}> {
        // Zephyr Scale Cloud API v2 - test steps are included in the test case endpoint
        const url = `${this.baseUrl}/testcases/${testCaseKey}/teststeps`;

        try {
            const response = await this.makeRequest(url, 'GET');
            // Response is an array of test steps
            const steps = response.values || response || [];
            return {
                type: 'STEP_BY_STEP',
                steps: steps.map((step: any, index: number) => ({
                    index: step.index || index + 1,
                    description: step.description || '',
                    expectedResult: step.expectedResult || '',
                })),
            };
        } catch (error) {
            // If test script doesn't exist, return empty
            return {type: 'STEP_BY_STEP', steps: []};
        }
    }

    /**
     * Search for test cases
     * @param query - Search query parameters
     * @returns Array of test cases
     */
    async searchTestCases(query: ZephyrSearchQuery): Promise<ZephyrTestCase[]> {
        // Zephyr Scale Cloud API v2 uses query parameters instead of POST body
        const params = new URLSearchParams({
            projectKey: query.projectKey,
            maxResults: zephyrConfig().defaultPageSize.toString(),
        });

        if (query.folder) {
            params.append('folderName', query.folder);
        }

        if (query.priority) {
            params.append('priority', query.priority);
        }

        // Note: Custom field filtering may need to be done client-side
        // as Zephyr Scale API v2 doesn't support custom field queries directly

        const url = `${this.baseUrl}/testcases?${params.toString()}`;
        const response = await this.makeRequest(url, 'GET');

        // Map response to our interface
        const testCases = (response.values || []).map((tc: any) => ({
            key: tc.key,
            name: tc.name,
            priority: tc.priority?.name || 'Normal',
            status: tc.status?.name || 'Draft',
            folder: tc.folder?.name || 'Root',
            customFields: tc.customFields,
        }));

        // Filter by automation status if specified (client-side)
        if (query.automationStatus !== undefined) {
            const playwrightField = zephyrCustomFields.playwright;
            return testCases.filter((tc: any) => {
                const fieldValue = tc.customFields?.[playwrightField];
                if (query.automationStatus === 'null' || query.automationStatus === '') {
                    return !fieldValue;
                }
                return fieldValue === query.automationStatus;
            });
        }

        return testCases;
    }

    /**
     * Update test case custom fields
     * @param testCaseKey - Test case key
     * @param customFields - Custom fields to update
     */
    async updateCustomFields(testCaseKey: string, customFields: Record<string, any>): Promise<void> {
        // Zephyr Scale Cloud API v2 endpoint - need to fetch existing test case first
        const getUrl = `${this.baseUrl}/testcases/${testCaseKey}`;
        const existingTestCase = await this.makeRequest(getUrl, 'GET');

        // Merge existing custom fields with new ones
        const updatedCustomFields = {
            ...existingTestCase.customFields,
            ...customFields,
        };

        // Update test case with required fields plus updated custom fields
        const updateUrl = `${this.baseUrl}/testcases/${testCaseKey}`;
        const payload: any = {
            projectKey: existingTestCase.project.key,
            name: existingTestCase.name,
            priority: existingTestCase.priority?.name || 'Normal',
            status: existingTestCase.status?.name || 'Draft',
            customFields: updatedCustomFields,
        };

        // Add optional fields only if they exist
        if (existingTestCase.objective) {
            payload.objective = existingTestCase.objective;
        }
        if (existingTestCase.precondition) {
            payload.precondition = existingTestCase.precondition;
        }
        if (existingTestCase.labels && existingTestCase.labels.length > 0) {
            payload.labels = existingTestCase.labels;
        }
        if (existingTestCase.folder?.id) {
            payload.folderId = existingTestCase.folder.id;
        }

        await this.makeRequest(updateUrl, 'PUT', payload);
    }

    /**
     * Mark test case as automated
     * @param testCaseKey - Test case key
     * @param e2eFilePath - Path to E2E test file
     */
    async markAsAutomated(testCaseKey: string, e2eFilePath: string): Promise<void> {
        // Fetch existing test case first
        const getUrl = `${this.baseUrl}/testcases/${testCaseKey}`;
        const existingTestCase = await this.makeRequest(getUrl, 'GET');

        // Prepare custom fields - keep all existing custom fields as-is
        // Don't try to modify custom fields as they have complex validation rules
        const customFields: Record<string, any> = {
            ...existingTestCase.customFields,
        };

        // Prepare labels - add 'playwright-automated' if not already present
        const existingLabels = existingTestCase.labels || [];
        const labels = existingLabels.includes('playwright-automated')
            ? existingLabels
            : [...existingLabels, 'playwright-automated'];

        // Update test case with Active status, labels, and custom fields
        // The API requires objects for status, priority, and project (not just names)
        // Active status ID is 890281 (discovered from MM-T5928 which already has it)
        const activeStatusId = 890281;

        const updateUrl = `${this.baseUrl}/testcases/${testCaseKey}`;
        const payload: any = {
            key: existingTestCase.key,
            id: existingTestCase.id,
            project: existingTestCase.project,
            name: existingTestCase.name,
            status: {
                id: activeStatusId,
                self: `https://api.zephyrscale.smartbear.com/v2/statuses/${activeStatusId}`,
            },
            priority: existingTestCase.priority,
            labels,
            customFields, // Must include ALL custom fields when updating
        };

        // Add optional fields only if they exist
        if (existingTestCase.objective) {
            payload.objective = existingTestCase.objective;
        }
        if (existingTestCase.precondition) {
            payload.precondition = existingTestCase.precondition;
        }
        if (existingTestCase.folder) {
            payload.folder = existingTestCase.folder;
        }

        await this.makeRequest(updateUrl, 'PUT', payload);
    }

    /**
     * Add comment to test case
     * @param testCaseKey - Test case key
     * @param comment - Comment text
     */
    async addComment(testCaseKey: string, comment: string): Promise<void> {
        // Zephyr Scale Cloud API v2 - comments endpoint
        const url = `${this.baseUrl}/testcases/${testCaseKey}/links/issues`;

        // Note: Zephyr Scale API v2 doesn't have a direct comment endpoint
        // We'll need to use Jira API or skip this for now
        // For now, we'll silently skip adding comments
        console.log(`Comment functionality not yet implemented for Zephyr Scale Cloud API v2`);
        console.log(`Would add comment to ${testCaseKey}: ${comment}`);
    }

    /**
     * Create a new test case in Zephyr
     * @param testCase - Test case data
     * @returns Created test case with key and ID
     */
    async createTestCase(testCase: {
        name: string;
        objective: string;
        steps: Array<{description: string; expectedResult: string}>;
        folder?: string;
        priority?: string;
        labels?: string[];
    }): Promise<{key: string; id: number}> {
        const url = `${this.baseUrl}/testcases`;

        const body: any = {
            projectKey: this.projectKey,
            name: testCase.name,
            objective: testCase.objective,
            priority: testCase.priority || 'Normal',
            status: 'Draft',
            labels: testCase.labels || ['automated', 'e2e'],
        };

        // Add folder if specified
        if (testCase.folder) {
            body.folderId = testCase.folder;
        }

        const response = await this.makeRequest(url, 'POST', body);

        // Now add test steps if provided
        if (testCase.steps && testCase.steps.length > 0) {
            await this.createTestSteps(response.key, testCase.steps);
        }

        return {
            key: response.key,
            id: response.id,
        };
    }

    /**
     * Create test steps for a test case
     * @param testCaseKey - Test case key
     * @param steps - Test steps to create
     */
    async createTestSteps(
        testCaseKey: string,
        steps: Array<{description: string; expectedResult: string}>,
    ): Promise<void> {
        const url = `${this.baseUrl}/testcases/${testCaseKey}/teststeps`;

        // Create all steps in one call using OVERWRITE mode
        const testSteps = steps.map((step, index) => ({
            index: index + 1,
            inline: {
                description: step.description,
                expectedResult: step.expectedResult,
            },
        }));

        await this.makeRequest(url, 'POST', {
            mode: 'OVERWRITE',
            items: testSteps,
        });
    }

    /**
     * Create test case from existing E2E test file
     * REVERSE WORKFLOW: E2E test → Zephyr test case
     *
     * @param parsedTest - Parsed E2E test metadata
     * @param options - Creation options
     * @returns Created test case with key and ID
     */
    async createTestCaseFromE2EFile(
        parsedTest: {
            testName: string;
            objective: string;
            precondition?: string;
            steps: Array<{description: string; expectedResult: string}>;
            priority: string;
            tags: string[];
            filePath: string;
        },
        options?: {
            folderId?: string;
            setActiveStatus?: boolean;
        },
    ): Promise<{key: string; id: number}> {
        console.log(`\nCreating Zephyr test case from E2E test: ${parsedTest.testName}`);

        const url = `${this.baseUrl}/testcases`;

        // Prepare labels - include 'playwright-automated' since test already exists
        const labels = [...new Set([...parsedTest.tags, 'playwright-automated'])];

        // Determine status - Active if test exists and passes, Draft otherwise
        const status = options?.setActiveStatus ? 'Active' : 'Draft';

        const body: any = {
            projectKey: this.projectKey,
            name: parsedTest.testName,
            objective: parsedTest.objective,
            priority: parsedTest.priority || 'Normal',
            status,
            labels,
        };

        // Add precondition if present
        if (parsedTest.precondition) {
            body.precondition = parsedTest.precondition;
        }

        // Add folder if specified
        if (options?.folderId) {
            body.folderId = options.folderId;
        }

        const response = await this.makeRequest(url, 'POST', body);

        console.log(`✅ Created test case: ${response.key}`);

        // Now add test steps if provided
        if (parsedTest.steps && parsedTest.steps.length > 0) {
            console.log(`   Adding ${parsedTest.steps.length} test steps...`);
            await this.createTestSteps(response.key, parsedTest.steps);
        }

        // If setting active status, update with Active status ID
        if (options?.setActiveStatus) {
            console.log(`   Setting status to Active...`);
            await this.markAsAutomated(response.key, parsedTest.filePath);
        }

        return {
            key: response.key,
            id: response.id,
        };
    }

    /**
     * Update E2E test file with Zephyr key
     * Adds @zephyr JSDoc tag to the test and updates test name with key
     *
     * @param filePath - Path to E2E test file
     * @param testName - Test name to update
     * @param zephyrKey - Zephyr test case key (e.g., MM-T1234)
     */
    async updateE2EFileWithZephyrKey(filePath: string, testName: string, zephyrKey: string): Promise<void> {
        const fs = await import('fs');
        let content = fs.readFileSync(filePath, 'utf-8');

        // Find the test function - need to capture the quote type and full test declaration
        const testPattern = new RegExp(
            `(\/\\*\\*[\\s\\S]*?\\*\/\\s*)?test(?:\\.(?:skip|only))?\\s*\\(\\s*(['"\`])(${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\2`,
            'g',
        );

        const match = testPattern.exec(content);
        if (!match) {
            console.warn(`⚠️  Could not find test "${testName}" in ${filePath}`);
            return;
        }

        const jsdoc = match[1];
        const quoteChar = match[2];
        const originalTestName = match[3];

        // Check if test name already has Zephyr key
        if (originalTestName.startsWith(zephyrKey)) {
            console.log(`   Test name already has ${zephyrKey} prefix, skipping update`);
            return;
        }

        // Update test name to include Zephyr key
        const updatedTestName = `${zephyrKey} ${originalTestName}`;
        const testNamePattern = new RegExp(
            `(test(?:\\.(?:skip|only))?\\s*\\(\\s*${quoteChar})${originalTestName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(${quoteChar})`,
            'g',
        );
        content = content.replace(testNamePattern, `$1${updatedTestName}$2`);

        // Check if JSDoc exists and add @zephyr tag
        if (jsdoc) {
            // JSDoc exists - check if @zephyr already present
            if (jsdoc.includes('@zephyr')) {
                console.log(`   Test already has @zephyr tag`);
            } else {
                // Add @zephyr tag before closing */
                const updatedJSDoc = jsdoc.replace(/\*\//, ` * @zephyr ${zephyrKey}\n */`);
                content = content.replace(jsdoc, updatedJSDoc);
            }
        } else {
            // No JSDoc - create one with @zephyr tag
            const newJsdoc = `/**\n * @zephyr ${zephyrKey}\n */\n`;
            const testStart = match.index;
            content = content.substring(0, testStart) + newJsdoc + content.substring(testStart);
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`   ✅ Updated ${filePath} with @zephyr ${zephyrKey} and test name`);
    }

    /**
     * Make HTTP request to Zephyr API
     * @param url - API endpoint URL
     * @param method - HTTP method
     * @param body - Request body
     * @returns Response data
     */
    private async makeRequest(url: string, method: string, body?: any): Promise<any> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        let lastError: Error | null = null;
        const config = zephyrConfig();

        // Retry logic
        for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, options);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Zephyr API error (${response.status}): ${errorText}`);
                }

                // Handle empty responses
                const text = await response.text();
                return text ? JSON.parse(text) : {};
            } catch (error) {
                lastError = error as Error;

                // Don't retry on 404 (not found)
                if (error instanceof Error && error.message.includes('404')) {
                    throw error;
                }

                // Wait before retry (exponential backoff)
                if (attempt < config.retryAttempts) {
                    const delay = config.retryDelay * attempt;
                    console.log(`Retry attempt ${attempt}/${config.retryAttempts} after ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError || new Error('Request failed after retries');
    }
}

/**
 * Create Zephyr API instance
 */
export function createZephyrAPI(): ZephyrAPI {
    return new ZephyrAPI();
}
