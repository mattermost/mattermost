// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Locator, expect} from '@playwright/test';

import SystemConsoleSidebarHeader from './sidebar_header';

export default class SystemConsoleSidebar {
    readonly container: Locator;
    readonly header: SystemConsoleSidebarHeader;
    readonly searchInput: Locator;

    readonly about: AboutCategory;
    readonly reporting: ReportingCategory;
    readonly userManagement: UserManagementCategory;
    readonly systemAttributes: SystemAttributesCategory;
    readonly environment: EnvironmentCategory;
    readonly siteConfiguration: SiteConfigurationCategory;
    readonly authentication: AuthenticationCategory;
    readonly plugins: PluginsCategory;
    readonly integrations: IntegrationsCategory;
    readonly compliance: ComplianceCategory;
    readonly experimental: ExperimentalCategory;

    constructor(container: Locator) {
        this.container = container;
        this.header = new SystemConsoleSidebarHeader(container.locator('.AdminSidebarHeader'));
        this.searchInput = container.getByPlaceholder('Find settings');

        this.about = new AboutCategory(container.getByTestId('about'));
        this.reporting = new ReportingCategory(container.getByTestId('reporting'));
        this.userManagement = new UserManagementCategory(container.getByTestId('user_management'));
        this.systemAttributes = new SystemAttributesCategory(container.getByTestId('system_attributes'));
        this.environment = new EnvironmentCategory(container.getByTestId('environment'));
        this.siteConfiguration = new SiteConfigurationCategory(container.getByTestId('site'));
        this.authentication = new AuthenticationCategory(container.getByTestId('authentication'));
        this.plugins = new PluginsCategory(container.getByTestId('plugins'));
        this.integrations = new IntegrationsCategory(container.getByTestId('integrations'));
        this.compliance = new ComplianceCategory(container.getByTestId('compliance'));
        this.experimental = new ExperimentalCategory(container.getByTestId('experimental'));
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
        await this.header.toBeVisible();
        await expect(this.searchInput).toBeVisible();
    }

    async search(text: string) {
        await this.searchInput.fill(text);
    }

    async clearSearch() {
        await this.searchInput.clear();
    }

    // Convenience shortcuts
    get editionAndLicense() {
        return this.about.editionAndLicense;
    }
    get users() {
        return this.userManagement.users;
    }
    get groups() {
        return this.userManagement.groups;
    }
    get teams() {
        return this.userManagement.teams;
    }
    get channels() {
        return this.userManagement.channels;
    }
    get permissions() {
        return this.userManagement.permissions;
    }
    get delegatedGranularAdministration() {
        return this.userManagement.delegatedGranularAdministration;
    }
    get mobileSecurity() {
        return this.environment.mobileSecurity;
    }
    get notifications() {
        return this.siteConfiguration.notifications;
    }
    get pluginManagement() {
        return this.plugins.pluginManagement;
    }
}

class SidebarSection {
    readonly container: Locator;
    readonly link: Locator;

    constructor(container: Locator, link: Locator) {
        this.container = container;
        this.link = link;
    }

    async click() {
        await this.link.click();
    }

    async isActive(): Promise<boolean> {
        const classAttr = await this.link.getAttribute('class');
        return classAttr?.includes('sidebar-section-title--active') ?? false;
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

class SidebarCategory {
    readonly container: Locator;
    readonly title: Locator;
    readonly sections: Locator;

    constructor(container: Locator) {
        this.container = container;
        this.title = container.locator('.category-title');
        this.sections = container.locator('ul.sections');
    }

    protected section(name: string): SidebarSection {
        const link = this.sections.getByRole('link', {name, exact: true});
        return new SidebarSection(this.sections, link);
    }

    async toBeVisible() {
        await expect(this.container).toBeVisible();
    }
}

class AboutCategory extends SidebarCategory {
    readonly editionAndLicense: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.editionAndLicense = this.section('Edition and License');
    }
}

class ReportingCategory extends SidebarCategory {
    readonly workspaceOptimization: SidebarSection;
    readonly siteStatistics: SidebarSection;
    readonly teamStatistics: SidebarSection;
    readonly serverLogs: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.workspaceOptimization = this.section('Workspace Optimization');
        this.siteStatistics = this.section('Site Statistics');
        this.teamStatistics = this.section('Team Statistics');
        this.serverLogs = this.section('Server Logs');
    }
}

class UserManagementCategory extends SidebarCategory {
    readonly users: SidebarSection;
    readonly groups: SidebarSection;
    readonly teams: SidebarSection;
    readonly channels: SidebarSection;
    readonly permissions: SidebarSection;
    readonly delegatedGranularAdministration: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.users = this.section('Users');
        this.groups = this.section('Groups');
        this.teams = this.section('Teams');
        this.channels = this.section('Channels');
        this.permissions = this.section('Permissions');
        this.delegatedGranularAdministration = this.section('Delegated Granular Administration');
    }
}

class SystemAttributesCategory extends SidebarCategory {
    readonly userAttributes: SidebarSection;
    readonly attributeBasedAccess: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.userAttributes = this.section('User Attributes');
        this.attributeBasedAccess = this.section('Attribute-Based Access');
    }
}

