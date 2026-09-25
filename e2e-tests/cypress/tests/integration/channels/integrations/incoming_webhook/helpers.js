// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

export function enableUsernameAndIconOverride(enable) {
    enableUsernameAndIconOverrideInt(enable, enable);
}

export function enableUsernameAndIconOverrideInt(enableUsername, enableIcon) {
    // Patch only these two flags. cy.apiUpdateConfig also merges e2e defaults,
    // which can change image-proxy/site settings MM-T622 asserts against, and
    // the admin-console Save path flakes when the radios are already set.
    cy.apiGetConfig().then(({config}) => {
        config.ServiceSettings.EnablePostUsernameOverride = enableUsername;
        config.ServiceSettings.EnablePostIconOverride = enableIcon;

        cy.getCookie('MMCSRF').then((csrfCookie) => {
            const headers = {};
            if (csrfCookie?.value) {
                headers['X-CSRF-Token'] = csrfCookie.value;
            }

            cy.request({
                url: '/api/v4/config',
                method: 'PUT',
                body: config,
                headers,
            }).then((response) => {
                expect(response.status).to.equal(200);
            });
        });
    });
}
