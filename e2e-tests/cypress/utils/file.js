// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const fs = require('fs');

const chalk = require('chalk');
const intersection = require('lodash.intersection');
const without = require('lodash.without');
const shell = require('shelljs');
const argv = require('yargs').
    default('includeFile', '').
    default('excludeFile', '').
    argv;

const TEST_DIR = 'tests';

const grepCommand = (word = '') => {
    // -r, recursive search on subdirectories
    // -I, ignore binary
    // -l, only names of files to stdout/return
    // -w, expression is searched for as a word
    return `grep -rIlw '${word}' ${TEST_DIR}`;
};

const grepFiles = (command) => {
    return shell.exec(command, {silent: true}).stdout.
        split('\n').
        filter((f) => f.includes('spec.js') || f.includes('spec.ts'));
};

const findFiles = (pattern) => {
    function diveOnFiles(dirPath, filesArr) {
        const files = fs.readdirSync(dirPath);
        let arrayOfFiles = filesArr || [];

        files.forEach((file) => {
            const filePath = `${dirPath}/${file}`;
            if (fs.statSync(filePath).isDirectory()) {
                arrayOfFiles = diveOnFiles(filePath, arrayOfFiles);
            } else {
                arrayOfFiles.push(filePath);
            }
        });

        return arrayOfFiles;
    }

    return shell.exec(`find ${TEST_DIR}/integration -name "${pattern}"`, {silent: true}).stdout.
        split('\n').
        filter((matched) => Boolean(matched)).
        map((fileOrDir) => {
            if (fs.statSync(`./${fileOrDir}`).isDirectory(fileOrDir)) {
                return diveOnFiles(`./${fileOrDir}`);
            }
            return fileOrDir;
        }).
        flat().
        filter((file) => file.includes('spec.js') || file.includes('spec.ts')).
        map((file) => file.replace('./', ''));
};

function getBaseTestFiles() {
    const {invert, group, stage} = argv;

    const allFiles = grepFiles(grepCommand());
    const stageFiles = getFilesByMetadata(stage);
    const groupFiles = getFilesByMetadata(group);

    if (invert) {
        // Return no test file if no stage and withGroup, but inverted
        if (!stage && !group) {
            return [];
        }

        // Return all excluding stage files
        if (stage && !group) {
            return without(allFiles, ...stageFiles);
        }

        // Return all excluding group files
        if (!stage && group) {
            return without(allFiles, ...groupFiles);
        }

        // Return all excluding group and stage files
        return without(allFiles, ...intersection(stageFiles, groupFiles));
    }

    // Return all files if no stage and group flags
    if (!stage && !group) {
        return allFiles;
    }

    // Return stage files if no group flag
    if (stage && !group) {
        return stageFiles;
    }

    // Return group files if no stage flag
    if (!stage && group) {
        return groupFiles;
    }

    // Return files if both in stage and group
    return intersection(stageFiles, groupFiles);
}

function getWeightedFiles(metadata, sortFirst = true) {
    let weightedFiles = [];
    if (metadata) {
        metadata.split(',').forEach((word, i, arr) => {
            const files = getFilesByMetadata(word).map((file) => {
                return {
                    file,
                    sortWeight: sortFirst ? (i - arr.length) : (i + 1),
                };
            });
            weightedFiles.push(...files);
        });
    }

    if (sortFirst) {
        weightedFiles = weightedFiles.reverse();
    }

    return weightedFiles.reduce((acc, f) => {
        acc[f.file] = f;
        return acc;
    }, {});
}

function reorderFiles(files = {}, filesToReorder = {}) {
    const testFilesObject = Object.assign({}, files);

    const validFiles = intersection(Object.keys(testFilesObject), Object.keys(filesToReorder));
    Object.entries(filesToReorder).forEach(([k, v]) => {
        if (validFiles.includes(k)) {
            testFilesObject[k] = v;
        }
    });

    return testFilesObject;
}

