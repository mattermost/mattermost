// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Show GIF images properly', () => {
    let offtopiclink;

    const selector = {
        gifFile: 'img[aria-label*="file thumbnail"]',
        sendButton: '[data-testid="SendMessageButton"]',
        staticGifCanvas: '[data-testid="static-gif-canvas"]',
        gifButton: '[data-testid="play-pause-gif-button"]',
        attachmentImage: '.attachment__image',
        markdownImage: '.markdown-inline-img',
    };

    const gifLink = {
        tenor: 'https://media.tenor.com/yCFHzEvKa9MAAAAi/hello.gif',
        giphy: 'https://media.giphy.com/media/XIqCQx02E1U9W/giphy.gif',
    };

    before(() => {
        // # Set the configuration on Link Previews and GIF picker.
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableLinkPreviews: true,
                EnableGifPicker: true,
            },
        });

        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            offtopiclink = `/${team.name}/channels/off-topic`;
            cy.visit(offtopiclink);
        });
    });

    beforeEach(() => {
        // # Got to a test channel on the side bar
        cy.get('#sidebarItem_off-topic').click({force: true});

        // * Validate if the channel has been opened
        cy.url().should('include', offtopiclink);
    });

    it('MM-T3318 Posting GIFs', () => {
        // # Post tenor GIF
        cy.postMessage(gifLink.tenor);

        cy.getLastPostId().as('postId').then((postId) => {
            // * Validate image size
            cy.get(`#post_${postId}`).find(selector.attachmentImage).should('have.css', 'width', '189px');
        });

        // # Post giphy GIF
        cy.postMessage(gifLink.giphy);

        cy.getLastPostId().as('postId').then((postId) => {
            // * Validate image size
            cy.get(`#post_${postId}`).find(selector.attachmentImage).invoke('outerWidth').should('be.gte', 480);
        });
    });

    it('MM-{Zephyr Test Number here} Toggling the GIF autoplay setting off shows a static GIF for GIFs posted as links', () => {
        // # Toggle autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post tenor GIF
        cy.postMessage(gifLink.tenor);

        cy.getLastPostId().as('postId').then((postId) => {
            // * Verify the static GIF is visible and has the right dimensions.
            cy.get(`#post_${postId}`).find(selector.staticGifCanvas).should('be.visible').and('have.attr', 'width', '189').and('have.attr', 'height', '200');

            // * Ensure the play button is visible.
            cy.get(`#post_${postId}`).find(selector.gifButton).should('be.visible');

            // * Ensure the canvas' image reference is hidden.
            cy.get(`#post_${postId}`).find(selector.attachmentImage).should('have.css', 'display', 'none');
        });

        // # Post GIPHY GIF
        cy.postMessage(gifLink.giphy);

        cy.getLastPostId().as('postId').then((postId) => {
            // * Validate static GIF is visible and has the right dimensions.
            cy.get(`#post_${postId}`).find(selector.staticGifCanvas).should('be.visible').and('have.attr', 'width', '500').and('have.attr', 'height', '280');

            // * Ensure the play button is visible.
            cy.get(`#post_${postId}`).find(selector.gifButton).should('be.visible');

            // * Ensure the canvas' image reference is hidden.
            cy.get(`#post_${postId}`).find(selector.attachmentImage).should('have.css', 'display', 'none');
        });
    });

    it('MM-{Zephyr Test Number here} Toggling the GIF autoplay setting off shows a static GIF for GIFs uploaded as images', () => {
        // # Toggle autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Upload a GIF on center view.
        postGifAttachment();

        // * Verify a static GIF is shown.
        verifyGifStatus(selector.gifFile, true);
    });

    it('MM-{Zephyr Test Number here} Toggling the GIF autoplay setting off shows a static GIF for GIFs posted via GIPHY in the emoji picker', () => {
        // # Toggle autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post a GIF from GIPHY using the emoji picker.
        postGiphyGif();

        // * Verify the play button is visible and the canvas image reference is hidden.
        verifyGifStatus(selector.markdownImage, true);
    });

    it('MM-{Zephyr Test Number here} Toggling the GIF autoplay setting on shows a playing GIF for GIFs posted as links', () => {
        // # Toggle autoplay off since it's on by default.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post tenor GIF
        cy.postMessage(gifLink.tenor);

        // # Toggle autoplay on.
        toggleAutoplayGifsAndEmojisSetting(false);

        // * Verify the play button is visible and the canvas image reference is hidden.
        verifyGifStatus(undefined, false);

        // # Toggle autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post giphy GIF
        cy.postMessage(gifLink.giphy);

        // # Toggle autoplay on.
        toggleAutoplayGifsAndEmojisSetting(false);

        // * Verify the play button is visible and the canvas image reference is hidden.
        verifyGifStatus(undefined, false);
    });

    it('MM-{Zephyr Test Number here} Toggling the GIF autoplay setting on shows a playing GIF for GIFs uploaded as images', () => {
        // # Toggle autoplay off since it's on by default.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Upload a GIF on center view.
        postGifAttachment();

        // # Toggle autoplay on.
        toggleAutoplayGifsAndEmojisSetting(false);

        // * Verify a playing GIF is shown.
        verifyGifStatus(selector.gifFile, false);
    });

    it('MM-{Zephyr Test Number here} Toggling the GIF autoplay setting on shows a playing GIF for GIFs posted via GIPHY in the emoji picker', () => {
        // # Toggle autoplay off since it's on by default.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post a GIF from GIPHY.
        postGiphyGif();

        // # Toggle autoplay on.
        toggleAutoplayGifsAndEmojisSetting(false);

        // * Verify the pause button is hidden initially and the GIF is playing.
        verifyGifStatus(selector.markdownImage, false);
    });

    it('MM-{Zephyr Test Number here} Clicking a GIF\'s pause button shows a static GIF for GIFs posted as links', () => {
        // # Post giphy GIF
        cy.postMessage(gifLink.giphy);

        // * Click the pause button and verify the static GIF is shown.
        clickGifButtonAndVerify(selector.attachmentImage, false);

        // # Post tenor GIF
        cy.postMessage(gifLink.tenor);

        // * Click the pause button and verify the static GIF is shown.
        clickGifButtonAndVerify(selector.attachmentImage, false);
    });

    it('MM-{Zephyr Test Number here} Clicking a GIF\'s pause button shows a static GIF for GIFs uploaded as images', () => {
        // # Upload a GIF on center view.
        postGifAttachment();

        // * Click the pause button and verify the static GIF is shown.
        clickGifButtonAndVerify(selector.gifFile, false);
    });

    it('MM-{Zephyr Test Number here} Clicking a GIF\'s pause button shows a static GIF for GIFs posted via GIPHY in the emoji picker', () => {
        // # Post a GIPHY gif.
        postGiphyGif();

        // * Click the pause button and verify the static GIF is shown.
        clickGifButtonAndVerify(undefined, false);
    });

    it('MM-{Zephyr Test Number here} Clicking a GIF\'s play button shows a playing GIF for GIFs posted as links', () => {
        // # Turn autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post tenor GIF
        cy.postMessage(gifLink.tenor);

        // * Verify the GIF is playing after clicking the play button.
        clickGifButtonAndVerify(selector.attachmentImage);

        // # Post giphy GIF
        cy.postMessage(gifLink.giphy);

        // * Verify the GIF is playing after clicking the play button.
        clickGifButtonAndVerify(selector.attachmentImage);
    });

    it('MM-{Zephyr Test Number here} Clicking a GIF\'s play button shows a playing GIF for GIFs uploaded as images', () => {
        // # Turn autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Upload a GIF on center view.
        postGifAttachment();

        // * Verify the GIF is playing after clicking the play button.
        clickGifButtonAndVerify(selector.gifFile);
    });

    it('MM-{Zephyr Test Number here} Clicking a GIF\'s play button shows a playing GIF for GIFs posted via GIPHY in the emoji picker', () => {
        // # Turn autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post a GIPHY gif.
        postGiphyGif();

        // * Verify the GIF is playing after clicking the play button.
        clickGifButtonAndVerify();
    });

    // If all the tests above pass, we now have enough confidence to use a GIF posted in any way rather than
    // testing all the ways GIFs can be uploaded.
    it('MM-{Zephyr Test Number here} Clicking a static GIF opens it in an enlarged view', () => {
        // # Turn autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post GIPHY gif.
        postGiphyGif();

        // Reload the page because the default image thumbnail is shown the first time you click a GIF after
        // uploading it.
        cy.reload();

        cy.getLastPostId().as('postId').then((postId) => {
            cy.get(`#post_${postId}`).as('lastPost').find('img.markdown-inline-img').then((image) => {
                // # Click the static GIF.
                cy.get('@lastPost').find(selector.staticGifCanvas).should('be.visible').parent().click('right');

                // * Verify the dialog is opened and the image preview shows the correct GIF.
                cy.findByRole('dialog').should('exist').within(() => {
                    cy.get('[data-testid="imagePreview"]').should('be.visible').and('have.attr', 'src', `${image[0].getAttribute('src')}`);

                    // # Close the modal.
                    cy.findByLabelText('Close').click();
                });
            });
        });
    });

    it('MM-{Zephyr Test Number here} Starting a thread from a static GIF shows a static GIF as the thread\'s original post', () => {
        // # Turn autoplay off.
        toggleAutoplayGifsAndEmojisSetting(true);

        // # Post GIPHY gif.
        postGiphyGif();

        // * Verify the thread's original post is a static GIF.
        verifyThreadGifStatus(true, selector.markdownImage);
    });

    it('MM-{Zephyr Test Number here} Starting a thread from a playing GIF shows a playing GIF as the thread\'s original post', () => {
        // # Turn autoplay on.
        toggleAutoplayGifsAndEmojisSetting(false);

        // # Post GIPHY gif.
        postGiphyGif();

        // * Verify the thread's original post is a playing GIF.
        verifyThreadGifStatus(false, selector.markdownImage);
    });
});

