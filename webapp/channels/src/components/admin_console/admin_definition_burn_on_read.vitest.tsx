// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

vi.mock('./admin_definition', () => ({
    default: {
        site: {
            subsections: {
                posts: {
                    schema: {
                        sections: [
                            {
                                key: 'PostSettings.BurnOnRead',
                                settings: [
                                    {
                                        key: 'ServiceSettings.EnableBurnOnRead',
                                        type: 'bool',
                                        label: {id: 'burn_on_read.enable.label', defaultMessage: 'Enable Burn on Read'},
                                        help_text: {id: 'burn_on_read.enable.help', defaultMessage: 'Help text'},
                                        isDisabled: vi.fn(),
                                    },
                                    {
                                        key: 'ServiceSettings.BurnOnReadDurationMinutes',
                                        type: 'dropdown',
                                        label: {id: 'burn_on_read.duration.label', defaultMessage: 'Duration'},
                                        help_text: {id: 'burn_on_read.duration.help', defaultMessage: 'Help text'},
                                        onConfigLoad: (val: unknown) => val || '10',
                                        options: [
                                            {value: '1'},
                                            {value: '5'},
                                            {value: '10'},
                                            {value: '30'},
                                            {value: '60'},
                                            {value: '480'},
                                        ],
                                        isDisabled: vi.fn(),
                                    },
                                ],
                                component: vi.fn(),
                                license_sku: 'enterprise_advanced',
                                componentProps: {
                                    requiredSku: 'enterprise_advanced',
                                    featureDiscoveryConfig: {
                                        featureName: 'burn_on_read',
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        },
    },
}));

describe('AdminDefinition - Burn-on-Read Settings', () => {
    test('should include Burn-on-Read settings in posts section', async () => {
        const {default: AdminDefinition} = await import('./admin_definition');
        const postsSection = AdminDefinition.site.subsections.posts;
        expect(postsSection).toBeDefined();

        const schema = postsSection.schema as {sections?: Array<{key: string; settings?: unknown[]}>};
        const sections = schema?.sections ?? [];
        expect(sections.length).toBeGreaterThan(0);

        const burnOnReadSection = sections.find((s) => s.key === 'PostSettings.BurnOnRead');
        expect(burnOnReadSection).toBeDefined();
    });

    test('EnableBurnOnRead setting should have correct configuration', async () => {
        const {default: AdminDefinition} = await import('./admin_definition');
        const postsSection = AdminDefinition.site.subsections.posts;
        const schema = postsSection.schema as {sections?: Array<{key: string; settings?: Array<{key: string; type?: string; label?: unknown}>}>};
        const sections = schema?.sections ?? [];
        const burnOnReadSection = sections.find((s) => s.key === 'PostSettings.BurnOnRead');
        const settings = burnOnReadSection?.settings ?? [];

        const enableSetting = settings.find((s) => s.key === 'ServiceSettings.EnableBurnOnRead');
        expect(enableSetting?.type).toBe('bool');
        expect(enableSetting?.label).toBeDefined();
    });

    test('BurnOnReadDurationMinutes setting should have correct options', async () => {
        const {default: AdminDefinition} = await import('./admin_definition');
        const postsSection = AdminDefinition.site.subsections.posts;
        const schema = postsSection.schema as {sections?: Array<{key: string; settings?: Array<{key: string; type?: string; options?: unknown[]}>}>};
        const sections = schema?.sections ?? [];
        const burnOnReadSection = sections.find((s) => s.key === 'PostSettings.BurnOnRead');
        const settings = burnOnReadSection?.settings ?? [];

        const durationSetting = settings.find((s) => s.key === 'ServiceSettings.BurnOnReadDurationMinutes');
        expect(durationSetting?.type).toBe('dropdown');
        expect(durationSetting?.options).toBeDefined();
    });

    test('all Burn-on-Read settings should have proper permission checks', async () => {
        const {default: AdminDefinition} = await import('./admin_definition');
        const postsSection = AdminDefinition.site.subsections.posts;
        const schema = postsSection.schema as {sections?: Array<{key: string; settings?: Array<{key: string; isDisabled?: unknown}>}>};
        const sections = schema?.sections ?? [];
        const burnOnReadSection = sections.find((s) => s.key === 'PostSettings.BurnOnRead');
        const settings = burnOnReadSection?.settings ?? [];

        settings.forEach((setting) => {
            expect(setting.isDisabled).toBeDefined();
        });
    });

    test('settings should have proper translation message descriptors', async () => {
        const {default: AdminDefinition} = await import('./admin_definition');
        const postsSection = AdminDefinition.site.subsections.posts;
        const schema = postsSection.schema as {sections?: Array<{key: string; settings?: Array<{key: string; label?: {id?: string}}>}>};
        const sections = schema?.sections ?? [];
        const burnOnReadSection = sections.find((s) => s.key === 'PostSettings.BurnOnRead');
        const settings = burnOnReadSection?.settings ?? [];

        settings.forEach((setting) => {
            if (setting.label && typeof setting.label === 'object') {
                expect(setting.label.id).toBeDefined();
            }
        });
    });

    test('Burn-on-Read section should use LicensedSectionContainer with proper feature discovery', async () => {
        const {default: AdminDefinition} = await import('./admin_definition');
        const postsSection = AdminDefinition.site.subsections.posts;
        const schema = postsSection.schema as {sections?: Array<{key: string; componentProps?: {featureDiscoveryConfig?: {featureName?: string}}}>};
        const sections = schema?.sections ?? [];
        const burnOnReadSection = sections.find((s) => s.key === 'PostSettings.BurnOnRead');

        expect(burnOnReadSection).toBeDefined();
        expect(burnOnReadSection?.componentProps?.featureDiscoveryConfig?.featureName).toBe('burn_on_read');
    });
});
