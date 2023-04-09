
import {checkE10Licensed, checkE20Licensed} from 'src/license';

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

    const withE10Name = withSkuName('E10');
    const withE20Name = withSkuName('E20');
    const withProfessionalName = withSkuName('professional');
    const withEnterpriseName = withSkuName('enterprise');
    const withUnknownName = withSkuName('unknown');

    const withMessageExportEnabled = withFeature('MessageExport', 'true');
    const withMessageExportDisabled = withFeature('MessageExport', 'false');
    const withLDAPEnabled = withFeature('LDAP', 'true');
    const withLDAPDisabled = withFeature('LDAP', 'false');

    const e10 = withE10Name(baseLicense);
    const professional = withProfessionalName(baseLicense);
    const e20 = withE20Name(baseLicense);
    const enterprise = withEnterpriseName(baseLicense);
    const unknownSku = withUnknownName(baseLicense);

    describe('check middle tier', () => {
        it('E10 SKU name', () => {
            expect(checkE10Licensed(e10)).toBe(true);
        });

        it('E10 SKU name with LDAP enabled', () => {
            expect(checkE10Licensed(withLDAPEnabled(e10))).toBe(true);
        });

        it('E10 SKU name with LDAP disabled', () => {
            expect(checkE10Licensed(withLDAPDisabled(e10))).toBe(true);
        });

        it('Professional SKU name', () => {
            expect(checkE10Licensed(professional)).toBe(true);
        });

        it('Professional SKU name with LDAP enabled', () => {
            expect(checkE10Licensed(withLDAPEnabled(professional))).toBe(true);
        });

        it('Professional SKU name with LDAP disabled', () => {
            expect(checkE10Licensed(withLDAPDisabled(professional))).toBe(true);
        });

        it('E20 SKU name', () => {
            expect(checkE10Licensed(e20)).toBe(true);
        });

        it('E20 SKU name with LDAP enabled', () => {
            expect(checkE10Licensed(withLDAPEnabled(e20))).toBe(true);
        });

        it('E20 SKU name with LDAP disabled', () => {
            expect(checkE10Licensed(withLDAPDisabled(e20))).toBe(true);
        });

        it('Enterprise SKU name', () => {
            expect(checkE10Licensed(enterprise)).toBe(true);
        });

        it('Enterprise SKU name with LDAP enabled', () => {
            expect(checkE10Licensed(withLDAPEnabled(enterprise))).toBe(true);
        });

        it('Enterprise SKU name with LDAP disabled', () => {
            expect(checkE10Licensed(withLDAPDisabled(enterprise))).toBe(true);
        });

        it('Unknown SKU name', () => {
            expect(checkE10Licensed(unknownSku)).toBe(false);
        });

        it('Unknown SKU name with LDAP enabled', () => {
            expect(checkE10Licensed(withLDAPEnabled(unknownSku))).toBe(true);
        });

        it('Unknown SKU name with LDAP disabled', () => {
            expect(checkE10Licensed(withLDAPDisabled(unknownSku))).toBe(false);
        });
    });

    describe('check upper tier', () => {
        it('E10 SKU name', () => {
            expect(checkE20Licensed(e10)).toBe(false);
        });

        it('E10 SKU name with LDAP enabled', () => {
            expect(checkE20Licensed(withMessageExportEnabled(e10))).toBe(false);
        });

        it('E10 SKU name with LDAP disabled', () => {
            expect(checkE20Licensed(withMessageExportDisabled(e10))).toBe(false);
        });

        it('Professional SKU name', () => {
            expect(checkE20Licensed(professional)).toBe(false);
        });

        it('Professional SKU name with LDAP enabled', () => {
            expect(checkE20Licensed(withMessageExportEnabled(professional))).toBe(false);
        });

        it('Professional SKU name with LDAP disabled', () => {
            expect(checkE20Licensed(withMessageExportDisabled(professional))).toBe(false);
        });

        it('E20 SKU name', () => {
            expect(checkE20Licensed(e20)).toBe(true);
        });

        it('E20 SKU name with Message Export enabled', () => {
            expect(checkE20Licensed(withMessageExportEnabled(e20))).toBe(true);
        });

        it('E20 SKU name with Message Export disabled', () => {
            expect(checkE20Licensed(withMessageExportDisabled(e20))).toBe(true);
        });

        it('Enterprise SKU name', () => {
            expect(checkE20Licensed(enterprise)).toBe(true);
        });

        it('Enterprise SKU name with Message Export enabled', () => {
            expect(checkE20Licensed(withMessageExportEnabled(enterprise))).toBe(true);
        });

        it('Enterprise SKU name with Message Export disabled', () => {
            expect(checkE20Licensed(withMessageExportDisabled(enterprise))).toBe(true);
        });

        it('Unknown SKU name', () => {
            expect(checkE20Licensed(unknownSku)).toBe(false);
        });

        it('Unknown SKU name with Message Export enabled', () => {
            expect(checkE20Licensed(withMessageExportEnabled(unknownSku))).toBe(true);
        });

        it('Unknown SKU name with Message Export disabled', () => {
            expect(checkE20Licensed(withMessageExportDisabled(unknownSku))).toBe(false);
        });
    });
});
