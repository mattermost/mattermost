// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @incoming_webhook

describe('Integrations/Incoming Webhook', () => {
    let incomingWebhook;
    let testChannel;

    before(() => {
        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            testChannel = channel;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: true,
                description: 'Incoming webhook - attachment does not collapse',
                display_name: 'attachment-does-not-collapse',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });

            cy.visit(`/${team.name}/channels/${channel.name}`);
        });
    });

    it('MM-T642 Attachment does not collapse', () => {
        // # Post the incoming webhook with a text attachment (lorem ipsum test text)
        const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus vel convallis arcu. Interdum et malesuada fames ac ante ipsum primis in faucibus. Curabitur id convallis lectus. Quisque ut laoreet augue, et suscipit magna. Etiam ut interdum nunc. Nam euismod felis eu ipsum eleifend, eget rhoncus arcu fringilla. Nam id laoreet eros, a bibendum diam. Donec sed augue vel tortor porta pulvinar. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Proin interdum, nunc in tempor molestie, dui erat facilisis tellus, ut faucibus mauris est et felis. Suspendisse pulvinar mauris vel viverra pulvinar. Maecenas iaculis euismod mauris, id pharetra justo rutrum et.' +
            'Donec sit amet nulla varius, posuere enim sit amet, venenatis sapien. Morbi venenatis ornare urna id vestibulum. Curabitur efficitur efficitur arcu, vel rhoncus lorem varius sed. Ut venenatis interdum arcu, et rutrum est pretium eu. Nam laoreet tincidunt cursus. Pellentesque feugiat sit amet ipsum a porta. Phasellus nec laoreet nulla. Duis gravida dolor orci, vitae mollis orci consequat at. Sed tincidunt dolor nisi, at fermentum ligula tristique non. Duis pulvinar, eros quis ultrices aliquam, libero ipsum lobortis leo, quis ullamcorper sapien sem vel magna. Etiam sed ligula ut ipsum luctus venenatis. Sed mollis convallis dolor, eu dictum leo condimentum id. Praesent porttitor neque in volutpat iaculis.' +
            'Vestibulum fermentum, elit vel vestibulum vestibulum, lectus odio tincidunt leo, quis gravida erat tortor non arcu. Donec condimentum accumsan dolor eget tempus. Pellentesque convallis porta mattis. Aenean pulvinar felis tincidunt, finibus felis at, imperdiet massa. Duis sed pellentesque urna, finibus tristique risus. In quam magna, commodo nec commodo ut, consectetur non tortor. Cras accumsan faucibus arcu, quis suscipit purus posuere ac. Nunc at urna nec massa bibendum posuere. Pellentesque at rhoncus eros. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Donec a maximus ipsum. Phasellus sed venenatis lacus, a vestibulum massa. Nunc rutrum nunc et dui porta aliquam. In ac eros mattis, congue nisi ut, rhoncus lacus. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent nec mauris at erat vehicula sollicitudin.' +
            'Aliquam ornare sed tortor ut placerat. Fusce posuere a odio nec aliquet. Cras nec maximus metus. In elementum tincidunt orci, at sagittis nisl. Pellentesque scelerisque lorem ultricies ipsum finibus, in iaculis purus tincidunt. Aliquam tempus nunc at elementum vehicula. Integer tempus pretium magna, sed gravida nisl porta at. Donec et imperdiet augue, eget cursus dolor. Sed non magna dui. Phasellus vel massa pulvinar, cursus diam sit amet, vestibulum neque. Vivamus accumsan, mi vitae ultrices pretium, arcu eros sodales enim, et pellentesque quam eros in ligula. In eu justo a quam iaculis consequat. Aenean ornare a velit ac aliquet. Nullam lobortis posuere neque a pretium.' +
            'Etiam dignissim sed ante commodo faucibus. Nunc vitae aliquet justo. Proin consequat leo vel libero porttitor, ac vulputate turpis bibendum. In vel libero sed odio euismod tincidunt id non dui. Quisque vitae est quis ante eleifend rutrum sed ut diam. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Integer rhoncus, leo nec iaculis sagittis, ligula mauris consequat felis, nec finibus odio sem tincidunt dolor. Pellentesque vel purus a sem rhoncus porta eget et erat. Sed interdum, justo ac dictum lacinia, nibh metus posuere arcu, vel euismod eros libero semper ligula. Proin elementum ligula quis ornare auctor. Integer vitae elementum augue, in congue lorem. Sed felis purus, consequat eu lacus in, fermentum accumsan diam. Duis lacus nunc, accumsan varius consequat nec, tincidunt et odio.';
        const payload = {
            channel: testChannel.name,
            attachments: [{fallback: 'testing attachment does not collapse', pretext: 'testing attachment does not collapse', text: content}],
        };
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload, waitFor: 'attachment-pretext'});

        // * Check "show more" button is visible and click
        cy.getLastPostId().then((postId) => {
            const postMessageId = `#${postId}_message`;
            cy.get(postMessageId).within(() => {
                cy.get('#showMoreButton').scrollIntoView().should('be.visible').and('have.text', 'Show more').click();
            });
        });

        // # Type /collapse and press Enter
        cy.uiGetPostTextBox().type('/collapse {enter}');

        // * Check that the post from the webhook has NOT collapsed (verify expanded post)
        cy.getNthPostId(-2).then((postId) => {
            const postMessageId = `#${postId}_message`;
            cy.get(postMessageId).within(() => {
                // * Verify "show more" button says "Show less"
                cy.get('#showMoreButton').scrollIntoView().should('be.visible').and('have.text', 'Show less');
            });
        });
    });
});
