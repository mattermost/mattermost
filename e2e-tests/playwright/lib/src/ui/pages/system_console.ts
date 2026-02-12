// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Page} from '@playwright/test';

import SystemConsoleNavbar from '@/ui/components/system_console/navbar';
import SystemConsoleSidebar from '@/ui/components/system_console/sidebar';
import SystemConsoleHeader from '@/ui/components/system_console/header';
import EditionAndLicense from '@/ui/components/system_console/sections/about/edition_and_license';
import TeamStatistics from '@/ui/components/system_console/sections/reporting/team_statistics';
import Users from '@/ui/components/system_console/sections/user_management/users';
import DelegatedGranularAdministration from '@/ui/components/system_console/sections/user_management/delegated_granular_administration';
import MobileSecurity from '@/ui/components/system_console/sections/environment/mobile_security';
import Notifications from '@/ui/components/system_console/sections/site_configuration/notifications';
import FeatureDiscovery from '@/ui/components/system_console/sections/system_users/feature_discovery';

export default class SystemConsolePage {
    readonly page: Page;

    // Layout
    readonly navbar: SystemConsoleNavbar;
    readonly sidebar: SystemConsoleSidebar;
    readonly header: SystemConsoleHeader;

    // About
    readonly editionAndLicense: EditionAndLicense;

    // Reporting
    readonly teamStatistics: TeamStatistics;

    // User Management
    readonly users: Users;
    readonly delegatedGranularAdministration: DelegatedGranularAdministration;

    // Environment
    readonly mobileSecurity: MobileSecurity;

    // Site Configuration
    readonly notifications: Notifications;

    // Feature Discovery (license-gated features)
    readonly featureDiscovery: FeatureDiscovery;

    constructor(page: Page) {
        this.page = page;

        // Layout
        this.navbar = new SystemConsoleNavbar(page.locator('.backstage-navbar'));
        this.sidebar = new SystemConsoleSidebar(page.locator('.admin-sidebar'));

        const adminConsoleWrapper = page.locator('#adminConsoleWrapper');
        this.header = new SystemConsoleHeader(adminConsoleWrapper);

        // About
        this.editionAndLicense = new EditionAndLicense(adminConsoleWrapper);

        // Reporting
        this.teamStatistics = new TeamStatistics(adminConsoleWrapper);

        // User Management
        this.users = new Users(adminConsoleWrapper);
        this.delegatedGranularAdministration = new DelegatedGranularAdministration(adminConsoleWrapper);

        // Environment
        this.mobileSecurity = new MobileSecurity(adminConsoleWrapper);

        // Site Configuration
        this.notifications = new Notifications(adminConsoleWrapper);

        // Feature Discovery
        this.featureDiscovery = new FeatureDiscovery(adminConsoleWrapper);
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await this.navbar.toBeVisible();
        await this.sidebar.toBeVisible();
    }

    async goto() {
        await this.page.goto('/admin_console');
    }
}
