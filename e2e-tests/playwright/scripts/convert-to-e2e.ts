#!/usr/bin/env ts-node

/**
 * Convert Manual Test to E2E Test
 *
 * Template-based test generation - NO AI REQUIRED!
 * Much cheaper and faster than using AI agents for every conversion.
 *
 * Usage:
 *   npm run convert-to-e2e MM-T5382
 *   npm run convert-to-e2e -- --batch (converts all from cache)
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {createZephyrAPI, ZephyrTestCase} from '../lib/zephyr-api';

// Load environment variables from the playwright directory
dotenv.config({path: path.join(__dirname, '../.env')});

interface E2ETestTemplate {
    testKey: string;
    testName: string;
    objective: string;
    precondition?: string;
    tag: string;
    setupCode: string;
    testSteps: string;
    filePath: string;
}

async function convertToE2E(testKey: string) {
    console.log(`🔄 Converting ${testKey} to E2E test...\n`);

    // Get test case from Zephyr
    const zephyrAPI = createZephyrAPI();
    const testCase = await zephyrAPI.getTestCase(testKey);

    console.log(`✅ Retrieved: ${testCase.name}\n`);

    // Generate E2E test code
    const template = generateE2ETest(testCase);

    // Create directory if needed
    const dir = path.dirname(template.filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }

    // Write test file
    fs.writeFileSync(template.filePath, generateTestCode(template));

    console.log(`✅ Created: ${template.filePath}\n`);
    console.log(`Next steps:`);
    console.log(`1. Review the generated test`);
    console.log(`2. Run: npx playwright test ${path.basename(template.filePath)}`);
    console.log(`3. Update Zephyr: npm run push-to-zephyr ${testKey}`);

    return template;
}

function generateE2ETest(testCase: ZephyrTestCase): E2ETestTemplate {
    // All AI-assisted tests go to ai-assisted-e2e folder
    const folder = 'ai-assisted-e2e';

    // Determine tag from team ownership or folder
    const teamOwnership = testCase.customFields?.['Team Ownership'];
    const tag = teamOwnership && Array.isArray(teamOwnership) && teamOwnership.length > 0
        ? `@${teamOwnership[0].toLowerCase()}`
        : '@channels';

    const fileName = testCase.key.toLowerCase().replace('mm-t', '') + '_' +
                     testCase.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 50) +
                     '.spec.ts';

    const filePath = path.join(
        __dirname,
        '../specs/functional',
        folder,
        fileName
    );

    // Extract objective from test name
    const objective = `Verify that ${testCase.name.toLowerCase()}`;

    // Determine if precondition is needed based on Team Ownership
    let precondition: string | undefined;
    if (teamOwnership && Array.isArray(teamOwnership)) {
        const team = teamOwnership[0]?.toLowerCase();
        if (team === 'calls') {
            precondition = 'Calls plugin must be enabled and configured';
        } else if (team === 'playbooks') {
            precondition = 'Playbooks plugin must be enabled and configured';
        } else if (team === 'boards') {
            precondition = 'Boards plugin must be enabled and configured';
        }
    }

    // Generate setup code
    const setupCode = generateSetupCode(testCase);

    // Generate test steps from Zephyr steps
    const testSteps = generateTestSteps(testCase);

    return {
        testKey: testCase.key,
        testName: testCase.name,
        objective,
        precondition,
        tag,
        setupCode,
        testSteps,
        filePath,
    };
}

function generateSetupCode(testCase: ZephyrTestCase): string {
    // Basic setup for most tests
    let setup = `    // # Initialize test setup
    const {user, team, channel} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();`;

    // Multi-user detection
    const needsMultiUser = testCase.testScript?.steps.some(step =>
        step.description.toLowerCase().includes('user a') ||
        step.description.toLowerCase().includes('user b') ||
        step.description.toLowerCase().includes('switch user') ||
        step.description.toLowerCase().includes('admin')
    );

    if (needsMultiUser) {
        setup = `    // # Initialize test setup with multiple users
    const {user, adminClient, team, channel} = await pw.initSetup();
    const admin = await adminClient.createUser();

    // # Login as first user
    const {channelsPage: userPage} = await pw.testBrowser.login(user);
    await userPage.goto(channel.name);

    // # Login as second user
    const {channelsPage: adminPage} = await pw.testBrowser2.login(admin);
    await adminPage.goto(channel.name);`;
    }

    return setup;
}

function generateTestSteps(testCase: ZephyrTestCase): string {
    if (!testCase.testScript || testCase.testScript.steps.length === 0) {
        return `    // # Perform test action
    // TODO: Add specific test steps

    // * Verify expected outcome
    // TODO: Add assertions`;
    }

    let code = '';

    testCase.testScript.steps.forEach((step, index) => {
        // Action comment
        code += `\n    // # ${step.description}\n`;
        code += `    // TODO: Implement action\n`;

        // Expected result comment
        if (step.expectedResult) {
            code += `\n    // * ${step.expectedResult}\n`;
            code += `    // TODO: Add assertion\n`;
        }
    });

    return code;
}

function generateTestCode(template: E2ETestTemplate): string {
    const preconditionBlock = template.precondition ?
        `\n * @precondition\n * ${template.precondition}\n` : '';

    return `// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective ${template.objective}${preconditionBlock} */
test('${template.testKey} ${generateTestTitle(template.testName)}', {tag: '${template.tag}'}, async ({pw}) => {
${template.setupCode}

${template.testSteps}
});
`;
}

function generateTestTitle(name: string): string {
    // Convert to action-oriented lowercase title
    return name
        .toLowerCase()
        .replace(/^(test|verify|check)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function mapFolderToTag(folder: string): string {
    const tagMap: Record<string, string> = {
        'calls': '@calls',
        'messaging': '@messaging',
        'channels': '@channels',
        'system console': '@system_console',
        'authentication': '@authentication',
        'notifications': '@notifications',
        'plugins': '@plugins',
    };

    for (const [key, tag] of Object.entries(tagMap)) {
        if (folder.includes(key)) {
            return tag;
        }
    }

    return '@channels';
}

// Main execution
const testKey = process.argv[2];

if (!testKey) {
    console.error('Usage: npm run convert-to-e2e MM-TXXX');
    process.exit(1);
}

convertToE2E(testKey).catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
