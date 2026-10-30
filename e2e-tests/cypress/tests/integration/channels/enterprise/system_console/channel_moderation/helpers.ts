// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import type {Team} from '@mattermost/types/teams';

import {checkBoxes} from './constants';

import * as TIMEOUTS from '@/fixtures/timeouts';
import {getAdminAccount} from '@/support/env';

// # Visits the channel configuration for a channel with channelName
export const visitChannelConfigPage = (channel: Channel) => {
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/channels');
    cy.get('.DataGrid_searchBar').within(() => {
        cy.findByPlaceholderText('Search').type(`${channel.name}{enter}`);
    });
    cy.findByText('Edit').click();
    cy.wait(TIMEOUTS.ONE_SEC);
};

const isNativeCheckbox = ($el: JQuery<HTMLElement>) => $el.is('input[type="checkbox"]');

const isPermissionChecked = ($el: JQuery<HTMLElement>) => {
    if (isNativeCheckbox($el)) {
        return Boolean($el.prop('checked') || $el.prop('indeterminate'));
    }

    // System / team scheme permission widgets still use Bootstrap checkbox classes.
    const classAttribute = $el.attr('class') ?? '';
    return classAttribute.includes('checked') || classAttribute.includes('intermediate');
};

const assertPermissionUnchecked = (permission: string) => {
    cy.findByTestId(permission).then(($el) => {
        if (isNativeCheckbox($el)) {
            cy.wrap($el).should('not.be.checked');
            return;
        }
        cy.wrap($el).should('not.have.class', 'checked');
    });
};

const assertPermissionChecked = (permission: string) => {
    cy.findByTestId(permission).then(($el) => {
        if (isNativeCheckbox($el)) {
            cy.wrap($el).should('be.checked');
            return;
        }
        cy.wrap($el).should('have.class', 'checked');
    });
};

// # Disable a permission
// Supports Compass Checkbox (opacity: 0 native input) and Bootstrap scheme widgets.
export const disablePermission = (permission: string) => {
    cy.findByTestId(permission).scrollIntoView().should('exist').then(($el) => {
        if (isPermissionChecked($el)) {
            cy.wrap($el).click({force: true});
        }
    });
    assertPermissionUnchecked(permission);
};

// # Saves channel config and navigates back to the channel config page if specified
export const saveConfigForChannel = (channelName: string | null = null, clickConfirmationButton = false) => {
    cy.get('#saveSetting').then((btn) => {
        if (btn.is(':enabled')) {
            btn.click();

            if (clickConfirmationButton) {
                cy.get('#confirmModalButton').click();
            }

            // # Wait for location path to end with /admin_console/user_management/channels
            cy.waitUntil(() => cy.location().then((location) => {
                return location.href.endsWith('/admin_console/user_management/channels');
            }));

            // # Make sure the save is complete by looking for the search input which is only visible on the team's index page
            cy.get('.DataGrid_searchBar').should('be.visible').within(() => {
                cy.findByPlaceholderText('Search').should('be.visible');
            });

            if (channelName) {
                // # Search for the channel.
                cy.get('.DataGrid_searchBar').within(() => {
                    cy.findByPlaceholderText('Search').type(`${channelName}{enter}`);
                });
                cy.findByText('Edit').click();
            }
        }
    });
};

// # Visits a channel as the member specified
export const visitChannel = (user: UserProfile, channel: Channel, team: Team) => {
    cy.apiLogin(user);
    cy.visit(`/${team.name}/channels/${channel.name}`);
    cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
};

// # Checks to see if we got a system message warning after using @all/@here/@channel
export const postChannelMentionsAndVerifySystemMessageExist = (channelName: string) => {
    function getSystemMessage(text: string) {
        return `Channel notifications are disabled in ${channelName}. The ${text} did not trigger any notifications.`;
    }

    // # Type @all and post it to the channel
    cy.postMessage('@all ');

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        // * Assert that the last message posted is the system message informing us we are not allowed to use channel mentions
        cy.get(`#postMessageText_${postId}`).should('include.text', getSystemMessage('@all'));
    });

    // # Type @here and post it to the channel
    cy.postMessage('@here ');

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        // * Assert that the last message posted is the system message informing us we are not allowed to use channel mentions
        cy.get(`#postMessageText_${postId}`).should('include.text', getSystemMessage('@here'));
    });

    cy.postMessage('@channel ');

    // # Type last post message text
    cy.getLastPostId().then((postId) => {
        // * Assert that the last message posted is the system message informing us we are not allowed to use channel mentions
        cy.get(`#postMessageText_${postId}`).should('include.text', getSystemMessage('@channel'));
    });
};

// # Enable a permission
// Supports Compass Checkbox (opacity: 0 native input) and Bootstrap scheme widgets.
export const enablePermission = (permission: string) => {
    cy.findByTestId(permission).scrollIntoView().should('exist').then(($el) => {
        if (!isPermissionChecked($el)) {
            cy.wrap($el).click({force: true});
        }
    });
    assertPermissionChecked(permission);
};

