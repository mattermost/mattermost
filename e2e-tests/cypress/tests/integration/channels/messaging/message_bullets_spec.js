// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Message', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T87 Text in bullet points is the same size as text above and below it', () => {
        // # Post a message
        cy.uiGetPostTextBox().clear().
            type('This is a normal sentence.').
            type('{shift}{enter}{enter}').
            type('1. this is point 1').
            type('{shift}{enter}').
            type(' - this is a bullet under 1').
            type('{shift}{enter}{enter}').
            type('This is more normal text.').
            type('{enter}');

        // # Get last postId
        cy.getLastPostId().then((postId) => {
            const postMessageTextId = `#postMessageText_${postId}`;

            //  * Verify text sizes
            cy.get(postMessageTextId).within(() => {
                const expectedSize = '13.5px';

                cy.get('p').first().should('have.text', 'This is a normal sentence.').and('have.css', 'font-size', expectedSize);
                cy.get('ol li').first().should('have.text', 'this is point 1\nthis is a bullet under 1').and('have.css', 'font-size', expectedSize);
                cy.get('ol li ul li').should('have.text', 'this is a bullet under 1').and('have.css', 'font-size', expectedSize);
                cy.get('p').last().should('have.text', 'This is more normal text.').and('have.css', 'font-size', expectedSize);
            });
        });
    });

    it('MM-T1321 WebApp: Truncated Numbered List on Chat History Panel', () => {
        const bulletMessages = [
            {
                text:
                    '9. firstBullet{shift}{enter}10. secondBullet{shift}{enter}11. thirdBullet',
                counter: 9,
            },
            {
                text:
                    '9999. firstBullet{shift}{enter}10000. secondBullet{shift}{enter}10001. thirdBullet',
                counter: 9999,
            },
            {
                text:
                    '999999. firstBullet{shift}{enter}1000000. secondBullet{shift}{enter}1000001. thirdBullet',
                counter: 999999,
            },
        ];

        bulletMessages.forEach((bulletMessage) => {
            // # Post the message containing bullets
            cy.uiGetPostTextBox().
                clear().
                type(bulletMessage.text).
                type('{enter}');

            // # Get the last posted message
            cy.getLastPost().within(() => {
                // * Verify that messages are wrapped in li tags
                cy.findByText('firstBullet').
                    should('be.visible').
                    parents('li').
                    should('exist');
                cy.findByText('secondBullet').
                    should('be.visible').
                    parents('li').
                    should('exist');
                cy.findByText('thirdBullet').
                    should('be.visible').
                    parents('li').
                    should('exist');

                // * Verify that li tags have ol as their parent
                cy.findByText('firstBullet').
                    parents('ol').
                    should('exist').
                    as('olParent');

                // * Verify that ol tag starts from the start number
                cy.get('@olParent').
                    should(
                        'have.css',
                        'counter-reset',
                        `list ${bulletMessage.counter - 1}`,
                    ).
                    and('have.class', 'markdown__list');
            });
        });
    });
});
