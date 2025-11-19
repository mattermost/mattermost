#!/usr/bin/env ts-node

/**
 * Update Zephyr Test Cases with Automation Metadata
 *
 * This script updates Zephyr test cases with automation status and file paths
 * after the E2E tests have been generated.
 *
 * Usage:
 *   npx ts-node scripts/update-zephyr-automation.ts <test-key> <file-path> [<test-key> <file-path> ...]
 *
 * Example:
 *   npx ts-node scripts/update-zephyr-automation.ts MM-T5927 specs/functional/system_console/enable_content_flagging.spec.ts MM-T5928 specs/functional/system_console/configure_flagging_settings.spec.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {createZephyrAPI} from '@mattermost/playwright-lib/zephyr-api';
import {validateZephyrConfig} from './zephyr.config';

// Load environment variables
dotenv.config({path: path.join(__dirname, '../.env')});

interface UpdateItem {
    testKey: string;
    filePath: string;
}

/**
 * Main workflow
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.length % 2 !== 0) {
        console.error(
            'Usage: npx ts-node scripts/update-zephyr-automation.ts <test-key> <file-path> [<test-key> <file-path> ...]',
        );
        console.error('');
        console.error('Example:');
        console.error(
            '  npx ts-node scripts/update-zephyr-automation.ts MM-T5927 specs/functional/system_console/enable_content_flagging.spec.ts MM-T5928 specs/functional/system_console/configure_flagging_settings.spec.ts',
        );
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('📝 Updating Zephyr Test Cases with Automation Metadata');
    console.log('='.repeat(60));
    console.log('');

    // Step 1: Validate configuration
    console.log('Step 1: Validating Zephyr configuration...');
    try {
        validateZephyrConfig();
        console.log('✅ Configuration valid\n');
    } catch (error: any) {
        console.error('❌ Configuration error:', error.message);
        console.error('Please ensure .env file has ZEPHYR_BASE_URL and ZEPHYR_TOKEN');
        process.exit(1);
    }

    // Step 2: Create API client
    console.log('Step 2: Creating Zephyr API client...');
    const zephyrAPI = createZephyrAPI();
    console.log('✅ API client created\n');

    // Step 3: Parse arguments into update items
    console.log('Step 3: Parsing arguments...');
    const updateItems: UpdateItem[] = [];
    for (let i = 0; i < args.length; i += 2) {
        const testKey = args[i];
        const filePath = args[i + 1];

        if (!testKey.match(/^MM-T\d+$/)) {
            console.error(`⚠️  Invalid test key format: ${testKey} (expected MM-TXXXX)`);
            continue;
        }

        updateItems.push({testKey, filePath});
        console.log(`✅ Will update ${testKey} → ${filePath}`);
    }

    console.log(`\nTotal updates: ${updateItems.length}\n`);

    if (updateItems.length === 0) {
        console.error('❌ No valid update items found');
        process.exit(1);
    }

    // Step 4: Update each test case
    console.log('Step 4: Updating test cases in Zephyr...\n');

    for (const item of updateItems) {
        try {
            console.log(`Updating ${item.testKey}...`);
            await zephyrAPI.markAsAutomated(item.testKey, item.filePath);
            console.log(`✅ Updated ${item.testKey} with automation metadata`);
            console.log(`   File: ${item.filePath}`);
            console.log('');
        } catch (error: any) {
            console.error(`❌ Failed to update ${item.testKey}:`, error.message);
            console.log('');
        }
    }

    console.log('='.repeat(60));
    console.log('✅ Zephyr Update Complete');
    console.log('='.repeat(60));
    console.log('');

    console.log('Next Steps:');
    console.log('1. View updated test cases in Zephyr');
    console.log('2. Run the E2E tests to verify automation');
    console.log('3. Update test execution results in Zephyr');
    console.log('');
}

// Run main
if (require.main === module) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export {main as updateZephyrAutomation};
