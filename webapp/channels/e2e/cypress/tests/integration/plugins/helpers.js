// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

export function waitForAlertMessage(pluginId, message) {
    const checkFn = () => {
        cy.log(`Waiting for ${message}`);
        return cy.findByTestId(pluginId).scrollIntoView().then((pluginEl) => {
            return pluginEl[0].innerText.includes(message);
        });
    };

    const options = {
        timeout: TIMEOUTS.TWO_MIN,
        interval: TIMEOUTS.FIVE_SEC,
        errorMsg: `Expected "${message}" to be in plugin status but not found.`,
    };

    return cy.waitUntil(checkFn, options);
}
