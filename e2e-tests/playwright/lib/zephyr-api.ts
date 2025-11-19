// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Zephyr API Wrapper
 *
 * Provides methods to interact with Zephyr test management system via API.
 */

import {zephyrConfig, zephyrCustomFields} from '../config/zephyr.config';

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
                self: `https://api.zephyrscale.smartbear.com/v2/statuses/${activeStatusId}`
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
        steps: Array<{description: string; expectedResult: string}>
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
     * Make HTTP request to Zephyr API
     * @param url - API endpoint URL
     * @param method - HTTP method
     * @param body - Request body
     * @returns Response data
     */
    private async makeRequest(url: string, method: string, body?: any): Promise<any> {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
                    throw new Error(
                        `Zephyr API error (${response.status}): ${errorText}`
                    );
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
                    await new Promise(resolve => setTimeout(resolve, delay));
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
