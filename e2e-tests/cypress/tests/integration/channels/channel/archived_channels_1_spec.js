// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @channel

import {getRandomId} from '../../../utils';

describe('Leave an archived channel', () => {
    let testTeam;
    let offTopicUrl;
    const channelType = {
        public: 'Channel Type: Public',
        archived: 'Channel Type: Archived',
    };
    before(() => {
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: true,
            },
        });

        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team, offTopicUrl: url}) => {
            testTeam = team;
            offTopicUrl = url;
            cy.visit(offTopicUrl);

            // # Post a message to the channel
            cy.postMessage('hello');
        });
    });

    it('MM-T1680 Open archived channel from search results with permalink view in another channel is open', () => {
        // # Visit the test team
        cy.visit(`/${testTeam.name}`);

        // # Create a new channel
        cy.uiCreateChannel({isNewSidebar: true});

        // # Make a post
        const archivedPostText = `archived${getRandomId()}`;
        cy.postMessage(archivedPostText);
        cy.getLastPostId().as('archivedPostId');

        // # Archive the newly created channel
        cy.uiArchiveChannel();

        // # Switch away from the archived channel
        cy.visit(offTopicUrl);

        // # Make a post outside of the archived channel
        const otherPostText = `post${getRandomId()}`;
        cy.postMessage(otherPostText);
        cy.getLastPostId().as('otherPostId');

        // # Search for the new post and jump to it from the search results
        cy.uiSearchPosts(otherPostText);
        cy.get('@otherPostId').then((otherPostId) => cy.uiJumpToSearchResult(otherPostId));

        // # Search for a post in the archived channel
        cy.uiSearchPosts(archivedPostText);

        // # Open it in the RHS
        cy.get('@archivedPostId').then((archivedPostId) => {
            cy.clickPostCommentIcon(archivedPostId, 'SEARCH');

            // * Verify that the RHS has switched from search results to the thread
            cy.get('#searchContainer').should('not.exist');
            cy.get('#rhsContainer').should('be.visible');

            // * Verify that the thread is visible and marked as archived
            cy.get(`#rhsPost_${archivedPostId}`).should('be.visible');
            cy.get('#rhsContainer .channel-archived-warning__container').should('be.visible');
            cy.get('#rhsContainer .channel-archived-warning__content').should('be.visible');
        });
    });

    it('MM-T1697 - Browse Public channels shows archived channels option', () => {
        // # Create public channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();

            // # Click on add channel button
            cy.get('#SidebarContainer .AddChannelDropdown_dropdownButton').click();

            // # Click on browse channels
            cy.get('#showMoreChannels').click();

            // # More channels modal opens
            cy.get('#moreChannelsModal').should('be.visible').within(() => {
                // # Click on dropdown
                cy.findByText(channelType.public).should('be.visible').click();

                // # Click archived channels
                cy.findByText('Archived Channels').click();

                // # Modal should contain created channel
                cy.get('#moreChannelsList').should('contain', channel.display_name);
            });

            cy.get('body').typeWithForce('{esc}');
        });
    });

    it('MM-T1699 - Browse Channels for all channel types shows archived channels option', () => {
        let archivedPrivateChannel;
        let archivedPublicChannel;

        // # Create private channel
        cy.uiCreateChannel({isPrivate: true, isNewSidebar: true}).as('channel').then((channel) => {
            archivedPrivateChannel = channel;

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${archivedPrivateChannel.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();
        });

        // # Create public channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            archivedPublicChannel = channel;

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${archivedPublicChannel.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();
        });

        // # Click on add channel button
        cy.get('#SidebarContainer .AddChannelDropdown_dropdownButton').click();

        // # Click on browse channels
        cy.get('#showMoreChannels').click();

        // # More channels modal opens
        cy.get('#moreChannelsModal').should('be.visible').within(() => {
            // # Public channel list opens by default
            cy.findByText(channelType.public).should('be.visible').click();

            // # Click on archived channels
            cy.findByText('Archived Channels').click();

            // # Channel list should contain newly created channels
            cy.get('#moreChannelsList').should('contain', archivedPrivateChannel.name);
            cy.get('#moreChannelsList').should('contain', archivedPublicChannel.display_name);
        });
        cy.get('body').typeWithForce('{esc}');
    });

    it('MM-T1700 - All archived public channels are shown Important', () => {
        let archivedPublicChannel1;
        let archivedPublicChannel2;

        // # Create public channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            archivedPublicChannel1 = channel;

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${archivedPublicChannel1.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();
        });

        // # Create second public channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            archivedPublicChannel2 = channel;

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${archivedPublicChannel2.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();

            // # Leave channel
            cy.uiLeaveChannel();

            // # User should be redirected to last viewed channel
            cy.url().should('include', `/${testTeam.name}/channels/${archivedPublicChannel1.name}`);
        });

        // # Click on add channel button
        cy.get('#SidebarContainer .AddChannelDropdown_dropdownButton').click();

        // # Click on browse channels
        cy.get('#showMoreChannels').click();

        // # More channels modal opens
        cy.get('#moreChannelsModal').should('be.visible').within(() => {
            // # Public channels are shown by default
            cy.findByText(channelType.public).should('be.visible').click();

            // # Go to archived channels
            cy.findByText('Archived Channels').click();

            // # Channel list should contain both archived public channels
            cy.get('#moreChannelsList').should('contain', archivedPublicChannel1.display_name);
            cy.get('#moreChannelsList').should('contain', archivedPublicChannel2.display_name);
        });
        cy.get('body').typeWithForce('{esc}');
    });

    it('MM-T1701 - Only Private channels you are a member of are displayed', () => {
        let archivedPrivateChannel1;
        let archivedPrivateChannel2;

        // # Create private channel
        cy.uiCreateChannel({isPrivate: true, isNewSidebar: true}).as('channel').then((channel) => {
            archivedPrivateChannel1 = channel;

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${archivedPrivateChannel1.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();
        });

        // # Create another private channel
        cy.uiCreateChannel({isPrivate: true, isNewSidebar: true}).as('channel').then((channel) => {
            archivedPrivateChannel2 = channel;

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${archivedPrivateChannel2.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();

            // # Leave the channel
            cy.uiLeaveChannel();
        });

        // # Leave channel modal is visible
        cy.get('#confirmModal').should('be.visible');
        cy.get('#confirmModalButton').click();

        // # Click on add channel button
        cy.get('#SidebarContainer .AddChannelDropdown_dropdownButton').click();

        // # Click on browse channels
        cy.get('#showMoreChannels').click();

        // # More channels modal opens
        cy.get('#moreChannelsModal').should('be.visible').within(() => {
            // # Show public channels is visible by default
            cy.findByText(channelType.public).should('be.visible').click();

            // # Go to archived channels
            cy.findByText('Archived Channels').click();

            // # Channel list should contain only the private channel user is a member of
            cy.get('#moreChannelsList').should('contain', archivedPrivateChannel1.name);
            cy.get('#moreChannelsList').should('not.contain', archivedPrivateChannel2.name);
        });
        cy.get('body').typeWithForce('{esc}');
    });

    it('MM-T1703 - User can open archived channels', () => {
        let archivedChannel;

        // # Create a public channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            archivedChannel = channel;

            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${archivedChannel.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();
        });

        // # Click on add channel button
        cy.get('#SidebarContainer .AddChannelDropdown_dropdownButton').click();

        // # Click on browse channels
        cy.get('#showMoreChannels').click();

        // # More channels modal opens and lands on public channels
        cy.get('#moreChannelsModal').should('be.visible').within(() => {
            cy.findByText(channelType.public).should('be.visible').click();

            // # Go to archived channels
            cy.findByText('Archived Channels').click();

            // # More channels list should contain the archived channel
            cy.get('#moreChannelsList').should('contain', archivedChannel.display_name);
        });
        cy.get('body').typeWithForce('{esc}');
    });

    it('MM-T1696 - When clicking Browse Channels no options for archived channels are shown when the feature is disabled', () => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            TeamSettings: {
                ExperimentalViewArchivedChannels: false,
            },
        });

        // # Create public channel
        cy.apiCreateChannel(testTeam.id, 'channel', 'channel').then(({channel}) => {
            // # Visit the channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);

            // # Archive the channel
            cy.uiArchiveChannel();

            // # Click on add channel button
            cy.get('#SidebarContainer .AddChannelDropdown_dropdownButton').click();

            // # Click on browse channels
            cy.get('#showMoreChannels').click();

            // # Modal should not contain the created channel
            cy.get('#channelsMoreDropdown').should('not.exist');
            cy.get('#moreChannelsList').should('not.contain', channel.name);
        });
        cy.get('body').typeWithForce('{esc}');
    });
});
