// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @multi_team_and_dm

import {getRandomId} from '../../../utils';

describe('System message', () => {
    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team, channel}) => {
            cy.visit(`/${team.name}/channels/${channel.name}`);

            // # Post a regular message
            cy.postMessage('Test for no status of a system message');

            const newHeader = `Update header with ${getRandomId()}`;
            cy.apiPatchChannel(channel.id, {header: newHeader});

            // # Wait until the system message gets posted.
            cy.uiWaitUntilMessagePostedIncludes(newHeader);
        });
    });

    it('MM-T427_1 No status on system message in standard view', () => {
        verifySystemMessage('clean');
    });

    it('MM-T427_2 No status on system message in compact view', () => {
        verifySystemMessage('clean');
    });
});

function verifySystemMessage(type, statusExist) {
    // # Set message display
    cy.apiSaveMessageDisplayPreference(type);

    // # Get last post
    cy.getLastPostId().then((postId) => {
        // * Verify it is a system message and that the status icon is not visible
        cy.get(`#post_${postId}`).invoke('attr', 'class').
            should('contain', 'post--system').
            and('not.contain', 'same--root').
            and('not.contain', 'other--root').
            and('not.contain', 'current--user').
            and('not.contain', 'post--comment').
            and('not.contain', 'post--root');

        cy.get(`#post_${postId}`).find('.status-wrapper .status svg').
            should(statusExist ? 'not.be.visible' : 'not.exist');
    });
}
