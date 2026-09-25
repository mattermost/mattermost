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
    // Set override flags via API. Visiting the admin console and clicking Save
    // leaves #saveSetting disabled when a previous spec already applied the
    // same values, which flakes MM-T622 and related webhook tests.
    cy.apiUpdateConfig({
        ServiceSettings: {
            EnablePostUsernameOverride: enableUsername,
            EnablePostIconOverride: enableIcon,
        },
    });
}
