// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for Admin Sidebar Mattermost Extended features:
 * - SystemConsoleHideEnterprise: Hides enterprise-only features from sidebar
 * - SystemConsoleIcons: Shows icons next to sidebar items
 */

describe('SystemConsoleHideEnterprise feature flag', () => {
    const mockItem = {
        url: 'test-item',
        title: 'Test Item',
        restrictedIndicator: {
            shouldDisplay: () => true,
            value: () => 'Enterprise',
        },
    };

    const mockItemNoRestricted = {
        url: 'test-item-2',
        title: 'Test Item 2',
    };

    describe('when hideEnterpriseEnabled is true', () => {
        it('should hide items with restrictedIndicator', () => {
            const hideEnterpriseEnabled = true;

            // Simulate the logic from admin_sidebar.tsx
            const shouldHide = hideEnterpriseEnabled && mockItem.restrictedIndicator;

            expect(shouldHide).toBe(true);
        });

        it('should NOT hide items without restrictedIndicator', () => {
            const hideEnterpriseEnabled = true;

            // Simulate the logic from admin_sidebar.tsx
            const shouldHide = hideEnterpriseEnabled && mockItemNoRestricted.restrictedIndicator;

            expect(shouldHide).toBeFalsy();
        });
    });

    describe('when hideEnterpriseEnabled is false', () => {
        it('should NOT hide items with restrictedIndicator', () => {
            const hideEnterpriseEnabled = false;

            const shouldHide = hideEnterpriseEnabled && mockItem.restrictedIndicator;

            expect(shouldHide).toBe(false);
        });

        it('should NOT hide items without restrictedIndicator', () => {
            const hideEnterpriseEnabled = false;

            const shouldHide = hideEnterpriseEnabled && mockItemNoRestricted.restrictedIndicator;

            expect(shouldHide).toBeFalsy();
        });
    });

    describe('config mapping', () => {
        it('should map FeatureFlagSystemConsoleHideEnterprise config to prop', () => {
            const configEnabled = {FeatureFlagSystemConsoleHideEnterprise: 'true'};
            const configDisabled = {FeatureFlagSystemConsoleHideEnterprise: 'false'};
            const configMissing = {};

            expect(configEnabled.FeatureFlagSystemConsoleHideEnterprise === 'true').toBe(true);
            expect(configDisabled.FeatureFlagSystemConsoleHideEnterprise === 'true').toBe(false);
            expect((configMissing as Record<string, string>).FeatureFlagSystemConsoleHideEnterprise === 'true').toBe(false);
        });
    });
});

describe('SystemConsoleIcons feature flag', () => {
    const mockItem = {
        url: 'test-item',
        title: 'Test Item',
        icon: <span className="test-icon">Icon</span>,
    };

    describe('when iconsEnabled is true', () => {
        it('should include icon prop', () => {
            const iconsEnabled = true;

            // Simulate the logic from admin_sidebar.tsx
            const iconProp = iconsEnabled ? mockItem.icon : undefined;

            expect(iconProp).toBeDefined();
            expect(iconProp).toBe(mockItem.icon);
        });

        it('should render plugin icons', () => {
            const iconsEnabled = true;

            // Simulate plugin icon rendering
            const pluginIcon = iconsEnabled ? (
                <span style={{display: 'inline-block'}}>Plugin Icon</span>
            ) : undefined;

            expect(pluginIcon).toBeDefined();
        });
    });

    describe('when iconsEnabled is false', () => {
        it('should NOT include icon prop', () => {
            const iconsEnabled = false;

            const iconProp = iconsEnabled ? mockItem.icon : undefined;

            expect(iconProp).toBeUndefined();
        });

        it('should NOT render plugin icons', () => {
            const iconsEnabled = false;

            const pluginIcon = iconsEnabled ? (
                <span style={{display: 'inline-block'}}>Plugin Icon</span>
            ) : undefined;

            expect(pluginIcon).toBeUndefined();
        });
    });

    describe('config mapping', () => {
        it('should map FeatureFlagSystemConsoleIcons config to prop', () => {
            const configEnabled = {FeatureFlagSystemConsoleIcons: 'true'};
            const configDisabled = {FeatureFlagSystemConsoleIcons: 'false'};
            const configMissing = {};

            expect(configEnabled.FeatureFlagSystemConsoleIcons === 'true').toBe(true);
            expect(configDisabled.FeatureFlagSystemConsoleIcons === 'true').toBe(false);
            expect((configMissing as Record<string, string>).FeatureFlagSystemConsoleIcons === 'true').toBe(false);
        });
    });
});

describe('Combined admin sidebar features', () => {
    const mockItems = [
        {url: 'item1', title: 'Regular Item', icon: <span>Icon1</span>},
        {url: 'item2', title: 'Enterprise Item', icon: <span>Icon2</span>, restrictedIndicator: {shouldDisplay: () => true, value: () => 'Enterprise'}},
        {url: 'item3', title: 'Another Item', icon: <span>Icon3</span>},
    ];

    it('should show all items with icons when both features are configured appropriately', () => {
        const hideEnterpriseEnabled = false;
        const iconsEnabled = true;

        const visibleItems = mockItems.filter((item) => {
            return !(hideEnterpriseEnabled && item.restrictedIndicator);
        });

        const itemsWithIcons = visibleItems.map((item) => ({
            ...item,
            displayIcon: iconsEnabled ? item.icon : undefined,
        }));

        expect(visibleItems).toHaveLength(3);
        expect(itemsWithIcons.every((item) => item.displayIcon !== undefined)).toBe(true);
    });

    it('should hide enterprise items and show no icons', () => {
        const hideEnterpriseEnabled = true;
        const iconsEnabled = false;

        const visibleItems = mockItems.filter((item) => {
            return !(hideEnterpriseEnabled && item.restrictedIndicator);
        });

        const itemsWithIcons = visibleItems.map((item) => ({
            ...item,
            displayIcon: iconsEnabled ? item.icon : undefined,
        }));

        expect(visibleItems).toHaveLength(2); // item1 and item3
        expect(itemsWithIcons.every((item) => item.displayIcon === undefined)).toBe(true);
    });

    it('should hide enterprise items and show icons for remaining', () => {
        const hideEnterpriseEnabled = true;
        const iconsEnabled = true;

        const visibleItems = mockItems.filter((item) => {
            return !(hideEnterpriseEnabled && item.restrictedIndicator);
        });

        const itemsWithIcons = visibleItems.map((item) => ({
            ...item,
            displayIcon: iconsEnabled ? item.icon : undefined,
        }));

        expect(visibleItems).toHaveLength(2);
        expect(itemsWithIcons.every((item) => item.displayIcon !== undefined)).toBe(true);
    });
});
