#!/usr/bin/env ts-node

/**
 * Sync E2E Test to Zephyr (Reverse Workflow)
 *
 * Creates Zephyr test cases from existing E2E test files.
 * This is the REVERSE workflow: E2E test → Zephyr test case
 *
 * Usage:
 *   npx ts-node scripts/sync-e2e-to-zephyr.ts <test-file-path> [--folder-id <id>] [--active] [--dry-run]
 *
 * Examples:
 *   # Create Zephyr test case from existing E2E test
 *   npx ts-node scripts/sync-e2e-to-zephyr.ts specs/functional/channels/threads/threads_list.spec.ts
 *
 *   # Create in specific folder with Active status
 *   npx ts-node scripts/sync-e2e-to-zephyr.ts specs/functional/channels/threads/threads_list.spec.ts --folder-id 28243013 --active
 *
 *   # Dry run (preview only, no actual creation)
 *   npx ts-node scripts/sync-e2e-to-zephyr.ts specs/functional/channels/threads/threads_list.spec.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {createZephyrAPI} from '@mattermost/playwright-lib/zephyr-api';
import {parseE2ETestFile, hasZephyrKey} from '@mattermost/playwright-lib/e2e-test-parser';
import {validateZephyrConfig} from './zephyr.config';

// Load environment variables
dotenv.config({path: path.join(__dirname, '../.env')});

interface SyncResult {
    testName: string;
    filePath: string;
    zephyrKey?: string;
    status: 'created' | 'skipped' | 'error';
    reason?: string;
}

async function main() {
    const args = process.argv.slice(2);

    // Parse arguments
    let testFilePath: string | null = null;
    let folderId: string | undefined;
    let setActiveStatus = false;
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--folder-id' && i + 1 < args.length) {
            folderId = args[++i];
        } else if (arg === '--active') {
            setActiveStatus = true;
        } else if (arg === '--dry-run') {
            dryRun = true;
        } else if (!arg.startsWith('--')) {
            testFilePath = arg;
        }
    }

    if (!testFilePath) {
        console.error(
            'Usage: npx ts-node scripts/sync-e2e-to-zephyr.ts <test-file-path> [--folder-id <id>] [--active] [--dry-run]',
        );
        process.exit(1);
    }

    console.log('='.repeat(70));
    console.log('🔄 Sync E2E Test to Zephyr (Reverse Workflow)');
    console.log('='.repeat(70));
    console.log('');

    // Resolve file path
    const fullPath = path.resolve(testFilePath);

    // Step 1: Validate configuration
    console.log('Step 1: Validating Zephyr configuration...');
    try {
        validateZephyrConfig();
        console.log('✅ Configuration valid\n');
    } catch (error: any) {
        console.error('❌ Configuration error:', error.message);
        console.error('Please ensure .env file has ZEPHYR_TOKEN');
        process.exit(1);
    }

    // Step 2: Parse E2E test file
    console.log('Step 2: Parsing E2E test file...');
    console.log(`   File: ${testFilePath}`);

    let parsedTests;
    try {
        parsedTests = parseE2ETestFile(fullPath);
        console.log(`   ✅ Found ${parsedTests.length} test(s)\n`);
    } catch (error: any) {
        console.error('❌ Failed to parse test file:', error.message);
        process.exit(1);
    }

    if (parsedTests.length === 0) {
        console.error('❌ No tests found in file');
        process.exit(1);
    }

    // Step 3: Display parsed tests
    console.log('Step 3: Parsed Test Details');
    console.log('─'.repeat(70));

    for (const test of parsedTests) {
        console.log(`\n📋 Test: ${test.testName}`);
        console.log(`   Objective: ${test.objective}`);
        if (test.precondition) {
            console.log(`   Precondition: ${test.precondition}`);
        }
        console.log(`   Category: ${test.category}`);
        console.log(`   Priority: ${test.priority}`);
        console.log(`   Tags: ${test.tags.join(', ')}`);
        console.log(`   Steps: ${test.steps.length}`);

        if (test.hasZephyrKey) {
            console.log(`   ⚠️  Already linked to: ${test.hasZephyrKey}`);
        }

        // Show first 3 steps
        if (test.steps.length > 0) {
            console.log('\n   Preview of steps:');
            test.steps.slice(0, 3).forEach((step, index) => {
                console.log(`   ${index + 1}. ${step.description}`);
                console.log(`      → ${step.expectedResult}`);
            });
            if (test.steps.length > 3) {
                console.log(`   ... and ${test.steps.length - 3} more step(s)`);
            }
        }
    }

    console.log('\n' + '─'.repeat(70));
    console.log('');

    // Dry run - stop here
    if (dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
        console.log('');
        console.log('To create these test cases in Zephyr, run without --dry-run flag');
        return;
    }

    // Step 4: Create test cases in Zephyr
    console.log('Step 4: Creating test cases in Zephyr...');

    // Use folder ID from argument or default to "AI Assisted Test"
    const targetFolderId = folderId || '28243013';
    console.log(`   Target folder ID: ${targetFolderId}`);
    console.log(`   Status: ${setActiveStatus ? 'Active' : 'Draft'}`);
    console.log('');

    const zephyrAPI = createZephyrAPI();
    const results: SyncResult[] = [];

    for (const test of parsedTests) {
        try {
            // Skip if already has Zephyr key
            if (test.hasZephyrKey) {
                console.log(`⏭️  Skipping "${test.testName}" - already linked to ${test.hasZephyrKey}\n`);
                results.push({
                    testName: test.testName,
                    filePath: test.filePath,
                    zephyrKey: test.hasZephyrKey,
                    status: 'skipped',
                    reason: `Already linked to ${test.hasZephyrKey}`,
                });
                continue;
            }

            // Create test case
            const result = await zephyrAPI.createTestCaseFromE2EFile(
                {
                    testName: test.testName,
                    objective: test.objective,
                    precondition: test.precondition,
                    steps: test.steps,
                    priority: test.priority,
                    tags: test.tags,
                    filePath: test.filePath,
                },
                {
                    folderId: targetFolderId,
                    setActiveStatus,
                },
            );

            // Update E2E file with @zephyr tag
            console.log('   Updating E2E test file with @zephyr tag...');
            await zephyrAPI.updateE2EFileWithZephyrKey(fullPath, test.testName, result.key);

            console.log(`✅ Successfully created and linked: ${result.key}\n`);

            results.push({
                testName: test.testName,
                filePath: test.filePath,
                zephyrKey: result.key,
                status: 'created',
            });
        } catch (error: any) {
            console.error(`❌ Failed to create test case for "${test.testName}":`, error.message);
            console.error('');

            results.push({
                testName: test.testName,
                filePath: test.filePath,
                status: 'error',
                reason: error.message,
            });
        }
    }

    // Step 5: Summary
    console.log('='.repeat(70));
    console.log('✅ Sync Complete');
    console.log('='.repeat(70));
    console.log('');

    const created = results.filter((r) => r.status === 'created');
    const skipped = results.filter((r) => r.status === 'skipped');
    const errors = results.filter((r) => r.status === 'error');

    console.log('Summary:');
    console.log(`   ✅ Created: ${created.length}`);
    console.log(`   ⏭️  Skipped: ${skipped.length}`);
    console.log(`   ❌ Errors: ${errors.length}`);
    console.log('');

    if (created.length > 0) {
        console.log('Created Test Cases:');
        created.forEach((r) => {
            console.log(`   ${r.zephyrKey} - ${r.testName}`);
        });
        console.log('');
    }

    if (skipped.length > 0) {
        console.log('Skipped Test Cases:');
        skipped.forEach((r) => {
            console.log(`   ${r.testName} - ${r.reason}`);
        });
        console.log('');
    }

    if (errors.length > 0) {
        console.log('Failed Test Cases:');
        errors.forEach((r) => {
            console.log(`   ${r.testName} - ${r.reason}`);
        });
        console.log('');
    }

    console.log('Next Steps:');
    console.log('   1. Review test cases in Zephyr Scale');
    console.log('   2. Verify test steps are accurate');
    console.log('   3. Update test priority/labels if needed');
    console.log('   4. Run E2E tests to ensure they still pass');
    console.log('');
}

// Run main
if (require.main === module) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export {main as syncE2EToZephyr};