function toggleAutoplayGifsAndEmojisSetting(toggleOff = true) {
    // # Open the Settings modal.
    cy.uiOpenSettingsModal('Display').within(() => {
        // # Open 'Enable Join/Leave Messages' and turn it off
        cy.findByRole('heading', {name: 'Autoplay GIFs and Emojis'}).click();
        cy.findByRole('radio', {name: toggleOff ? 'Off' : 'On'}).click();

        // # Save and close the modal
        cy.uiSave();
        cy.uiClose();
    });
}

function postGiphyGif() {
    // # Open the emoji picker.
    cy.get('#emojiPickerButton').click();

    // # Click the GIF tab.
    cy.get('#emoji-picker-tabs-tab-2').should('exist').click();

    // # Click the first GIF from GIPHY.
    cy.get('.giphy-grid').within(() => {
        cy.get('a').eq(0).click();
    });

    // # Post the GIF.
    cy.get('[data-testid="SendMessageButton"]').click();
}

function postGifAttachment() {
    // # Upload a GIF on center view.
    cy.get('#fileUploadInput').attachFile('animated-gif-image-file.gif');

    // Post the GIF.
    cy.get('[data-testid="SendMessageButton"]').click();
}

function clickGifButtonAndVerify(imageSelector = 'img.markdown-inline-img', shouldPlayGif = true) {
    const gifButtonSelector = '[data-testid="play-pause-gif-button"]';
    const staticGifCanvasSelector = '[data-testid="static-gif-canvas"]';
    const gifText = 'GIF';

    if (shouldPlayGif) {
        cy.getLastPostId().as('postId').then((postId) => {
            // # Click the play button.
            cy.get(`#post_${postId}`).find(gifButtonSelector).should('have.text', gifText).click();

            // * Verify static GIF is not visible.
            cy.get(`#post_${postId}`).find(staticGifCanvasSelector).should('not.be.visible');

            // * Verify the playing GIF is visible.
            cy.get(`#post_${postId}`).find(imageSelector).should('have.css', 'display', 'block');

            // * Verify the pause button is hidden initially.
            cy.get(`#post_${postId}`).find(gifButtonSelector).should('not.be.visible');
        });
    } else {
        cy.getLastPostId().as('postId').then((postId) => {
            // # Click the pause button.
            cy.get(`#post_${postId}`).find(`.image-loaded-container>${gifButtonSelector}`).should('not.have.text', gifText).click({force: true});

            // * Verify static GIF is visible.
            cy.get(`#post_${postId}`).find(staticGifCanvasSelector).should('be.visible');

            // * Verify the playing GIF is hidden.
            cy.get(`#post_${postId}`).find(imageSelector).should('have.css', 'display', 'none');

            // * Verify the play button is visible.
            cy.get(`#post_${postId}`).find(gifButtonSelector).should('be.visible');
        });
    }
}

