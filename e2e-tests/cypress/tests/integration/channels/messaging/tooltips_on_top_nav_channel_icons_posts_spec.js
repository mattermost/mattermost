// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging @plugin @not_cloud

import {demoPlugin} from '../../../utils/plugins';

describe('Messaging', () => {
    let testTeam;
    let testChannel;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();

        // # Login as test user and visit off-topic
        cy.apiInitSetup().then(({team, user, offTopicUrl}) => {
            testTeam = team;

            // # Set up Demo plugin
            cy.apiUploadAndEnablePlugin(demoPlugin);

            // # Login as regular user
            cy.apiLogin(user);

            // # Set up test channel with a long name
            cy.apiCreateChannel(testTeam.id, 'channel-test', 'Public channel with a long name').then(({channel}) => {
                testChannel = channel;
            });
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T134 Visual verification of tooltips on top nav, channel icons, posts', () => {
        cy.findByRole('banner', {name: 'channel header region'}).should('be.visible').as('channelHeader');

        // * Members tooltip is present
        openAndVerifyTooltip(() => cy.uiGetChannelMemberButton(), 'Members');

        // * Pinned post tooltip is present
        openAndVerifyTooltip(() => cy.uiGetChannelPinButton(), 'Pinned posts');

        // * Saved posts tooltip is present
        openAndVerifyTooltip(() => cy.uiGetSavedPostButton(), 'Saved posts');

        // * Add to favorites posts tooltip is present - un checked
        openAndVerifyTooltip(() => cy.uiGetChannelFavoriteButton(), 'Add to Favorites');

        // * Add to favorites posts tooltip is present - checked
        cy.get('@channelHeader').findByRole('button', {name: 'add to favorites'}).should('be.visible').click();
        openAndVerifyTooltip(() => cy.uiGetChannelFavoriteButton(), 'Remove from Favorites');

        // * Unmute a channel tooltip is present
        cy.uiOpenChannelMenu('Mute Channel');
        openAndVerifyTooltip(() => cy.uiGetMuteButton(), 'Unmute');

        // * Download file tooltip is present
        cy.findByLabelText('Upload files').attachFile('long_text_post.txt');
        cy.postMessage('test file upload');
        const downloadLink = () => cy.findByTestId('fileAttachmentList').should('be.visible').findByRole('link', {name: 'download', hidden: true});
        downloadLink().trigger('mouseover');
        cy.uiGetToolTip('Download');
        downloadLink().trigger('mouseout');

        // * Long channel name (shown truncated on the LHS)
        cy.get(`#sidebarItem_${testChannel.name}`).should('be.visible').as('longChannelAtSidebar');
        cy.get('@longChannelAtSidebar').trigger('mouseover');
        cy.uiGetToolTip(testChannel.display_name);
        cy.get('@longChannelAtSidebar').trigger('mouseout');

        // * Check that the Demo plugin tooltip is present
        cy.get('@channelHeader').find('.fa-plug').should('be.visible').trigger('mouseover');
        cy.uiGetToolTip('Demo Plugin');
    });
});

function openAndVerifyTooltip(buttonFn, text) {
    // # Mouseover to the element
    buttonFn().trigger('mouseover');

    // * Verify the tooltip
    cy.uiGetToolTip(text);

    // # Hide the tooltip
    buttonFn().trigger('mouseout');
}
