// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages, type MessageDescriptor} from 'react-intl';

export const sectionStrings: Record<string, Record<string, MessageDescriptor>> = {
    about: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_about.name',
            defaultMessage: 'About',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_about.description',
            defaultMessage: 'The ability to install or upgrade your servers enterprise licensing.',
        },
    }),
    about_edition_and_license: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_about_edition_and_license.name',
            defaultMessage: 'Edition and License',
        },
    }),
    billing: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_billing.name',
            defaultMessage: 'Billing',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_billing.description',
            defaultMessage: 'Access subscription details, billing history, company information and payment information.',
        },
    }),
    reporting: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_reporting.name',
            defaultMessage: 'Reporting',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_reporting.description',
            defaultMessage: 'Review site statistics, team statistics and server logs.',
        },
    }),
    reporting_site_statistics: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_reporting_site_statistics.name',
            defaultMessage: 'Site Statistics',
        },
    }),
    reporting_team_statistics: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_reporting_team_statistics.name',
            defaultMessage: 'Team Statistics',
        },
    }),
    reporting_server_logs: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_reporting_server_logs.name',
            defaultMessage: 'Server Logs',
        },
    }),
    user_management: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_user_management.name',
            defaultMessage: 'User Management',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_user_management.description',
            defaultMessage: 'Review users, groups, teams, channels, permissions and system roles.',
        },
    }),
    user_management_users: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_user_management_users.name',
            defaultMessage: 'Users',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_user_management_users.description',
            defaultMessage: 'Cannot reset admin passwords',
        },
    }),
    user_management_groups: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_user_management_groups.name',
            defaultMessage: 'Groups',
        },
    }),
    user_management_teams: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_user_management_teams.name',
            defaultMessage: 'Teams',
        },
    }),
    user_management_channels: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_user_management_channels.name',
            defaultMessage: 'Channels',
        },
    }),
    user_management_permissions: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_user_management_permissions.name',
            defaultMessage: 'Permissions',
        },
    }),
    user_management_system_roles: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_user_management_system_roles.name',
            defaultMessage: 'Delegated Granular Administration',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_user_management_system_roles.description',
            defaultMessage: 'Restricts the System Console interface only. The underlying API endpoints are accessible to all users in a read-only state for basic product functionality.',
        },
    }),
    environment: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment.name',
            defaultMessage: 'Environment',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_environment.description',
            defaultMessage: 'Review server environment configuration such as URLs, database and performance.',
        },
    }),
    environment_web_server: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_web_server.name',
            defaultMessage: 'Web Server',
        },
    }),
    environment_database: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_database.name',
            defaultMessage: 'Database',
        },
    }),
    environment_elasticsearch: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_elasticsearch.name',
            defaultMessage: 'Elasticsearch',
        },
    }),
    environment_file_storage: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_file_storage.name',
            defaultMessage: 'File Storage',
        },
    }),
    environment_image_proxy: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_image_proxy.name',
            defaultMessage: 'Image Proxy',
        },
    }),
    environment_smtp: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_smtp.name',
            defaultMessage: 'SMTP',
        },
    }),
    environment_push_notification_server: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_push_notification_server.name',
            defaultMessage: 'Push Notification Server',
        },
    }),
    environment_high_availability: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_high_availability.name',
            defaultMessage: 'High Availability',
        },
    }),
    environment_rate_limiting: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_rate_limiting.name',
            defaultMessage: 'Rate Limiting',
        },
    }),
    environment_logging: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_logging.name',
            defaultMessage: 'Logging',
        },
    }),
    environment_session_lengths: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_session_lengths.name',
            defaultMessage: 'Session Lengths',
        },
    }),
    environment_performance_monitoring: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_performance_monitoring.name',
            defaultMessage: 'Performance Monitoring',
        },
    }),
    environment_developer: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_environment_developer.name',
            defaultMessage: 'Developer',
        },
    }),
    site: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site.name',
            defaultMessage: 'Site Configuration',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_site.description',
            defaultMessage: 'Review site specific configurations such as site name, notification defaults and file sharing.',
        },
    }),
    site_customization: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_customization.name',
            defaultMessage: 'Customization',
        },
    }),
    site_localization: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_localization.name',
            defaultMessage: 'Localization',
        },
    }),
    site_users_and_teams: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_users_and_teams.name',
            defaultMessage: 'Users and Teams',
        },
    }),
    site_notifications: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_notifications.name',
            defaultMessage: 'Notifications',
        },
    }),
    site_announcement_banner: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_announcement_banner.name',
            defaultMessage: 'Announcement Banner',
        },
    }),
    site_emoji: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_emoji.name',
            defaultMessage: 'Emoji',
        },
    }),
    site_posts: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_posts.name',
            defaultMessage: 'Posts',
        },
    }),
    site_file_sharing_and_downloads: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_file_sharing_and_downloads.name',
            defaultMessage: 'File Sharing and Downloads',
        },
    }),
    site_public_links: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_public_links.name',
            defaultMessage: 'Public Links',
        },
    }),
    site_notices: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_site_notices.name',
            defaultMessage: 'Notices',
        },
    }),
    authentication: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication.name',
            defaultMessage: 'Authentication',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_authentication.description',
            defaultMessage: 'Review the configuration around how users can signup and access Mattermost.',
        },
    }),
    authentication_signup: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_signup.name',
            defaultMessage: 'Signup',
        },
    }),
    authentication_email: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_email.name',
            defaultMessage: 'Email',
        },
    }),
    authentication_password: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_password.name',
            defaultMessage: 'Password',
        },
    }),
    authentication_mfa: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_mfa.name',
            defaultMessage: 'MFA',
        },
    }),
    authentication_ldap: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_ldap.name',
            defaultMessage: 'AD/LDAP',
        },
    }),
    authentication_saml: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_saml.name',
            defaultMessage: 'SAML 2.0',
        },
    }),
    authentication_openid: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_openid.name',
            defaultMessage: 'OpenID Connect',
        },
    }),
    authentication_guest_access: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_authentication_guest_access.name',
            defaultMessage: 'Guest Access',
        },
    }),
    plugins: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_plugins.name',
            defaultMessage: 'Plugins',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_plugins.description',
            defaultMessage: 'Review installed plugins and their configuration.',
        },
    }),
    integrations: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_integrations.name',
            defaultMessage: 'Integrations',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_integrations.description',
            defaultMessage: 'Review integration configurations such as webhooks, bots and cross-origin requests.',
        },
    }),
    integrations_integration_management: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_integrations_integration_management.name',
            defaultMessage: 'Integration Management',
        },
    }),
    integrations_bot_accounts: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_integrations_bot_accounts.name',
            defaultMessage: 'Bot Accounts',
        },
    }),
    integrations_gif: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_integrations_gif.name',
            defaultMessage: 'GIF',
        },
    }),
    integrations_cors: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_integrations_cors.name',
            defaultMessage: 'CORS',
        },
    }),
    compliance: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_compliance.name',
            defaultMessage: 'Compliance',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_compliance.description',
            defaultMessage: 'Review compliance settings such as retention, exports and activity logs.',
        },
    }),
    compliance_data_retention_policy: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_compliance_data_retention_policy.name',
            defaultMessage: 'Data Retention Policy',
        },
    }),
    compliance_compliance_export: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_compliance_compliance_export.name',
            defaultMessage: 'Compliance Export',
        },
    }),
    compliance_compliance_monitoring: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_compliance_compliance_monitoring.name',
            defaultMessage: 'Compliance Monitoring',
        },
    }),
    compliance_custom_terms_of_service: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_compliance_custom_terms_of_service.name',
            defaultMessage: 'Custom Terms of Service',
        },
    }),
    experimental: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_experimental.name',
            defaultMessage: 'Experimental',
        },
        description: {
            id: 'admin.permissions.sysconsole_section_experimental.description',
            defaultMessage: 'Review the settings of experimental features',
        },
    }),
    experimental_features: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_experimental_features.name',
            defaultMessage: 'Features',
        },
    }),
    experimental_feature_flags: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_experimental_feature_flags.name',
            defaultMessage: 'Feature Flags',
        },
    }),
    experimental_bleve: defineMessages({
        name: {
            id: 'admin.permissions.sysconsole_section_experimental_bleve.name',
            defaultMessage: 'Bleve',
        },
    }),
};
