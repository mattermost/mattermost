#!/usr/bin/env node
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * This script helps reconcile conflicts between en.json and defaultMessage values in code.
 *
 * When formatjs extraction finds duplicate IDs with different defaultMessages, this script
 * analyzes the differences to help determine which version is correct.
 *
 * It checks for:
 * 1. Spelling corrections
 * 2. Placeholder consistency (e.g., {value} in message matches expected placeholders)
 * 3. Grammatical improvements
 * 4. Completeness (added/removed content)
 *
 * Usage:
 *   node scripts/i18n-reconcile-conflicts.js
 *
 * This will:
 * - Extract messages to a temporary file
 * - Compare with existing en.json
 * - Show conflicts with analysis
 * - Generate a report of which version to keep
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const EN_JSON_PATH = path.join(__dirname, '../src/i18n/en.json');
const TEMP_EXTRACT = '/tmp/en.json.new';

// Cache for git log lookups
const gitLogCache = new Map();
const codeFileCache = new Map();

/**
 * Get the last modification date for a message ID in en.json
 */
function getEnJsonLastModified(id) {
    if (gitLogCache.has(`en:${id}`)) {
        return gitLogCache.get(`en:${id}`);
    }

    try {
        const result = execSync(
            `git log -1 --format="%ai | %h | %s" -S '"${id}"' -- src/i18n/en.json`,
            {encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']}
        ).trim();

        const info = result || 'Unknown';
        gitLogCache.set(`en:${id}`, info);
        return info;
    } catch {
        return 'Unknown';
    }
}

/**
 * Find which code file contains a message ID
 */
function findCodeFile(id) {
    if (codeFileCache.has(id)) {
        return codeFileCache.get(id);
    }

    try {
        // Escape dots in the ID for grep regex
        const escapedId = id.replace(/\./g, '\\.');
        // Match both id= (JSX props) and id: (object literals)
        const result = execSync(
            `grep -r "id[=:].*${escapedId}" src --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" | grep -v test | grep -v ".snap" | head -1`,
            {encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']}
        ).trim();

        const file = result ? result.split(':')[0] : null;
        codeFileCache.set(id, file);
        return file;
    } catch {
        return null;
    }
}

/**
 * Get the last modification date for a code file
 */
function getCodeLastModified(file) {
    if (!file) return 'Unknown';

    if (gitLogCache.has(`code:${file}`)) {
        return gitLogCache.get(`code:${file}`);
    }

    try {
        const result = execSync(
            `git log -1 --format="%ai | %h | %s" -- "${file}"`,
            {encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore']}
        ).trim();

        const info = result || 'Unknown';
        gitLogCache.set(`code:${file}`, info);
        return info;
    } catch {
        return 'Unknown';
    }
}

/**
 * Generate detailed diff analysis including GitHub-style preview and word/char differences
 */
function generateDetailedDiff(current, extracted) {
    const lines = [];

    // GitHub-style diff preview (show spaces as dots for visibility)
    lines.push('   ╔═══ Diff Preview ═══');
    lines.push(`   ║ - ${current.replace(/ /g, '·')}`);
    lines.push(`   ║ + ${extracted.replace(/ /g, '·')}`);
    lines.push('   ╚════════════════════');

    // Whitespace analysis
    if (current.trimEnd() !== current) {
        lines.push('   🔍 Current has trailing whitespace');
    }
    if (current.trimStart() !== current) {
        lines.push('   🔍 Current has leading whitespace');
    }
    if (extracted.trimEnd() !== extracted) {
        lines.push('   🔍 Extracted has trailing whitespace');
    }
    if (extracted.trimStart() !== extracted) {
        lines.push('   🔍 Extracted has leading whitespace');
    }

    // Word-level diff
    const currentWords = current.split(/\s+/).filter(Boolean);
    const extractedWords = extracted.split(/\s+/).filter(Boolean);

    const addedWords = extractedWords.filter(w => !currentWords.includes(w));
    const removedWords = currentWords.filter(w => !extractedWords.includes(w));

    if (addedWords.length > 0 && addedWords.length <= 10) {
        lines.push(`   ➕ Added words: [${addedWords.join(', ')}]`);
    } else if (addedWords.length > 10) {
        lines.push(`   ➕ Added ${addedWords.length} words`);
    }

    if (removedWords.length > 0 && removedWords.length <= 10) {
        lines.push(`   ➖ Removed words: [${removedWords.join(', ')}]`);
    } else if (removedWords.length > 10) {
        lines.push(`   ➖ Removed ${removedWords.length} words`);
    }

    // Character-level diff for relatively short strings
    if (current.length < 150 && extracted.length < 150) {
        const charDiffs = [];
        const maxLen = Math.max(current.length, extracted.length);

        for (let i = 0; i < maxLen; i++) {
            if (current[i] !== extracted[i]) {
                const curChar = current[i] === ' ' ? '␣' : (current[i] || '∅');
                const extChar = extracted[i] === ' ' ? '␣' : (extracted[i] || '∅');
                charDiffs.push(`@${i}: '${curChar}'→'${extChar}'`);
            }
        }

        if (charDiffs.length > 0 && charDiffs.length <= 8) {
            lines.push(`   🔤 Character changes: ${charDiffs.join(', ')}`);
        } else if (charDiffs.length > 8) {
            lines.push(`   🔤 ${charDiffs.length} character changes`);
        }
    }

    return lines.length > 4 ? lines.join('\n') : null;
}

// Extract to temp file
console.log('Running formatjs extraction...\n');
try {
    execSync('npm run i18n-extract:check', {stdio: 'pipe'});
} catch (error) {
    // Expected to fail on diff, continue
}

// Load both files
const currentMessages = JSON.parse(fs.readFileSync(EN_JSON_PATH, 'utf8'));
const extractedMessages = JSON.parse(fs.readFileSync(TEMP_EXTRACT, 'utf8'));

// Find conflicts
const conflicts = [];
for (const [id, currentMsg] of Object.entries(currentMessages)) {
    const extractedMsg = extractedMessages[id];
    if (extractedMsg && extractedMsg !== currentMsg) {
        conflicts.push({id, currentMsg, extractedMsg});
    }
}

// Find new messages
const newMessages = [];
for (const [id, extractedMsg] of Object.entries(extractedMessages)) {
    if (!currentMessages[id]) {
        newMessages.push({id, extractedMsg});
    }
}

// Find removed messages
const removedMessages = [];
for (const [id, currentMsg] of Object.entries(currentMessages)) {
    if (!extractedMessages[id]) {
        removedMessages.push({id, currentMsg});
    }
}

console.log(`\n${'='.repeat(80)}`);
console.log('I18N RECONCILIATION REPORT');
console.log(`${'='.repeat(80)}\n`);

console.log(`Found ${conflicts.length} conflicts, ${newMessages.length} new messages, ${removedMessages.length} removed messages\n`);

if (conflicts.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('CONFLICTS (en.json vs defaultMessage in code)');
    console.log(`${'─'.repeat(80)}\n`);

    conflicts.forEach(({id, currentMsg, extractedMsg}) => {
        console.log(`\n📝 ID: ${id}`);
        console.log(`   Current (en.json):  "${currentMsg}"`);
        console.log(`   Extracted (code):   "${extractedMsg}"`);

        // Git history metadata
        const enJsonModified = getEnJsonLastModified(id);
        const codeFile = findCodeFile(id);
        const codeModified = getCodeLastModified(codeFile);

        console.log(`   📅 en.json:  ${enJsonModified}`);
        console.log(`   📅 code:     ${codeModified}`);
        if (codeFile) {
            console.log(`   📂 file:     ${codeFile}`);
        }

        // Analyze differences
        const analysis = [];

        // Check placeholders
        const currentPlaceholders = (currentMsg.match(/\{[^}]+\}/g) || []).sort();
        const extractedPlaceholders = (extractedMsg.match(/\{[^}]+\}/g) || []).sort();

        if (JSON.stringify(currentPlaceholders) !== JSON.stringify(extractedPlaceholders)) {
            analysis.push(`   ⚠️  Placeholder mismatch: ${JSON.stringify(currentPlaceholders)} vs ${JSON.stringify(extractedPlaceholders)}`);
        }

        // Check length difference
        const lengthDiff = Math.abs(currentMsg.length - extractedMsg.length);
        if (lengthDiff > 50) {
            analysis.push(`   📏 Significant length difference: ${lengthDiff} characters`);
        }

        // Check for common spelling corrections
        const spellingPatterns = [
            {wrong: /complimentary/i, right: /complementary/i, word: 'complimentary→complementary'},
            {wrong: /occurence/i, right: /occurrence/i, word: 'occurence→occurrence'},
            {wrong: /seperate/i, right: /separate/i, word: 'seperate→separate'},
        ];

        spellingPatterns.forEach(({wrong, right, word}) => {
            if (wrong.test(currentMsg) && right.test(extractedMsg)) {
                analysis.push(`   ✅ Spelling correction: ${word} (use extracted)`);
            } else if (wrong.test(extractedMsg) && right.test(currentMsg)) {
                analysis.push(`   ✅ Spelling correction: ${word} (use current)`);
            }
        });

        if (analysis.length > 0) {
            console.log(analysis.join('\n'));
        } else {
            console.log('   ℹ️  Manual review needed');
        }
    });
}

if (removedMessages.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('REMOVED MESSAGES (in en.json but not in code)');
    console.log(`${'─'.repeat(80)}\n`);

    removedMessages.slice(0, 10).forEach(({id, currentMsg}) => {
        console.log(`   ${id}: "${currentMsg}"`);
    });

    if (removedMessages.length > 10) {
        console.log(`   ... and ${removedMessages.length - 10} more`);
    }
    console.log('\n   ⚠️  Review if these are dead code or externally referenced (e.g., plugins)');
}

if (newMessages.length > 0) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log('NEW MESSAGES (in code but not in en.json)');
    console.log(`${'─'.repeat(80)}\n`);

    newMessages.forEach(({id, extractedMsg}) => {
        console.log(`   ${id}: "${extractedMsg}"`);
    });
}

console.log(`\n${'='.repeat(80)}\n`);

// Generate recommendations
console.log('RECOMMENDATIONS:\n');
console.log('1. For spelling corrections: Use the version with correct spelling');
console.log('2. For placeholder mismatches: Use the version matching actual usage in code');
console.log('3. For removed messages: Verify if truly unused or externally referenced');
console.log('4. For new messages: Add to en.json by running i18n-extract\n');

console.log('To apply extracted messages:');
console.log('  npm run i18n-extract\n');

console.log('To review specific conflicts:');
console.log('  npm run i18n-extract:check | less\n');
