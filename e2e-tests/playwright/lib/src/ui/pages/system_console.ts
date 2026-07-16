// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import SystemConsoleNavbar from '@/ui/components/system_console/navbar';
import SystemConsoleSidebar from '@/ui/components/system_console/sidebar';
import SystemConsoleHeader from '@/ui/components/system_console/header';
import EditionAndLicense from '@/ui/components/system_console/sections/about/edition_and_license';
import TeamStatistics from '@/ui/components/system_console/sections/reporting/team_statistics';
import Users from '@/ui/components/system_console/sections/user_management/users';
import DelegatedGranularAdministration from '@/ui/components/system_console/sections/user_management/delegated_granular_administration';
import PermissionsSystemScheme from '@/ui/components/system_console/sections/user_management/permissions_system_scheme';
import MobileSecurity from '@/ui/components/system_console/sections/environment/mobile_security';
import Localization from '@/ui/components/system_console/sections/site_configuration/localization';
import Notifications from '@/ui/components/system_console/sections/site_configuration/notifications';
import UsersAndTeams from '@/ui/components/system_console/sections/site_configuration/users_and_teams';
import BoardAttributes from '@/ui/components/system_console/sections/system_attributes/board_attributes';
import SystemProperties from '@/ui/components/system_console/sections/system_attributes/system_properties';
import SessionAttributes from '@/ui/components/system_console/sections/system_attributes/session_attributes';
import FeatureDiscovery from '@/ui/components/system_console/sections/system_users/feature_discovery';
import PluginManagement from '@/ui/components/system_console/sections/plugins/plugin_management';

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
    readonly permissionsSystemScheme: PermissionsSystemScheme;

    // Environment
    readonly mobileSecurity: MobileSecurity;

    // Site Configuration
    readonly localization: Localization;
    readonly notifications: Notifications;
    readonly usersAndTeams: UsersAndTeams;

    // System Attributes
    readonly systemProperties: SystemProperties;
    readonly sessionAttributes: SessionAttributes;
    readonly boardAttributes: BoardAttributes;

    // Feature Discovery (license-gated features)
    readonly featureDiscovery: FeatureDiscovery;

    // Plugins
    readonly pluginManagement: PluginManagement;

    constructor(page: Page) {
        this.page = page;

        // Layout
        this.navbar = new SystemConsoleNavbar(page.getByTestId('backstage-navbar'));
        this.sidebar = new SystemConsoleSidebar(page.getByTestId('admin-sidebar'));

        const adminConsoleWrapper = page.locator('#adminConsoleWrapper');
        this.header = new SystemConsoleHeader(adminConsoleWrapper);

        // About
        this.editionAndLicense = new EditionAndLicense(adminConsoleWrapper);

        // Reporting
        this.teamStatistics = new TeamStatistics(adminConsoleWrapper);

        // User Management
        this.users = new Users(adminConsoleWrapper);
        this.delegatedGranularAdministration = new DelegatedGranularAdministration(adminConsoleWrapper);
        this.permissionsSystemScheme = new PermissionsSystemScheme(adminConsoleWrapper);

        // Environment
        this.mobileSecurity = new MobileSecurity(adminConsoleWrapper);

        // Site Configuration
        this.localization = new Localization(adminConsoleWrapper);
        this.notifications = new Notifications(adminConsoleWrapper);
        this.usersAndTeams = new UsersAndTeams(adminConsoleWrapper);

        // System Attributes
        this.systemProperties = new SystemProperties(adminConsoleWrapper);
        this.sessionAttributes = new SessionAttributes(adminConsoleWrapper);
        this.boardAttributes = new BoardAttributes(adminConsoleWrapper);

        // Feature Discovery
        this.featureDiscovery = new FeatureDiscovery(adminConsoleWrapper);

        // Plugins
        this.pluginManagement = new PluginManagement(adminConsoleWrapper);
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await this.navbar.toBeVisible();
        await this.sidebar.toBeVisible();
    }

    async goto() {
        await this.page.goto('/admin_console');
    }

    /** Notifications settings URL is environment/notifications (sidebar groups under Site Configuration). */
    async gotoNotificationsSettings() {
        await this.page.goto('/admin_console/environment/notifications');
        await this.page.waitForLoadState('networkidle');
    }

    async gotoPluginManagement() {
        await this.page.goto('/admin_console/plugins/plugin_management');
        await this.page.waitForLoadState('networkidle');
    }
}
