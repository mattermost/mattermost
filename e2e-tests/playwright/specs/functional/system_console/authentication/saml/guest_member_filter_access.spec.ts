// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {guestAttributeName, setupSamlUser} from './guest_member_support';

test.describe('SAML guest filter access', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify a SAML user logs in as a member when the guest attribute value does not match
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('MM-T1426_1 User logged in as member, filter does not match', {tag: '@saml'}, async ({pw, page}) => {
        // # Configure a non-matching SAML guest filter and log in
        const setup = await setupSamlUser(pw, page, {
            enableGuestAccess: true,
            guestAttribute: `${guestAttributeName}=wrong`,
        });

        // * Verify the non-matching SAML user can create a public channel as a member
        await setup.channelsPage.expectCanCreatePublicChannel(true);
        expect((await setup.adminClient.getUserByEmail(setup.user.email)).roles).not.toContain('system_guest');
    });

    /**
     * @objective Verify a SAML user logs in as a guest when the guest attribute value matches
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('MM-T1426_2 User logged in as guest, correct filter', {tag: '@saml'}, async ({pw, page}) => {
        // # Configure a matching SAML guest filter and log in
        const setup = await setupSamlUser(pw, page, {
            enableGuestAccess: true,
            guestAttribute: `${guestAttributeName}=true`,
        });

        // * Verify the matching SAML user cannot create a public channel as a guest
        await setup.channelsPage.expectCanCreatePublicChannel(false);
        expect((await setup.adminClient.getUserByEmail(setup.user.email)).roles).toContain('system_guest');
    });
});
