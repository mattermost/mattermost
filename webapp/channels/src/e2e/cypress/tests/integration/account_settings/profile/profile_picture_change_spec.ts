// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stage: @prod
// Group: @account_setting

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Account Settings', () => {
    beforeEach(() => {
        cy.apiAdminLogin().apiInitSetup({loginAfter: true}).its('user').as('user');
    });

    it('MM-T2079 Can remove profile pic then choose different pic without saving in between', function() {
        // # Add a profile picture (aka "old profile picture")
        setInitialPicture(this.user);

        cy.visit('/');

        // # Save the id of the old picture
        getProfilePictureId().as('idOld');

        // # Open Profile > Profile Settings > Profile Picture > Edit
        cy.uiOpenProfileModal().findByRole('button', {name: /picture edit/i}).click();

        // # Click the X to remove the old profile picture but do not click save
        cy.findByRole('button', {name: /remove profile picture/i}).click();

        // # Select a new profile picture and click Save
        cy.findByTestId('uploadPicture').attachFile('png-image-file.png');
        cy.uiSave().wait(TIMEOUTS.HALF_SEC);
        cy.findByRole('button', {name: /close/i}).click();

        // * Verify that new profile image exists and isn't equal to the old one
        getProfilePictureId().then((idNew) => expect(idNew).to.exist.and.not.to.be.equal(this.idOld));
    });

    it('MM-T2075_1 Profile Picture: Cancel out of adding profile picture', () => {
        verifyProfilePictureDoesNotUpdateAfterCancel();
    });

    it('MM-T2075_2 Profile Picture: Cancel out of changing profile picture ', function() {
        // # Add a profile picture (aka "old profile picture")
        setInitialPicture(this.user);

        verifyProfilePictureDoesNotUpdateAfterCancel();
    });
});

function getProfilePictureId() {
    return cy.uiGetProfileHeader().find('.Avatar').invoke('attr', 'src').then((urlString) => {
        const url = new URL(urlString);
        const params = new URLSearchParams(url.search);
        return params.get('_');
    });
}

function setInitialPicture(user) {
    cy.apiUploadFile('image', 'mattermost-icon.png', {
        url: `/api/v4/users/${user.id}/image`,
        method: 'POST',
        successStatus: 200,
    });
}

function verifyProfilePictureDoesNotUpdateAfterCancel() {
    let idOld;

    cy.visit('/');

    // # Save the id of the old picture
    getProfilePictureId().then((id) => {
        idOld = id;
    });

    // # Open Profile > Profile Settings > Profile Picture > Edit
    cy.uiOpenProfileModal().findByRole('button', {name: /picture edit/i}).click();

    // # Select a new profile picture
    cy.findByTestId('uploadPicture').attachFile('png-image-file.png');

    cy.uiCancel().wait(TIMEOUTS.HALF_SEC);

    cy.uiClose();

    // * Verify that 'new' profile image exists and equal to the old one
    getProfilePictureId().then((idNew) => expect(idNew).to.equal(idOld));
}
