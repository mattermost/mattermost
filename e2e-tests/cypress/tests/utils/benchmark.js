// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function reportBenchmarkResults(cy, win) {
    const testName = getTestName();
    const selectors = win.getSortedTrackedSelectors();
    win.dumpTrackedSelectorsStatistics();
    cy.log(selectors.length);
    cy.writeFile(`tests/integration/benchmark/__benchmarks__/${testName}.json`, JSON.stringify(selectors));
}

// From https://github.com/cypress-io/cypress/issues/2972#issuecomment-577072392
function getTestName() {
    const cypressContext = Cypress.mocha.getRunner().suite.ctx.test;
    const testTitles = [];

    function extractTitles(obj) {
        if (Object.hasOwn(obj, 'parent')) {
            testTitles.push(obj.title);
            const nextObj = obj.parent;
            extractTitles(nextObj);
        }
    }

    extractTitles(cypressContext);
    const orderedTitles = testTitles.reverse();
    const fileName = orderedTitles.join(' -- ');
    return fileName;
}
