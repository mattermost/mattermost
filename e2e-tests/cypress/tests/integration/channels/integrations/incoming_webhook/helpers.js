// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

import * as TIMEOUTS from '@/fixtures/timeouts';

export function enableUsernameAndIconOverride(enable) {
    enableUsernameAndIconOverrideInt(enable, enable);
}

export function enableUsernameAndIconOverrideInt(enableUsername, enableIcon) {
    // Patch only these two flags via PUT of the current config. The admin-console
    // Save control stays disabled when the radios already match, and apiUpdateConfig
    // also resets e2e defaults. Wait until both flags are visible to the API so a
    // webhook is not posted with a stale EnablePostIconOverride.
    const flagsMatch = (config) => (
        config.ServiceSettings.EnablePostUsernameOverride === enableUsername &&
        config.ServiceSettings.EnablePostIconOverride === enableIcon
    );

    cy.apiGetConfig().then(({config}) => {
        if (flagsMatch(config)) {
            return;
        }

        const nextConfig = {
            ...config,
            ServiceSettings: {
                ...config.ServiceSettings,
                EnablePostUsernameOverride: enableUsername,
                EnablePostIconOverride: enableIcon,
            },
        };

        cy.getCookie('MMCSRF').then((csrfCookie) => {
            const headers = {};
            if (csrfCookie?.value) {
                headers['X-CSRF-Token'] = csrfCookie.value;
            }

            cy.request({
                url: '/api/v4/config',
                method: 'PUT',
                body: nextConfig,
                headers,
            }).then((response) => {
                expect(response.status).to.equal(200);
            });
        });
    });

    cy.waitUntil(
        () => cy.apiGetConfig().then(({config}) => flagsMatch(config)),
        {timeout: TIMEOUTS.HALF_MIN, interval: TIMEOUTS.HALF_SEC},
    );
}
