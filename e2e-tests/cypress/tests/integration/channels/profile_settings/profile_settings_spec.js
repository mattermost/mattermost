// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @profile_settings

describe('Profile Settings', () => {
    let testUser;

    before(() => {
        // # Login as new user and visit off-topic
        cy.apiInitSetup({prefix: 'other', loginAfter: true}).then(({offTopicUrl, user}) => {
            cy.visit(offTopicUrl);
            testUser = user;
        });
    });

    it('MM-T2044 Clear fields, values revert', () => {
        cy.uiOpenProfileModal('Profile Settings');

        // # Click 'Edit' to the right of 'Full Name'
        cy.get('#nameEdit').should('be.visible').click();

        // # Clear the first name
        cy.get('#firstName').clear();

        // # Type a new first name
        cy.get('#firstName').should('be.visible').type('newFirstName');

        // # Clear the last name
        cy.get('#lastName').should('be.visible').clear();

        // # Type a new last name
        cy.get('#lastName').should('be.visible').type('newLastName');

        // # Click 'Cancel'
        cy.uiCancel();

        // * Check that the full name was not updated since it was not saved
        cy.get('#nameDesc').should('be.visible').should('contain', testUser.first_name + ' ' + testUser.last_name);

        // # Close the modal
        cy.uiClose();
    });

    const fileTypes = [
        {
            extension: 'PNG',
            fileName: 'profile_picture.png',
        },
        {
            extension: 'JPG',
            fileName: 'profile_picture.jpg',
        },
        {
            extension: 'JPEG',
            fileName: 'profile_picture.jpeg',
        },
        {
            extension: 'BMP',
            fileName: 'profile_picture.bmp',
        },
    ];

    fileTypes.forEach((fileType, index) => {
        it(`MM-T2078_${index + 1} Profile picture: file ${fileType.extension} type accepted`, () => {
            // # Save the default profile picture link so it can be compared to the new one
            cy.uiGetProfileHeader().findByRole('img').invoke('attr', 'src').as('defaultProfilePictureLink');

            cy.uiOpenProfileModal('Profile Settings');

            // # Click 'Edit' to the right of the 'Profile Picture'
            cy.get('#pictureEdit').should('be.visible').click();

            // # Confirm the 'Save' button is blocked when no picture selected
            cy.findByTestId('saveSettingPicture').should('have.class', 'disabled');

            // # Insert the file profile picture - keep in mind that using the hidden input field is needed
            cy.findByTestId('uploadPicture').attachFile(fileType.fileName);

            // # Click the 'Save' button after the image is uploaded
            cy.findByTestId('saveSettingPicture').should('not.have.class', 'disabled').click();

            // # Confirm the user was returned to the Profile modal with the 'Profile Picture' description changed and 'Edit' button visible again
            cy.get('#pictureDesc').should('include.text', 'Image last updated');
            cy.get('#pictureEdit').should('be.visible');

            // # Close the modal
            cy.uiClose();

            // # Save the new custom profile picture link so it can be compared to the old one
            cy.uiGetProfileHeader().findByRole('img').invoke('attr', 'src').as('customProfilePictureLink');

            cy.then(function() {
                expect(this.customProfilePictureLink).to.not.equal(this.defaultProfilePictureLink);

                // # This regular expression (/\?_=\d+$/) checks if the string ends with ?_= followed by one or more digits.
                expect(this.customProfilePictureLink, 'New custom profile picture link should end with "?image_=<digits>"').to.match(/image\?_=\d+$/);
            });
        });
    });
});
