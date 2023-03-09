// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @system_console @announcement_banner

import {hexToRgbArray, rgbArrayToString} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Announcement Banner', () => {
    before(() => {
        cy.apiRequireLicense();
    });

    it('MM-T1128 Announcement Banner - Dismissible banner shows long text truncated', () => {
        const bannerEmbedLink = 'http://example.com';
        const bannerEndLink = 'http://example.com/the_end';
        const bannerText = `Here's an announcement! It has a link: ${bannerEmbedLink}. It's a really long announcement, because we have a lot to say. Be sure to read it all, click the link, then dismiss the banner, and then you can go on to the next test, which will have a shorter announcement. Thank you for reading [to the end](${bannerEndLink}) and have a nice day!`;
        const bannerBgColor = '#4378da';
        const bannerBgColorRGBArray = hexToRgbArray(bannerBgColor);
        const bannerTextColor = '#ffffff';
        const bannerTextColorRGBArray = hexToRgbArray(bannerTextColor);

        // # Go to announcement banner config page of system console
        cy.visit('/admin_console/site_config/announcement_banner');

        // # Enable banner if not already enabled
        cy.findByTestId('AnnouncementSettings.EnableBanner').
            should('be.visible').
            within(() => {
                cy.findByText('true').
                    should('be.visible').
                    click({force: true});
            });

        // # Enter the long banner text
        cy.findByTestId('AnnouncementSettings.BannerText').
            should('be.visible').
            within(() => {
                cy.get('input').
                    should('be.visible').
                    clear().
                    invoke('val', bannerText).
                    wait(TIMEOUTS.HALF_SEC).
                    type(' {backspace}{enter}');
            });

        // # Change the banner background color
        cy.findByTestId('AnnouncementSettings.BannerColor').
            should('be.visible').
            within(() => {
                cy.get('input').
                    should('be.visible').
                    clear().
                    type(bannerBgColor);
            });

        // # Change the banner text color
        cy.findByTestId('AnnouncementSettings.BannerTextColor').
            should('be.visible').
            within(() => {
                cy.get('input').
                    should('be.visible').
                    clear().
                    type(bannerTextColor);
            });

        // # Allow for banner dismissal to true
        cy.findByTestId('AnnouncementSettings.AllowBannerDismissal').
            should('be.visible').
            within(() => {
                cy.findByText('true').
                    should('be.visible').
                    click({force: true});
            });

        // # Click on the save button
        cy.get('.admin-console').
            should('exist').
            within(() => {
                cy.findByText('Save').should('be.visible').click();
            });

        // * Verify banner overflow is hidden from viewport
        // also verify its background color and text color matches to configuration entered
        // and check if the url in the text rendered as anchor tag
        cy.get('.announcement-bar').
            as('announcementBanner').
            should('exist').
            and('is.visible').
            and('have.css', 'overflow', 'hidden').
            and(
                'have.css',
                'background-color',
                rgbArrayToString(bannerBgColorRGBArray),
            ).
            and('have.css', 'color', rgbArrayToString(bannerTextColorRGBArray)).
            contains('a', bannerEmbedLink).
            should('have.attr', 'href', bannerEmbedLink);

        // * Verify only the banner text's first part is visible by ensuring the first link
        // is visible but the second link is not
        cy.findByText(/Here's an announcement! It has a link: /).
            should('be.visible').
            within(() => {
                cy.get(`a[href="${bannerEmbedLink}"]`).should('be.visible');
                cy.get(`a[href="${bannerEndLink}"]`).should('not.be.visible');
            });

        // # Hover over the banner
        cy.get('@announcementBanner').trigger('mouseover');

        // * Verify popover is visible
        cy.get('#announcement-bar__tooltip').
            as('announcementBannerTooltip').
            should('be.visible').
            within(() => {
                // * Verify complete banner is present in the popover
                cy.findByText(/Here's an announcement! It has a link: /).should(
                    'be.visible',
                );
                cy.findByText(
                    /. It's a really long announcement, because we have a lot to say. Be sure to read it all, click the link, then dismiss the banner, and then you can go on to the next test, which will have a shorter announcement. Thank you for reading and have a nice day!/,
                ).should('be.visible');
            });

        // # Move mouse out of banner area
        cy.get('@announcementBanner').trigger('mouseout');

        // * Verify the popover is no more visible
        cy.get('@announcementBannerTooltip').should('not.exist');

        // # Close the banner
        cy.get('.announcement-bar__close').should('be.visible').click();

        // * Verify  the banner is closed
        cy.get('@announcementBanner').should('not.exist');
    });
});
