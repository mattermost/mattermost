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
    // Set via API so Save is not required to become enabled (already-matching
    // admin console checkboxes leave the button disabled).
    cy.apiUpdateConfig({
        ServiceSettings: {
            EnablePostUsernameOverride: enableUsername,
            EnablePostIconOverride: enableIcon,
        },
    });
}
