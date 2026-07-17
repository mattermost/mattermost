// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createHmac} from 'node:crypto';

import type {UserProfile} from '@mattermost/types/users';

import {SystemConsolePage, test} from '@mattermost/playwright-lib';

const ldapAccount = {
    username: 'test.one',
    password: 'Password1',
};

function decodeBase32(value: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const character of value.replace(/[=]+$/, '').toUpperCase()) {
        bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
        bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    }
    return Buffer.from(bytes);
}

function generateTotp(secret: string) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const code =
        (((digest[offset] & 0x7f) << 24) |
            ((digest[offset + 1] & 0xff) << 16) |
            ((digest[offset + 2] & 0xff) << 8) |
            (digest[offset + 3] & 0xff)) %
        1_000_000;
    return code.toString().padStart(6, '0');
}

test.describe('User authentication methods', () => {
    /**
     * @objective Verify the System Console reports Email, SAML, LDAP, and MFA authentication methods correctly
     *
     * @precondition
     * OpenLDAP is populated and the server has an LDAP-capable license
     */
    test('MM-T953 Verify correct authentication method', {tag: '@ldap'}, async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        if (!adminUser) {
            throw new Error('Unable to load the system administrator');
        }
        await adminClient.patchConfig({
            ServiceSettings: {
                EnableMultifactorAuthentication: true,
            },
        });
        await adminClient.initializeOpenLdap();

        const randomMfaUser = await pw.random.user();
        const mfaUser = {
            ...(await adminClient.createUser(randomMfaUser, '', '')),
            password: randomMfaUser.password,
        } as UserProfile;
        const randomSamlUser = await pw.random.user();
        const samlUser = {
            ...(await adminClient.createUser(randomSamlUser, '', '')),
            password: randomSamlUser.password,
        } as UserProfile;
        await adminClient.migrateUserAuthToSaml(samlUser.email, samlUser.username);

        const {user: authenticatedLdapUser} = await pw.makeClient(ldapAccount, {useCache: false});
        if (!authenticatedLdapUser) {
            throw new Error(`Unable to authenticate LDAP user ${ldapAccount.username}`);
        }

        const mfaSecret = await adminClient.generateMfaSecret(mfaUser.id);
        await adminClient.updateUserMfa(mfaUser.id, true, generateTotp(mfaSecret.secret));

        const {page} = await pw.testBrowser.login(adminUser);
        const consolePage = new SystemConsolePage(page);
        await consolePage.users.goto();

        // # Search for each configured account in the System Console
        // * Verify every account reports its expected authentication method
        await consolePage.users.expectAuthenticationMethod(adminUser.username, 'Email');
        await consolePage.users.expectAuthenticationMethod(samlUser.username, 'SAML');
        await consolePage.users.expectAuthenticationMethod(authenticatedLdapUser.username, 'LDAP');
        await consolePage.users.expectAuthenticationMethod(mfaUser.username, 'MFA');
    });
});
