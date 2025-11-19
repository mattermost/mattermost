#!/usr/bin/env ts-node

/**
 * Pull Test Cases from Zephyr
 *
 * Script to pull test cases that need automation from Zephyr.
 * This is a regular script, not an AI agent - much more efficient!
 *
 * Usage:
 *   npm run pull-from-zephyr
 *   npm run pull-from-zephyr -- --priority=P1
 *   npm run pull-from-zephyr -- --folder=Calls
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import {createZephyrAPI, ZephyrTestCase} from '../lib/zephyr-api';
import {validateZephyrConfig} from '../config/zephyr.config';

// Load environment variables from the playwright directory
dotenv.config({path: path.join(__dirname, '../.env')});

interface PullOptions {
    priority?: string;
    folder?: string;
    status?: string;
    outputFormat?: 'json' | 'markdown' | 'console';
}

async function pullTestCases(options: PullOptions = {}) {
    console.log('📥 Pulling test cases from Zephyr...\n');

    // Validate config
    try {
        validateZephyrConfig();
    } catch (error: any) {
        console.error('❌ Configuration error:', error.message);
        process.exit(1);
    }

    const zephyrAPI = createZephyrAPI();

    // Build search query
    const searchQuery: any = {
        projectKey: 'MM',
        automationStatus: 'null', // Not automated
    };

    if (options.priority) {
        searchQuery.priority = options.priority;
    }

    if (options.folder) {
        searchQuery.folder = options.folder;
    }

    try {
        const testCases = await zephyrAPI.searchTestCases(searchQuery);

        console.log(`✅ Found ${testCases.length} test cases needing automation\n`);

        // Output results
        if (options.outputFormat === 'json') {
            outputJSON(testCases);
        } else if (options.outputFormat === 'markdown') {
            outputMarkdown(testCases);
        } else {
            outputConsole(testCases);
        }

        // Save to file for later processing
        const outputDir = path.join(__dirname, '../.cache');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }

        const outputFile = path.join(outputDir, 'zephyr-test-cases.json');
        fs.writeFileSync(outputFile, JSON.stringify(testCases, null, 2));
        console.log(`\n💾 Saved to: ${outputFile}`);

        return testCases;
    } catch (error: any) {
        console.error('❌ Error pulling test cases:', error.message);
        process.exit(1);
    }
}

function outputConsole(testCases: ZephyrTestCase[]) {
    console.log('=== Test Cases Needing Automation ===\n');

    // Group by folder
    const byFolder = groupByFolder(testCases);

    for (const [folder, tests] of Object.entries(byFolder)) {
        console.log(`📁 ${folder} (${tests.length} tests)`);
        tests.forEach(test => {
            console.log(`  - ${test.key}: ${test.name}`);
            console.log(`    Priority: ${test.priority}`);
        });
        console.log('');
    }

    console.log(`\nTotal: ${testCases.length} tests`);
}

function outputJSON(testCases: ZephyrTestCase[]) {
    console.log(JSON.stringify(testCases, null, 2));
}

function outputMarkdown(testCases: ZephyrTestCase[]) {
    console.log('# Test Cases Needing Automation\n');
    console.log(`Total: ${testCases.length} tests\n`);

    const byFolder = groupByFolder(testCases);

    for (const [folder, tests] of Object.entries(byFolder)) {
        console.log(`## ${folder}\n`);
        console.log('| Key | Name | Priority |');
        console.log('|-----|------|----------|');
        tests.forEach(test => {
            console.log(`| ${test.key} | ${test.name} | ${test.priority} |`);
        });
        console.log('');
    }
}

function groupByFolder(testCases: ZephyrTestCase[]): Record<string, ZephyrTestCase[]> {
    const grouped: Record<string, ZephyrTestCase[]> = {};

    testCases.forEach(test => {
        const folder = test.folder || 'Uncategorized';
        if (!grouped[folder]) {
            grouped[folder] = [];
        }
        grouped[folder].push(test);
    });

    return grouped;
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: PullOptions = {};

args.forEach(arg => {
    if (arg.startsWith('--priority=')) {
        options.priority = arg.split('=')[1];
    } else if (arg.startsWith('--folder=')) {
        options.folder = arg.split('=')[1];
    } else if (arg.startsWith('--format=')) {
        options.outputFormat = arg.split('=')[1] as 'json' | 'markdown' | 'console';
    }
});

// Run the script
pullTestCases(options);
