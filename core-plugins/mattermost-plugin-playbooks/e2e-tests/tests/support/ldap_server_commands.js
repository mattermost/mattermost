// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '../utils';

const ldapTmpFolder = 'ldap_tmp';

Cypress.Commands.add('modifyLDAPUsers', (filename) => {
    cy.exec(`ldapmodify -x -D "cn=admin,dc=mm,dc=test,dc=com" -w mostest -H ldap://${Cypress.env('ldapServer')}:${Cypress.env('ldapPort')} -f tests/fixtures/${filename} -c`, {failOnNonZeroExit: false});
});

Cypress.Commands.add('resetLDAPUsers', () => {
    cy.modifyLDAPUsers('ldap-reset-data.ldif');
});

Cypress.Commands.add('createLDAPUser', ({prefix = 'ldap', user} = {}) => {
    const ldapUser = user || generateLDAPUser(prefix);
    const data = generateContent(ldapUser);
    const filename = `new_user_${Date.now()}.ldif`;
    const filePath = `tests/fixtures/${ldapTmpFolder}/${filename}`;

    cy.task('writeToFile', ({filename, fixturesFolder: ldapTmpFolder, data}));

    return cy.ldapAdd(filePath).then(() => {
        return cy.wrap(ldapUser);
    });
});

Cypress.Commands.add('updateLDAPUser', (user) => {
    const data = generateContent(user, true);
    const filename = `update_user_${Date.now()}.ldif`;
    const filePath = `tests/fixtures/${ldapTmpFolder}/${filename}`;

    cy.task('writeToFile', ({filename, fixturesFolder: ldapTmpFolder, data}));

    return cy.ldapModify(filePath).then(() => {
        return cy.wrap(user);
    });
});

Cypress.Commands.add('ldapAdd', (filePath) => {
    const {host, bindDn, password} = getLDAPCredentials();

    return cy.exec(
        `ldapadd -x -D "${bindDn}" -w ${password} -H ${host} -f ${filePath} -c`,
        {failOnNonZeroExit: false},
    ).then(({code, stdout, stderr}) => {
        cy.log(`ldapadd code: ${code}, stdout: ${stdout}, stderr: ${stderr}`);
    });
});

Cypress.Commands.add('ldapModify', (filePath) => {
    const {host, bindDn, password} = getLDAPCredentials();

    return cy.exec(
        `ldapmodify -x -D "${bindDn}" -w ${password} -H ${host} -f ${filePath} -c`,
        {failOnNonZeroExit: false},
    ).then(({code, stdout, stderr}) => {
        cy.log(`ldapmodify code: ${code}, stdout: ${stdout}, stderr: ${stderr}`);
    });
});

function getLDAPCredentials() {
    const host = `ldap://${Cypress.env('ldapServer')}:${Cypress.env('ldapPort')}`;
    const bindDn = 'cn=admin,dc=mm,dc=test,dc=com';
    const password = 'mostest';

    return {host, bindDn, password};
}

export function generateLDAPUser(prefix = 'ldap') {
    const randomId = getRandomId();
    const username = `${prefix}user${randomId}`;

    return {
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

function generateContent(user = {}, isUpdate = false) {
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
