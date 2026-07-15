// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {verifyNewAndExistingLogin} from './login_roles_support';

test.describe('SAML member and guest login roles', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify a new SAML member is created and the same Mattermost account is used on the next login
     *
     * @precondition Keycloak is available and the server has a SAML-capable license
     */
    test('Saml login new and existing MM regular user', {tag: '@saml'}, async ({pw, page}) => {
        // # Complete new and existing SAML login flows
        await verifyNewAndExistingLogin(pw, page, {expectedRole: 'member'});
        // * Verify both logins use the same member account
    });

    /**
     * @objective Verify the UserType=Guest SAML attribute creates a guest and preserves that role on the next login
     *
     * @precondition Keycloak is available and guest accounts are licensed
     */
    test('Saml login new and existing MM guest user(userType=Guest)', {tag: '@saml'}, async ({pw, page}) => {
        // # Complete new and existing SAML login flows with UserType=Guest
        await verifyNewAndExistingLogin(pw, page, {
            attributeName: 'UserType',
            attributeValue: 'Guest',
            guestAttribute: 'UserType=Guest',
            expectedRole: 'guest',
        });
        // * Verify both logins use the same guest account
    });

    /**
     * @objective Verify the IsGuest=true SAML attribute creates a guest and preserves that role on the next login
     *
     * @precondition Keycloak is available and guest accounts are licensed
     */
    test('Saml login new and existing MM guest(isGuest=true)', {tag: '@saml'}, async ({pw, page}) => {
        // # Complete new and existing SAML login flows with IsGuest=true
        await verifyNewAndExistingLogin(pw, page, {
            attributeName: 'IsGuest',
            attributeValue: 'true',
            guestAttribute: 'IsGuest=true',
            expectedRole: 'guest',
        });
        // * Verify both logins use the same guest account
    });
});
