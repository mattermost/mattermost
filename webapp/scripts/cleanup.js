#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Simple cross-platform file cleanup utility
 * Usage: node scripts/cleanup.js <file1> [file2] [...]
 */

const fs = require('fs');

const files = process.argv.slice(2);

if (files.length === 0) {
    console.error('Usage: node scripts/cleanup.js <file1> [file2] [...]');
    process.exit(1);
}

files.forEach((file) => {
    try {
        fs.unlinkSync(file);
    } catch (error) {
        // Silently ignore if file doesn't exist
        if (error.code !== 'ENOENT') {
            console.error(`Failed to delete ${file}:`, error.message);
        }
    }
});
