// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Configuration for merging sharded blob reports via:
//   npx playwright merge-reports --config merge.config.mjs ./all-blob-reports/

export default {
    reporter: [
        ['html', {open: 'never', outputFolder: './results/reporter'}],
        ['json', {outputFile: './results/reporter/results.json'}],
        ['junit', {outputFile: './results/reporter/results.xml'}],
    ],
};
