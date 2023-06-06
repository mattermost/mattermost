// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console

describe('Main menu', () => {
    before(() => {
        cy.visit('/admin_console');

        // # Open the hamburger menu
        cy.get('button > span[class="menu-icon"]').click();
    });

    const verifyLink = (text, link) => {
        // * Verify link opens in new tab
        cy.get('a[href="' + link + '"]').scrollIntoView().should('have.attr', 'target', '_blank');

        // * Verify link text matches correct href value
        cy.get('a[href="' + link + '"]').contains(text);
    };

    it('MM-T909 Can switch to team', () => {
        // * Verify teams are visible
        cy.findByText('Switch to eligendi').should('be.visible');
    });

    it('MM-T910 Can open Administrators Guide', () => {
        cy.apiGetClientLicense().then(({isCloudLicensed}) => {
            const guideLink = isCloudLicensed ?
                'https://docs.mattermost.com/guides/administration.html#cloud-workspace-management' :
                'https://docs.mattermost.com/guides/administration.html';

            // * Verify administrator's guide link
            verifyLink("Administrator's Guide", guideLink);
        });
    });

    it('MM-T911 Can open Troubleshooting Forum', () => {
        // * Verify troubleshooting forum link
        verifyLink('Troubleshooting Forum', 'https://forum.mattermost.com/t/how-to-use-the-troubleshooting-forum/150');
    });

    it('MM-T914 Can log out from system console', () => {
        // * Verify log out button is visible
        cy.findByText('Log Out').should('be.visible');
    });

    it('MM-T912 Can open Commercial Support', () => {
        // * Verify commercial support
        cy.findByText('Commercial Support').click();
        cy.get('#commercialSupportModal').should('be.visible');
        cy.uiClose();
    });
});

