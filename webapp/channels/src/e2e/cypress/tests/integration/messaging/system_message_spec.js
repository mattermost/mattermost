// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

// helper function to count the lines in a block of text by wrapping each word in a span and finding where the text breaks the line
function getLines(e) {
    const $cont = Cypress.$(e);
    const textArr = $cont.text().split(' ');

    for (let i = 0; i < textArr.length; i++) {
        textArr[i] = '<span>' + textArr[i] + ' </span>';
    }

    $cont.html(textArr.join(''));

    const $wordSpans = $cont.find('span');
    const lineArray = [];
    var lineIndex = 0;
    var lineStart = true;

    $wordSpans.each(function handleWord(idx) {
        const top = Cypress.$(this).position().top;

        if (lineStart) {
            lineArray[lineIndex] = [idx];
            lineStart = false;
        } else {
            var $next = Cypress.$(this).next();

            if ($next.length) {
                if ($next.position().top > top) {
                    lineArray[lineIndex].push(idx);
                    lineIndex++;
                    lineStart = true;
                }
            } else {
                lineArray[lineIndex].push(idx);
            }
        }
    });
    return lineArray.length;
}

describe('System Message', () => {
    let testUsername;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team, user}) => {
            testUsername = user.username;
            cy.visit(`/${team.name}/channels/off-topic`);
        });
    });

    it('MM-T426 System messages wrap properly', () => {
        const newHeader = `${Date.now()} newheader`;

        // # Update channel header textbox
        cy.updateChannelHeader(`> ${newHeader}`);

        // * Check the status update
        cy.getLastPost().
            should('contain', 'System').
            and('contain', `@${testUsername} updated the channel header to:`).
            and('contain', newHeader);

        const validateSingle = (desc) => {
            const lines = getLines(desc.find('p').last());
            assert(lines === 1, 'second line of the message should be a short one');
        };

        cy.getLastPost().then(validateSingle);

        // # Update the status to a long string
        cy.updateChannelHeader('> ' + newHeader.repeat(20));

        // * Check that the status is updated and is spread on more than one line
        cy.getLastPost().
            should('contain', 'System').
            and('contain', `@${testUsername} updated the channel header`).
            and('contain', 'From:').
            and('contain', newHeader).
            and('contain', 'To:').
            and('contain', newHeader.repeat(20));

        const validateMulti = (desc) => {
            const lines = getLines(desc.find('p').last());
            assert(lines > 1, 'second line of the message should be a long one');
        };

        cy.getLastPost().then(validateMulti);
    });
});
