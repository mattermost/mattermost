// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AlreadyExistsError, Attribute, Change, Client} from 'ldapts';
import {test} from '@playwright/test';
import type {AdminConfig} from '@mattermost/types/config';

import {
    OPENLDAP_ADMIN_DN,
    OPENLDAP_ADMIN_PASSWORD,
    OPENLDAP_ALIAS,
    OPENLDAP_BASE_DN,
    OPENLDAP_PORT,
} from '../containers/constants';

import {getAdminClient} from './init';

import {testConfig} from '@/test_config';
import {getRandomId} from '@/util';

// Typed in-process LDAP client — avoids depending on external ldapadd/ldapmodify binaries.

export type LdapUser = {
    username: string;
    password: string;
    email: string;
    firstname: string;
    lastname: string;
};

const ORG_UNIT = 'e2etest';
const ORG_UNIT_DN = `ou=${ORG_UNIT},${OPENLDAP_BASE_DN}`;

export function generateLdapUser(prefix = 'ldap'): LdapUser {
    const randomId = getRandomId();
    const username = `${prefix}user${randomId}`;
    return {
        username,
        password: 'Password1',
        email: `${username}@mmtest.com`,
        firstname: `Firstname-${randomId}`,
        lastname: `Lastname-${randomId}`,
    };
}

async function withAdminClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({url: `ldap://${testConfig.ldapHost}:${testConfig.ldapPort}`});
    try {
        await client.bind(OPENLDAP_ADMIN_DN, OPENLDAP_ADMIN_PASSWORD);
        return await fn(client);
    } finally {
        await client.unbind();
    }
}

async function ensureOrgUnit(client: Client): Promise<void> {
    try {
        await client.add(ORG_UNIT_DN, {objectClass: 'organizationalUnit', ou: ORG_UNIT});
    } catch (error) {
        if (!(error instanceof AlreadyExistsError)) {
            throw error;
        }
    }
}

/** Creates the user (and the shared org unit, if it doesn't exist yet) and returns it. */
export async function createLdapUser(user: LdapUser = generateLdapUser()): Promise<LdapUser> {
    await withAdminClient(async (client) => {
        await ensureOrgUnit(client);
        await client.add(`uid=${user.username},${ORG_UNIT_DN}`, {
            objectClass: 'inetOrgPerson',
            cn: user.firstname,
            sn: user.lastname,
            uid: user.username,
            mail: user.email,
            userPassword: user.password,
        });
    });
    return user;
}

export async function updateLdapUser(username: string, changes: Partial<Omit<LdapUser, 'username'>>): Promise<void> {
    await withAdminClient(async (client) => {
        const dn = `uid=${username},${ORG_UNIT_DN}`;
        const attributeByType: Array<[string, string | undefined]> = [
            ['cn', changes.firstname],
            ['sn', changes.lastname],
            ['mail', changes.email],
            ['userPassword', changes.password],
        ];

        const modifications = attributeByType
            .filter((entry): entry is [string, string] => entry[1] !== undefined)
            .map(
                ([type, value]) =>
                    new Change({operation: 'replace', modification: new Attribute({type, values: [value]})}),
            );

        if (modifications.length > 0) {
            await client.modify(dn, modifications);
        }
    });
}

export async function deleteLdapUser(username: string): Promise<void> {
    await withAdminClient(async (client) => {
        await client.del(`uid=${username},${ORG_UNIT_DN}`);
    });
}

// In `testcontainers` mode the Mattermost server is itself a container on the Testcontainers network, so it
// must reach OpenLDAP via its network alias — unlike testConfig.ldapHost/ldapPort, which resolve to
// a host-mapped address for this module's own ldapts client (a separate, non-containerized process).
function ldapServerAddress(): [string, number] {
    return testConfig.useTestContainers ? [OPENLDAP_ALIAS, OPENLDAP_PORT] : [testConfig.ldapHost, testConfig.ldapPort];
}

/** `LdapSettings` patch pointing the server at the OpenLDAP container and the users this module creates. */
export function ldapServerConfig(): Partial<AdminConfig['LdapSettings']> {
    const [ldapServer, ldapPort] = ldapServerAddress();
    return {
        Enable: true,
        LdapServer: ldapServer,
        LdapPort: ldapPort,
        BaseDN: ORG_UNIT_DN,
        BindUsername: OPENLDAP_ADMIN_DN,
        BindPassword: OPENLDAP_ADMIN_PASSWORD,
        UserFilter: '(objectClass=inetOrgPerson)',
        IdAttribute: 'uid',
        LoginIdAttribute: 'uid',
        UsernameAttribute: 'uid',
        EmailAttribute: 'mail',
        FirstNameAttribute: 'cn',
        LastNameAttribute: 'sn',
    };
}

/**
 * Checks OpenLDAP was started this run, points the server at it, and confirms the server can
 * actually reach it — skipping the test otherwise, instead of failing on an unmet precondition.
 */
export async function ensureOpenldap(): Promise<void> {
    if (!testConfig.testcontainersServices.includes('openldap')) {
        test.skip(true, 'Skipping test - openldap not started (set PW_TESTCONTAINERS_SERVICES=openldap)');
        return;
    }

    const {adminClient} = await getAdminClient();
    await adminClient.patchConfig({LdapSettings: ldapServerConfig()});

    // testLdap() searches under BaseDN and requires at least one matching user to succeed, so
    // probe with a throwaway user rather than depending on whatever the spec creates afterward.
    const probeUser = generateLdapUser('ensureprobe');
    try {
        await createLdapUser(probeUser);
        await adminClient.testLdap();
    } catch (error) {
        test.skip(true, `Skipping test - LDAP connection test failed: ${String(error)}`);
    } finally {
        await deleteLdapUser(probeUser.username).catch(() => undefined);
    }
}
