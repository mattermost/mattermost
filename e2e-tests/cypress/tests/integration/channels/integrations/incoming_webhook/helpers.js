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
    // Patch only the two override flags. Visiting Integration Management and
    // clicking Save fails when leftover config already matches (Save stays
    // disabled). Do not use apiUpdateConfig: it merges e2e defaults. Do not
    // GET-then-full-PUT /api/v4/config: a stale snapshot can overwrite other
    // concurrent config changes.
    cy.apiGetConfig().then(({config}) => {
        if (
            config.ServiceSettings.EnablePostUsernameOverride === enableUsername &&
            config.ServiceSettings.EnablePostIconOverride === enableIcon
        ) {
            return;
        }

        cy.getCookie('MMCSRF').then((csrfCookie) => {
            const headers = {'X-Requested-With': 'XMLHttpRequest'};
            if (csrfCookie?.value) {
                headers['X-CSRF-Token'] = csrfCookie.value;
            }
            cy.request({
                method: 'PUT',
                url: '/api/v4/config/patch',
                headers,
                body: {
                    ServiceSettings: {
                        EnablePostUsernameOverride: enableUsername,
                        EnablePostIconOverride: enableIcon,
                    },
                },
            }).its('status').should('eq', 200).then(() => {
                cy.apiGetConfig().then(({config: updated}) => {
                    expect(updated.ServiceSettings.EnablePostUsernameOverride).to.equal(enableUsername);
                    expect(updated.ServiceSettings.EnablePostIconOverride).to.equal(enableIcon);
                });
            });
        });
    });
}
