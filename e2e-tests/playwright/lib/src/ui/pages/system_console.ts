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
import ClassificationMarkings from '@/ui/components/system_console/sections/site_configuration/classification_markings';
import Localization from '@/ui/components/system_console/sections/site_configuration/localization';
import Notifications from '@/ui/components/system_console/sections/site_configuration/notifications';
import UsersAndTeams from '@/ui/components/system_console/sections/site_configuration/users_and_teams';
import SelfDeletingMessages from '@/ui/components/system_console/sections/self_deleting_messages';
import AttributeBasedAccessControl from '@/ui/components/system_console/sections/system_attributes/attribute_based_access_control';
import SystemProperties from '@/ui/components/system_console/sections/system_attributes/system_properties';
import PolicyEditor from '@/ui/components/system_console/sections/access_control/policy_editor';
import PolicyList from '@/ui/components/system_console/sections/access_control/policy_list';
import FeatureDiscovery from '@/ui/components/system_console/sections/system_users/feature_discovery';

import type {BaseComponent} from '../base_component';
import {BasePage} from '../base_page';

export default class SystemConsolePage extends BasePage {
    readonly components: Record<string, BaseComponent>;

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
    readonly classificationMarkings: ClassificationMarkings;
    readonly localization: Localization;
    readonly notifications: Notifications;
    readonly usersAndTeams: UsersAndTeams;
    readonly selfDeletingMessages: SelfDeletingMessages;

    // System Attributes
    readonly attributeBasedAccessControl: AttributeBasedAccessControl;
    readonly systemProperties: SystemProperties;

    // Access Control
    readonly policyList: PolicyList;
    readonly policyEditor: PolicyEditor;

    // Feature Discovery (license-gated features)
    readonly featureDiscovery: FeatureDiscovery;

    constructor(page: Page) {
        super(page);

        // Layout
        this.navbar = new SystemConsoleNavbar(page.getByTestId('backstageNavbar'));
        this.sidebar = new SystemConsoleSidebar(page.getByTestId('adminSidebar'));

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
        this.classificationMarkings = new ClassificationMarkings(adminConsoleWrapper);
        this.localization = new Localization(adminConsoleWrapper);
        this.notifications = new Notifications(adminConsoleWrapper);
        this.usersAndTeams = new UsersAndTeams(adminConsoleWrapper);
        this.selfDeletingMessages = new SelfDeletingMessages(
            adminConsoleWrapper.getByTestId('sysconsole_section_PostSettings'),
            page,
        );

        // System Attributes
        this.attributeBasedAccessControl = new AttributeBasedAccessControl(adminConsoleWrapper);
        this.systemProperties = new SystemProperties(adminConsoleWrapper);

        // Access Control
        this.policyList = new PolicyList(adminConsoleWrapper);
        this.policyEditor = new PolicyEditor(adminConsoleWrapper);

        // Feature Discovery
        this.featureDiscovery = new FeatureDiscovery(adminConsoleWrapper);

        this.components = {
            navbar: this.navbar,
            sidebar: this.sidebar,
            header: this.header,
            editionAndLicense: this.editionAndLicense,
            teamStatistics: this.teamStatistics,
            users: this.users,
            delegatedGranularAdministration: this.delegatedGranularAdministration,
            permissionsSystemScheme: this.permissionsSystemScheme,
            mobileSecurity: this.mobileSecurity,
            classificationMarkings: this.classificationMarkings,
            localization: this.localization,
            notifications: this.notifications,
            usersAndTeams: this.usersAndTeams,
            selfDeletingMessages: this.selfDeletingMessages,
            attributeBasedAccessControl: this.attributeBasedAccessControl,
            systemProperties: this.systemProperties,
            policyList: this.policyList,
            policyEditor: this.policyEditor,
            featureDiscovery: this.featureDiscovery,
        };
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
}