class EnvironmentCategory extends SidebarCategory {
    readonly webServer: SidebarSection;
    readonly database: SidebarSection;
    readonly elasticsearch: SidebarSection;
    readonly fileStorage: SidebarSection;
    readonly imageProxy: SidebarSection;
    readonly smtp: SidebarSection;
    readonly pushNotificationServer: SidebarSection;
    readonly highAvailability: SidebarSection;
    readonly cacheSettings: SidebarSection;
    readonly rateLimiting: SidebarSection;
    readonly logging: SidebarSection;
    readonly sessionLengths: SidebarSection;
    readonly performanceMonitoring: SidebarSection;
    readonly developer: SidebarSection;
    readonly mobileSecurity: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.webServer = this.section('Web Server');
        this.database = this.section('Database');
        this.elasticsearch = this.section('Elasticsearch');
        this.fileStorage = this.section('File Storage');
        this.imageProxy = this.section('Image Proxy');
        this.smtp = this.section('SMTP');
        this.pushNotificationServer = this.section('Push Notification Server');
        this.highAvailability = this.section('High Availability');
        this.cacheSettings = this.section('Cache Settings');
        this.rateLimiting = this.section('Rate Limiting');
        this.logging = this.section('Logging');
        this.sessionLengths = this.section('Session Lengths');
        this.performanceMonitoring = this.section('Performance Monitoring');
        this.developer = this.section('Developer');
        this.mobileSecurity = this.section('Mobile Security');
    }
}

class SiteConfigurationCategory extends SidebarCategory {
    readonly customization: SidebarSection;
    readonly localization: SidebarSection;
    readonly usersAndTeams: SidebarSection;
    readonly notifications: SidebarSection;
    readonly systemWideNotifications: SidebarSection;
    readonly emoji: SidebarSection;
    readonly posts: SidebarSection;
    readonly contentFlagging: SidebarSection;
    readonly moveThread: SidebarSection;
    readonly fileSharingAndDownloads: SidebarSection;
    readonly publicLinks: SidebarSection;
    readonly notices: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.customization = this.section('Customization');
        this.localization = this.section('Localization');
        this.usersAndTeams = this.section('Users and Teams');
        this.notifications = this.section('Notifications');
        this.systemWideNotifications = this.section('System-wide Notifications');
        this.emoji = this.section('Emoji');
        this.posts = this.section('Posts');
        this.contentFlagging = this.section('Content Flagging');
        this.moveThread = this.section('Move Thread (Beta)');
        this.fileSharingAndDownloads = this.section('File Sharing and Downloads');
        this.publicLinks = this.section('Public Links');
        this.notices = this.section('Notices');
    }
}

class AuthenticationCategory extends SidebarCategory {
    readonly signup: SidebarSection;
    readonly email: SidebarSection;
    readonly password: SidebarSection;
    readonly mfa: SidebarSection;
    readonly adLdap: SidebarSection;
    readonly saml: SidebarSection;
    readonly openIdConnect: SidebarSection;
    readonly guestAccess: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.signup = this.section('Signup');
        this.email = this.section('Email');
        this.password = this.section('Password');
        this.mfa = this.section('MFA');
        this.adLdap = this.section('AD/LDAP');
        this.saml = this.section('SAML 2.0');
        this.openIdConnect = this.section('OpenID Connect');
        this.guestAccess = this.section('Guest Access');
    }
}

class PluginsCategory extends SidebarCategory {
    readonly pluginManagement: SidebarSection;
    readonly agents: SidebarSection;
    readonly calls: SidebarSection;
    readonly playbooks: SidebarSection;
    readonly boards: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.pluginManagement = this.section('Plugin Management');
        this.agents = this.section('Agents');
        this.calls = this.section('Calls');
        this.playbooks = this.section('Playbooks');
        this.boards = this.section('Mattermost Boards');
    }

    getPlugin(pluginName: string): SidebarSection {
        const link = this.sections.getByRole('link', {name: pluginName, exact: true});
        return new SidebarSection(this.sections, link);
    }
}

class IntegrationsCategory extends SidebarCategory {
    readonly integrationManagement: SidebarSection;
    readonly botAccounts: SidebarSection;
    readonly gif: SidebarSection;
    readonly cors: SidebarSection;
    readonly embedding: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.integrationManagement = this.section('Integration Management');
        this.botAccounts = this.section('Bot Accounts');
        this.gif = this.section('GIF');
        this.cors = this.section('CORS');
        this.embedding = this.section('Embedding');
    }
}

class ComplianceCategory extends SidebarCategory {
    readonly dataRetentionPolicies: SidebarSection;
    readonly complianceExport: SidebarSection;
    readonly complianceMonitoring: SidebarSection;
    readonly auditLogging: SidebarSection;
    readonly customTermsOfService: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.dataRetentionPolicies = this.section('Data Retention Policies');
        this.complianceExport = this.section('Compliance Export');
        this.complianceMonitoring = this.section('Compliance Monitoring');
        this.auditLogging = this.section('Audit Logging');
        this.customTermsOfService = this.section('Custom Terms of Service');
    }
}

class ExperimentalCategory extends SidebarCategory {
    readonly features: SidebarSection;
    readonly featureFlags: SidebarSection;

    constructor(container: Locator) {
        super(container);
        this.features = this.section('Features');
        this.featureFlags = this.section('Feature Flags');
    }
}
