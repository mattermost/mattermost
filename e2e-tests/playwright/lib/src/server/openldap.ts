// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Attribute, Change, Client} from 'ldapts';

import {testConfig} from '@/test_config';
import {duration} from '@/util';

export type LdapUser = {
    username: string;
    password: string;
    email: string;
    firstName: string;
    lastName: string;
};

const ldapBaseDN = 'ou=e2etest,dc=mm,dc=test,dc=com';
const ldapBindDN = 'cn=admin,dc=mm,dc=test,dc=com';

/**
 * Creates and updates users in the OpenLDAP service supplied by E2E Docker.
 */
export class OpenLdapClient {
    private readonly client: Client;

    constructor(url = testConfig.ldapUrl) {
        this.client = new Client({url, timeout: duration.half_min, connectTimeout: duration.half_min});
    }

    async createUser(user: LdapUser) {
        await this.withBinding(async () => {
            await this.ensureUserOrganizationalUnit();
            await this.client.add(this.userDN(user.username), {
                objectClass: ['iNetOrgPerson'],
                cn: user.firstName,
                sn: user.lastName,
                uid: user.username,
                mail: user.email,
                userPassword: user.password,
            });
        });
    }

    async updateUserNames(username: string, firstName: string, lastName: string) {
        await this.withBinding(async () => {
            await this.client.modify(this.userDN(username), [
                new Change({
                    operation: 'replace',
                    modification: new Attribute({type: 'cn', values: [firstName]}),
                }),
                new Change({
                    operation: 'replace',
                    modification: new Attribute({type: 'sn', values: [lastName]}),
                }),
            ]);
        });
    }

    private async ensureUserOrganizationalUnit() {
        await this.client
            .add(ldapBaseDN, {
                objectClass: ['organizationalUnit'],
                ou: 'e2etest',
            })
            .catch((error: {code?: number}) => {
                if (error.code !== 68) {
                    throw error;
                }
            });
    }

    private async withBinding(action: () => Promise<void>) {
        await this.client.bind(ldapBindDN, testConfig.ldapBindPassword);
        try {
            await action();
        } finally {
            await this.client.unbind();
        }
    }

    private userDN(username: string) {
        return `uid=${username},${ldapBaseDN}`;
    }
}
