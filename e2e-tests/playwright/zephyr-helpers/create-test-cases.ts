#!/usr/bin/env ts-node

/**
 * Create Test Cases in Zephyr from Skeleton Files
 *
 * This script reads skeleton test files, creates test cases in Zephyr,
 * and returns the mapping of placeholder keys to actual Zephyr keys.
 *
 * Usage:
 *   npx ts-node scripts/create-test-cases.ts <skeleton-file-1> <skeleton-file-2> ...
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {createZephyrAPI} from './zephyr-api';
import {validateZephyrConfig} from './zephyr.config';

// Load environment variables
dotenv.config({path: path.join(__dirname, '../.env')});

interface SkeletonMetadata {
    filePath: string;
    testName: string;
    objective: string;
    steps: string[];
    category: string;
}

interface KeyMapping {
    placeholder: string;
    actualKey: string;
    testName: string;
    filePath: string;
}

/**
 * Extract test metadata from skeleton file
 */
function extractMetadataFromFile(filePath: string): SkeletonMetadata | null {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract objective
    const objectiveMatch = content.match(/@objective\s+(.+)/);
    const objective = objectiveMatch ? objectiveMatch[1].trim() : '';

    // Extract test name from test() call
    const testMatch = content.match(/test\('MM-TXXX\s+(.+?)'/);
    if (!testMatch) {
        console.error(`Could not extract test name from ${filePath}`);
        return null;
    }

    const testName = testMatch[1];

    // Extract test steps
    const stepsMatch = content.match(/@test steps\n([\s\S]*?)\s\*\//);
    const stepsText = stepsMatch ? stepsMatch[1] : '';
    const steps = stepsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^\*\s+\d+\./.test(line))
        .map((line) => line.replace(/^\*\s+\d+\.\s*/, ''));

    // Infer category from file path
    const category = filePath.includes('/system_console/')
        ? 'system_console'
        : filePath.includes('/channels/')
          ? 'channels'
          : filePath.includes('/messaging/')
            ? 'messaging'
            : filePath.includes('/auth/')
              ? 'auth'
              : 'functional';

    return {
        filePath,
        testName,
        objective,
        steps,
        category,
    };
}

/**
 * Create test case in Zephyr
 */
async function createTestCaseInZephyr(
    zephyrAPI: any,
    metadata: SkeletonMetadata,
    folderId?: string,
): Promise<{key: string; id: number}> {
    console.log(`\nCreating test case: ${metadata.testName}`);
    console.log(`Objective: ${metadata.objective}`);
    console.log(`Steps: ${metadata.steps.length}`);

    const testSteps = metadata.steps.map((step, index) => ({
        description: step,
        expectedResult: `Step ${index + 1} completes successfully`,
    }));

    const result = await zephyrAPI.createTestCase({
        name: metadata.testName,
        objective: metadata.objective,
        steps: testSteps,
        folder: folderId,
        priority: 'Normal',
        labels: ['automated', 'e2e', metadata.category],
    });

    console.log(`✅ Created: ${result.key}`);
    return result;
}

/**
 * Main workflow
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: npx ts-node scripts/create-test-cases.ts <file1> <file2> ...');
        process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('📤 Creating Test Cases in Zephyr');
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

    // Step 3: Extract metadata from skeleton files
    console.log('Step 3: Extracting metadata from skeleton files...');
    const metadataList: SkeletonMetadata[] = [];

    for (const filePath of args) {
        const fullPath = path.resolve(filePath);
        if (!fs.existsSync(fullPath)) {
            console.error(`⚠️  File not found: ${filePath}`);
            continue;
        }

        const metadata = extractMetadataFromFile(fullPath);
        if (metadata) {
            metadataList.push(metadata);
            console.log(`✅ Extracted: ${metadata.testName}`);
        }
    }

    console.log(`\nTotal tests to create: ${metadataList.length}\n`);

    if (metadataList.length === 0) {
        console.error('❌ No valid skeleton files found');
        process.exit(1);
    }

    // Step 4: Create test cases in Zephyr
    console.log('Step 4: Creating test cases in Zephyr...');
    const keyMappings: KeyMapping[] = [];
    // Use folder ID 28243013 - "AI Assisted Test"
    const folderId = '28243013';

    for (const metadata of metadataList) {
        try {
            const result = await createTestCaseInZephyr(zephyrAPI, metadata, folderId);

            keyMappings.push({
                placeholder: 'MM-TXXX',
                actualKey: result.key,
                testName: metadata.testName,
                filePath: metadata.filePath,
            });
        } catch (error: any) {
            console.error(`❌ Failed to create test case for ${metadata.testName}:`, error.message);
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Test Case Creation Complete');
    console.log('='.repeat(60));
    console.log('');

    // Step 5: Output key mappings
    console.log('Key Mappings:');
    keyMappings.forEach((mapping) => {
        console.log(`  ${mapping.placeholder} → ${mapping.actualKey}`);
        console.log(`    File: ${path.basename(mapping.filePath)}`);
        console.log(`    Name: ${mapping.testName}`);
        console.log('');
    });

    // Step 6: Save mappings to file
    const mappingsFile = path.join(__dirname, '.temp-mappings.json');
    fs.writeFileSync(mappingsFile, JSON.stringify(keyMappings, null, 2));
    console.log(`📄 Mappings saved to: ${mappingsFile}`);
    console.log('');

    return keyMappings;
}

// Run main
if (require.main === module) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export {main as createTestCases};