// # Checks to see if we did not get a system message warning after using @all/@here/@channel
export const postChannelMentionsAndVerifySystemMessageNotExist = (channel: Channel) => {
    function getSystemMessage(text: string) {
        return `Channel notifications are disabled in ${channel.name}. The ${text} did not trigger any notifications.`;
    }

    cy.postMessage('@all ');

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        // * Assert that the last message posted is NOT a system message informing us we are not allowed to use channel mentions
        cy.get(`#postMessageText_${postId}`).should('not.have.text', getSystemMessage('@all'));
    });

    cy.postMessage('@here ');

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        // * Assert that the last message posted is NOT a system message informing us we are not allowed to use channel mentions
        cy.get(`#postMessageText_${postId}`).should('not.have.text', getSystemMessage('@here'));
    });

    cy.postMessage('@channel ');

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        // * Assert that the last message posted is NOT a system message informing us we are not allowed to use channel mentions
        cy.get(`#postMessageText_${postId}`).should('not.have.text', getSystemMessage('@channel'));
    });
};

// # Wait's until the Saving text becomes Save
const waitUntilConfigSave = () => {
    cy.waitUntil(() => cy.get('#saveSetting').then((el) => {
        return el[0].innerText === 'Save';
    }));
};

// Clicks the save button in the system console page.
// waitUntilConfigSaved: If we need to wait for the save button to go from saving -> save.
// Usually we need to wait unless we are doing this in team override scheme
export const saveConfigForScheme = (waitUntilConfigSaved = true, clickConfirmationButton = false) => {
    // # Save if possible (if previous test ended abruptly all permissions may already be enabled)
    cy.get('#saveSetting').then((btn) => {
        if (btn.is(':enabled')) {
            btn.click();
        }
    });
    if (clickConfirmationButton) {
        cy.get('#confirmModalButton').click();
    }
    if (waitUntilConfigSaved) {
        waitUntilConfigSave();
    }
};

// # Goes to the System Scheme page as System Admin
export const goToSystemScheme = () => {
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions/system_scheme');
    cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'System Scheme');
};

// # Goes to the permissions page and creates a new team override scheme with schemeName
export const goToPermissionsAndCreateTeamOverrideScheme = (schemeName: string, team: Team) => {
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions');
    cy.findByTestId('team-override-schemes-link').click();
    cy.get('#scheme-name').type(schemeName);
    cy.findByTestId('add-teams').click();
    cy.get('#selectItems input').typeWithForce(team.display_name);
    cy.get('#multiSelectList').should('be.visible').children().first().click({force: true});
    cy.get('#saveItems').should('be.visible').click();
    saveConfigForScheme(false);
    cy.wait(TIMEOUTS.ONE_SEC);
};

// # Goes to the permissions page and clicks edit or delete for a team override scheme
export const deleteOrEditTeamScheme = (schemeDisplayName: string, editOrDelete: string) => {
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions');
    cy.findByTestId(`${schemeDisplayName}-${editOrDelete}`).click();
    if (editOrDelete === 'delete') {
        cy.get('#confirmModalButton').click();
    }
};

// # Open channel members rhs
export const viewManageChannelMembersRHS = () => {
    // # Click member count to open member list rhs
    cy.get('.member-rhs__trigger').click();
};

// # Enable (check) all the permissions in the channel moderation widget through the API
export const enableDisableAllChannelModeratedPermissionsViaAPI = (channel: Channel, enable = true) => {
    cy.externalRequest(
        {
            user: getAdminAccount(),
            method: 'PUT',
            path: `channels/${channel.id}/moderations/patch`,
            data:
                [
                    {
                        name: 'create_post',
                        roles: {
                            members: enable,
                            guests: enable,
                        },
                    },
                    {
                        name: 'create_reactions',
                        roles: {
                            members: enable,
                            guests: enable,
                        },
                    },
                    {
                        name: 'manage_members',
                        roles: {
                            members: enable,
                        },
                    },
                    {
                        name: 'use_channel_mentions',
                        roles: {
                            members: enable,
                            guests: enable,
                        },
                    },
                    {
                        name: 'manage_bookmarks',
                        roles: {
                            members: enable,
                        },
                    },
                ],
        },
    );
};

// # This goes to the system scheme and clicks the reset permissions to default and then saves the setting
export const resetSystemSchemePermissionsToDefault = () => {
    cy.apiAdminLogin();
    cy.visit('/admin_console/user_management/permissions/system_scheme');
    cy.findByTestId('resetPermissionsToDefault').click();
    cy.get('#confirmModalButton').click();
    saveConfigForScheme();
};

export const demoteToChannelOrTeamMember = (userId: string, id: string, channelsOrTeams = 'channels') => {
    cy.externalRequest({
        user: getAdminAccount(),
        method: 'put',
        path: `${channelsOrTeams}/${id}/members/${userId}/schemeRoles`,
        data: {
            scheme_user: true,
            scheme_admin: false,
        },
    });
};

export const promoteToChannelOrTeamAdmin = (userId: string, id: string, channelsOrTeams = 'channels') => {
    cy.externalRequest({
        user: getAdminAccount(),
        method: 'put',
        path: `${channelsOrTeams}/${id}/members/${userId}/schemeRoles`,
        data: {
            scheme_user: true,
            scheme_admin: true,
        },
    });
};

// # Disable (uncheck) all the permissions in the channel moderation widget
export const disableAllChannelModeratedPermissions = () => {
    checkBoxes.forEach((buttonId) => {
        cy.findByTestId(buttonId).then(($btn) => {
            if ($btn.prop('checked')) {
                cy.wrap($btn).click({force: true});
            }
        });
    });
};

// # Enable (check) all the permissions in the channel moderation widget
export const enableAllChannelModeratedPermissions = () => {
    checkBoxes.forEach((buttonId) => {
        cy.findByTestId(buttonId).then(($btn) => {
            if (!$btn.prop('checked')) {
                cy.wrap($btn).click({force: true});
            }
        });
    });
};
