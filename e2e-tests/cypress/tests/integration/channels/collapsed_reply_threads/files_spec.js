// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads

import * as MESSAGES from '../../../fixtures/messages';
import {waitUntilUploadComplete, interceptFileUpload} from '../files_and_attachments/helpers';

describe('Collapsed Reply Threads', () => {
    let testTeam;
    let testChannel;
    let user1;

    const files = [
        {
            testCase: 'MM-T4777_2',
            filename: 'word-file.doc',
            extensions: 'DOC',
            icon: 'icon-file-word-outline',
        },
        {
            testCase: 'MM-T4777_3',
            filename: 'wordx-file.docx',
            extensions: 'DOCX',
            icon: 'icon-file-word-outline',
        },
        {
            testCase: 'MM-T4777_4',
            filename: 'powerpoint-file.ppt',
            extensions: 'PPT',
            icon: 'icon-file-powerpoint-outline',
        },
        {
            testCase: 'MM-T4777_5',
            filename: 'powerpointx-file.pptx',
            extensions: 'PPTX',
            icon: 'icon-file-powerpoint-outline',
        },
        {
            testCase: 'MM-T4777_6',
            filename: 'mp3-audio-file.mp3',
            extensions: 'MP3',
            icon: 'icon-file-audio-outline',
        },
        {
            testCase: 'MM-T4777_7',
            filename: 'mp4-video-file.mp4',
            extensions: 'MP4',
            icon: 'icon-file-video-outline',
        },
        {
            testCase: 'MM-T4777_8',
            filename: 'theme.json',
            extensions: 'JSON',
            icon: 'icon-file-code-outline',
        },
    ];

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_off',
            },
        });

        // # Create new channel and other user, and add other user to channel
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, channel, user}) => {
            testTeam = team;
            user1 = user;
            testChannel = channel;

            cy.apiSaveCRTPreference(user1.id, 'on');
        });
    });

    beforeEach(() => {
        // # Visit the channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        interceptFileUpload();
    });

    it('MM-T4777_1 should show image thumbnail in thread list item', () => {
        const image = 'jpg-image-file.jpg';

        cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(image);
        waitUntilUploadComplete();
        cy.get('.post-image__thumbnail').should('be.visible');
        cy.uiGetPostTextBox().clear().type('{enter}');

        cy.getLastPostId().then((rootId) => {
            // # Post a reply to create a thread and follow
            cy.postMessageAs({sender: user1, message: MESSAGES.SMALL, channelId: testChannel.id, rootId});

            // # Visit Global Threads
            cy.uiClickSidebarItem('threads');

            // * Text should be the filename
            cy.get('.file_card__name').should('have.text', image);

            // * Image should be shown
            cy.get('.file_card__image.post-image.small').should('be.visible');

            // # Cleanup
            cy.apiDeletePost(rootId);
        });
    });

    files.forEach((file) => {
        it(`${file.testCase} should display correct icon for ${file.extensions} on threads list`, () => {
            // # Post a file
            cy.get('#advancedTextEditorCell').find('#fileUploadInput').attachFile(file.filename);
            waitUntilUploadComplete();
            cy.get('.post-image__thumbnail').should('be.visible');
            cy.uiGetPostTextBox().clear().type('{enter}');

            cy.getLastPostId().then((rootId) => {
                // # Post a reply to create a thread and follow
                cy.postMessageAs({sender: user1, message: MESSAGES.SMALL, channelId: testChannel.id, rootId});

                // # Visit Global Threads
                cy.uiClickSidebarItem('threads');

                // * Thread item should display the correct icon
                cy.get('.file_card__attachment').should('have.class', file.icon);

                // * Thread item should display text
                cy.get('.file_card__name').should('have.text', file.filename);

                // # Cleanup
                cy.apiDeletePost(rootId);
            });
        });
    });
});
