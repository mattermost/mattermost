// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericContainer, StartedTestContainer, Wait, StartedNetwork} from 'testcontainers';

import {getOpenLdapImage, DEFAULT_CREDENTIALS, INTERNAL_PORTS} from '../config/defaults';
import {OpenLdapConnectionInfo} from '../config/types';
import {createFileLogConsumer} from '../utils/log';

// Custom schema for objectGUID attribute (from server/tests/custom-schema-objectID.ldif)
const CUSTOM_SCHEMA_OBJECT_ID = `dn: cn=schema,cn=config
changetype: modify
add: olcAttributeTypes
olcAttributeTypes: ( 1.2.840.113556.1.4.2 NAME 'objectGUID'
  DESC 'AD object GUID'
  EQUALITY octetStringMatch
  SYNTAX 1.3.6.1.4.1.1466.115.121.1.40
  SINGLE-VALUE )
-
add: olcObjectClasses
olcObjectClasses: ( 1.2.840.113556.1.5.256 NAME 'activeDSObject'
  DESC 'Active Directory Schema Object'
  SUP top AUXILIARY
  MAY ( objectGUID ) )`;

// Custom schema for Custom Profile Attributes (from server/tests/custom-schema-cpa.ldif)
const CUSTOM_SCHEMA_CPA = `dn: cn=schema,cn=config
changetype: modify
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.101
    NAME 'textCustomAttribute'
    DESC 'A text custom attribute for inetOrgPerson'
    EQUALITY caseIgnoreMatch
    SUBSTR caseIgnoreSubstringsMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.15 )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.104
    NAME 'dateCustomAttribute'
    DESC 'A date attribute'
    EQUALITY generalizedTimeMatch
    ORDERING generalizedTimeOrderingMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.24 )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.105
    NAME 'selectCustomAttribute'
    DESC 'A selection attribute with values: option1, option2, option3'
    EQUALITY caseIgnoreMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.15
    SINGLE-VALUE )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.106
    NAME 'multiSelectCustomAttribute'
    DESC 'A multi-selection attribute with values: choice1, choice2, choice3, choice4'
    EQUALITY caseIgnoreMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.15 )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.107
    NAME 'userReferenceCustomAttribute'
    DESC 'A reference to a single user'
    EQUALITY distinguishedNameMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.12
    SINGLE-VALUE )
-
add: olcAttributeTypes
olcAttributeTypes: ( 1.3.6.1.4.1.4203.666.1.108
    NAME 'multiUserReferenceCustomAttribute'
    DESC 'References to multiple users'
    EQUALITY distinguishedNameMatch
    SYNTAX 1.3.6.1.4.1.1466.115.121.1.12 )
-
add: olcObjectClasses
olcObjectClasses: ( 1.3.6.1.4.1.4203.666.1.103
    NAME 'customInetOrgPerson'
    DESC 'inetOrgPerson with custom attributes'
    SUP top
    AUXILIARY
    MAY ( textCustomAttribute $ dateCustomAttribute $ selectCustomAttribute $ multiSelectCustomAttribute $ userReferenceCustomAttribute $ multiUserReferenceCustomAttribute))`;

// Test data LDIF (from server/tests/test-data.ldif) - simplified version with essential test users
const TEST_DATA_LDIF = `dn: ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: organizationalunit

dn: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: iNetOrgPerson
sn: User
cn: Test1
title: Test1 Title
mail: success+testone@simulator.amazonses.com
userPassword: Password1

dn: uid=test.two,ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: iNetOrgPerson
sn: User
cn: Test2
title: Test2 Title
mail: success+testtwo@simulator.amazonses.com
userPassword: Password1

dn: uid=dev.one,ou=testusers,dc=mm,dc=test,dc=com
changetype: add
objectclass: iNetOrgPerson
sn: User
cn: Dev1
title: Senior Software Design Engineer
mail: success+devone@simulator.amazonses.com
userPassword: Password1

dn: ou=testgroups,dc=mm,dc=test,dc=com
changetype: add
objectclass: organizationalunit

dn: cn=developers,ou=testgroups,dc=mm,dc=test,dc=com
changetype: add
objectclass: groupOfUniqueNames
uniqueMember: uid=dev.one,ou=testusers,dc=mm,dc=test,dc=com
uniqueMember: uid=test.one,ou=testusers,dc=mm,dc=test,dc=com`;

export interface OpenLdapConfig {
    image?: string;
    adminPassword?: string;
    domain?: string;
    organisation?: string;
}

export async function createOpenLdapContainer(
    network: StartedNetwork,
    config: OpenLdapConfig = {},
): Promise<StartedTestContainer> {
    const image = config.image ?? getOpenLdapImage();
    const adminPassword = config.adminPassword ?? DEFAULT_CREDENTIALS.openldap.adminPassword;
    const domain = config.domain ?? DEFAULT_CREDENTIALS.openldap.domain;
    const organisation = config.organisation ?? DEFAULT_CREDENTIALS.openldap.organisation;

    const container = await new GenericContainer(image)
        .withNetwork(network)
        .withNetworkAliases('openldap')
        .withEnvironment({
            LDAP_TLS_VERIFY_CLIENT: 'never',
            LDAP_ORGANISATION: organisation,
            LDAP_DOMAIN: domain,
            LDAP_ADMIN_PASSWORD: adminPassword,
        })
        .withCopyContentToContainer([
            {
                content: CUSTOM_SCHEMA_OBJECT_ID,
                target: '/container/service/slapd/assets/test/custom-schema-objectID.ldif',
            },
            {content: CUSTOM_SCHEMA_CPA, target: '/container/service/slapd/assets/test/custom-schema-cpa.ldif'},
            {content: TEST_DATA_LDIF, target: '/container/service/slapd/assets/test/test-data.ldif'},
        ])
        .withExposedPorts(INTERNAL_PORTS.openldap.ldap, INTERNAL_PORTS.openldap.ldaps)
        .withLogConsumer(createFileLogConsumer('openldap'))
        .withWaitStrategy(Wait.forLogMessage(/slapd starting/))
        .withStartupTimeout(60_000)
        .start();

    return container;
}

export function getOpenLdapConnectionInfo(container: StartedTestContainer, image: string): OpenLdapConnectionInfo {
    const host = container.getHost();
    const domain = DEFAULT_CREDENTIALS.openldap.domain;
    const domainParts = domain.split('.');
    const baseDN = domainParts.map((part) => `dc=${part}`).join(',');

    return {
        host,
        port: container.getMappedPort(INTERNAL_PORTS.openldap.ldap),
        tlsPort: container.getMappedPort(INTERNAL_PORTS.openldap.ldaps),
        baseDN,
        bindDN: `cn=admin,${baseDN}`,
        bindPassword: DEFAULT_CREDENTIALS.openldap.adminPassword,
        image,
    };
}
