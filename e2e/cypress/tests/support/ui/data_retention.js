// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

Cypress.Commands.add('uiGoToDataRetentionPage', () => {
    cy.visit('/admin_console/compliance/data_retention_settings');
    cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Data Retention Policies');
});

Cypress.Commands.add('uiClickCreatePolicy', () => {
    cy.uiGetButton('Add policy').click();
    cy.get('.DataRetentionSettings .admin-console__header', {timeout: TIMEOUTS.TWO_MIN}).should('be.visible').invoke('text').should('include', 'Custom Retention Policy');
});

Cypress.Commands.add('uiFillOutCustomPolicyFields', (name, durationDropdown, durationText = '') => {
    // # Type policy name
    cy.uiGetTextbox('Policy name').clear().type(name);

    // # Add message retention values
    cy.get('.CustomPolicy__fields #DropdownInput_message_retention').should('be.visible').click();
    cy.get(`.message_retention__menu .message_retention__option span.option_${durationDropdown}`).should('be.visible').click();
    if (durationText) {
        cy.get('.CustomPolicy__fields input#message_retention_input').clear().type(durationText);
    }
});

Cypress.Commands.add('uiAddTeamsToCustomPolicy', (teamNames) => {
    cy.uiGetButton('Add teams').click();
    teamNames.forEach((teamName) => {
        cy.findByRole('textbox', {name: 'Search and add teams'}).typeWithForce(teamName);
        cy.get('.team-info-block').then((el) => {
            el.click();
        });
    });
    cy.uiGetButton('Add').click();
});

Cypress.Commands.add('uiAddChannelsToCustomPolicy', (channelNames) => {
    cy.uiGetButton('Add channels').click();
    channelNames.forEach((channelName) => {
        cy.findByRole('textbox', {name: 'Search and add channels'}).typeWithForce(channelName);
        cy.wait(TIMEOUTS.ONE_SEC);
        cy.get('.channel-info-block').then((el) => {
            el.click();
        });
    });
    cy.uiGetButton('Add').click();
});

Cypress.Commands.add('uiAddRandomTeamToCustomPolicy', (numberOfTeams = 1) => {
    cy.uiGetButton('Add teams').click();
    for (let i = 0; i < numberOfTeams; i++) {
        cy.get('.team-info-block').first().then((el) => {
            el.click();
        });
    }
    cy.uiGetButton('Add').click();
});

Cypress.Commands.add('uiAddRandomChannelToCustomPolicy', (numberOfChannels = 1) => {
    cy.uiGetButton('Add channels').click();
    for (let i = 0; i < numberOfChannels; i++) {
        cy.get('.channel-info-block').first().then((el) => {
            el.click();
        });
    }
    cy.uiGetButton('Add').click();
});

Cypress.Commands.add('uiVerifyCustomPolicyRow', (policyId, description, duration, appliedTo) => {
    // * Assert row has correct description
    cy.get(`#customDescription-${policyId}`).should('include.text', description);

    // * Assert row has correct duration
    cy.get(`#customDuration-${policyId}`).should('include.text', duration);

    // * Assert row has correct team/channel counts
    cy.get(`#customAppliedTo-${policyId}`).should('include.text', appliedTo);
});

Cypress.Commands.add('uiClickEditCustomPolicyRow', (policyId) => {
    cy.get(`#customWrapper-${policyId}`).trigger('mouseover').click();
    cy.findByRole('button', {name: /edit/i}).should('be.visible').click();
});

Cypress.Commands.add('uiVerifyPolicyResponse', (body, teamCount, channelCount, duration, displayName) => {
    // * Assert response body exists
    assert.isNotNull(body);

    // * Assert response body contains an ID
    assert.isNotNull(body.id);

    // * Assert response body team_count matches supplied value
    expect(body.team_count).to.equal(teamCount);

    // * Assert response body channel_count matches supplied value
    expect(body.channel_count).to.equal(channelCount);

    // * Assert response body duration matches supplied value
    expect(body.post_duration).to.equal(duration);

    // * Assert response body display_name matches supplied value
    expect(body.display_name).to.equal(displayName);
});
