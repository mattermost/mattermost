// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @incoming_webhook

describe('Incoming webhook', () => {
    let testChannel;
    let otherUser;
    let incomingWebhook;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnablePostUsernameOverride: true,
                EnablePostIconOverride: true,
            },
        });

        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel, user}) => {
            testChannel = channel;
            otherUser = user;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook - basic formatting',
                display_name: 'basic-formatting',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });

            cy.visit(`/${team.name}/channels/${channel.name}`);
            cy.postMessage('Test message');
        });
    });

    it('MM-T619 Webhook with @-mention, username and profile pic, and basic formatting', () => {
        const baseUrl = Cypress.config('baseUrl');
        const payload = getPayload(testChannel, otherUser);
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload});

        cy.waitUntil(() => cy.getLastPost().then((el) => {
            const postedMessageEl = el.find('.post-message__text > p')[0];
            return Boolean(postedMessageEl && postedMessageEl.textContent.includes('The following escaped characters should appear normally'));
        }));

        cy.getLastPost().within((el) => {
            // * Verify that the username is overridden per webhook payload
            cy.get('.post__header').find('.user-popover').should('have.text', payload.username);

            // * Verify that the user icon is overridden per webhook payload
            const encodedIconUrl = encodeURIComponent(payload.icon_url);
            cy.get('.profile-icon > img').should('have.attr', 'src', `${baseUrl}/api/v4/image?url=${encodedIconUrl}`);

            // * Verify that the BOT label appears
            cy.get('.Tag').should('be.visible').and('have.text', 'BOT');

            // * Verify that there's no status indicator
            cy.get('.status').should('not.exist');

            // # Verify that the elements on posted message matched as expected
            cy.get('.post-message__text').within(() => {
                cy.wrap(el).should('contain', 'The following escaped characters should appear normally');
                cy.wrap(el).should('contain', '(ampersand, open angle, close angle): & < >');
                cy.wrap(el).should('contain', 'The following should appear as links:');
                cy.get('.markdown__link').eq(0).
                    should('have.text', 'This is a link to about-dot-mattermost-dot-com').
                    and('have.attr', 'href', 'https://mattermost.com/');
                cy.get('.markdown__link').eq(1).
                    should('have.text', 'Markdown Link also to About page').
                    and('have.attr', 'href', 'https://mattermost.com/');
                cy.wrap(el).should('contain', 'Normal Link:');
                cy.get('.markdown__link').eq(2).
                    should('have.text', 'https://mattermost.com/').
                    and('have.attr', 'href', 'https://mattermost.com/');
                cy.wrap(el).should('contain', 'Mail Link:');
                cy.get('.markdown__link').eq(3).
                    should('have.text', 'Email').
                    and('have.attr', 'href', 'mailto:mail@example.com');
                cy.wrap(el).should('contain', 'The following should be markdown formatted');
                cy.wrap(el).should('contain', '(mouse emoji, strawberry emoji, then formatting as indicated):');
                cy.get('.emoticon').eq(0).parent().
                    should('have.html', `<span alt=":hamster:" class="emoticon" title=":hamster:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f439.png&quot;);">:hamster:</span>`);
                cy.get('.emoticon').eq(1).parent().
                    should('have.html', `<span alt=":strawberry:" class="emoticon" title=":strawberry:" style="background-image: url(&quot;${baseUrl}/static/emoji/1f353.png&quot;);">:strawberry:</span>`);
                cy.wrap(el).find('strong').should('have.text', 'bold');
                cy.wrap(el).find('em').should('have.text', 'italic');
                cy.wrap(el).find('strong').should('have.text', 'bold');
                cy.get('.codespan__pre-wrap').should('have.html', '<code>code</code>');
                cy.wrap(el).find('del').should('have.text', 'strike');
                cy.get('.mention-link').eq(0).should('have.text', '#hashtag');
                cy.get('.mention-link').eq(1).should('have.text', `@${otherUser.username}`);
            });
        });
    });
});

function getPayload(channel, user) {
    const text = `The following escaped characters should appear normally
    (ampersand, open angle, close angle): &amp; &lt; &gt;
The following should appear as links:
    <https://mattermost.com/|This is a link to about-dot-mattermost-dot-com>
    [Markdown Link also to About page](https://mattermost.com/)
    Normal Link: https://mattermost.com/
    Mail Link: <mailto:mail@example.com|Email>
The following should be markdown formatted
    (mouse emoji, strawberry emoji, then formatting as indicated): 🐹 :strawberry: **bold** _italic_ \`code\` ~~strike~~ #hashtag
The following should turn into a user mention and clicking it should open profile popover
    @${user.username}
`;

    return {
        channel: channel.name,
        username: 'new_username',
        text,
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
    };
}
