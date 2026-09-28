// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';

import LoginPage from './login';

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
import GlobalAttributes from '@/ui/components/system_console/sections/system_attributes/global_attributes';
import SystemProperties from '@/ui/components/system_console/sections/system_attributes/system_properties';
import SessionAttributes from '@/ui/components/system_console/sections/system_attributes/session_attributes';
import FeatureDiscovery from '@/ui/components/system_console/sections/system_users/feature_discovery';
import PluginManagement from '@/ui/components/system_console/sections/plugins/plugin_management';
import OpenIdConnect from '@/ui/components/system_console/sections/authentication/openid_connect';
import AdLdap from '@/ui/components/system_console/sections/authentication/ad_ldap';
import PasswordSettings from '@/ui/components/system_console/sections/authentication/password';
import PublicLinks from '@/ui/components/system_console/sections/site_configuration/public_links';
import {testConfig} from '@/test_config';

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
    readonly globalAttributes: GlobalAttributes;
    readonly systemProperties: SystemProperties;
    readonly sessionAttributes: SessionAttributes;
    readonly boardAttributes: BoardAttributes;

    // Feature Discovery (license-gated features)
    readonly featureDiscovery: FeatureDiscovery;

    // Plugins
    readonly pluginManagement: PluginManagement;

    // Authentication
    readonly openIdConnect: OpenIdConnect;
    readonly adLdap: AdLdap;
    readonly passwordSettings: PasswordSettings;
    readonly publicLinks: PublicLinks;

    // Same page after logging out of the System Console
    readonly loginPage: LoginPage;

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
        this.globalAttributes = new GlobalAttributes(adminConsoleWrapper);
        this.systemProperties = new SystemProperties(adminConsoleWrapper);
        this.sessionAttributes = new SessionAttributes(adminConsoleWrapper);
        this.boardAttributes = new BoardAttributes(adminConsoleWrapper);

        // Feature Discovery
        this.featureDiscovery = new FeatureDiscovery(adminConsoleWrapper);

        // Plugins
        this.pluginManagement = new PluginManagement(adminConsoleWrapper);

        // Authentication
        this.openIdConnect = new OpenIdConnect(adminConsoleWrapper);
        this.adLdap = new AdLdap(adminConsoleWrapper);
        this.passwordSettings = new PasswordSettings(adminConsoleWrapper);
        this.publicLinks = new PublicLinks(adminConsoleWrapper);

        this.loginPage = new LoginPage(page);
    }

    async toBeVisible() {
        await this.page.waitForLoadState('networkidle');
        await this.navbar.toBeVisible();
        await this.sidebar.toBeVisible();
    }

    async goto() {
        await this.page.goto(new URL('/admin_console', testConfig.baseURL).href);
    }

    /** Notifications settings URL is environment/notifications (sidebar groups under Site Configuration). */
    async gotoNotificationsSettings() {
        await this.page.goto(new URL('/admin_console/environment/notifications', testConfig.baseURL).href);
    }

    async gotoPluginManagement() {
        await this.page.goto(new URL('/admin_console/plugins/plugin_management', testConfig.baseURL).href);
        await this.pluginManagement.toBeVisible();
    }

    async gotoEditionAndLicense() {
        await this.page.goto(new URL('/admin_console/about/license', testConfig.baseURL).href);
        await this.editionAndLicense.toBeVisible();
    }

    async gotoOpenIdConnect() {
        await this.page.goto(new URL('/admin_console/authentication/openid', testConfig.baseURL).href);
        await this.openIdConnect.toBeVisible();
    }

    async gotoUser(userId: string) {
        await this.page.goto(new URL(`/admin_console/user_management/user/${userId}`, testConfig.baseURL).href);
        await this.users.userDetail.toBeVisible();
    }

    async gotoAdLdap() {
        await this.page.goto(new URL('/admin_console/authentication/ldap', testConfig.baseURL).href);
        await this.adLdap.toBeVisible();
    }

    async gotoPasswordSettings() {
        await this.page.goto(new URL('/admin_console/authentication/password', testConfig.baseURL).href);
        await this.passwordSettings.toBeVisible();
    }

    async gotoPublicLinks() {
        await this.page.goto(new URL('/admin_console/site_config/public_links', testConfig.baseURL).href);
        await this.publicLinks.toBeVisible();
    }

    async logOut() {
        await this.sidebar.header.logOut();
        await this.loginPage.toBeVisible();
    }
}
