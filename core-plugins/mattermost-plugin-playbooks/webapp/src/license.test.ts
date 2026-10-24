// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {checkEnterpriseLicensed, checkProfessionalLicensed} from 'src/license';

describe('license checks', () => {
    const baseLicense = {};

    const withSkuName = (name: string) => (license: Record<string, string>) => {
        return {
            ...license,
            SkuShortName: name,
        };
    };

    const withFeature = (feature: string, value: string) => (license: Record<string, string>) => {
        return {
            ...license,
            [feature]: value,
        };
    };

    const withProfessionalName = withSkuName('professional');
    const withEnterpriseName = withSkuName('enterprise');
    const withEntryName = withSkuName('entry');
    const withEnterpriseAdvancedName = withSkuName('advanced');
    const withUnknownName = withSkuName('unknown');

    const withMessageExportEnabled = withFeature('MessageExport', 'true');
    const withMessageExportDisabled = withFeature('MessageExport', 'false');
    const withLDAPEnabled = withFeature('LDAP', 'true');
    const withLDAPDisabled = withFeature('LDAP', 'false');

    const professional = withProfessionalName(baseLicense);
    const enterprise = withEnterpriseName(baseLicense);
    const entry = withEntryName(baseLicense);
    const enterpriseAdvanced = withEnterpriseAdvancedName(baseLicense);
    const unknownSku = withUnknownName(baseLicense);

    describe('check professional tier', () => {
        it('Professional SKU name', () => {
            expect(checkProfessionalLicensed(professional)).toBe(true);
        });

        it('Professional SKU name with LDAP enabled', () => {
            expect(checkProfessionalLicensed(withLDAPEnabled(professional))).toBe(true);
        });

        it('Professional SKU name with LDAP disabled', () => {
            expect(checkProfessionalLicensed(withLDAPDisabled(professional))).toBe(true);
        });

        it('Enterprise SKU name', () => {
            expect(checkProfessionalLicensed(enterprise)).toBe(true);
        });

        it('Enterprise SKU name with LDAP enabled', () => {
            expect(checkProfessionalLicensed(withLDAPEnabled(enterprise))).toBe(true);
        });

        it('Enterprise SKU name with LDAP disabled', () => {
            expect(checkProfessionalLicensed(withLDAPDisabled(enterprise))).toBe(true);
        });

        it('Enterprise Advanced SKU name', () => {
            expect(checkProfessionalLicensed(enterpriseAdvanced)).toBe(true);
        });

        it('Enterprise Advanced SKU name with LDAP enabled', () => {
            expect(checkProfessionalLicensed(withLDAPEnabled(enterpriseAdvanced))).toBe(true);
        });

        it('Enterprise Advanced SKU name with LDAP disabled', () => {
            expect(checkProfessionalLicensed(withLDAPDisabled(enterpriseAdvanced))).toBe(true);
        });

        it('Entry SKU name', () => {
            expect(checkProfessionalLicensed(entry)).toBe(true);
        });

        it('Entry SKU name with LDAP enabled', () => {
            expect(checkProfessionalLicensed(withLDAPEnabled(entry))).toBe(true);
        });

        it('Entry SKU name with LDAP disabled', () => {
            expect(checkProfessionalLicensed(withLDAPDisabled(entry))).toBe(true);
        });

        it('Unknown SKU name', () => {
            expect(checkProfessionalLicensed(unknownSku)).toBe(false);
        });

        it('Unknown SKU name with LDAP enabled', () => {
            expect(checkProfessionalLicensed(withLDAPEnabled(unknownSku))).toBe(true);
        });

        it('Unknown SKU name with LDAP disabled', () => {
            expect(checkProfessionalLicensed(withLDAPDisabled(unknownSku))).toBe(false);
        });
    });

    describe('check enterprise tier', () => {
        it('Professional SKU name', () => {
            expect(checkEnterpriseLicensed(professional)).toBe(false);
        });

        it('Professional SKU name with Message Export enabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportEnabled(professional))).toBe(false);
        });

        it('Professional SKU name with Message Export disabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportDisabled(professional))).toBe(false);
        });

        it('Enterprise SKU name', () => {
            expect(checkEnterpriseLicensed(enterprise)).toBe(true);
        });

        it('Enterprise SKU name with Message Export enabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportEnabled(enterprise))).toBe(true);
        });

        it('Enterprise SKU name with Message Export disabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportDisabled(enterprise))).toBe(true);
        });

        it('Enterprise Advanced SKU name', () => {
            expect(checkEnterpriseLicensed(enterpriseAdvanced)).toBe(true);
        });

        it('Enterprise Advanced SKU name with Message Export enabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportEnabled(enterpriseAdvanced))).toBe(true);
        });

        it('Enterprise Advanced SKU name with Message Export disabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportDisabled(enterpriseAdvanced))).toBe(true);
        });

        it('Entry SKU name', () => {
            expect(checkEnterpriseLicensed(entry)).toBe(true);
        });

        it('Entry SKU name with Message Export enabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportEnabled(entry))).toBe(true);
        });

        it('Entry SKU name with Message Export disabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportDisabled(entry))).toBe(true);
        });

        it('Unknown SKU name', () => {
            expect(checkEnterpriseLicensed(unknownSku)).toBe(false);
        });

        it('Unknown SKU name with Message Export enabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportEnabled(unknownSku))).toBe(true);
        });

        it('Unknown SKU name with Message Export disabled', () => {
            expect(checkEnterpriseLicensed(withMessageExportDisabled(unknownSku))).toBe(false);
        });
    });
});
