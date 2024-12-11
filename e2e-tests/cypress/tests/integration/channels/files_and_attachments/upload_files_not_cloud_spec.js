// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @files_and_attachments

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {stubClipboard} from '../../../utils';

import {downloadAttachmentAndVerifyItsProperties} from './helpers';

describe('Upload Files', () => {
    let testTeam;
    let testChannel;
    let otherUser;

    before(() => {
        cy.shouldNotRunOnCloudEdition();
    });

    beforeEach(() => {
        // # Login as sysadmin
        cy.apiAdminLogin();

        // # Create new team and new user and visit test channel
        cy.apiInitSetup().then(({team, channel, channelUrl}) => {
            testTeam = team;
            testChannel = channel;

            cy.apiCreateUser().then(({user: user2}) => {
                otherUser = user2;

                cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, otherUser.id);
                });
            });

            cy.visit(channelUrl);
        });
    });

    it('MM-T346 Public link related to a deleted post should no longer open the file', () => {
        // # Enable option for public file links
        cy.apiUpdateConfig({
            FileSettings: {
                EnablePublicLink: true,
            },
        }).then(({config}) => {
            expect(config.FileSettings.EnablePublicLink).to.be.true;

            // # Reload then stub the clipboard
            cy.reload();
            stubClipboard().as('clipboard');

            const filename = 'jpg-image-file.jpg';

            // # Make a post with a file attached
            cy.get('#fileUploadInput').attachFile(filename);
            cy.postMessage('Post with attachment to be deleted');

            // # Open file preview
            cy.uiGetFileThumbnail(filename).click();

            // * Verify preview modal is opened
            cy.uiGetFilePreviewModal();

            // # Hover over the downlink button and verify that tooltip is shown
            cy.uiGetDownloadLinkFilePreviewModal().trigger('mouseenter');
            cy.findByText('Get a public link').should('exist');

            // # Copy download link
            cy.uiGetDownloadLinkFilePreviewModal().click();

            // Ensure that the clipboard is called then save its content
            cy.get('@clipboard').its('wasCalled').should('eq', true);
            cy.get('@clipboard').
                its('contents').
                as('publicLinkOfAttachment').
                then((url) => {
                    cy.request({url}).then((response) => {
                        // * Verify that the link no longer exists in the system
                        expect(response.status).to.be.equal(200);
                    });
                });

            // # Wait a little for link to get generate
            cy.wait(TIMEOUTS.ONE_SEC);

            // # Close the image preview modal
            cy.uiCloseFilePreviewModal();

            // # Once again get the last post with attachment, this time to delete it
            cy.getLastPostId().then((lastPostId) => {
                // # Click post dot menu in center.
                cy.clickPostDotMenu(lastPostId);

                // # Scan inside the post menu dropdown
                cy.get(`#CENTER_dropdown_${lastPostId}`).
                    should('exist').
                    within(() => {
                        // # Click on the delete post button from the dropdown
                        cy.findByText('Delete').click();
                    });
            });

            // * Verify caution dialog for delete post is visible
            cy.get('.modal-dialog').
                should('be.visible').
                within(() => {
                    // # Confirm click on the delete button for the post
                    cy.findByText('Delete').click();
                });

            // # Try to fetch the url of the attachment we previously deleted
            cy.get('@publicLinkOfAttachment').then((url) => {
                cy.request({url, failOnStatusCode: false}).then((response) => {
                    // * Verify that the link no longer exists in the system
                    expect(response.status).to.be.equal(404);
                });

                // # Open the deleted link in the browser
                cy.visit(url, {failOnStatusCode: false});
            });

            // * Verify that we land on attachment not found page
            cy.findByText('Error');
            cy.findByText('Unable to get the file info.');
            cy.findByText('Back to Mattermost').
                parent().
                should('have.attr', 'href', '/').
                click();
        });
    });

    it('MM-T345 Public links for common file types should open in a new browser tab', () => {
        // # Enable option for public file links
        cy.apiUpdateConfig({
            FileSettings: {
                EnablePublicLink: true,
            },
        });

        cy.reload();
        stubClipboard().as('clipboard');

        // # Save Show Preview Preference to true
        cy.apiSaveLinkPreviewsPreference('true');

        // # Save Preview Collapsed Preference to false
        cy.apiSaveCollapsePreviewsPreference('false');

        const commonTypeFiles = [
            'jpg-image-file.jpg',
            'gif-image-file.gif',
            'png-image-file.png',
            'tiff-image-file.tif',
            'mp3-audio-file.mp3',
            'mp4-video-file.mp4',
            'mpeg-video-file.mpg',
        ];

        commonTypeFiles.forEach((filename) => {
            // # Make a post with a file attached
            cy.get('#fileUploadInput').attachFile(filename);
            cy.wait(TIMEOUTS.ONE_SEC);
            cy.postMessage(filename);

            // # Open file preview
            cy.uiGetFileThumbnail(filename).click();

            // * Verify preview modal is opened
            cy.uiGetFilePreviewModal();

            // # Hover over the downlink button and verify that tooltip is shown
            cy.uiGetDownloadLinkFilePreviewModal().trigger('mouseenter');
            cy.findByText('Get a public link').should('exist');

            // # Click to copy download link
            cy.uiGetDownloadLinkFilePreviewModal().click({force: true});

            // # Wait a little for url to be (re)generated
            cy.wait(TIMEOUTS.ONE_SEC);

            // Ensure that the clipboard is called then save its content
            cy.get('@clipboard').its('wasCalled').should('eq', true);
            cy.get('@clipboard').
                its('contents').
                as('link').
                then((publicLinkOfAttachment) => {
                    // # Close the image preview modal
                    cy.uiCloseFilePreviewModal();

                    // # Post the link of attachment as a message
                    cy.uiPostMessageQuickly(publicLinkOfAttachment);

                    // * Check the attachment url contains the attachment
                    downloadAttachmentAndVerifyItsProperties(publicLinkOfAttachment, filename, 'inline');
                });
        });
    });
});
