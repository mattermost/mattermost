// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Test Documentation Format Linter
 *
 * This script verifies that all spec files follow the required documentation format:
 * - JSDoc with @objective and @precondition
 * - Proper test title with MM-T ID
 * - Tag for feature categorization
 * - Action/Verification comments
 */

/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable import/order */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/* eslint-disable no-console */

// Colors for terminal output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
    white: '\x1b[37m',
};

// Regex patterns
const patterns = {
    // Support both single-line and multi-line test declarations
    testDeclaration:
        /test\(\s*['"]([^'"]+)['"]\s*,(?:\s*|\n\s*){.*?tag:\s*['"]@.*?['"].*?}(?:\s*|\n\s*),(?:\s*|\n\s*)async/g,
    jsdocBlock: /\/\*\*\s*\n(?:.*\n)*?\s*\*\//g,
    objective: /@objective\s+.*?(?=\n|\*\/)/g,
    precondition: /@precondition\s+.*?(?=\n|\*\/)/g,
    tagDeclaration: /{tag:\s*['"]@[\w_]+['"]}|{\s*tag:\s*['"]@[\w_]+['"]\s*}/g,
    // Match action comments - note the difference between # as a comment marker vs # in strings
    actionComment: /(?:^|\n)\s*\/\/\s*#\s*.+/g,
    // Match verification comments - note the difference between * as a comment marker vs * in strings
    verificationComment: /(?:^|\n)\s*\/\/\s*\*\s*.+/g,
};

// Get all spec files
const specFiles = glob.sync(path.join(process.cwd(), 'specs/**/*.spec.ts'));

// Results
const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    errors: [],
};

// Process each file
specFiles.forEach((filePath) => {
    const relativeFilePath = path.relative(process.cwd(), filePath);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const fileErrors = [];

    // Extract all test declarations
    const testDeclarations = Array.from(fileContent.matchAll(patterns.testDeclaration));
    const jsdocBlocks = Array.from(fileContent.matchAll(patterns.jsdocBlock));

    // If no test declarations found, warn but don't fail
    if (testDeclarations.length === 0) {
        results.warnings++;
        console.log(
            `${colors.yellow}WARNING${colors.reset}: No test declarations found in ${colors.cyan}${relativeFilePath}${colors.reset}`,
        );
        return;
    }

    // Check each test for proper format
    testDeclarations.forEach((testMatch) => {
        const testDeclaration = testMatch[0];
        const testName = testMatch[1];

        // Get test function position to find corresponding JSDoc
        const testPosition = testMatch.index;

        // Get the JSDoc block that immediately precedes this test
        const precedingJSDoc = jsdocBlocks.find((jsdoc) => {
            const jsdocEnd = jsdoc.index + jsdoc[0].length;
            // JSDoc should end right before the test with only whitespace in between
            const textBetween = fileContent.substring(jsdocEnd, testPosition).trim();
            return textBetween === '';
        });

        // Check if test has a test key (MM-T####)
        if (!testName.match(/^MM-T\d+/)) {
            // This is a new test without a test key
            console.log(
                `${colors.cyan}NEW TEST FOUND: "${testName}"${colors.reset} - Will be registered in the test management system after merge`,
            );
            results.newTests = results.newTests || [];
            results.newTests.push({file: relativeFilePath, testName});
        } else {
            // This is an existing test with a test key
            const baseTestKey = testName.match(/^(MM-T\d+)/)[1];

            // Check if this is a step of a multi-step test case
            const stepMatch = testName.match(/^MM-T\d+(_\d+)/);
            const isStep = stepMatch !== null;
            const stepSuffix = isStep ? stepMatch[1] : '';
            const testKey = baseTestKey + (stepSuffix || '');

            // Log different message for test steps
            if (isStep) {
                // Extract the step number without the underscore
                const stepNumber = stepSuffix.substring(1);
                console.log(
                    `${colors.magenta}DOCUMENTATION UPDATE: "${testKey}"${colors.reset} - step ${stepNumber} of ${baseTestKey} - Changes will be mapped to test management system after merge`,
                );
            } else {
                console.log(
                    `${colors.magenta}DOCUMENTATION UPDATE: "${testKey}"${colors.reset} - Changes will be saved to test management system after merge`,
                );
            }

            // Check if documentation is present and mark for update
            if (precedingJSDoc) {
                results.updatedTests = results.updatedTests || [];
                results.updatedTests.push({
                    file: relativeFilePath,
                    testKey,
                    baseTestKey,
                    isStep,
                    stepSuffix,
                    testName,
                });
            }
        }

        // JSDoc was already retrieved above, no need to get it again

        if (!precedingJSDoc) {
            fileErrors.push(`Missing JSDoc documentation at "${testName}"`);
        } else {
            const jsdocContent = precedingJSDoc[0];

            // Check for @objective
            if (!jsdocContent.match(patterns.objective)) {
                fileErrors.push(`Missing @objective in JSDoc at "${testName}"`);
            }

            // Note: @precondition is optional and should only be included when there are
            // non-default requirements for the test
        }

        // Check for tag declaration
        if (!testDeclaration.match(patterns.tagDeclaration)) {
            fileErrors.push(`Missing feature tag at "${testName}"`);
        }

        // Simpler approach to extract test body by using string search and tracking braces to find function boundaries
        const testNameEscaped = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const testDeclarationPattern = new RegExp(`test\\s*\\([\\s\\n]*['"]${testNameEscaped}['"]`);

        // Find the position of the test declaration
        const testDeclarationMatch = testDeclarationPattern.exec(fileContent);
        let testFnMatch = null;

        if (testDeclarationMatch) {
            // Find the position of "async" after the test declaration
            const startPos = testDeclarationMatch.index;
            const asyncPattern = /async\s*\([^)]*\)\s*=>\s*{/g;
            asyncPattern.lastIndex = startPos;

            const asyncMatch = asyncPattern.exec(fileContent);
            if (asyncMatch) {
                // Find the position of the opening brace of the function body
                const openBracePos = asyncMatch.index + asyncMatch[0].length - 1;

                // Find the matching closing brace
                let braceCount = 1;
                let currentPos = openBracePos + 1;

                while (braceCount > 0 && currentPos < fileContent.length) {
                    const char = fileContent[currentPos];

                    if (char === '{') {
                        braceCount++;
                    } else if (char === '}') {
                        braceCount--;
                    }

                    currentPos++;
                }

                // If we found the matching closing brace, extract everything between them
                if (braceCount === 0) {
                    const testBody = fileContent.substring(openBracePos + 1, currentPos - 1);
                    testFnMatch = [null, testBody];
                }
            }

            // If we couldn't extract using the above method, try a more direct string search approach
            if (!testFnMatch) {
                // Find the test function by searching for the test name and extracting all content until the end of the function
                const testIndex =
                    fileContent.indexOf(`test('${testName}'`) ||
                    fileContent.indexOf(`test("${testName}"`) ||
                    fileContent.indexOf(`test(\n  '${testName}'`) ||
                    fileContent.indexOf(`test(\n  "${testName}"`);

                if (testIndex !== -1) {
                    // Find the position of "async" which indicates the start of the function body
                    const asyncIndex = fileContent.indexOf('async', testIndex);
                    if (asyncIndex !== -1) {
                        // Find the opening brace after "async"
                        const openBraceIndex = fileContent.indexOf('{', asyncIndex);
                        if (openBraceIndex !== -1) {
                            // Count braces to find the matching closing brace
                            let braceCount = 1;
                            let closePos = openBraceIndex + 1;

                            while (braceCount > 0 && closePos < fileContent.length) {
                                const char = fileContent[closePos];

                                if (char === '{') {
                                    braceCount++;
                                } else if (char === '}') {
                                    braceCount--;
                                }

                                closePos++;
                            }

                            if (braceCount === 0) {
                                const testBody = fileContent.substring(openBraceIndex + 1, closePos - 1);
                                testFnMatch = [null, testBody];
                            }
                        }
                    }
                }
            }
        }

        if (testFnMatch) {
            const testBody = testFnMatch[1];

            // Check for action comments (// #) - we need to be more flexible in our detection
            let hasActionComments = false;
            const actionPattern = /\/\/\s*#/;

            if (actionPattern.test(testBody)) {
                hasActionComments = true;
            }

            if (!hasActionComments) {
                fileErrors.push(`Missing action comments at "${testName}" (format: "// # Some descriptive action")`);
            }

            // Check for verification comments (// *) - we need to be more flexible in our detection
            let hasVerificationComments = false;
            const verificationPattern = /\/\/\s*\*/;

            if (verificationPattern.test(testBody)) {
                hasVerificationComments = true;
            }

            if (!hasVerificationComments) {
                fileErrors.push(
                    `Missing verification comments at "${testName}" (format: "// * Some descriptive verification")`,
                );
            }
        } else {
            fileErrors.push(`Could not extract test body for "${testName}"`);
        }
    });

    if (fileErrors.length > 0) {
        results.failed++;
        results.errors.push({
            file: relativeFilePath,
            errors: fileErrors,
        });
    } else {
        results.passed++;
    }
});

// Print results
console.log('\n' + '-'.repeat(80));
console.log(`${colors.cyan}Test Documentation Format Linter Results${colors.reset}`);
console.log(`Files checked: ${specFiles.length}`);
console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
console.log(`${colors.yellow}Warnings: ${results.warnings}${colors.reset}`);
console.log(`${colors.cyan}New tests: ${results.newTests ? results.newTests.length : 0}${colors.reset}`);
console.log(`${colors.magenta}Updated tests: ${results.updatedTests ? results.updatedTests.length : 0}${colors.reset}`);

if (results.errors.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log(`${colors.red}Errors:${colors.reset}`);

    results.errors.forEach((fileResult) => {
        console.log(`\n${colors.cyan}${fileResult.file}${colors.reset}:`);
        fileResult.errors.forEach((error) => {
            console.log(`  ${colors.red}•${colors.reset} ${error}`);
        });
    });
}

// Display new tests summary if any were found
if (results.newTests && results.newTests.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log(`${colors.cyan}New Tests to be Registered:${colors.reset}`);

    results.newTests.forEach((newTest) => {
        console.log(`  ${colors.cyan}•${colors.reset} ${newTest.file}: "${newTest.testName}"`);
    });
}

// Display updated tests summary if any were found
if (results.updatedTests && results.updatedTests.length > 0) {
    console.log('\n' + '-'.repeat(80));
    console.log(`${colors.magenta}Tests with Documentation Updates:${colors.reset}`);

    // Group the updated tests by base test key
    const groupedTests = {};
    results.updatedTests.forEach((test) => {
        if (!groupedTests[test.baseTestKey]) {
            groupedTests[test.baseTestKey] = [];
        }
        groupedTests[test.baseTestKey].push(test);
    });

    // Display the tests grouped by base test key
    Object.keys(groupedTests).forEach((baseTestKey) => {
        const tests = groupedTests[baseTestKey];

        // If there's only one test with this base key and it's not a step
        if (tests.length === 1 && !tests[0].isStep) {
            const test = tests[0];
            console.log(
                `  ${colors.magenta}•${colors.reset} ${test.file}: ${test.testKey} "${test.testName.substring(test.testKey.length).trim()}"`,
            );
        }
        // If there are multiple steps of the same test
        else {
            console.log(
                `  ${colors.magenta}•${colors.reset} ${tests[0].file}: ${colors.cyan}${baseTestKey}${colors.reset} (with ${tests.length} steps):`,
            );

            // Sort steps by their step number
            tests.sort((a, b) => {
                if (!a.isStep) return -1;
                if (!b.isStep) return 1;

                const aNum = parseInt(a.stepSuffix.substring(1), 10);
                const bNum = parseInt(b.stepSuffix.substring(1), 10);
                return aNum - bNum;
            });

            // Display each step
            tests.forEach((test) => {
                const namePart = test.testName.substring(test.baseTestKey.length).trim();
                if (test.isStep) {
                    // Extract the step number without the underscore
                    const stepNumber = test.stepSuffix.substring(1);
                    console.log(
                        `    ${colors.magenta}◦${colors.reset} step ${stepNumber}: "${namePart.substring(test.stepSuffix.length).trim()}"`,
                    );
                } else {
                    console.log(`    ${colors.magenta}◦${colors.reset} Base test: "${namePart}"`);
                }
            });
        }
    });
}

console.log('\n' + '-'.repeat(80));
if (results.failed > 0) {
    console.log(`${colors.red}Linter failed!${colors.reset} Please fix the test documentation issues.`);
    process.exit(1);
} else {
    console.log(`${colors.green}Linter passed!${colors.reset} All spec files follow the required format.`);
    process.exit(0);
}
