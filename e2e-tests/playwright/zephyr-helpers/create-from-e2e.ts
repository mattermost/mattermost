#!/usr/bin/env ts-node

/**
 * Create Zephyr test case from existing E2E test file
 *
 * Usage:
 *   npx ts-node zephyr-helpers/create-from-e2e.ts <file-path>
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {ZephyrAPI} from './zephyr-api';

// Load environment variables
dotenv.config({path: path.join(__dirname, '../.env')});

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: npx ts-node zephyr-helpers/create-from-e2e.ts <file-path>');
        console.error('Example: npx ts-node zephyr-helpers/create-from-e2e.ts specs/functional/ai-assisted/system_console/user_management/update_user_email.spec.ts');
        process.exit(1);
    }

    const filePath = args[0];
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`\n📄 Reading E2E test file: ${filePath}\n`);

    const content = fs.readFileSync(fullPath, 'utf-8');

    // Extract metadata from the test file
    const objectiveMatch = content.match(/@objective\s+(.+)/);
    const objective = objectiveMatch ? objectiveMatch[1].trim() : 'Test objective';

    // Extract test steps
    const stepsMatch = content.match(/@test_steps\n([\s\S]*?)\s\*\//);
    const stepsText = stepsMatch ? stepsMatch[1] : '';
    const steps = stepsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^\*\s+\d+\./.test(line))
        .map((line) => line.replace(/^\*\s+\d+\.\s*/, ''))
        .map((desc) => ({
            description: desc,
            expectedResult: 'Step completes successfully'
        }));

    // Extract test name from test() call
    const testMatch = content.match(/test\(['"]([^'"]+)['"]/);
    const testName = testMatch ? testMatch[1] : 'Test';

    // Extract tags
    const tagMatch = content.match(/tag:\s*['"]([^'"]+)['"]/);
    const tags = tagMatch ? [tagMatch[1]] : ['@functional'];

    const parsedTest = {
        testName,
        objective,
        steps,
        priority: 'High',
        tags,
        filePath
    };

    console.log('Test Details:');
    console.log('  Name:', testName);
    console.log('  Objective:', objective);
    console.log('  Steps:', steps.length);
    console.log('  Tags:', tags.join(', '));
    console.log('');

    console.log('📤 Creating Zephyr test case...\n');

    try {
        const zephyrAPI = new ZephyrAPI();

        // Use folder ID 28243013 - "AI Assisted Test"
        const result = await zephyrAPI.createTestCaseFromE2EFile(parsedTest, {
            folderId: '28243013',
            setActiveStatus: true
        });

        console.log('');
        console.log('✅ Zephyr test case created successfully!');
        console.log(`   Key: ${result.key}`);
        console.log(`   ID: ${result.id}`);
        console.log('');

        // Now update the E2E test file with @zephyr tag and key
        console.log('📝 Updating E2E test file with Zephyr key...\n');
        await zephyrAPI.updateE2EFileWithZephyrKey(filePath, testName, result.key);

        console.log('✅ Complete! E2E test now linked to Zephyr test case');
        console.log(`   Zephyr: ${result.key}`);
        console.log(`   File: ${filePath}`);
        console.log('');
    } catch (error: any) {
        console.error('❌ Failed to create test case:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}