function removeFromFiles(files = {}, filesToRemove = []) {
    const testFilesObject = Object.assign({}, files);

    const removedFiles = intersection(Object.keys(testFilesObject), filesToRemove);
    removedFiles.forEach((file) => {
        if (Object.hasOwn(testFilesObject, file)) {
            delete testFilesObject[file];
        }
    });

    return {testFilesObject, removedFiles};
}

function getSortedTestFiles(platform, browser, headless) {
    // Get test files based on stage, group and/or invert
    const baseTestFiles = getBaseTestFiles();

    // Add files matched by spec metadata
    const includeFilesByGroup = getFilesByMetadata(argv.includeGroup);
    if (includeFilesByGroup.length) {
        printMessage(includeFilesByGroup, `\nIncluded test files due to --include-group="${argv.includeGroup}"`);
    }

    // Add files matched by filename
    const includeFilesByFilename = argv.includeFile.split(',').
        map((pattern) => findFiles(pattern)).
        reduce((acc, files) => acc.concat(files), []);
    if (includeFilesByFilename.length) {
        printMessage(includeFilesByFilename, `\nIncluded test files due to --include-file="${argv.includeFile}"`);
    }

    let testFilesObject = baseTestFiles.
        concat(includeFilesByGroup).
        concat(includeFilesByFilename).
        reduce((acc, file) => {
            acc[file] = {file, sortWeight: 0};
            return acc;
        }, {});

    // Remove skipped files due to test environment
    let removedFiles;
    const skippedFiles = getSkippedFiles(platform, browser, headless);
    ({testFilesObject, removedFiles} = removeFromFiles(testFilesObject, skippedFiles));
    printMessage(removedFiles, `\nSkipped test files due to ${platform}/${browser} (${headless ? 'headless' : 'headed'})`);

    // Remove files matched by spec metadata
    const excludeFilesByGroup = getFilesByMetadata(argv.excludeGroup);
    ({testFilesObject, removedFiles} = removeFromFiles(testFilesObject, excludeFilesByGroup));
    if (excludeFilesByGroup.length) {
        printMessage(removedFiles, `\nExcluded test files due to --exclude-group="${argv.excludeGroup}"`);
    }

    // Remove files matched by filename
    const excludeFilesByFilename = argv.excludeFile.split(',').
        map((pattern) => findFiles(pattern)).
        reduce((acc, files) => acc.concat(files), []);

    ({testFilesObject, removedFiles} = removeFromFiles(testFilesObject, excludeFilesByFilename));
    if (excludeFilesByFilename.length) {
        printMessage(removedFiles, `\nExcluded test files due to --exclude-file="${argv.excludeFile}"`);
    }

    // Get files to be sorted first
    const firstFilesObject = getWeightedFiles(argv.sortFirst, true);
    testFilesObject = reorderFiles(testFilesObject, firstFilesObject);

    // Get files to be sorted last
    const lastFilesObject = getWeightedFiles(argv.sortLast, false);
    testFilesObject = reorderFiles(testFilesObject, lastFilesObject);

    const sortedFiles = Object.values(testFilesObject).
        sort((a, b) => {
            if (a.sortWeight > b.sortWeight) {
                return 1;
            } else if (a.sortWeight < b.sortWeight) {
                return -1;
            }

            return a.file.localeCompare(b.file);
        }).
        map((sortedObj) => sortedObj.file);

    return {sortedFiles, skippedFiles, weightedTestFiles: Object.values(testFilesObject)};
}

function getFilesByMetadata(metadata) {
    if (!metadata) {
        return [];
    }

    const egc = grepCommand(metadata.split(',').join('\\|'));
    return grepFiles(egc);
}

function printMessage(files = [], message) {
    console.log(chalk.cyan(`\n${message}:`));

    files.forEach((file, index) => {
        console.log(chalk.cyan(`- [${index + 1}] ${file}`));
    });
}

function getSkippedFiles(platform, browser, headless) {
    const platformFiles = getFilesByMetadata(`@${platform}`);
    const browserFiles = getFilesByMetadata(`@${browser}`);
    const headlessFiles = getFilesByMetadata(`@${headless ? 'headless' : 'headed'}`);

    return platformFiles.concat(browserFiles, headlessFiles);
}

module.exports = {
    getSortedTestFiles,
};
