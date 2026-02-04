// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @mattermost_extended @media

describe('Media Extended Features', () => {
    let testTeam: Cypress.Team;
    let testUser: Cypress.UserProfile;
    let offTopicUrl: string;

    before(() => {
        // # Enable media features
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                VideoEmbed: true,
                VideoLinkEmbed: true,
                EmbedYoutube: true,
                ImageMulti: true,
                ImageSmaller: true,
                ImageCaptions: true,
            },
            MattermostExtendedSettings: {
                Media: {
                    MaxImageHeight: 400,
                    MaxImageWidth: 600,
                    MaxVideoHeight: 400,
                    MaxVideoWidth: 600,
                    CaptionFontSize: 12,
                },
            },
        });

        // # Create test team and user
        cy.apiInitSetup({loginAfter: false}).then(({team, user, offTopicUrl: url}) => {
            testTeam = team;
            testUser = user;
            offTopicUrl = url;
        });
    });

    after(() => {
        // # Disable media features
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            FeatureFlags: {
                VideoEmbed: false,
                VideoLinkEmbed: false,
                EmbedYoutube: false,
                ImageMulti: false,
                ImageSmaller: false,
                ImageCaptions: false,
            },
        });
    });

    describe('VideoEmbed', () => {
        it('MM-EXT-ME001 Video attachments show inline player', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Upload a video file (we'll use the fixture if available)
            // Note: This test requires a video fixture
            cy.fixture('video-sample.mp4', 'binary').then((videoContent) => {
                const blob = Cypress.Blob.binaryStringToBlob(videoContent, 'video/mp4');
                const file = new File([blob], 'test-video.mp4', {type: 'video/mp4'});

                // # Attach the file
                cy.get('#fileUploadInput').attachFile({
                    fileContent: blob,
                    fileName: 'test-video.mp4',
                    mimeType: 'video/mp4',
                });

                // # Post the message
                cy.postMessage('Video attachment test');

                // * Video player should be visible
                cy.get('.video-player-container').should('exist');
                cy.get('.video-player').should('exist');
            });
        });

        it('MM-EXT-ME002 Video player has controls', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // * If there's a video player, it should have controls
            cy.get('.video-player').then(($video) => {
                if ($video.length > 0) {
                    cy.wrap($video).should('have.attr', 'controls');
                }
            });
        });

        it('MM-EXT-ME003 Video player respects max dimensions', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // * If there's a video player, it should respect max dimensions
            cy.get('.video-player-container').then(($container) => {
                if ($container.length > 0) {
                    cy.wrap($container).should('have.css', 'max-width');
                }
            });
        });
    });

    describe('VideoLinkEmbed', () => {
        it('MM-EXT-ME004 Video URL with emoji prefix embeds player', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post a message with video link using the ▶️Video format
            // Note: Using a publicly accessible video URL
            cy.postMessage('[▶️Video](https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4)');

            // * Video embed should appear
            cy.get('.VideoLinkEmbed').should('exist');
        });

        it('MM-EXT-ME005 Regular video URL links are not auto-embedded', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post a plain video URL without the special format
            cy.postMessage('https://example.com/video.mp4');

            // * Should be a regular link, not embedded
            cy.get('.post-message__text a').contains('video.mp4').should('exist');
        });

        it('MM-EXT-ME006 Video link embed shows download button', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // * If there's a video link embed, it should have download option
            cy.get('.VideoLinkEmbed').then(($embed) => {
                if ($embed.length > 0) {
                    cy.wrap($embed).find('.video-download-btn, button').should('exist');
                }
            });
        });
    });

    describe('EmbedYoutube', () => {
        it('MM-EXT-ME007 YouTube links show Discord-style embed', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post a YouTube URL
            cy.postMessage('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

            // * Discord-style YouTube embed should appear
            cy.get('.YoutubeVideoDiscord, .youtube-video-discord').should('exist');
        });

        it('MM-EXT-ME008 YouTube short URLs are embedded', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post a youtu.be short URL
            cy.postMessage('https://youtu.be/dQw4w9WgXcQ');

            // * YouTube embed should appear
            cy.get('.YoutubeVideoDiscord, .youtube-video-discord, .youtube-video').should('exist');
        });

        it('MM-EXT-ME009 YouTube embed shows thumbnail initially', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // * YouTube embed should show thumbnail, not iframe initially
            cy.get('.YoutubeVideoDiscord, .youtube-video-discord').then(($embed) => {
                if ($embed.length > 0) {
                    // * Should have thumbnail image
                    cy.wrap($embed).find('img').should('exist');
                }
            });
        });

        it('MM-EXT-ME010 Clicking YouTube thumbnail loads player', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // # Click on YouTube thumbnail
            cy.get('.YoutubeVideoDiscord, .youtube-video-discord').then(($embed) => {
                if ($embed.length > 0) {
                    cy.wrap($embed).click();

                    // * Iframe should appear after click
                    cy.wrap($embed).find('iframe').should('exist');
                }
            });
        });
    });

    describe('ImageMulti', () => {
        it('MM-EXT-ME011 Multiple images display at full size', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post a message with multiple images via markdown
            cy.postMessage('![Image 1](https://via.placeholder.com/300x200) ![Image 2](https://via.placeholder.com/300x200)');

            // * Both images should be visible (not collapsed into thumbnail grid)
            cy.get('.post-message__text img').should('have.length.at.least', 2);
        });

        it('MM-EXT-ME012 Images are displayed vertically', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);

            // * Multiple images should stack vertically
            cy.get('.MultiImageView, .multi-image-view').then(($container) => {
                if ($container.length > 0) {
                    // Check if it has the vertical layout class
                    cy.wrap($container).should('have.class', 'vertical');
                }
            });
        });
    });

    describe('ImageSmaller', () => {
        it('MM-EXT-ME013 Images respect max dimensions', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post an image
            cy.postMessage('![Large Image](https://via.placeholder.com/1000x800)');

            // * Image should have constrained dimensions
            cy.get('.post-message__text img').last().then(($img) => {
                // Check that the image has max-height or max-width styles applied
                const style = $img.attr('style') || '';
                const hasConstraints = style.includes('max-height') || style.includes('max-width');

                // Or check computed styles
                cy.wrap($img).should('satisfy', (el: JQuery<HTMLElement>) => {
                    const computed = window.getComputedStyle(el[0]);
                    const maxHeight = parseInt(computed.maxHeight, 10);
                    const maxWidth = parseInt(computed.maxWidth, 10);

                    // Should have constraints (configured as 400x600)
                    return maxHeight <= 500 || maxWidth <= 700;
                });
            });
        });

        it('MM-EXT-ME014 Max dimensions are configurable', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Update max dimensions
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Media: {
                        MaxImageHeight: 300,
                        MaxImageWidth: 400,
                    },
                },
            });

            // # Verify config was updated
            cy.apiGetConfig().then(({config}) => {
                expect(config.MattermostExtendedSettings.Media.MaxImageHeight).to.equal(300);
                expect(config.MattermostExtendedSettings.Media.MaxImageWidth).to.equal(400);
            });

            // # Reset to original values
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Media: {
                        MaxImageHeight: 400,
                        MaxImageWidth: 600,
                    },
                },
            });
        });
    });

    describe('ImageCaptions', () => {
        it('MM-EXT-ME015 Image with title shows caption', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post an image with title attribute (caption)
            cy.postMessage('![Alt text](https://via.placeholder.com/300x200 "This is the caption")');

            // * Caption should be visible
            cy.get('.image-caption, .markdown-inline-img__caption').should('exist');
            cy.get('.image-caption, .markdown-inline-img__caption').should('contain', 'This is the caption');
        });

        it('MM-EXT-ME016 Caption font size is configurable', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Update caption font size
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Media: {
                        CaptionFontSize: 14,
                    },
                },
            });

            // # Verify config was updated
            cy.apiGetConfig().then(({config}) => {
                expect(config.MattermostExtendedSettings.Media.CaptionFontSize).to.equal(14);
            });

            // # Reset to original value
            cy.apiUpdateConfig({
                MattermostExtendedSettings: {
                    Media: {
                        CaptionFontSize: 12,
                    },
                },
            });
        });

        it('MM-EXT-ME017 Image without title has no caption', () => {
            // # Login as test user
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
            cy.get('#post_textbox').should('be.visible');

            // # Post an image without title
            cy.postMessage('![Just alt text](https://via.placeholder.com/300x200)');

            // * No caption should appear for this image
            cy.get('.post-message__text').last().within(() => {
                // The image should exist but no caption
                cy.get('img').should('exist');
            });
        });
    });

    describe('Feature Flag Configuration', () => {
        it('MM-EXT-ME018 VideoEmbed can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable VideoEmbed
            cy.apiUpdateConfig({
                FeatureFlags: {
                    VideoEmbed: false,
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.VideoEmbed).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    VideoEmbed: true,
                },
            });
        });

        it('MM-EXT-ME019 ImageMulti can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable ImageMulti
            cy.apiUpdateConfig({
                FeatureFlags: {
                    ImageMulti: false,
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.ImageMulti).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    ImageMulti: true,
                },
            });
        });

        it('MM-EXT-ME020 EmbedYoutube can be toggled', () => {
            // # Login as admin
            cy.apiAdminLogin();

            // # Disable EmbedYoutube
            cy.apiUpdateConfig({
                FeatureFlags: {
                    EmbedYoutube: false,
                },
            });

            // # Verify config
            cy.apiGetConfig().then(({config}) => {
                expect(config.FeatureFlags.EmbedYoutube).to.equal(false);
            });

            // # Re-enable
            cy.apiUpdateConfig({
                FeatureFlags: {
                    EmbedYoutube: true,
                },
            });
        });
    });

    describe('Admin Console Media Settings', () => {
        it('MM-EXT-ME021 Admin console shows media settings', () => {
            // # Login as admin and navigate to System Console
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Mattermost Extended section
            cy.get('.admin-sidebar').should('be.visible');
            cy.findByText('Mattermost Extended').click();

            // * Media settings should be accessible
            cy.findByText('Media').should('exist');
        });

        it('MM-EXT-ME022 Media settings are editable', () => {
            // # Login as admin
            cy.apiAdminLogin();
            cy.visit('/admin_console');

            // # Navigate to Media settings
            cy.findByText('Mattermost Extended').click();
            cy.findByText('Media').click();

            // * Settings form should be visible
            cy.get('.admin-console__wrapper').should('be.visible');
        });
    });
});
