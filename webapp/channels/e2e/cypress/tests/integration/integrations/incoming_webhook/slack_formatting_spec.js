// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @incoming_webhook

describe('Incoming webhook', () => {
    let testTeam;
    let testChannel;
    let incomingWebhook;
    let offTopicLink;
    let sysadminUser;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnablePostUsernameOverride: true,
                EnablePostIconOverride: true,
            },
        });

        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: false,
                description: 'Incoming webhook - basic formatting',
                display_name: 'basic-formatting',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });

            offTopicLink = `/${team.name}/channels/off-topic`;
        });

        cy.apiGetMe().then((me) => {
            sysadminUser = me.user;
        });
    });

    beforeEach(() => {
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
    });

    describe('MM-T626 Incoming webhook is only image and fallback text', () => {
        const id = 'MM-T626';

        const baseUrl = Cypress.config('baseUrl');
        const imageUrl = 'https://cdn.pixabay.com/photo/2017/10/10/22/24/wide-format-2839089_960_720.jpg';
        const imageSrc = `${baseUrl}/api/v4/image?url=${encodeURIComponent(imageUrl)}`;

        it('first payload', () => {
            const search = id + '-1';
            const payload = {text: search, attachments: [{fallback: 'fallback text', image_url: imageUrl}]};

            cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

            cy.getLastPost().within(() => {
                cy.get('.post-message__text').should('have.text', search);
                cy.get('.attachment__image').should('have.attr', 'src', imageSrc);
            });
        });

        it('second payload', () => {
            const search = id + '-2';
            const payload = {channel: 'off-topic', text: search, username: 'new_username', attachments: [{fallback: 'fallback text', image_url: imageUrl}], icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png'};

            cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});
            cy.visit(offTopicLink);

            cy.getLastPost().within(() => {
                cy.get('.post-message__text').should('have.text', search);
                cy.get('.attachment__image').should('have.attr', 'src', imageSrc);
            });
        });
    });

    describe('MM-T627 Images with tall and wide aspect ratios appear correctly', () => {
        const id = 'MM-T627';

        it('wide image', () => {
            const search = id + '-wide';
            const payload = {text: search, attachments: [{image_url: 'https://cdn.pixabay.com/photo/2017/10/10/22/24/wide-format-2839089_960_720.jpg'}]};

            cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

            // Original image is 960x246. 960/246 = ~3.9. Let's make sure image is rendered with 3.9 +/- 0.1

            cy.getLastPost().within(() => {
                cy.get('.post-message__text').should('have.text', search);
                const originalWidth = 960;
                const originalHeight = 246;
                const aspectRatio = originalWidth / originalHeight;
                cy.get('img.attachment__image').should('be.visible').and((img) => {
                    expect(img.width() / img.height()).to.be.closeTo(aspectRatio, 0.05);
                });
            });
        });

        it('tall image', () => {
            const search = id + '-tall';
            const payload = {text: search, attachments: [{image_url: 'https://media.npr.org/programs/atc/features/2009/may/short/abetall3-0483922b5fb40887fc9fbe20a606e256cbbd10ee-s800-c85.jpg'}]};

            cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

            cy.getLastPost().within(() => {
                cy.get('.post-message__text').should('have.text', search);
                const originalWidth = 385;
                const originalHeight = 916;
                const aspectRatio = originalWidth / originalHeight;
                cy.get('img.attachment__image').should('be.visible').and((img) => {
                    expect(img.width() / img.height()).to.be.closeTo(aspectRatio, 0.05);
                });
            });
        });
    });

    it('MM-T628 Incoming webhook supports Slack-style mentions', () => {
        const id = 'MM-T628';
        const text = `${id}: <!here> <!channel>`;

        const payload = {
            channel: testChannel.name,
            username: 'new_username',
            text,
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
        };

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.waitUntil(() => cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text > p')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes(id));
        }));

        cy.getLastPost().within(() => {
            cy.get('.post-message__text').within(() => {
                cy.get('.mention--highlight').eq(0).should('have.text', '@here');
                cy.get('.mention--highlight').eq(1).should('have.text', '@channel');
            });
        });
    });

    it('MM-T629 Incoming webhook with Slack attachment, mention in `pretext`', () => {
        const id = 'MM-T629';

        const payload = {
            channel: testChannel.name,
            attachments: [{type: 'slack_attachment',
                color: '#7CD197',
                fields: [{short: false, title: 'Area', value: "Testing with a very long piece of text that will take up the whole width of the table (stopping short of the space where the thumbnail image is displayed). This is one more sentence to really make it a long field, and let's add a taco emoji :taco:."}, {short: true, title: 'Iteration', value: 'Testing'}, {short: true, title: 'State', value: 'New'}, {short: false, title: 'Reason', value: 'New defect reported'}, {short: false, title: 'Random field', value: 'This is a field which is not marked as short so it should be rendered on a separate row'}, {short: true, title: 'Short 1', value: 'Short field'}, {short: true, title: 'Short 2', value: 'Another one'}, {short: true, title: 'Field with link', value: '<http://example.com|Link>'}],
                mrkdwn_in: ['pretext'],
                pretext: `${id} <@${sysadminUser.id}> Some text here to look at (verify eyes emoji) :eyes:`,
                text: 'This is the text of the attachment. There should be a small Jenkins thumbnail off to the right.',
                thumb_url: 'https://slack.global.ssl.fastly.net/7bf4/img/services/jenkins-ci_128.png',
                title: 'A slack attachment',
                title_link: 'https://www.google.com'}],
        };

        cy.visit(offTopicLink);

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.get(`#sidebarItem_${testChannel.name}`).find('#unreadMentions').should('have.text', '1');
        cy.get(`#sidebarItem_${testChannel.name}`).click({force: true});

        cy.getLastPost().within(() => {
            cy.get('.attachment__thumb-pretext').should('contain', id);
            cy.get('.attachment__thumb-pretext a.mention-link').should('have.text', '@sysadmin');
            cy.get('.attachment__thumb-pretext span[data-emoticon="eyes"]').should('exist');

            cy.get('a.attachment__title-link[href="https://www.google.com"]').should('have.text', 'A slack attachment');
            cy.get('.attachment-field a.markdown__link[href="http://example.com"]').should('have.text', 'Link');
            cy.get('.attachment-field span[data-emoticon="taco"]').should('exist');

            cy.get('.attachment__thumb-container .file-preview__button img').should('exist');
        });
    });

    it('MM-T630 Incoming webhook with Slack attachment, mention in attachment `text`', () => {
        const id = 'MM-T630';

        const payload = {
            channel: testChannel.name,
            attachments: [{type: 'slack_attachment',
                color: '#7CD197',
                fields: [{short: false, title: 'Area', value: "Testing with a very long piece of text that will take up the whole width of the table (stopping short of the space where the thumbnail image is displayed). This is one more sentence to really make it a long field, and let's add a taco emoji :taco:."}, {short: true, title: 'Iteration', value: 'Testing'}, {short: true, title: 'State', value: 'New'}, {short: false, title: 'Reason', value: 'New defect reported'}, {short: false, title: 'Random field', value: 'This is a field which is not marked as short so it should be rendered on a separate row'}, {short: true, title: 'Short 1', value: 'Short field'}, {short: true, title: 'Short 2', value: 'Another one'}, {short: true, title: 'Field with link', value: '<http://example.com|Link>'}],
                mrkdwn_in: ['pretext'],
                pretext: `${id} Some text here to look at (verify eyes emoji) :eyes:`,
                text: `This is the text of the attachment. <@${sysadminUser.id}>, There should be a small Jenkins thumbnail off to the right.`,
                thumb_url: 'https://slack.global.ssl.fastly.net/7bf4/img/services/jenkins-ci_128.png',
                title: 'A slack attachment',
                title_link: 'https://www.google.com'}],
        };

        cy.visit(offTopicLink);

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.get(`#sidebarItem_${testChannel.name}`).find('#unreadMentions').should('have.text', '1');
        cy.get(`#sidebarItem_${testChannel.name}`).click({force: true});

        cy.getLastPost().within(() => {
            cy.get('.attachment__thumb-pretext').should('contain', id);
            cy.get('.attachment__thumb-pretext span[data-emoticon="eyes"]').should('exist');

            cy.get('.attachment__body .post-message__text-container a.mention-link').should('have.text', '@sysadmin');
            cy.get('a.attachment__title-link[href="https://www.google.com"]').should('have.text', 'A slack attachment');
            cy.get('.attachment-field a.markdown__link[href="http://example.com"]').should('have.text', 'Link');
            cy.get('.attachment-field span[data-emoticon="taco"]').should('exist');

            cy.get('.attachment__thumb-container .file-preview__button img').should('exist');
        });
    });

    describe('MM-T631 Short field in payload can accept strings text in quotes for true and false', () => {
        const id = 'MM-T631';

        const makePayloadFromShortValue = (short, currentID) => ({
            channel: testChannel.name,
            attachments: [{type: 'slack_attachment',
                color: '#7CD197',
                fields: [{short: false, title: 'Area', value: "Testing with a very long piece of text that will take up the whole width of the table (stopping short of the space where the thumbnail image is displayed). This is one more sentence to really make it a long field, and let's add a taco emoji :taco:."}, {short: true, title: 'Iteration', value: 'Testing'}, {short: true, title: 'State', value: 'New'}, {short: false, title: 'Reason', value: 'New defect reported'}, {short: false, title: 'Random field', value: 'This is a field which is not marked as short so it should be rendered on a separate row'}, {short: true, title: 'Short 1', value: 'Short field'},
                    {short, title: 'Short 2', value: 'Another one'}, {short: true, title: 'Field with link', value: '<http://example.com|Link>'}],
                mrkdwn_in: ['pretext'],
                pretext: 'Some text here to look at (verify eyes emoji) :eyes:',
                text: `${currentID} ${short} This is the text of the attachment. <@${sysadminUser.id}>, there should be a small Jenkins thumbnail off to the right.`,
                thumb_url: 'https://slack.global.ssl.fastly.net/7bf4/img/services/jenkins-ci_128.png',
                title: 'A slack attachment',
                title_link: 'https://www.google.com',
            }]});

        const testCases = [
            {short: true, shouldShowShort: true, desc: 'true boolean'},
            {short: false, shouldShowShort: false, desc: 'false boolean'},
            {short: 'true', shouldShowShort: true, desc: 'true string'},
            {short: 'false', shouldShowShort: false, desc: 'false string'},
        ];

        testCases.forEach((testCase, i) => {
            it(`should show table elements based on short value ${testCase.desc}`, () => {
                const currentID = `${id} - ${i}`;
                const payload = makePayloadFromShortValue(testCase.short, currentID);
                cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

                cy.getLastPost().within(() => {
                    cy.get('.attachment__body .post-message__text-container p').should('contain', currentID);

                    if (testCase.shouldShowShort) {
                        cy.get('table:nth-child(6) > thead > tr > th:nth-child(2)').should('have.text', 'Short 2');
                        cy.get('table:nth-child(6) > tbody > tr > td:nth-child(2) > p').should('have.text', 'Another one');
                    } else {
                        cy.get('table:nth-child(7) > thead > tr > th:nth-child(1)').should('have.text', 'Short 2');
                        cy.get('table:nth-child(7) > tbody > tr > td:nth-child(1) > p').should('have.text', 'Another one');
                    }
                });
            });
        });
    });

    it('MM-T632 Slack compatibility code shouldn\'t mess up characters', () => {
        const id = 'MM-T632';
        const text = `${id} <>|<>|`;
        const payload = {
            channel: testChannel.name,
            text,
        };

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.getLastPost().within(() => {
            cy.get('.post__body p').should('have.text', text);
        });
    });

    it('MM-T634 Action buttons in Slack-style attachment post', () => {
        const id = 'MM-T634';

        const payload = {text: id, attachments: [{pretext: 'This is the attachment pretext.', text: 'This is the attachment text.', actions: [{name: 'Select an option...', integration: {url: 'http://127.0.0.1:7357/action_options', context: {action: 'do_something'}}, type: 'select', data_source: 'channels'}, {name: 'Select an option...', integration: {url: 'http://127.0.0.1:7357/action_options', context: {action: 'do_something'}}, type: 'select', options: [{text: 'Option1', value: 'opt1'}, {text: 'Option2', value: 'opt2'}, {text: 'Option3', value: 'opt3'}]}, {name: 'Ephemeral Message', integration: {url: 'http://127.0.0.1:7357', context: {action: 'do_something_ephemeral'}}}, {name: 'Update', integration: {url: 'http://127.0.0.1:7357', context: {action: 'do_something_update'}}}]}]};

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.getLastPost().within(() => {
            cy.get('.post-message__text').should('have.text', id);

            cy.get('.attachment-actions > :nth-child(1)').should('have.attr', 'data-testid', 'autoCompleteSelector');
            cy.get('.attachment-actions > :nth-child(1) input').should('have.attr', 'placeholder', 'Select an option...');
            cy.get('.attachment-actions > :nth-child(2)').should('have.attr', 'data-testid', 'autoCompleteSelector');
            cy.get('.attachment-actions > :nth-child(2) input').should('have.attr', 'placeholder', 'Select an option...');

            cy.get('.attachment-actions > button:nth-child(3)').should('have.attr', 'data-action-id');
            cy.get('.attachment-actions > button:nth-child(3)').should('have.text', 'Ephemeral Message');
            cy.get('.attachment-actions > button:nth-child(4)').should('have.attr', 'data-action-id');
            cy.get('.attachment-actions > button:nth-child(4)').should('have.text', 'Update');
        });
    });

    it('MM-T635 Initial selection on post action dropdown', () => {
        const id = 'MM-T635';

        const payload = {text: id, attachments: [{pretext: 'This is the attachment pretext.', text: 'This is the attachment text.', actions: [{name: 'Select an option...', integration: {url: 'http://127.0.0.1:7357/action_options', context: {action: 'do_something'}}, type: 'select', data_source: 'channels'}, {name: 'Select an option...', integration: {url: 'http://127.0.0.1:7357/action_options', context: {action: 'do_something'}}, type: 'select', options: [{text: 'Option1', value: 'opt1'}, {text: 'Option2', value: 'opt2'}, {text: 'Option3', value: 'opt3'}]}, {name: 'Ephemeral Message', integration: {url: 'http://127.0.0.1:7357', context: {action: 'do_something_ephemeral'}}}, {name: 'Update', integration: {url: 'http://127.0.0.1:7357', context: {action: 'do_something_update'}}}]}]};

        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.getLastPost().within(() => {
            cy.get('.post-message__text').should('have.text', id);

            cy.get('.attachment-actions > :nth-child(1)').should('have.attr', 'data-testid', 'autoCompleteSelector');
            cy.get('.attachment-actions > :nth-child(1) input').should('have.attr', 'placeholder', 'Select an option...');
            cy.get('.attachment-actions > :nth-child(2)').should('have.attr', 'data-testid', 'autoCompleteSelector');
            cy.get('.attachment-actions > :nth-child(2) input').should('have.attr', 'placeholder', 'Select an option...');

            cy.get('.attachment-actions > button:nth-child(3)').should('have.attr', 'data-action-id');
            cy.get('.attachment-actions > button:nth-child(3)').should('have.text', 'Ephemeral Message');
            cy.get('.attachment-actions > button:nth-child(4)').should('have.attr', 'data-action-id');
            cy.get('.attachment-actions > button:nth-child(4)').should('have.text', 'Update');
        });
    });
});
