// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from 'tests/types';
import {getRandomId} from '../utils';

const ldapTmpFolder = 'ldap_tmp';

export interface LdapUser {
    username: string;
    password: string;
    email: string;
    firstname: string;
    lastname: string;
    ldapfirstname: string;
    ldaplastname: string;
    keycloakId: string;
}

function modifyLDAPUsers(filename: string) {
    cy.exec(`ldapmodify -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest -H ldap://${Cypress.env('ldapServer')}:${Cypress.env('ldapPort')} -f tests/fixtures/${filename} -c`, {failOnNonZeroExit: false});
}

Cypress.Commands.add('modifyLDAPUsers', modifyLDAPUsers);

function resetLDAPUsers() {
    cy.modifyLDAPUsers('ldap-reset-data.ldif');
}

Cypress.Commands.add('resetLDAPUsers', resetLDAPUsers);

function createLDAPUser({prefix = 'ldap', user = null} = {}): ChainableT<LdapUser> {
    const ldapUser = user || generateLDAPUser(prefix);
    const data = generateContent(ldapUser);
    const filename = `new_user_${Date.now()}.ldif`;
    const filePath = `tests/fixtures/${ldapTmpFolder}/${filename}`;

    cy.task('writeToFile', ({filename, fixturesFolder: ldapTmpFolder, data}));

    return cy.ldapAdd(filePath).then(() => {
        return cy.wrap<LdapUser>(ldapUser);
    });
}

Cypress.Commands.add('createLDAPUser', createLDAPUser);

function updateLDAPUser(user: Partial<LdapUser>) {
    const data = generateContent(user, true);
    const filename = `update_user_${Date.now()}.ldif`;
    const filePath = `tests/fixtures/${ldapTmpFolder}/${filename}`;

    cy.task('writeToFile', ({filename, fixturesFolder: ldapTmpFolder, data}));

    return cy.ldapModify(filePath).then(() => {
        return cy.wrap(user);
    });
}

Cypress.Commands.add('updateLDAPUser', updateLDAPUser);

function ldapAdd(filePath: string) {
    const {host, bindDn, password} = getLDAPCredentials();

    return cy.exec(
        `ldapadd -x -D "${bindDn}" -w ${password} -H ${host} -f ${filePath} -c`,
        {failOnNonZeroExit: false},
    ).then(({code, stdout, stderr}) => {
        cy.log(`ldapadd code: ${code}, stdout: ${stdout}, stderr: ${stderr}`);
    });
}

Cypress.Commands.add('ldapAdd', ldapAdd);

function ldapModify(filePath: string) {
    const {host, bindDn, password} = getLDAPCredentials();

    return cy.exec(
        `ldapmodify -x -D "${bindDn}" -w ${password} -H ${host} -f ${filePath} -c`,
        {failOnNonZeroExit: false},
    ).then(({code, stdout, stderr}) => {
        cy.log(`ldapmodify code: ${code}, stdout: ${stdout}, stderr: ${stderr}`);
    });
}

Cypress.Commands.add('ldapModify', ldapModify);

function getLDAPCredentials() {
    const host = `ldap://${Cypress.env('ldapServer')}:${Cypress.env('ldapPort')}`;
    const bindDn = 'cn=admin,dc=mm,dc=test,dc=com';
    const password = 'mostest';

    return {host, bindDn, password};
}

export function generateLDAPUser(prefix = 'ldap'): LdapUser {
    const randomId = getRandomId();
    const username = `${prefix}user${randomId}`;

    return <LdapUser>{
        username,
        password: 'Password1',
        email: `${username}@mmtest.com`,
        firstname: `Firstname-${randomId}`,
        lastname: `Lastname-${randomId}`,
        ldapfirstname: `${prefix.toUpperCase()}Firstname-${randomId}`,
        ldaplastname: `${prefix.toUpperCase()}Lastname-${randomId}`,
        keycloakId: '',
    };
}

function generateContent(user: Partial<LdapUser> = {}, isUpdate = false) {
    let deleteContent = '';
    if (isUpdate) {
        deleteContent = `dn: uid=${user.username},ou=e2etest,dc=mm,dc=test,dc=com
changetype: delete
`;
    }

    return `
${deleteContent}

dn: ou=e2etest,dc=mm,dc=test,dc=com
changetype: add
objectclass: organizationalunit

# generic test users
dn: uid=${user.username},ou=e2etest,dc=mm,dc=test,dc=com
changetype: add
objectclass: iNetOrgPerson
cn: ${user.firstname}
sn: ${user.lastname}
uid: ${user.username}
mail: ${user.email}
userPassword: Password1
`;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            modifyLDAPUsers: typeof modifyLDAPUsers;
            resetLDAPUsers: typeof resetLDAPUsers;
            createLDAPUser: typeof createLDAPUser;
            updateLDAPUser: typeof updateLDAPUser;
            ldapAdd: typeof ldapAdd;
            ldapModify: typeof ldapModify;
        }
    }
}