function verifyGifStatus(imageSelector = '.attachment__image', isStaticGif = true) {
    const gifButtonSelector = '[data-testid="play-pause-gif-button"]';
    const staticGifCanvasSelector = '[data-testid="static-gif-canvas"]';

    if (isStaticGif) {
        cy.getLastPostId().as('postId').then((postId) => {
            // * Verify the static GIF is visible.
            cy.get(`#post_${postId}`).find(staticGifCanvasSelector).should('be.visible');

            // * Ensure the play button is visible.
            cy.get(`#post_${postId}`).find(gifButtonSelector).should('be.visible');

            // * Ensure the canvas' image reference is hidden.
            cy.get(`#post_${postId}`).find(imageSelector).should('have.css', 'display', 'none');
        });
    } else {
        cy.getLastPostId().as('postId').then((postId) => {
            // * Verify the static GIF is not visible.
            cy.get(`#post_${postId}`).find(staticGifCanvasSelector).should('not.be.visible');

            // * Ensure the pause button is initially hidden.
            cy.get(`#post_${postId}`).find(gifButtonSelector).should('not.be.visible');

            // * Ensure the playing GIF is visible.
            cy.get(`#post_${postId}`).find(imageSelector).should('have.css', 'display', 'block');
        });
    }
}

function verifyThreadGifStatus(channelGifIsStatic, imageSelector) {
    // # Click the post to open a thread.
    cy.getLastPostId().as('postId').then((postId) => {
        cy.get(`#post_${postId}`).as('postId').then((lastPost) => {
            cy.get('@postId').find(imageSelector).then((channelGif) => {
                cy.wrap(lastPost).click();

                // * Verify RHS is opened.
                cy.get('#rhsContainer').should('be.visible').within(() => {
                    // * Verify the user is viewing a thread.
                    cy.get('.ThreadViewer').should('exist');

                    // * Verify the thread's original post GIF is the same as the GIF in the channel and either
                    // plays or is static accordingly.
                    cy.findByLabelText('file thumbnail').should('have.attr', 'src', channelGif[0].getAttribute('src')).and(channelGifIsStatic ? 'not.be.visible' : 'be.visible').then(() => {
                        // * Verify the correct GIF is shown.
                        cy.get('[data-testid="static-gif-canvas"]').should('exist').and(channelGifIsStatic ? 'be.visible' : 'not.be.visible');
                    });

                    // # Close the RHS.
                    cy.get('#rhsCloseButton').click();
                });
            });
        });
    });
}
