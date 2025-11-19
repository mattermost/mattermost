#!/usr/bin/env ts-node

/**
 * Zephyr Integration Pilot Test
 *
 * This script tests the complete workflow for one test case (MM-T5382):
 * 1. Pull test case from Zephyr
 * 2. Display test case details
 * 3. (Manual step: Convert to E2E)
 * 4. Update Zephyr with automation status
 *
 * Usage:
 *   npm run test:zephyr-pilot
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {createZephyrAPI} from '../lib/zephyr-api';
import {validateZephyrConfig} from '../config/zephyr.config';

// Load environment variables from the playwright directory
dotenv.config({path: path.join(__dirname, '../.env')});

const TEST_CASE_KEY = 'MM-T5382'; // Calls feature test

async function runPilotTest() {
    console.log('='.repeat(60));
    console.log('🧪 Zephyr Integration Pilot Test');
    console.log('='.repeat(60));
    console.log('');

    // Step 1: Validate configuration
    console.log('Step 1: Validating Zephyr configuration...');
    console.log('DEBUG: ZEPHYR_BASE_URL =', process.env.ZEPHYR_BASE_URL);
    console.log('DEBUG: ZEPHYR_TOKEN =', process.env.ZEPHYR_TOKEN ? 'SET' : 'NOT SET');
    try {
        validateZephyrConfig();
    } catch (error: any) {
        console.error('❌ Configuration error:', error.message);
        console.error('');
        console.error('Please create a .env file with your Zephyr credentials.');
        console.error('See .env.example for template.');
        process.exit(1);
    }
    console.log('');

    // Step 2: Create API client
    console.log('Step 2: Creating Zephyr API client...');
    const zephyrAPI = createZephyrAPI();
    console.log('✅ API client created');
    console.log('');

    // Step 3: Pull test case from Zephyr
    console.log(`Step 3: Pulling test case ${TEST_CASE_KEY} from Zephyr...`);
    try {
        const testCase = await zephyrAPI.getTestCase(TEST_CASE_KEY);

        console.log('✅ Test case retrieved successfully!');
        console.log('');
        console.log('--- Test Case Details ---');
        console.log(`Key: ${testCase.key}`);
        console.log(`Name: ${testCase.name}`);
        console.log(`Priority: ${testCase.priority}`);
        console.log(`Status: ${testCase.status}`);
        console.log(`Folder: ${testCase.folder}`);
        console.log('');

        // Display test steps
        if (testCase.testScript && testCase.testScript.steps.length > 0) {
            console.log('--- Test Steps ---');
            testCase.testScript.steps.forEach((step, index) => {
                console.log(`\nStep ${step.index}:`);
                console.log(`  Action: ${step.description}`);
                console.log(`  Expected: ${step.expectedResult}`);
            });
            console.log('');
        }

        // Check automation status
        const playwrightStatus = testCase.customFields?.playwright || 'Not Automated';
        console.log(`Automation Status: ${playwrightStatus}`);
        console.log('');

        // Step 4: Demonstrate updating Zephyr (optional)
        console.log('Step 4: Would you like to mark this test as automated?');
        console.log('(This is just a demo - skip for now)');
        console.log('');

        console.log('='.repeat(60));
        console.log('✅ Pilot Test Complete!');
        console.log('='.repeat(60));
        console.log('');
        console.log('Next Steps:');
        console.log('1. Use @manual-converter to generate E2E test from this data');
        console.log('2. Run E2E test to verify it works');
        console.log('3. Use @zephyr-pusher to mark as automated');
        console.log('');

    } catch (error: any) {
        console.error('❌ Error pulling test case:', error.message);
        console.error('');
        console.error('Possible issues:');
        console.error('- Test case MM-T5382 does not exist in Zephyr');
        console.error('- API token does not have read permissions');
        console.error('- Base URL is incorrect');
        console.error('- Network connectivity issues');
        process.exit(1);
    }
}

// Run the pilot test
runPilotTest().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
