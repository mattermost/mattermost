
const RESOURCE_KEYS = {
    ABOUT: {
        EDITION_AND_LICENSE: 'about.edition_and_license',
    },
    REPORTING: {
        SITE_STATISTICS: 'reporting.site_statistics',
        TEAM_STATISTICS: 'reporting.team_statistics',
        SERVER_LOGS: 'reporting.server_logs',
    },
    USER_MANAGEMENT: {
        USERS: 'user_management.users',
        GROUPS: 'user_management.groups',
        TEAMS: 'user_management.teams',
        CHANNELS: 'user_management.channels',
        PERMISSIONS: 'user_management.permissions',
        SYSTEM_ROLES: 'user_management.system_roles',
    },
    SYSTEM_ATTRIBUTES: {
        USER_ATTRIBUTES: 'system_attributes.user_attributes',
        ATTRIBUTE_BASED_ACCESS_CONTROL: 'system_attributes.attribute_based_access_control',
    },
    AUTHENTICATION: {
        SIGNUP: 'authentication.signup',
        EMAIL: 'authentication.email',
        PASSWORD: 'authentication.password',
        MFA: 'authentication.mfa',
        LDAP: 'authentication.ldap',
        SAML: 'authentication.saml',
        OPENID: 'authentication.openid',
        GUEST_ACCESS: 'authentication.guest_access',
    },
    INTEGRATIONS: {
        INTEGRATION_MANAGEMENT: 'integrations.integration_management',
        BOT_ACCOUNTS: 'integrations.bot_accounts',
        GIF: 'integrations.gif',
        CORS: 'integrations.cors',
    },
    COMPLIANCE: {
        DATA_RETENTION_POLICY: 'compliance.data_retention_policy',
        COMPLIANCE_EXPORT: 'compliance.compliance_export',
        COMPLIANCE_MONITORING: 'compliance.compliance_monitoring',
        CUSTOM_TERMS_OF_SERVICE: 'compliance.custom_terms_of_service',
    },
    PRODUCTS: {
        BOARDS: 'boards',
    },
    SITE: {
        CUSTOMIZATION: 'site.customization',
        LOCALIZATION: 'site.localization',
        USERS_AND_TEAMS: 'site.users_and_teams',
        NOTIFICATIONS: 'site.notifications',
        ANNOUNCEMENT_BANNER: 'site.announcement_banner',
        EMOJI: 'site.emoji',
        POSTS: 'site.posts',
        FILE_SHARING_AND_DOWNLOADS: 'site.file_sharing_and_downloads',
        PUBLIC_LINKS: 'site.public_links',
        NOTICES: 'site.notices',
        IP_FILTERING: 'site.ip_filters',
    },
    EXPERIMENTAL: {
        FEATURES: 'experimental.features',
        FEATURE_FLAGS: 'experimental.feature_flags',
        BLEVE: 'experimental.bleve',
    },
    ENVIRONMENT: {
        WEB_SERVER: 'environment.web_server',
        DATABASE: 'environment.database',
        ELASTICSEARCH: 'environment.elasticsearch',
        FILE_STORAGE: 'environment.file_storage',
        IMAGE_PROXY: 'environment.image_proxy',
        SMTP: 'environment.smtp',
        PUSH_NOTIFICATION_SERVER: 'environment.push_notification_server',
        HIGH_AVAILABILITY: 'environment.high_availability',
        RATE_LIMITING: 'environment.rate_limiting',
        LOGGING: 'environment.logging',
        SESSION_LENGTHS: 'environment.session_lengths',
        PERFORMANCE_MONITORING: 'environment.performance_monitoring',
        DEVELOPER: 'environment.developer',
        MOBILE_SECURITY: 'environment.mobile_security',
    },
    MATTERMOST_EXTENDED: {
        FEATURES: 'mattermost_extended.features',
        POSTS: 'mattermost_extended.posts',
        THREADS: 'mattermost_extended.threads',
        BUG_FIXES: 'mattermost_extended.bug_fixes',
    },
};

const TableKeys = [
    'about.edition_and_license',
    'billing',
    'reporting.site_statistics',
    'reporting.team_statistics',
    'reporting.server_logs',
    'user_management.users',
    'user_management.groups',
    'user_management.teams',
    'user_management.channels',
    'user_management.permissions',
    'user_management.system_roles',
    'site.customization',
    'site.localization',
    'site.users_and_teams',
    'site.notifications',
    'site.announcement_banner',
    'site.emoji',
    'site.posts',
    'site.file_sharing_and_downloads',
    'site.public_links',
    'site.notices',
    'site.ip_filters',
    'environment.web_server',
    'environment.database',
    'environment.elasticsearch',
    'environment.file_storage',
    'environment.image_proxy',
    'environment.smtp',
    'environment.push_notification_server',
    'environment.high_availability',
    'environment.rate_limiting',
    'environment.logging',
    'environment.session_lengths',
    'environment.performance_monitoring',
    'environment.developer',
    'environment.mobile_security',
    'authentication.signup',
    'authentication.email',
    'authentication.password',
    'authentication.mfa',
    'authentication.ldap',
    'authentication.saml',
    'authentication.openid',
    'authentication.guest_access',
    'plugins',
    'integrations.integration_management',
    'boards',
    'integrations.bot_accounts',
    'integrations.gif',
    'integrations.cors',
    'compliance.data_retention_policy',
    'compliance.compliance_export',
    'compliance.compliance_monitoring',
    'compliance.custom_terms_of_service',
    'experimental.features',
    'experimental.feature_flags',
    'experimental.bleve',
    'mattermost_extended.features',
    'mattermost_extended.posts',
    'mattermost_extended.threads',
    'mattermost_extended.bug_fixes'
];

function check(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'object') {
            check(obj[key]);
        } else {
            if (!TableKeys.includes(obj[key])) {
                console.log('MISSING:', obj[key]);
            }
        }
    }
}

check(RESOURCE_KEYS);
