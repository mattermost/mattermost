// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {externalSourceValue, resolveExternalSource} from './external_source';

describe('externalSourceValue', () => {
    it('reads each source from its own attribute', () => {
        expect(externalSourceValue('ldap', 'employeeID', 'position')).toBe('employeeID');
        expect(externalSourceValue('saml', 'employeeID', 'position')).toBe('position');
    });
});

describe('resolveExternalSource', () => {
    it.each([
        ['', '', undefined],
        ['employeeID', '', 'ldap'],
        ['', 'position', 'saml'],

        // Both linked: AD/LDAP wins, matching the order the "Synced with" chips
        // render in, so the two never disagree about the primary source.
        ['employeeID', 'position', 'ldap'],
    ])('resolves ldap=%p saml=%p to %p', (ldapAttr, samlAttr, expected) => {
        expect(resolveExternalSource(ldapAttr, samlAttr)).toBe(expected);
    });
});
