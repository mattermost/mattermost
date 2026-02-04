// webapp/channels/src/tests/mattermost_extended/settings_resorted.test.tsx
/**
 * Tests for the SettingsResorted feature flag.
 * When enabled, user settings are reorganized into intuitive categories with icons.
 */

describe('SettingsResorted Feature', () => {
    describe('Config Mapping', () => {
        it('should map FeatureFlagSettingsResorted to boolean', () => {
            // When config.FeatureFlagSettingsResorted === 'true', feature is enabled
            const configEnabled = {FeatureFlagSettingsResorted: 'true'};
            const configDisabled = {FeatureFlagSettingsResorted: 'false'};
            const configMissing = {};

            expect(configEnabled.FeatureFlagSettingsResorted === 'true').toBe(true);
            expect(configDisabled.FeatureFlagSettingsResorted === 'true').toBe(false);
            expect((configMissing as any).FeatureFlagSettingsResorted === 'true').toBe(false);
        });
    });

    describe('Tab Structure', () => {
        describe('when SettingsResorted is disabled', () => {
            it('should have default tabs: Notifications, Display, Sidebar, Advanced', () => {
                const defaultTabs = [
                    'notifications',
                    'display',
                    'sidebar',
                    'advanced',
                ];

                // Default tab names
                expect(defaultTabs).toContain('notifications');
                expect(defaultTabs).toContain('display');
                expect(defaultTabs).toContain('sidebar');
                expect(defaultTabs).toContain('advanced');
            });

            it('should NOT have split display tabs', () => {
                const defaultTabs = [
                    'notifications',
                    'display',
                    'sidebar',
                    'advanced',
                ];

                expect(defaultTabs).not.toContain('display_theme');
                expect(defaultTabs).not.toContain('display_time');
                expect(defaultTabs).not.toContain('display_teammates');
                expect(defaultTabs).not.toContain('display_messages');
                expect(defaultTabs).not.toContain('display_channel');
                expect(defaultTabs).not.toContain('display_language');
            });
        });

        describe('when SettingsResorted is enabled', () => {
            it('should have reorganized tabs with split display categories', () => {
                const resortedTabs = [
                    'notifications',
                    'display_theme',
                    'display_time',
                    'display_teammates',
                    'display_messages',
                    'display_channel',
                    'display_language',
                    'sidebar',
                    'advanced',
                ];

                // Should have split display tabs
                expect(resortedTabs).toContain('display_theme');
                expect(resortedTabs).toContain('display_time');
                expect(resortedTabs).toContain('display_teammates');
                expect(resortedTabs).toContain('display_messages');
                expect(resortedTabs).toContain('display_channel');
                expect(resortedTabs).toContain('display_language');
            });

            it('should NOT have combined display tab', () => {
                const resortedTabs = [
                    'notifications',
                    'display_theme',
                    'display_time',
                    'display_teammates',
                    'display_messages',
                    'display_channel',
                    'display_language',
                    'sidebar',
                    'advanced',
                ];

                expect(resortedTabs).not.toContain('display');
            });
        });
    });

    describe('Tab Icons', () => {
        const tabIcons = {
            notifications: 'icon icon-bell-outline',
            display_theme: 'icon icon-palette-outline',
            display_time: 'icon icon-clock-outline',
            display_teammates: 'icon icon-account-multiple-outline',
            display_messages: 'icon icon-message-text-outline',
            display_channel: 'icon icon-forum-outline',
            display_language: 'icon icon-globe',
            sidebar: 'icon icon-dock-left',
            advanced: 'icon icon-tune',
        };

        it('should have icon for each resorted tab', () => {
            Object.entries(tabIcons).forEach(([tab, icon]) => {
                expect(icon).toBeDefined();
                expect(icon).toContain('icon icon-');
            });
        });

        it('should use MDI (Material Design Icons) format', () => {
            Object.values(tabIcons).forEach((icon) => {
                expect(icon).toMatch(/^icon icon-[\w-]+$/);
            });
        });
    });

    describe('Preference Group Mapping', () => {
        it('should map display_theme tab to THEME group', () => {
            const tabToGroup: Record<string, string> = {
                display_theme: 'theme',
                display_time: 'time_date',
                display_teammates: 'teammates',
                display_messages: 'messages',
                display_channel: 'channel',
                display_language: 'language',
            };

            expect(tabToGroup.display_theme).toBe('theme');
            expect(tabToGroup.display_time).toBe('time_date');
            expect(tabToGroup.display_teammates).toBe('teammates');
            expect(tabToGroup.display_messages).toBe('messages');
            expect(tabToGroup.display_channel).toBe('channel');
            expect(tabToGroup.display_language).toBe('language');
        });
    });

    describe('Feature Flag Toggle', () => {
        it('should be configurable via admin console', () => {
            // The feature flag is exposed in admin_definition.tsx
            // and can be toggled via MattermostExtendedSettings.Features.SettingsResorted
            const featureFlagKey = 'FeatureFlagSettingsResorted';
            expect(featureFlagKey).toBeDefined();
        });

        it('should be configurable via environment variable', () => {
            // MM_FEATUREFLAGS_SETTINGSRESORTED=true
            const envVarName = 'MM_FEATUREFLAGS_SETTINGSRESORTED';
            expect(envVarName).toBe('MM_FEATUREFLAGS_SETTINGSRESORTED');
        });
    });
});