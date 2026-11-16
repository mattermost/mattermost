// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    NO_EXTERNAL_SOURCE_LINKS,
    conflictingExternalSources,
    externalSourceLinksFromField,
    hasExternalSourceLink,
    linkedExternalSources,
    resolveExternalSource,
    sourcesExclusiveOf,
} from './external_source';

const links = (overrides: Partial<typeof NO_EXTERNAL_SOURCE_LINKS>) => ({...NO_EXTERNAL_SOURCE_LINKS, ...overrides});

describe('externalSourceLinksFromField', () => {
    it('reads each source from the attr of the same name, ignoring anything that is not a string', () => {
        expect(externalSourceLinksFromField({attrs: {ldap: 'employeeID', saml: 7, openid: 'address.country'}})).toEqual({ldap: 'employeeID', saml: '', openid: 'address.country'});
        expect(externalSourceLinksFromField({})).toEqual(NO_EXTERNAL_SOURCE_LINKS);
    });
});

describe('linkedExternalSources', () => {
    it('lists the linked sources in chip order', () => {
        expect(linkedExternalSources(links({saml: 'position', ldap: 'employeeID'}))).toEqual(['ldap', 'saml']);
        expect(linkedExternalSources(links({openid: 'groups'}))).toEqual(['openid']);
        expect(hasExternalSourceLink(NO_EXTERNAL_SOURCE_LINKS)).toBe(false);
        expect(hasExternalSourceLink(links({openid: 'groups'}))).toBe(true);
    });
});

describe('resolveExternalSource', () => {
    it.each([
        [{}, undefined],
        [{ldap: 'employeeID'}, 'ldap'],
        [{saml: 'position'}, 'saml'],
        [{openid: 'department'}, 'openid'],

        // Both linked: AD/LDAP wins, matching the order the "Synced with" chips
        // render in, so the two never disagree about the primary source.
        [{ldap: 'employeeID', saml: 'position'}, 'ldap'],
    ])('resolves %p to %p', (overrides, expected) => {
        expect(resolveExternalSource(links(overrides))).toBe(expected);
    });
});

describe('sourcesExclusiveOf', () => {
    it('keeps OpenID Connect apart from AD/LDAP and SAML, which may be linked together', () => {
        expect(sourcesExclusiveOf('openid')).toEqual(['ldap', 'saml']);
        expect(sourcesExclusiveOf('ldap')).toEqual(['openid']);
        expect(sourcesExclusiveOf('saml')).toEqual(['openid']);
    });

    it('names the linked sources that block another one', () => {
        expect(conflictingExternalSources('openid', links({ldap: 'employeeID', saml: 'position'}))).toEqual(['ldap', 'saml']);
        expect(conflictingExternalSources('saml', links({ldap: 'employeeID'}))).toEqual([]);
        expect(conflictingExternalSources('ldap', links({openid: 'department'}))).toEqual(['openid']);
        expect(conflictingExternalSources('openid', NO_EXTERNAL_SOURCE_LINKS)).toEqual([]);
    });
});
