#!/usr/bin/env ts-node

/**
 * Simple CLI to update Zephyr test case status to Active
 *
 * Usage:
 *   npx ts-node zephyr-helpers/update-test-status.ts MM-T3125 specs/functional/path/to/test.spec.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import {ZephyrAPI} from './zephyr-api';

// Load environment variables
dotenv.config({path: path.join(__dirname, '../.env')});

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: npx ts-node zephyr-helpers/update-test-status.ts <TEST-KEY> <FILE-PATH>');
        console.error('Example: npx ts-node zephyr-helpers/update-test-status.ts MM-T3125 specs/functional/channels/test.spec.ts');
        process.exit(1);
    }

    const testKey = args[0];
    const filePath = args[1];

    console.log(`\n📝 Updating ${testKey} to Active status...`);

    try {
        const zephyrAPI = new ZephyrAPI();
        await zephyrAPI.markAsAutomated(testKey, filePath);
        console.log(`✅ Successfully updated ${testKey} to Active`);
        console.log(`   File: ${filePath}\n`);
    } catch (error: any) {
        console.error(`❌ Failed to update ${testKey}:`, error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}
