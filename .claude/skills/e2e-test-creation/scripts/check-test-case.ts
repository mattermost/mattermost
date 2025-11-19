#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import * as path from 'path';
import {createZephyrAPI} from '../lib/zephyr-api';

dotenv.config({path: path.join(__dirname, '../.env')});

const testKey = process.argv[2] || 'MM-T5382';

async function checkTestCase() {
    const api = createZephyrAPI();
    const tc = await api.getTestCase(testKey);

    console.log('Test Case:', tc.key);
    console.log('Name:', tc.name);
    console.log('Folder:', tc.folder);
    console.log('Priority:', tc.priority);
    console.log('Status:', tc.status);
    console.log('\nCustom Fields:');
    console.log(JSON.stringify(tc.customFields, null, 2));
}

checkTestCase().catch(console.error);
