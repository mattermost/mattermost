// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @profile_popover

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {createPrivateChannel} from '../elasticsearch_autocomplete/helpers';
import {getAdminAccount} from '../../../support/env';

describe('Profile popover', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let testChannel: Cypress.Channel;
    let privateChannel: Cypress.Channel;
    let otherUser: Cypress.UserProfile;
    let offTopicUrl: string;

    before(() => {
        cy.apiRequireLicense();
        cy.apiInitSetup().then(({team, user, channel, offTopicUrl: url}) => {
            testTeam = team;
            testUser = user;
            testChannel = channel;
            offTopicUrl = url;

            cy.apiCreateUser().then(({user: secondUser}) => {
                otherUser = secondUser;
                cy.apiAddUserToTeam(testTeam.id, secondUser.id);
            });
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiResetRoles();
        cy.visit('/admin_console/user_management/permissions/system_scheme');
        cy.get('.admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').and('have.text', 'System Scheme');
    });

    it('MM-T2 Add user — Error if already in channel', () => {
        cy.findByTestId('all_users-public_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('all_users', 'public', true);

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('all_users', 'private', true);

        cy.apiLogout();

        // # Login as test user and go to off-topic
        cy.apiLogin(testUser);
        cy.visit(offTopicUrl);

        // # Send message
        cy.postMessage('Hi there');
        cy.apiLogout();

        // # Login as the second user now
        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);

        clickAddToChannel(testUser);

        cy.get('div[aria-labelledby="addChannelModalLabel"]').within(() => {
            // # Type "Town" and press enter.
            cy.get('input').should('be.visible').type('Town').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * Verify error message
            cy.get('#add-user-to-channel-modal__user-is-member').should('have.text', `${testUser.first_name} ${testUser.last_name} is already a member of that channel`);

            // * And verify that button is disabled
            cy.get('#add-user-to-channel-modal__add-button').should('be.disabled');
        });
    });

    it('MM-T3 Add user — Public ON / Private OFF', () => {
        cy.findByTestId('all_users-private_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are disabled
        verifyPermissionSubSections('all_users', 'private', false);

        cy.findByTestId('saveSetting').as('saveButton').scrollIntoView();
        cy.get('@saveButton').should('be.visible').click();

        cy.apiLogout();

        // # Login as the second user now
        cy.apiLogin(otherUser);

        // # Create a private channel
        createPrivateChannel(testTeam.id, otherUser).then((channel) => {
            privateChannel = channel;
        });

        cy.visit(offTopicUrl);

        clickAddToChannel(testUser);

        cy.get('div[aria-labelledby="addChannelModalLabel"]').within(() => {
            // # Type "private" and press enter.
            cy.get('input').should('be.visible').type('private').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // # Verify that button is disabled
            cy.get('#add-user-to-channel-modal__add-button').should('be.disabled');
        });
    });

    it('MM-T4 Add user — Public OFF / Private ON', () => {
        cy.findByTestId('all_users-public_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled
        verifyPermissionSubSections('all_users', 'public', false);

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('all_users', 'private', true);

        cy.findByTestId('saveSetting').as('saveButton').scrollIntoView();
        cy.get('@saveButton').should('be.visible').click();

        cy.apiLogout();

        // # Login as the second user now
        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);

        clickAddToChannel(testUser);

        cy.get('div[aria-labelledby="addChannelModalLabel"]').within(() => {
            // # Type "Town" and press enter.
            cy.get('input').should('be.visible').type('Town').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * And verify that button is disabled
            cy.get('#add-user-to-channel-modal__add-button').should('be.disabled');

            // # Clear text box, type "Test Channel" and press enter.
            cy.get('input').should('be.visible').clear().type('Test Channel').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * Verify that button is enabled
            cy.get('#add-user-to-channel-modal__add-button').should('not.be.disabled');
        });
    });

    it('MM-T6 Add User - Channel Admins (Public only)', () => {
        cy.findByTestId('all_users-public_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        cy.findByTestId('all_users-private_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are disabled
        verifyPermissionSubSections('all_users', 'public', false);

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('all_users', 'private', false);

        cy.findByTestId('channel_admin-public_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are enabled.
        verifyPermissionSubSections('channel_admin', 'public', true);

        // # Clicking twice to disable it
        cy.findByTestId('channel_admin-private_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled
        verifyPermissionSubSections('channel_admin', 'private', false);

        cy.findByTestId('saveSetting').as('saveButton').scrollIntoView();
        cy.get('@saveButton').should('be.visible').click();

        // # Remove testUser from channel
        cy.removeUserFromChannel(testChannel.id, testUser.id);

        cy.apiLogout();

        // # Login
        cy.apiLogin(otherUser);
        cy.apiAddUserToChannel(testChannel.id, otherUser.id);

        // # Promote to channel admin
        promoteToChannelOrTeamAdmin(otherUser, testChannel.id);
        cy.visit(offTopicUrl);

        clickAddToChannel(testUser);

        cy.get('div[aria-labelledby="addChannelModalLabel"]').within(() => {
            // # Type "Channel" and press enter.
            cy.get('input').should('be.visible').type('Channel').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * And verify that button is enabled
            cy.get('#add-user-to-channel-modal__add-button').should('not.be.disabled');

            // # Clear text box, type "private" and press enter.
            cy.get('input').should('be.visible').clear().type('private').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * Verify that button is disabled.
            cy.get('#add-user-to-channel-modal__add-button').should('be.disabled');

            // # Clear text box, type "Channel" and press enter.
            cy.get('input').clear().type('Channel').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // # Now click the Add button
            cy.get('#add-user-to-channel-modal__add-button').click();
        });

        // * Now verify that popup is gone
        cy.get('div[aria-labelledby="addChannelModalLabel"]').should('not.exist');

        // # Visit that channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Verify that user added message is there.
        cy.findByTestId('postView', {timeout: TIMEOUTS.ONE_MIN}).find('.post-message__text').should('contain.text', `@${testUser.username} added to the channel by you.`);
    });

    it('MM-T7 Add User — Team admins (Private only)', () => {
        cy.findByTestId('all_users-public_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled
        verifyPermissionSubSections('all_users', 'public', false);

        cy.findByTestId('all_users-private_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are disabled
        verifyPermissionSubSections('all_users', 'private', false);

        cy.findByTestId('channel_admin-private_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('channel_admin', 'private', true);

        // # Clicking twice to disable it
        cy.findByTestId('team_admin-public_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled
        verifyPermissionSubSections('team_admin', 'public', false);
        cy.findByTestId('team_admin-private_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('team_admin', 'private', true);

        cy.findByTestId('saveSetting').as('saveButton').scrollIntoView();
        cy.get('@saveButton').should('be.visible').click();

        // # Remove testUser from channel
        cy.removeUserFromChannel(testChannel.id, testUser.id);

        // # Demote from being a channel admin.
        demoteToChannelOrTeamMember(otherUser, testChannel.id);

        // # Promote other user to team admin
        promoteToChannelOrTeamAdmin(otherUser, testTeam.id, 'teams');
        cy.apiLogout();

        // # Login as otheruser
        cy.apiLogin(otherUser);

        // # Visit off-topic
        cy.visit(offTopicUrl);

        clickAddToChannel(testUser);

        cy.get('div[aria-labelledby="addChannelModalLabel"]').within(() => {
            // # Type "Public" and press enter.
            cy.get('input').should('be.visible').type('Public').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * And verify that button is disabled
            cy.get('#add-user-to-channel-modal__add-button').should('be.disabled');

            // # Clear text box, type "Test Channel" and press enter.
            cy.get('input').should('be.visible').clear().type('Test Channel').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * Verify that button is enabled.
            cy.get('#add-user-to-channel-modal__add-button').should('not.be.disabled');

            // # Now click the Add button
            cy.get('#add-user-to-channel-modal__add-button').click();
        });

        // * Now verify that popup is gone
        cy.get('div[aria-labelledby="addChannelModalLabel"]').should('not.exist');

        // # Visit that channel
        cy.visit(`/${testTeam.name}/channels/${privateChannel.name}`);

        // * Verify that user added message is there.
        cy.findByTestId('postView', {timeout: TIMEOUTS.ONE_MIN}).find('.post-message__text').should('contain.text', `@${testUser.username} added to the channel by you.`);
    });

    it('MM-T9 Add User - Any user (can add users)', () => {
        cy.findByTestId('all_users-public_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('all_users', 'public', true);

        // * Verify that all the sub-checkboxes are enabled
        verifyPermissionSubSections('all_users', 'private', true);

        // # Demote other user to team member
        demoteToChannelOrTeamMember(otherUser, testTeam.id, 'teams');

        // # Remove testUser from the private channel.
        cy.removeUserFromChannel(privateChannel.id, testUser.id);

        cy.apiCreateChannel(testTeam.id, 'nomember', 'No Member');
        cy.apiLogout();

        // # Login as otheruser
        cy.apiLogin(otherUser);

        // # Visit off-topic
        cy.visit(offTopicUrl);

        clickAddToChannel(testUser);

        cy.get('div[aria-labelledby="addChannelModalLabel"]').within(() => {
            // # Type "No Member" and press enter.
            cy.get('input').should('be.visible').type('No Member').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * Verify that button is disabled.
            cy.get('#add-user-to-channel-modal__add-button').should('be.disabled');

            // # Clear text box, type "Test Channel" and press enter.
            cy.get('input').should('be.visible').clear().type('Test Channel').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * Verify that button is enabled.
            cy.get('#add-user-to-channel-modal__add-button').should('not.be.disabled');

            // # Type "Channel" and press enter.
            cy.get('input').should('be.visible').clear().type('Channel').wait(TIMEOUTS.HALF_SEC).type('{enter}');

            // * And verify that button is enabled
            cy.get('#add-user-to-channel-modal__add-button').should('not.be.disabled');

            // # Now click the Add button
            cy.get('#add-user-to-channel-modal__add-button').click();
        });

        // * Now verify that popup is gone
        cy.get('div[aria-labelledby="addChannelModalLabel"]').should('not.exist');

        // # Visit that channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Verify that there are 2 post views now.
        cy.findAllByTestId('postView', {timeout: TIMEOUTS.ONE_MIN}).should('have.length', 2);

        // * Verify that user added message is there.
        cy.findAllByTestId('postView').last().find('.post-message__text').should('contain.text', `@${testUser.username} added to the channel by you.`);
    });

    it('MM-T1 Add User - System Admin only', () => {
        cy.findByTestId('all_users-public_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled.
        verifyPermissionSubSections('all_users', 'public', false);

        cy.findByTestId('all_users-private_channel-checkbox').scrollIntoView().should('be.visible').click();

        // * Verify that all the sub-checkboxes are disabled.
        verifyPermissionSubSections('all_users', 'public', false);

        cy.findByTestId('channel_admin-public_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled.
        verifyPermissionSubSections('channel_admin', 'public', false);

        cy.findByTestId('channel_admin-private_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled.
        verifyPermissionSubSections('channel_admin', 'private', false);

        cy.findByTestId('team_admin-public_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled.
        verifyPermissionSubSections('team_admin', 'public', false);

        cy.findByTestId('team_admin-private_channel-checkbox').scrollIntoView().should('be.visible').click().click();

        // * Verify that all the sub-checkboxes are disabled.
        verifyPermissionSubSections('team_admin', 'private', false);

        cy.findByTestId('saveSetting').as('saveButton').scrollIntoView();
        cy.get('@saveButton').should('be.visible').click();

        cy.apiLogout();

        // # Login
        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);
        verifyAddToChannel(testUser, false);

        // # Promote to channel admin
        promoteToChannelOrTeamAdmin(otherUser, testChannel.id);

        cy.apiLogout();

        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);
        verifyAddToChannel(testUser, false);

        // # Promote to team admin
        promoteToChannelOrTeamAdmin(otherUser, testTeam.id, 'teams');

        cy.apiLogout();

        cy.apiLogin(otherUser);
        cy.visit(offTopicUrl);
        verifyAddToChannel(testUser, false);
        cy.apiLogout();

        // login as system admin
        cy.apiAdminLogin();

        cy.visit(offTopicUrl);

        verifyAddToChannel(testUser);
    });
});

const verifyPermissionSubSections = (category: string, publicOrPrivate: string, checked: boolean) => {
    let classCondition: string;
    if (checked) {
        classCondition = 'have.class';
    } else {
        classCondition = 'not.have.class';
    }

    // # Expand the section
    cy.get('#' + category + '-' + publicOrPrivate + '_channel > .fa').scrollIntoView().should('be.visible').click();

    if (category !== 'channel_admin') {
        cy.findByTestId(category + '-' + publicOrPrivate + '_channel-create_' + publicOrPrivate + '_channel-checkbox').should(classCondition, 'checked');
    }
    if (publicOrPrivate === 'public') {
        cy.findByTestId(`${category}-public_channel-convert_public_channel_to_private-checkbox`).should(classCondition, 'checked');
    }
    cy.findByTestId(`${category}-${publicOrPrivate}_channel-manage_${publicOrPrivate}_channel_properties-checkbox`).should(classCondition, 'checked');
    cy.findByTestId(`${category}-${publicOrPrivate}_channel-manage_${publicOrPrivate}_channel_members_and_read_groups-checkbox`).should(classCondition, 'checked');
    cy.findByTestId(`${category}-${publicOrPrivate}_channel-delete_${publicOrPrivate}_channel-checkbox`).should(classCondition, 'checked');
};

const verifyAddToChannel = (user: Cypress.UserProfile, visible = true) => {
    // # Open profile popover
    cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).within(() => {
        cy.findAllByText(user.username).first().should('have.text', user.username).click();
    });

    if (visible) {
        // * Add to a Channel should not be visible
        cy.get('#addToChannelButton').should('be.visible');
    } else {
        // * Add to a Channel should not be visible
        cy.get('#addToChannelButton').should('not.exist');
    }
};

const clickAddToChannel = (user: Cypress.UserProfile) => {
    // # Open profile popover
    cy.get('#postListContent', {timeout: TIMEOUTS.ONE_MIN}).within(() => {
        cy.findAllByText(`${user.username}`).first().should('have.text', user.username).click();
    });

    // * Add to a Channel should not be visible
    cy.get('#addToChannelButton').should('be.visible').click();
};

const promoteToChannelOrTeamAdmin = (user: Cypress.UserProfile, id: string, channelsOrTeams = 'channels') => {
    cy.externalRequest({
        user: getAdminAccount(),
        method: 'put',
        path: `${channelsOrTeams}/${id}/members/${user.id}/schemeRoles`,
        data: {
            scheme_user: true,
            scheme_admin: true,
        },
    });
};

const demoteToChannelOrTeamMember = (user: Cypress.UserProfile, id: string, channelsOrTeams = 'channels') => {
    cy.externalRequest({
        user: getAdminAccount(),
        method: 'put',
        path: `${channelsOrTeams}/${id}/members/${user.id}/schemeRoles`,
        data: {
            scheme_user: true,
            scheme_admin: false,
        },
    });
};
