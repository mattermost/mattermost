// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

import {verifyNewAndExistingLogin} from './login_roles_support';

test.describe('SAML administrator login roles', () => {
    test.describe.configure({mode: 'serial'});

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    /**
     * @objective Verify the UserType=Admin SAML attribute creates an administrator and preserves that role on the next login
     *
     * @precondition Keycloak is available and SAML administrator attributes are licensed
     */
    test('Saml login new and existing MM admin(userType=Admin)', {tag: '@saml'}, async ({pw, page}) => {
        // # Complete new and existing SAML login flows with UserType=Admin
        await verifyNewAndExistingLogin(pw, page, {
            attributeName: 'UserType',
            attributeValue: 'Admin',
            adminAttribute: 'UserType=Admin',
            expectedRole: 'admin',
        });
        // * Verify both logins use the same administrator account
    });

    /**
     * @objective Verify the IsAdmin=true SAML attribute creates an administrator and preserves that role on the next login
     *
     * @precondition Keycloak is available and SAML administrator attributes are licensed
     */
    test('Saml login new and existing MM admin(isAdmin=true)', {tag: '@saml'}, async ({pw, page}) => {
        // # Complete new and existing SAML login flows with IsAdmin=true
        await verifyNewAndExistingLogin(pw, page, {
            attributeName: 'IsAdmin',
            attributeValue: 'true',
            adminAttribute: 'IsAdmin=true',
            expectedRole: 'admin',
        });
        // * Verify both logins use the same administrator account
    });
});
