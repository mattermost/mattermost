// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const timeouts = require('../../../fixtures/timeouts');

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @scroll

describe('Scroll', () => {
    let testTeam;
    let testChannel;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
            },
        });

        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
        });
    });

    it('MM-T2368 Fixed width', () => {
        const link = 'https://www.bbc.com/news/uk-wales-45142614';
        const gifLink = '![gif](http://i.giphy.com/xNrM4cGJ8u3ao.gif)';
        const firstMessage = 'This is the first post';
        const lastMessage = 'This is the last post';

        // Assigning alias to posted message ids
        cy.postMessage(firstMessage);
        cy.getLastPostId().as('firstPostId');
        cy.postMessage(link);
        cy.getLastPostId().as('linkPreviewPostId');
        cy.postMessage(gifLink);
        cy.getLastPostId().as('gifLinkPostId');

        // Posting different type of images and videos
        const commonTypeFiles = [
            'jpg-image-file.jpg',
            'gif-image-file.gif',
            'mp3-audio-file.mp3',
            'mpeg-video-file.mpg',
        ];
        commonTypeFiles.forEach((file) => {
            cy.get('#fileUploadInput').selectFile(`tests/fixtures/${file}`, {force: true}).wait(timeouts.HALF_SEC);
            cy.postMessage(`Attached with ${file}`);
            cy.getLastPostId().as(`${file}PostId`);
        });
        cy.postMessage(lastMessage);
        cy.getLastPostId().as('lastPostId');

        // Getting height of each post before applying 'Fixed width, centered' option and assigning to alias
        cy.findAllByLabelText('sysadmin').eq(0).invoke('height').then((height) => {
            cy.wrap(height).as('initialUserNameHeight');
        });
        getComponentByText('@firstPostId', firstMessage).invoke('height').then((height) => {
            cy.wrap(height).as('initialFirstPostHeight');
        });
        getFileThumbnail('mp3-audio-file.mp3').invoke('height').then((height) => {
            cy.wrap(height).as('initialMp3Height');
        });
        getFileThumbnail('mpeg-video-file.mpg').invoke('height').then((height) => {
            cy.wrap(height).as('initialMpgHeight');
        });
        getFileThumbnail('gif-image-file.gif').invoke('height').then((height) => {
            cy.wrap(height).as('initialGifHeight');
        });
        getFileThumbnail('jpg-image-file.jpg').invoke('height').then((height) => {
            cy.wrap(height).as('initialJpgHeight');
        });
        getComponentBySelector('@linkPreviewPostId', '.PostAttachmentOpenGraph__image').invoke('height').then((height) => {
            cy.wrap(height).as('initialAttachmentHeight');
        });
        getComponentBySelector('@gifLinkPostId', 'img[aria-label="file thumbnail"]').invoke('height').then((height) => {
            cy.wrap(height).as('initialInlineImgHeight');
        });
        getComponentByText('@lastPostId', lastMessage).invoke('height').then((height) => {
            cy.wrap(height).as('initialLastPostHeight');
        });

        // # Switch the settings for the test user to enable Fixed width center
        cy.uiOpenSettingsModal('Display').within(() => {
            cy.findByText('Display', {timeout: timeouts.ONE_MIN}).click();
            cy.findByText('Channel Display').click();
            cy.findByLabelText('Fixed width, centered').click();
            cy.uiSaveAndClose();
        });

        // # Browse to Channel
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

        // * Verify All posts are displayed correctly
        cy.findAllByTestId('postContent').should('have.length', '9').and('have.class', 'post__content center');

        // * Verify there is no scroll pop
        cy.get('#post-list').should('exist').within(() => {
            cy.get('@initialUserNameHeight').then((originalHeight) => {
                cy.findAllByLabelText('sysadmin').eq(0).invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialFirstPostHeight').then((originalHeight) => {
                getComponentByText('@firstPostId', firstMessage).invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialLastPostHeight').then((originalHeight) => {
                getComponentByText('@lastPostId', lastMessage).invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialMp3Height').then((originalHeight) => {
                getFileThumbnail('mp3-audio-file.mp3').invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialMpgHeight').then((originalHeight) => {
                getFileThumbnail('mpeg-video-file.mpg').invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialGifHeight').then((originalHeight) => {
                getFileThumbnail('gif-image-file.gif').invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialJpgHeight').then((originalHeight) => {
                getFileThumbnail('jpg-image-file.jpg').invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialInlineImgHeight').then((originalHeight) => {
                getComponentBySelector('@gifLinkPostId', 'img[aria-label="file thumbnail"]').invoke('height').should('be.equal', originalHeight);
            });
            cy.get('@initialAttachmentHeight').then((originalHeight) => {
                getComponentBySelector('@linkPreviewPostId', '.PostAttachmentOpenGraph__image').invoke('height').should('be.equal', originalHeight);
            });
        });
    });

    // Get thumbnail component based on filename
    const getFileThumbnail = (filename) => {
        return cy.get(`@${filename}PostId`).then((postId) => {
            cy.get(`#${postId}_message`).findByLabelText(`file thumbnail ${filename}`);
        });
    };

    // Get component by alias and selector
    const getComponentBySelector = (alias, selector) => {
        return cy.get(alias).then((postId) => {
            cy.get(`#${postId}_message`).find(selector);
        });
    };

    // Get component by alias and text
    const getComponentByText = (alias, text) => {
        return cy.get(alias).then((postId) => {
            cy.get(`#${postId}_message`).findByText(text);
        });
    };
});
