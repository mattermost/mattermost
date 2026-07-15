// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

import {configureGuestSaml, guestAttributeName, setupSamlUser} from './guest_member_support';

test.describe('SAML guest settings and member access', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify the SAML guest attribute becomes disabled after a configured value is saved and guest access is disabled
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('MM-T1423_1 SAML Guest Setting disabled if Guest Access is turned off', {tag: '@saml'}, async ({pw}) => {
        const {adminUser} = await configureGuestSaml(pw, {enableGuestAccess: true, guestAttribute: ''});
        const {page} = await pw.testBrowser.login(adminUser!);
        const systemConsolePage = new SystemConsolePage(page);

        // # Set and save a SAML guest attribute while guest access is enabled
        await systemConsolePage.saml.goto();
        await systemConsolePage.saml.setGuestAttribute(`${guestAttributeName}=true`);

        // # Disable guest access and confirm the warning
        await systemConsolePage.guestAccess.goto();
        await systemConsolePage.guestAccess.setEnabled(false);

        // * Verify the previously configured SAML guest attribute is disabled
        await systemConsolePage.saml.goto();
        await systemConsolePage.saml.expectGuestAttributeDisabled();
    });

    /**
     * @objective Verify a SAML user logs in as a member when guest access is disabled
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('MM-T1423_2 SAML User will login as member', {tag: '@saml'}, async ({pw, page}) => {
        // # Configure guest access off and log in through SAML
        const setup = await setupSamlUser(pw, page, {enableGuestAccess: false, guestAttribute: ''});

        // * Verify the SAML user can create a public channel as a member
        await setup.channelsPage.expectCanCreatePublicChannel(true);
        expect((await setup.adminClient.getUserByEmail(setup.user.email)).roles).not.toContain('system_guest');
    });
});
