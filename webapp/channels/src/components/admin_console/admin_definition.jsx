// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AccountMultipleOutlineIcon, ChartBarIcon, CogOutlineIcon, CreditCardOutlineIcon, FlaskOutlineIcon, FormatListBulletedIcon, InformationOutlineIcon, PowerPlugOutlineIcon, ServerVariantIcon, ShieldOutlineIcon, SitemapIcon} from '@mattermost/compass-icons/components';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {Constants, CloudProducts, LicenseSkus} from 'utils/constants';
import {isCloudFreePlan} from 'utils/cloud_utils';
import {isCloudLicense} from 'utils/license_utils';
import {getSiteURL} from 'utils/url';
import {t} from 'utils/i18n';
import {
    ldapTest, invalidateAllCaches, reloadConfig, testS3Connection,
    removeIdpSamlCertificate, uploadIdpSamlCertificate,
    removePrivateSamlCertificate, uploadPrivateSamlCertificate,
    removePublicSamlCertificate, uploadPublicSamlCertificate,
    removePrivateLdapCertificate, uploadPrivateLdapCertificate,
    removePublicLdapCertificate, uploadPublicLdapCertificate,
    invalidateAllEmailInvites, testSmtp, testSiteURL, getSamlMetadataFromIdp, setSamlIdpCertificateFromMetadata,
} from 'actions/admin_actions';
import SystemAnalytics from 'components/analytics/system_analytics';
import TeamAnalytics from 'components/analytics/team_analytics';
import PluginManagement from 'components/admin_console/plugin_management';
import CustomPluginSettings from 'components/admin_console/custom_plugin_settings';
import RestrictedIndicator from 'components/widgets/menu/menu_items/restricted_indicator';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import ExternalLink from 'components/external_link';

import OpenIdConvert from './openid_convert';
import Audits from './audits';
import CustomURLSchemesSetting from './custom_url_schemes_setting.jsx';
import CustomEnableDisableGuestAccountsSetting from './custom_enable_disable_guest_accounts_setting';
import LicenseSettings from './license_settings';
import PermissionSchemesSettings from './permission_schemes_settings';
import PermissionSystemSchemeSettings from './permission_schemes_settings/permission_system_scheme_settings';
import PermissionTeamSchemeSettings from './permission_schemes_settings/permission_team_scheme_settings';
import ValidationResult from './validation';
import SystemRoles from './system_roles';
import SystemRole from './system_roles/system_role';
import SystemUsers from './system_users';
import SystemUserDetail from './system_user_detail';
import ServerLogs from './server_logs';
import BrandImageSetting from './brand_image_setting/brand_image_setting';
import GroupSettings from './group_settings/group_settings';
import GroupDetails from './group_settings/group_details';
import TeamSettings from './team_channel_settings/team';
import TeamDetails from './team_channel_settings/team/details';
import ChannelSettings from './team_channel_settings/channel';
import ChannelDetails from './team_channel_settings/channel/details';
import PasswordSettings from './password_settings.jsx';
import PushNotificationsSettings from './push_settings.jsx';
import DataRetentionSettings from './data_retention_settings';
import GlobalDataRetentionForm from './data_retention_settings/global_policy_form';
import CustomDataRetentionForm from './data_retention_settings/custom_policy_form';
import MessageExportSettings from './message_export_settings.jsx';
import DatabaseSettings from './database_settings.jsx';
import ElasticSearchSettings from './elasticsearch_settings.jsx';
import BleveSettings from './bleve_settings.jsx';
import FeatureFlags from './feature_flags.tsx';
import ClusterSettings from './cluster_settings.jsx';
import CustomTermsOfServiceSettings from './custom_terms_of_service_settings';
import SessionLengthSettings from './session_length_settings';
import BillingSubscriptions from './billing/billing_subscriptions/index.tsx';
import BillingHistory from './billing/billing_history';
import CompanyInfo from './billing/company_info';
import PaymentInfo from './billing/payment_info';
import CompanyInfoEdit from './billing/company_info_edit';
import PaymentInfoEdit from './billing/payment_info_edit';
import WorkspaceOptimizationDashboard from './workspace-optimization/dashboard';
import {
    LDAPFeatureDiscovery,
    SAMLFeatureDiscovery,
    OpenIDFeatureDiscovery,
    OpenIDCustomFeatureDiscovery,
    AnnouncementBannerFeatureDiscovery,
    ComplianceExportFeatureDiscovery,
    CustomTermsOfServiceFeatureDiscovery,
    DataRetentionFeatureDiscovery,
    GuestAccessFeatureDiscovery,
    SystemRolesFeatureDiscovery,
    GroupsFeatureDiscovery,
} from './feature_discovery/features';

import * as DefinitionConstants from './admin_definition_constants';

const FILE_STORAGE_DRIVER_LOCAL = 'local';
const FILE_STORAGE_DRIVER_S3 = 'amazons3';
const MEBIBYTE = Math.pow(1024, 2);

const SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA1 = 'RSAwithSHA1';
const SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA256 = 'RSAwithSHA256';
const SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA512 = 'RSAwithSHA512';

const SAML_SETTINGS_CANONICAL_ALGORITHM_C14N = 'Canonical1.0';
const SAML_SETTINGS_CANONICAL_ALGORITHM_C14N11 = 'Canonical1.1';

// admin_definitions data structure define the autogenerated admin_console
// section. It defines the structure of the menu based on sections, subsections
// and pages. Each page contains an schema which defines a component to use for
// render the entire section or the name of the section (name and
// name_default), the section in the config file (id), and a list of options to
// configure (settings).
//
// All text fields contains a translation key, and the <field>_default string are the
// default text when the translation is still not available (the english version
// of the text).
//
// We can define different types of settings configuration widgets:
//
// Widget:
//   - type: which define the widget type.
//   - label (and label_default): which define the main text of the setting.
//   - isDisabled: a function which receive current config, the state of the page and the license.
//   - isHidden: a function which receive current config, the state of the page and the license.
//
// Custom Widget (extends from Widget):
//   - component: The component used to render the widget
//
// JobsTable Widget (extends from Widget):
//   - job_type: The kind of job from Constants.JobTypes
//   - render_job: Function to convert a job object into a react component.
//
// Banner Widget (extends from Widget):
//   - banner_type: The type of banner (options: info or warning)
//
// Setting Widget (extends from Widget):
//   - key: The key to store the configuration in the config file.
//   - help_text (and help_text_default): Long description of the field.
//   - help_text_markdown: True if the translation text contains markdown.
//   - help_text_values: Values to fill the translation (if needed).
//
// Bool Widget (extends from Setting Widget)
//
// Number Widget (extends from Setting Widget)
//
// Color Widget (extends from Setting Widget)
//
// Text Widget (extends from Setting Widget)
//   - placeholder (and placeholder_default): Placeholder text to show in the input.
//   - dynamic_value: function that generate the value of the field based on the current value, the config, the state and the license.
//   - default_value: function that generate the default value of the field based on the config, the state and the license.
//   - max_length: The maximum length allowed
//
// Button Widget (extends from Setting Widget)
//   - action: A redux action to execute on click.
//   - error_message (and error_message_default): Error to show if action doesn't work.
//   - success_message (and success_message_default): Success message to show if action doesn't work.
//
// Language Widget (extends from Setting Widget)
//   - multiple: If you can select multiple languages.
//   - no_result (and no_result_default): Text to show on not results found (only for multiple = true).
//   - not_present (and not_present_default): Text to show when the default language is not present (only for multiple = true).
//
// Dropdown Widget (extends from Setting Widget)
//   - options: List of options of the dropdown (each options has value, display_name, display_name_default and optionally help_text, help_text_default, help_text_values, help_text_markdown fields).
//
// Permissions Flag (extends from Setting Widget)
//   - permissions_mapping_name: A permission name in the utils/policy_roles_adapter.js file.
//
// FileUpload (extends from Setting Widget)
//   - remove_help_text (and remove_help_text_default):  Long description of the field when a file is uploaded.
//   - remove_help_text_markdown: True if the translation text contains markdown.
//   - remove_help_text_values: Values to fill the translation (if needed).
//   - remove_button_text (and remove_button_text_default): Button text for remove when the file is uploaded.
//   - removing_text (and removing_text_default): Text shown while the system is removing the file.
//   - uploading_text (and uploading_text_default): Text shown while the system is uploading the file.
//   - upload_action: An store action to upload the file.
//   - remove_action: An store action to remove the file.
//   - fileType: A list of extensions separated by ",". E.g. ".jpg,.png,.gif".

export const it = {
    not: (func) => (config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) => {
        return typeof func === 'function' ? !func(config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) : !func;
    },
    all: (...funcs) => (config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) => {
        for (const func of funcs) {
            if (typeof func === 'function' ? !func(config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) : !func) {
                return false;
            }
        }
        return true;
    },
    any: (...funcs) => (config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) => {
        for (const func of funcs) {
            if (typeof func === 'function' ? func(config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) : func) {
                return true;
            }
        }
        return false;
    },
    stateMatches: (key, regex) => (config, state) => state[key].match(regex),
    stateEquals: (key, value) => (config, state) => state[key] === value,
    stateIsTrue: (key) => (config, state) => Boolean(state[key]),
    stateIsFalse: (key) => (config, state) => !state[key],
    configIsTrue: (group, setting) => (config) => Boolean(config[group][setting]),
    configIsFalse: (group, setting) => (config) => !config[group][setting],
    configContains: (group, setting, word) => (config) => Boolean(config[group][setting]?.includes(word)),
    enterpriseReady: (config, state, license, enterpriseReady) => enterpriseReady,
    licensed: (config, state, license) => license.IsLicensed === 'true',
    cloudLicensed: (config, state, license) => isCloudLicense(license),
    licensedForFeature: (feature) => (config, state, license) => license.IsLicensed && license[feature] === 'true',
    licensedForSku: (skuName) => (config, state, license) => license.IsLicensed && license.SkuShortName === skuName,
    licensedForCloudStarter: (config, state, license) => isCloudLicense(license) && license.SkuShortName === LicenseSkus.Starter,
    hidePaymentInfo: (config, state, license, enterpriseReady, consoleAccess, cloud) => {
        const productId = cloud?.subscription?.product_id;
        const limits = cloud?.limits;
        const subscriptionProduct = cloud?.products?.[productId];
        const isCloudFreeProduct = isCloudFreePlan(subscriptionProduct, limits);
        return cloud?.subscription?.is_free_trial === 'true' || isCloudFreeProduct;
    },
    userHasReadPermissionOnResource: (key) => (config, state, license, enterpriseReady, consoleAccess) => consoleAccess?.read?.[key],
    userHasReadPermissionOnSomeResources: (key) => Object.values(key).some((resource) => it.userHasReadPermissionOnResource(resource)),
    userHasWritePermissionOnResource: (key) => (config, state, license, enterpriseReady, consoleAccess) => consoleAccess?.write?.[key],
    isSystemAdmin: (config, state, license, enterpriseReady, consoleAccess, icloud, isSystemAdmin) => isSystemAdmin,
};

export const validators = {
    isRequired: (text, textDefault) => (value) => new ValidationResult(Boolean(value), text, textDefault),
    minValue: (min, text, textDefault) => (value) => new ValidationResult((value >= min), text, textDefault),
};

const usesLegacyOauth = (config, state, license, enterpriseReady, consoleAccess, cloud) => {
    if (!config.GitLabSettings || !config.GoogleSettings || !config.Office365Settings) {
        return false;
    }

    return it.any(
        it.all(
            it.not(it.configContains('GitLabSettings', 'Scope', 'openid')),
            it.any(
                it.configIsTrue('GitLabSettings', 'Id'),
                it.configIsTrue('GitLabSettings', 'Secret'),
            ),
        ),
        it.all(
            it.not(it.configContains('GoogleSettings', 'Scope', 'openid')),
            it.any(
                it.configIsTrue('GoogleSettings', 'Id'),
                it.configIsTrue('GoogleSettings', 'Secret'),
            ),
        ),
        it.all(
            it.not(it.configContains('Office365Settings', 'Scope', 'openid')),
            it.any(
                it.configIsTrue('Office365Settings', 'Id'),
                it.configIsTrue('Office365Settings', 'Secret'),
            ),
        ),
    )(config, state, license, enterpriseReady, consoleAccess, cloud);
};

const getRestrictedIndicator = (displayBlocked = false, minimumPlanRequiredForFeature = LicenseSkus.Professional) => ({
    value: (cloud) => (
        <RestrictedIndicator
            useModal={false}
            blocked={displayBlocked || !(cloud?.subscription?.is_free_trial === 'true')}
            minimumPlanRequiredForFeature={minimumPlanRequiredForFeature}
            tooltipMessageBlocked={{
                id: t('admin.sidebar.restricted_indicator.tooltip.message.blocked'),
                defaultMessage: 'This is {article} {minimumPlanRequiredForFeature} feature, available with an upgrade or free {trialLength}-day trial',
            }}
        />
    ),
    shouldDisplay: (license, subscriptionProduct) => displayBlocked || (isCloudLicense(license) && subscriptionProduct?.sku === CloudProducts.STARTER),
});

const AdminDefinition = {
    about: {
        icon: (
            <InformationOutlineIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.about'),
        sectionTitleDefault: 'About',
        isHidden: it.any(
            it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
            it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.ABOUT)),
        ),
        license: {
            url: 'about/license',
            title: t('admin.sidebar.license'),
            title_default: 'Edition and License',
            searchableStrings: [
                'admin.license.title',
                'admin.license.uploadDesc',
                'admin.license.keyRemove',
                'admin.license.edition',
                'admin.license.type',
                'admin.license.key',
                'Mattermost Enterprise Edition. Unlock enterprise features in this software through the purchase of a subscription from ',
                'This software is offered under a commercial license.\n\nSee ENTERPRISE-EDITION-LICENSE.txt in your root install directory for details. See NOTICE.txt for information about open source software used in this system.',
            ],
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
            schema: {
                id: 'LicenseSettings',
                component: LicenseSettings,
            },
        },
    },
    billing: {
        icon: (
            <CreditCardOutlineIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.billing'),
        sectionTitleDefault: 'Billing & Account',
        isHidden: it.any(
            it.not(it.enterpriseReady),
            it.not(it.userHasReadPermissionOnResource('billing')),
            it.not(it.licensed),
            it.all(
                it.not(it.licensedForFeature('Cloud')),
                it.configIsFalse('ServiceSettings', 'SelfHostedPurchase'),
            ),
        ),
        subscription: {
            url: 'billing/subscription',
            title: t('admin.sidebar.subscription'),
            title_default: 'Subscription',
            searchableStrings: [
                'admin.billing.subscription.title',
                'admin.billing.subscription.deleteWorkspaceSection.title',
                'admin.billing.subscription.deleteWorkspaceModal.deleteButton',
            ],
            schema: {
                id: 'BillingSubscriptions',
                component: BillingSubscriptions,
            },

            // cloud only view
            isHidden: it.not(it.licensedForFeature('Cloud')),
            isDisabled: it.not(it.userHasWritePermissionOnResource('billing')),
        },
        billing_history: {
            url: 'billing/billing_history',
            title: t('admin.sidebar.billing_history'),
            title_default: 'Billing History',
            searchableStrings: [
                'admin.billing.history.title',
            ],
            schema: {
                id: 'BillingHistory',
                component: BillingHistory,
            },
            isDisabled: it.not(it.userHasWritePermissionOnResource('billing')),
        },
        company_info: {
            url: 'billing/company_info',
            title: t('admin.sidebar.company_info'),
            title_default: 'Company Information',
            searchableStrings: [
                'admin.billing.company_info.title',
            ],
            schema: {
                id: 'CompanyInfo',
                component: CompanyInfo,
            },

            // cloud only view
            isHidden: it.not(it.licensedForFeature('Cloud')),
            isDisabled: it.not(it.userHasWritePermissionOnResource('billing')),
        },
        company_info_edit: {
            url: 'billing/company_info_edit',
            schema: {
                id: 'CompanyInfoEdit',
                component: CompanyInfoEdit,
            },

            // cloud only view
            isHidden: it.not(it.licensedForFeature('Cloud')),
            isDisabled: it.not(it.userHasWritePermissionOnResource('billing')),
        },
        payment_info: {
            url: 'billing/payment_info',
            title: t('admin.sidebar.payment_info'),
            title_default: 'Payment Information',
            isHidden: it.any(
                it.hidePaymentInfo,

                // cloud only view
                it.not(it.licensedForFeature('Cloud')),
            ),
            searchableStrings: [
                'admin.billing.payment_info.title',
            ],
            schema: {
                id: 'PaymentInfo',
                component: PaymentInfo,
            },
            isDisabled: it.not(it.userHasWritePermissionOnResource('billing')),
        },
        payment_info_edit: {
            url: 'billing/payment_info_edit',
            schema: {
                id: 'PaymentInfoEdit',
                component: PaymentInfoEdit,
            },
            isDisabled: it.not(it.userHasWritePermissionOnResource('billing')),
        },
    },
    reporting: {
        icon: (
            <ChartBarIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.reporting'),
        sectionTitleDefault: 'Reporting',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.REPORTING)),
        workspace_optimization: {
            url: 'reporting/workspace_optimization',
            title: t('admin.sidebar.workspaceOptimization'),
            title_default: 'Workspace Optimization',
            schema: {
                id: 'WorkspaceOptimizationDashboard',
                component: WorkspaceOptimizationDashboard,
            },
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
        },
        system_analytics: {
            url: 'reporting/system_analytics',
            title: t('admin.sidebar.siteStatistics'),
            title_default: 'Site Statistics',
            searchableStrings: [
                'analytics.system.title',
                'analytics.system.totalPosts',
                'analytics.system.activeUsers',
                'analytics.system.totalSessions',
                'analytics.system.totalCommands',
                'analytics.system.totalIncomingWebhooks',
                'analytics.system.totalOutgoingWebhooks',
                'analytics.system.totalWebsockets',
                'analytics.system.totalMasterDbConnections',
                'analytics.system.totalReadDbConnections',
                'analytics.system.postTypes',
                'analytics.system.channelTypes',
                'analytics.system.totalUsers',
                'analytics.system.totalTeams',
                'analytics.system.totalChannels',
                'analytics.system.dailyActiveUsers',
                'analytics.system.monthlyActiveUsers',
            ],
            schema: {
                id: 'SystemAnalytics',
                component: SystemAnalytics,
            },
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
        },
        team_statistics: {
            url: 'reporting/team_statistics',
            title: t('admin.sidebar.teamStatistics'),
            title_default: 'Team Statistics',
            searchableStrings: [
                ['analytics.team.title', {team: ''}],
                'analytics.system.info',
                'analytics.team.totalPosts',
                'analytics.team.activeUsers',
                'analytics.team.totalUsers',
                'analytics.team.publicChannels',
                'analytics.team.privateGroups',
                'analytics.team.recentUsers',
                'analytics.team.newlyCreated',
            ],
            schema: {
                id: 'TeamAnalytics',
                component: TeamAnalytics,
            },
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.TEAM_STATISTICS)),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.TEAM_STATISTICS)),
        },
        server_logs: {
            url: 'reporting/server_logs',
            title: t('admin.sidebar.logs'),
            title_default: 'Server Logs',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.SERVER_LOGS)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.SERVER_LOGS)),
            searchableStrings: [
                'admin.logs.bannerDesc',
                'admin.logs.title',
            ],
            schema: {
                id: 'ServerLogs',
                component: ServerLogs,
            },
        },
    },
    user_management: {
        icon: (
            <AccountMultipleOutlineIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.userManagement'),
        sectionTitleDefault: 'User Management',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.USER_MANAGEMENT)),
        system_users: {
            url: 'user_management/users',
            title: t('admin.sidebar.users'),
            title_default: 'Users',
            searchableStrings: [
                ['admin.system_users.title', {siteName: ''}],
            ],
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.USERS)),
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.USERS)),
            schema: {
                id: 'SystemUsers',
                component: SystemUsers,
            },
        },
        system_user_detail: {
            url: 'user_management/user/:user_id',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.USERS)),
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.USERS)),
            schema: {
                id: 'SystemUserDetail',
                component: SystemUserDetail,
            },
        },
        group_detail: {
            url: 'user_management/groups/:group_id',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.GROUPS)),
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.GROUPS)),
            schema: {
                id: 'GroupDetail',
                component: GroupDetails,
            },
        },
        groups: {
            url: 'user_management/groups',
            title: t('admin.sidebar.groups'),
            title_default: 'Groups',
            isHidden: it.any(
                it.not(it.licensedForFeature('LDAPGroups')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.GROUPS)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.GROUPS)),
            schema: {
                id: 'Groups',
                component: GroupSettings,
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        groups_feature_discovery: {
            url: 'user_management/groups',
            isDiscovery: true,
            title: t('admin.sidebar.groups'),
            title_default: 'Groups',
            isHidden: it.any(
                it.licensedForFeature('LDAPGroups'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'Groups',
                name: t('admin.group_settings.groupsPageTitle'),
                name_default: 'Groups',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: GroupsFeatureDiscovery,
                        key: 'GroupsFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true, LicenseSkus.Enterprise),
        },
        team_detail: {
            url: 'user_management/teams/:team_id',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.TEAMS)),
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.TEAMS)),
            schema: {
                id: 'TeamDetail',
                component: TeamDetails,
            },
        },
        teams: {
            url: 'user_management/teams',
            title: t('admin.sidebar.teams'),
            title_default: 'Teams',
            isHidden: it.any(
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.TEAMS)),
            ),
            schema: {
                id: 'Teams',
                component: TeamSettings,
            },
        },
        channel_detail: {
            url: 'user_management/channels/:channel_id',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.CHANNELS)),
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.CHANNELS)),
            schema: {
                id: 'ChannelDetail',
                component: ChannelDetails,
            },
        },
        channel: {
            url: 'user_management/channels',
            title: t('admin.sidebar.channels'),
            title_default: 'Channels',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.CHANNELS)),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.CHANNELS)),
            schema: {
                id: 'Channels',
                component: ChannelSettings,
            },
        },
        systemScheme: {
            url: 'user_management/permissions/system_scheme',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.PERMISSIONS)),
            schema: {
                id: 'PermissionSystemScheme',
                component: PermissionSystemSchemeSettings,
            },
        },
        teamSchemeDetail: {
            url: 'user_management/permissions/team_override_scheme/:scheme_id',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.PERMISSIONS)),
            schema: {
                id: 'PermissionSystemScheme',
                component: PermissionTeamSchemeSettings,
            },
        },
        teamScheme: {
            url: 'user_management/permissions/team_override_scheme',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.PERMISSIONS)),
            schema: {
                id: 'PermissionSystemScheme',
                component: PermissionTeamSchemeSettings,
            },
        },
        permissions: {
            url: 'user_management/permissions/',
            title: t('admin.sidebar.permissions'),
            title_default: 'Permissions',
            searchableStrings: [
                'admin.permissions.documentationLinkText',
                'admin.permissions.teamOverrideSchemesNoSchemes',
                'admin.permissions.loadMoreSchemes',
                'admin.permissions.introBanner',
                'admin.permissions.systemSchemeBannerTitle',
                'admin.permissions.systemSchemeBannerText',
                'admin.permissions.systemSchemeBannerButton',
                'admin.permissions.teamOverrideSchemesTitle',
                'admin.permissions.teamOverrideSchemesBannerText',
                'admin.permissions.teamOverrideSchemesNewButton',
            ],
            isHidden: it.any(
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.PERMISSIONS)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.PERMISSIONS)),
            schema: {
                id: 'PermissionSchemes',
                component: PermissionSchemesSettings,
            },
        },
        system_role: {
            url: 'user_management/system_roles/:role_id',
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES)),
            schema: {
                id: 'SystemRole',
                component: SystemRole,
            },
        },
        system_roles: {
            url: 'user_management/system_roles',
            title: t('admin.sidebar.systemRoles'),
            title_default: 'System Roles',
            searchableStrings: [],
            isHidden: it.any(
                it.not(it.licensedForFeature('LDAPGroups')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.SYSTEM_ROLES)),
            schema: {
                id: 'SystemRoles',
                component: SystemRoles,
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        system_roles_feature_discovery: {
            url: 'user_management/system_roles',
            isDiscovery: true,
            title: t('admin.sidebar.systemRoles'),
            title_default: 'System Roles',
            isHidden: it.any(
                it.licensedForFeature('LDAPGroups'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'SystemRoles',
                name: t('admin.permissions.systemRoles'),
                name_default: 'System Roles',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: SystemRolesFeatureDiscovery,
                        key: 'SystemRolesFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true, LicenseSkus.Enterprise),
        },
    },
    environment: {
        icon: (
            <ServerVariantIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.environment'),
        sectionTitleDefault: 'Environment',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.ENVIRONMENT)),
        web_server: {
            url: 'environment/web_server',
            title: t('admin.sidebar.webServer'),
            title_default: 'Web Server',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
            ),
            schema: {
                id: 'ServiceSettings',
                name: t('admin.environment.webServer'),
                name_default: 'Web Server',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BANNER,
                        label: t('admin.rate.noteDescription'),
                        label_default: 'Changing properties in this section will require a server restart before taking effect.',
                        banner_type: 'info',
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.SiteURL',
                        label: t('admin.service.siteURL'),
                        label_default: 'Site URL:',
                        help_text: t('admin.service.siteURLDescription'),
                        help_text_default: 'The URL that users will use to access Mattermost. Standard ports, such as 80 and 443, can be omitted, but non-standard ports are required. For example: http://example.com:8065. This setting is required.\n \nMattermost may be hosted at a subpath. For example: http://example.com:8065/company/mattermost. A restart is required before the server will work correctly.',
                        help_text_markdown: true,
                        placeholder: t('admin.service.siteURLExample'),
                        placeholder_default: 'E.g.: "http://example.com:8065"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BUTTON,
                        key: 'TestSiteURL',
                        action: testSiteURL,
                        label: t('admin.service.testSiteURL'),
                        label_default: 'Test Live URL',
                        loading: t('admin.service.testSiteURLTesting'),
                        loading_default: 'Testing...',
                        error_message: t('admin.service.testSiteURLFail'),
                        error_message_default: 'Test unsuccessful: {error}',
                        success_message: t('admin.service.testSiteURLSuccess'),
                        success_message_default: 'Test successful. This is a valid URL.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.ListenAddress',
                        label: t('admin.service.listenAddress'),
                        label_default: 'Listen Address:',
                        placeholder: t('admin.service.listenExample'),
                        placeholder_default: 'E.g.: ":8065"',
                        help_text: t('admin.service.listenDescription'),
                        help_text_default: 'The address and port to which to bind and listen. Specifying ":8065" will bind to all network interfaces. Specifying "127.0.0.1:8065" will only bind to the network interface having that IP address. If you choose a port of a lower level (called "system ports" or "well-known ports", in the range of 0-1023), you must have permissions to bind to that port. On Linux you can use: "sudo setcap cap_net_bind_service=+ep ./bin/mattermost" to allow Mattermost to bind to well-known ports.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.Forward80To443',
                        label: t('admin.service.forward80To443'),
                        label_default: 'Forward port 80 to 443:',
                        help_text: t('admin.service.forward80To443Description'),
                        help_text_default: 'Forwards all insecure traffic from port 80 to secure port 443. Not recommended when using a proxy server.',
                        disabled_help_text: t('admin.service.forward80To443Description.disabled'),
                        disabled_help_text_default: 'Forwards all insecure traffic from port 80 to secure port 443. Not recommended when using a proxy server.\n \nThis setting cannot be enabled until your server is [listening](#ListenAddress) on port 443.',
                        disabled_help_text_markdown: true,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                            it.not(it.stateMatches('ServiceSettings.ListenAddress', /:443$/)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'ServiceSettings.ConnectionSecurity',
                        label: t('admin.connectionSecurityTitle'),
                        label_default: 'Connection Security:',
                        help_text: DefinitionConstants.CONNECTION_SECURITY_HELP_TEXT_WEBSERVER,
                        options: [
                            {
                                value: '',
                                display_name: t('admin.connectionSecurityNone'),
                                display_name_default: 'None',
                            },
                            {
                                value: 'TLS',
                                display_name: t('admin.connectionSecurityTls'),
                                display_name_default: 'TLS (Recommended)',
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.TLSCertFile',
                        label: t('admin.service.tlsCertFile'),
                        label_default: 'TLS Certificate File:',
                        help_text: t('admin.service.tlsCertFileDescription'),
                        help_text_default: 'The certificate file to use.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                            it.stateIsTrue('ServiceSettings.UseLetsEncrypt'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.TLSKeyFile',
                        label: t('admin.service.tlsKeyFile'),
                        label_default: 'TLS Key File:',
                        help_text: t('admin.service.tlsKeyFileDescription'),
                        help_text_default: 'The private key file to use.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                            it.stateIsTrue('ServiceSettings.UseLetsEncrypt'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.UseLetsEncrypt',
                        label: t('admin.service.useLetsEncrypt'),
                        label_default: 'Use Let\'s Encrypt:',
                        help_text: t('admin.service.useLetsEncryptDescription'),
                        help_text_default: 'Enable the automatic retrieval of certificates from Let\'s Encrypt. The certificate will be retrieved when a client attempts to connect from a new domain. This will work with multiple domains.',
                        disabled_help_text: t('admin.service.useLetsEncryptDescription.disabled'),
                        disabled_help_text_default: 'Enable the automatic retrieval of certificates from Let\'s Encrypt. The certificate will be retrieved when a client attempts to connect from a new domain. This will work with multiple domains.\n \nThis setting cannot be enabled unless the [Forward port 80 to 443](#Forward80To443) setting is set to true.',
                        disabled_help_text_markdown: true,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                            it.stateIsFalse('ServiceSettings.Forward80To443'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.LetsEncryptCertificateCacheFile',
                        label: t('admin.service.letsEncryptCertificateCacheFile'),
                        label_default: 'Let\'s Encrypt Certificate Cache File:',
                        help_text: t('admin.service.letsEncryptCertificateCacheFileDescription'),
                        help_text_default: 'Certificates retrieved and other data about the Let\'s Encrypt service will be stored in this file.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                            it.stateIsFalse('ServiceSettings.UseLetsEncrypt'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'ServiceSettings.ReadTimeout',
                        label: t('admin.service.readTimeout'),
                        label_default: 'Read Timeout:',
                        help_text: t('admin.service.readTimeoutDescription'),
                        help_text_default: 'Maximum time allowed from when the connection is accepted to when the request body is fully read.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'ServiceSettings.WriteTimeout',
                        label: t('admin.service.writeTimeout'),
                        label_default: 'Write Timeout:',
                        help_text: t('admin.service.writeTimeoutDescription'),
                        help_text_default: 'If using HTTP (insecure), this is the maximum time allowed from the end of reading the request headers until the response is written. If using HTTPS, it is the total time from when the connection is accepted until the response is written.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'ServiceSettings.WebserverMode',
                        label: t('admin.webserverModeTitle'),
                        label_default: 'Webserver Mode:',
                        help_text: DefinitionConstants.WEBSERVER_MODE_HELP_TEXT,
                        options: [
                            {
                                value: 'gzip',
                                display_name: t('admin.webserverModeGzip'),
                                display_name_default: 'gzip',
                            },
                            {
                                value: 'uncompressed',
                                display_name: t('admin.webserverModeUncompressed'),
                                display_name_default: 'Uncompressed',
                            },
                            {
                                value: 'disabled',
                                display_name: t('admin.webserverModeDisabled'),
                                display_name_default: 'Disabled',
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableInsecureOutgoingConnections',
                        label: t('admin.service.insecureTlsTitle'),
                        label_default: 'Enable Insecure Outgoing Connections: ',
                        help_text: t('admin.service.insecureTlsDesc'),
                        help_text_default: 'When true, any outgoing HTTPS requests will accept unverified, self-signed certificates. For example, outgoing webhooks to a server with a self-signed TLS certificate, using any domain, will be allowed. Note that this makes these connections susceptible to man-in-the-middle attacks.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.ManagedResourcePaths',
                        label: t('admin.service.managedResourcePaths'),
                        label_default: 'Managed Resource Paths:',
                        help_text: t('admin.service.managedResourcePathsDescription'),
                        help_text_default: 'A comma-separated list of paths on the Mattermost server that are managed by another service. See <link>here</link> for more information.',
                        help_text_markdown: false,
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/install/desktop-managed-resources.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BUTTON,
                        action: reloadConfig,
                        key: 'ReloadConfigButton',
                        label: t('admin.reload.button'),
                        label_default: 'Reload Configuration From Disk',
                        help_text: t('admin.reload.reloadDescription'),
                        help_text_default: 'Deployments using multiple databases can switch from one master database to another without restarting the Mattermost server by updating "config.json" to the new desired configuration and using the {featureName} feature to load the new settings while the server is running. The administrator should then use the {recycleDatabaseConnections} feature to recycle the database connections based on the new settings.',
                        help_text_values: {
                            featureName: (
                                <b>
                                    <FormattedMessage
                                        id='admin.reload.reloadDescription.featureName'
                                        defaultMessage='Reload Configuration from Disk'
                                    />
                                </b>
                            ),
                            recycleDatabaseConnections: (
                                <a href='../environment/database'>
                                    <b>
                                        <FormattedMessage
                                            id='admin.reload.reloadDescription.recycleDatabaseConnections'
                                            defaultMessage='Environment > Database > Recycle Database Connections'
                                        />
                                    </b>
                                </a>
                            ),
                        },
                        error_message: t('admin.reload.reloadFail'),
                        error_message_default: 'Reload unsuccessful: {error}',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BUTTON,
                        key: 'PurgeButton',
                        action: invalidateAllCaches,
                        label: t('admin.purge.button'),
                        label_default: 'Purge All Caches',
                        help_text: t('admin.purge.purgeDescription'),
                        help_text_default: 'This will purge all the in-memory caches for things like sessions, accounts, channels, etc. Deployments using High Availability will attempt to purge all the servers in the cluster.  Purging the caches may adversely impact performance.',
                        error_message: t('admin.purge.purgeFail'),
                        error_message_default: 'Purging unsuccessful: {error}',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                    },
                ],
            },
        },
        database: {
            url: 'environment/database',
            title: t('admin.sidebar.database'),
            title_default: 'Database',
            searchableStrings: [
                'admin.database.title',
                ['admin.recycle.recycleDescription', {featureName: '', reloadConfiguration: ''}],
                'admin.recycle.recycleDescription.featureName',
                'admin.recycle.recycleDescription.reloadConfiguration',
                'admin.recycle.button',
                'admin.sql.noteDescription',
                'admin.sql.disableDatabaseSearchTitle',
                'admin.sql.disableDatabaseSearchDescription',
                'admin.sql.driverName',
                'admin.sql.driverNameDescription',
                'admin.sql.dataSource',
                'admin.sql.dataSourceDescription',
                'admin.sql.maxConnectionsTitle',
                'admin.sql.maxConnectionsDescription',
                'admin.sql.maxOpenTitle',
                'admin.sql.maxOpenDescription',
                'admin.sql.queryTimeoutTitle',
                'admin.sql.queryTimeoutDescription',
                'admin.sql.connMaxLifetimeTitle',
                'admin.sql.connMaxLifetimeDescription',
                'admin.sql.connMaxIdleTimeTitle',
                'admin.sql.connMaxIdleTimeDescription',
                'admin.sql.traceTitle',
                'admin.sql.traceDescription',
            ],
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DATABASE)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DATABASE)),
            schema: {
                id: 'DatabaseSettings',
                component: DatabaseSettings,
            },
        },
        elasticsearch: {
            url: 'environment/elasticsearch',
            title: t('admin.sidebar.elasticsearch'),
            title_default: 'Elasticsearch',
            isHidden: it.any(
                it.not(it.licensedForFeature('Elasticsearch')),
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.ELASTICSEARCH)),
            ),
            searchableStrings: [
                'admin.elasticsearch.title',
                'admin.elasticsearch.enableIndexingTitle',
                ['admin.elasticsearch.enableIndexingDescription', {documentationLink: ''}],
                'admin.elasticsearch.enableIndexingDescription.documentationLinkText',
                'admin.elasticsearch.connectionUrlTitle',
                ['admin.elasticsearch.connectionUrlDescription', {documentationLink: ''}],
                'admin.elasticsearch.connectionUrlExample.documentationLinkText',
                'admin.elasticsearch.skipTLSVerificationTitle',
                'admin.elasticsearch.skipTLSVerificationDescription',
                'admin.elasticsearch.usernameTitle',
                'admin.elasticsearch.usernameDescription',
                'admin.elasticsearch.passwordTitle',
                'admin.elasticsearch.passwordDescription',
                'admin.elasticsearch.sniffTitle',
                'admin.elasticsearch.sniffDescription',
                'admin.elasticsearch.testHelpText',
                'admin.elasticsearch.elasticsearch_test_button',
                'admin.elasticsearch.bulkIndexingTitle',
                'admin.elasticsearch.createJob.help',
                'admin.elasticsearch.purgeIndexesHelpText',
                'admin.elasticsearch.purgeIndexesButton',
                'admin.elasticsearch.purgeIndexesButton.label',
                'admin.elasticsearch.enableSearchingTitle',
                'admin.elasticsearch.enableSearchingDescription',
            ],
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.ELASTICSEARCH)),
            schema: {
                id: 'ElasticSearchSettings',
                component: ElasticSearchSettings,
            },
        },
        storage: {
            url: 'environment/file_storage',
            title: t('admin.sidebar.fileStorage'),
            title_default: 'File Storage',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
            ),
            schema: {
                id: 'FileSettings',
                name: t('admin.environment.fileStorage'),
                name_default: 'File Storage',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'FileSettings.DriverName',
                        label: t('admin.image.storeTitle'),
                        label_default: 'File Storage System:',
                        help_text: t('admin.image.storeDescription'),
                        help_text_default: 'Storage system where files and image attachments are saved.\n \nSelecting "Amazon S3" enables fields to enter your Amazon credentials and bucket details.\n \nSelecting "Local File System" enables the field to specify a local file directory.',
                        help_text_markdown: true,
                        options: [
                            {
                                value: FILE_STORAGE_DRIVER_LOCAL,
                                display_name: t('admin.image.storeLocal'),
                                display_name_default: 'Local File System',
                            },
                            {
                                value: FILE_STORAGE_DRIVER_S3,
                                display_name: t('admin.image.storeAmazonS3'),
                                display_name_default: 'Amazon S3',
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'FileSettings.Directory',
                        label: t('admin.image.localTitle'),
                        label_default: 'Local Storage Directory:',
                        help_text: t('admin.image.localDescription'),
                        help_text_default: 'Directory to which files and images are written. If blank, defaults to ./data/.',
                        placeholder: t('admin.image.localExample'),
                        placeholder_default: 'E.g.: "./data/"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_LOCAL)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'FileSettings.MaxFileSize',
                        label: t('admin.image.maxFileSizeTitle'),
                        label_default: 'Maximum File Size:',
                        help_text: t('admin.image.maxFileSizeDescription'),
                        help_text_default: 'Maximum file size for message attachments in megabytes. Caution: Verify server memory can support your setting choice. Large file sizes increase the risk of server crashes and failed uploads due to network interruptions.',
                        placeholder: t('admin.image.maxFileSizeExample'),
                        placeholder_default: '50',
                        onConfigLoad: (configVal) => configVal / MEBIBYTE,
                        onConfigSave: (displayVal) => displayVal * MEBIBYTE,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.ExtractContent',
                        label: t('admin.image.extractContentTitle'),
                        label_default: 'Enable document search by content:',
                        help_text: t('admin.image.extractContentDescription'),
                        help_text_markdown: false,
                        help_text_default: 'When enabled, supported document types are searchable by their content. Search results for existing documents may be incomplete <link>until a data migration is executed</link>.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://www.mattermost.com/file-content-extraction'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.ArchiveRecursion',
                        label: t('admin.image.archiveRecursionTitle'),
                        label_default: 'Enable searching content of documents within ZIP files:',
                        help_text: t('admin.image.archiveRecursionDescription'),
                        help_text_default: 'When enabled, content of documents within ZIP files will be returned in search results. This may have an impact on server performance for large files. ',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.configIsFalse('FileSettings', 'ExtractContent'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'FileSettings.AmazonS3Bucket',
                        label: t('admin.image.amazonS3BucketTitle'),
                        label_default: 'Amazon S3 Bucket:',
                        help_text: t('admin.image.amazonS3BucketDescription'),
                        help_text_default: 'Name you selected for your S3 bucket in AWS.',
                        placeholder: t('admin.image.amazonS3BucketExample'),
                        placeholder_default: 'E.g.: "mattermost-media"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'FileSettings.AmazonS3PathPrefix',
                        label: t('admin.image.amazonS3PathPrefixTitle'),
                        label_default: 'Amazon S3 Path Prefix:',
                        help_text: t('admin.image.amazonS3PathPrefixDescription'),
                        help_text_default: 'Prefix you selected for your S3 bucket in AWS.',
                        placeholder: t('admin.image.amazonS3PathPrefixExample'),
                        placeholder_default: 'E.g.: "subdir1/" or you can leave it .',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'FileSettings.AmazonS3Region',
                        label: t('admin.image.amazonS3RegionTitle'),
                        label_default: 'Amazon S3 Region:',
                        help_text: t('admin.image.amazonS3RegionDescription'),
                        help_text_default: 'AWS region you selected when creating your S3 bucket. If no region is set, Mattermost attempts to get the appropriate region from AWS, or sets it to "us-east-1" if none found.',
                        placeholder: t('admin.image.amazonS3RegionExample'),
                        placeholder_default: 'E.g.: "us-east-1"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'FileSettings.AmazonS3AccessKeyId',
                        label: t('admin.image.amazonS3IdTitle'),
                        label_default: 'Amazon S3 Access Key ID:',
                        help_text: t('admin.image.amazonS3IdDescription'),
                        help_text_default: '(Optional) Only required if you do not want to authenticate to S3 using an <link>IAM role</link>. Enter the Access Key ID provided by your Amazon EC2 administrator.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        placeholder: t('admin.image.amazonS3IdExample'),
                        placeholder_default: 'E.g.: "AKIADTOVBGERKLCBV"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'FileSettings.AmazonS3Endpoint',
                        label: t('admin.image.amazonS3EndpointTitle'),
                        label_default: 'Amazon S3 Endpoint:',
                        help_text: t('admin.image.amazonS3EndpointDescription'),
                        help_text_default: 'Hostname of your S3 Compatible Storage provider. Defaults to "s3.amazonaws.com".',
                        placeholder: t('admin.image.amazonS3EndpointExample'),
                        placeholder_default: 'E.g.: "s3.amazonaws.com"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'FileSettings.AmazonS3SecretAccessKey',
                        label: t('admin.image.amazonS3SecretTitle'),
                        label_default: 'Amazon S3 Secret Access Key:',
                        help_text: t('admin.image.amazonS3SecretDescription'),
                        help_text_default: '(Optional) The secret access key associated with your Amazon S3 Access Key ID.',
                        placeholder: t('admin.image.amazonS3SecretExample'),
                        placeholder_default: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.AmazonS3SSL',
                        label: t('admin.image.amazonS3SSLTitle'),
                        label_default: 'Enable Secure Amazon S3 Connections:',
                        help_text: t('admin.image.amazonS3SSLDescription'),
                        help_text_default: 'When false, allow insecure connections to Amazon S3. Defaults to secure connections only.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.AmazonS3SSE',
                        label: t('admin.image.amazonS3SSETitle'),
                        label_default: 'Enable Server-Side Encryption for Amazon S3:',
                        help_text: t('admin.image.amazonS3SSEDescription'),
                        help_text_default: 'When true, encrypt files in Amazon S3 using server-side encryption with Amazon S3-managed keys. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/configure/configuration-settings.html#session-lengths'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('Compliance')),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.AmazonS3Trace',
                        label: t('admin.image.amazonS3TraceTitle'),
                        label_default: 'Enable Amazon S3 Debugging:',
                        help_text: t('admin.image.amazonS3TraceDescription'),
                        help_text_default: '(Development Mode) When true, log additional debugging information to the system logs.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BUTTON,
                        action: testS3Connection,
                        key: 'TestS3Connection',
                        label: t('admin.s3.connectionS3Test'),
                        label_default: 'Test Connection',
                        loading: t('admin.s3.testing'),
                        loading_default: 'Testing...',
                        error_message: t('admin.s3.s3Fail'),
                        error_message_default: 'Connection unsuccessful: {error}',
                        success_message: t('admin.s3.s3Success'),
                        success_message_default: 'Connection was successful',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                    },
                ],
            },
        },
        image_proxy: {
            url: 'environment/image_proxy',
            title: t('admin.sidebar.imageProxy'),
            title_default: 'Image Proxy',
            isHidden: it.any(
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
            ),
            schema: {
                id: 'ImageProxy',
                name: t('admin.environment.imageProxy'),
                name_default: 'Image Proxy',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ImageProxySettings.Enable',
                        label: t('admin.image.enableProxy'),
                        label_default: 'Enable Image Proxy:',
                        help_text: t('admin.image.enableProxyDescription'),
                        help_text_default: 'When true, enables an image proxy for loading all Markdown images.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'ImageProxySettings.ImageProxyType',
                        label: t('admin.image.proxyType'),
                        label_default: 'Image Proxy Type:',
                        help_text: t('admin.image.proxyTypeDescription'),
                        help_text_default: 'Configure an image proxy to load all Markdown images through a proxy. The image proxy prevents users from making insecure image requests, provides caching for increased performance, and automates image adjustments such as resizing. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/deploy/image-proxy.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        options: [
                            {
                                value: 'atmos/camo',
                                display_name: t('atmos/camo'),
                                display_name_default: 'atmos/camo',
                            },
                            {
                                value: 'local',
                                display_name: t('local'),
                                display_name_default: 'local',
                            },
                        ],
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                            it.stateIsFalse('ImageProxySettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ImageProxySettings.RemoteImageProxyURL',
                        label: t('admin.image.proxyURL'),
                        label_default: 'Remote Image Proxy URL:',
                        help_text: t('admin.image.proxyURLDescription'),
                        help_text_default: 'URL of your remote image proxy server.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                            it.stateIsFalse('ImageProxySettings.Enable'),
                            it.stateEquals('ImageProxySettings.ImageProxyType', 'local'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ImageProxySettings.RemoteImageProxyOptions',
                        label: t('admin.image.proxyOptions'),
                        label_default: 'Remote Image Proxy Options:',
                        help_text: t('admin.image.proxyOptionsDescription'),
                        help_text_default: 'Additional options such as the URL signing key. Refer to your image proxy documentation to learn more about what options are supported.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                            it.stateIsFalse('ImageProxySettings.Enable'),
                            it.stateEquals('ImageProxySettings.ImageProxyType', 'local'),
                        ),
                    },
                ],
            },
        },
        smtp: {
            url: 'environment/smtp',
            title: t('admin.sidebar.smtp'),
            title_default: 'SMTP',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
            ),
            schema: {
                id: 'SMTP',
                name: t('admin.environment.smtp'),
                name_default: 'SMTP',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.SMTPServer',
                        label: t('admin.environment.smtp.smtpServer.title'),
                        label_default: 'SMTP Server:',
                        placeholder: t('admin.environment.smtp.smtpServer.placeholder'),
                        placeholder_default: 'Ex: "smtp.yourcompany.com", "email-smtp.us-east-1.amazonaws.com"',
                        help_text: t('admin.environment.smtp.smtpServer.description'),
                        help_text_default: 'Location of SMTP email server.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.SMTPPort',
                        label: t('admin.environment.smtp.smtpPort.title'),
                        label_default: 'SMTP Server Port:',
                        placeholder: t('admin.environment.smtp.smtpPort.placeholder'),
                        placeholder_default: 'Ex: "25", "465", "587"',
                        help_text: t('admin.environment.smtp.smtpPort.description'),
                        help_text_default: 'Port of SMTP email server.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.EnableSMTPAuth',
                        label: t('admin.environment.smtp.smtpAuth.title'),
                        label_default: 'Enable SMTP Authentication:',
                        help_text: t('admin.environment.smtp.smtpAuth.description'),
                        help_text_default: 'When true, SMTP Authentication is enabled.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.SMTPUsername',
                        label: t('admin.environment.smtp.smtpUsername.title'),
                        label_default: 'SMTP Server Username:',
                        placeholder: t('admin.environment.smtp.smtpUsername.placeholder'),
                        placeholder_default: 'Ex: "admin@yourcompany.com", "AKIADTOVBGERKLCBV"',
                        help_text: t('admin.environment.smtp.smtpUsername.description'),
                        help_text_default: 'Obtain this credential from administrator setting up your email server.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                            it.stateIsFalse('EmailSettings.EnableSMTPAuth'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.SMTPPassword',
                        label: t('admin.environment.smtp.smtpPassword.title'),
                        label_default: 'SMTP Server Password:',
                        placeholder: t('admin.environment.smtp.smtpPassword.placeholder'),
                        placeholder_default: 'Ex: "yourpassword", "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"',
                        help_text: t('admin.environment.smtp.smtpPassword.description'),
                        help_text_default: 'Obtain this credential from administrator setting up your email server.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                            it.stateIsFalse('EmailSettings.EnableSMTPAuth'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'EmailSettings.ConnectionSecurity',
                        label: t('admin.environment.smtp.connectionSecurity.title'),
                        label_default: 'Connection Security:',
                        help_text: DefinitionConstants.CONNECTION_SECURITY_HELP_TEXT_EMAIL,
                        options: [
                            {
                                value: '',
                                display_name: t('admin.environment.smtp.connectionSecurity.option.none'),
                                display_name_default: 'None',
                            },
                            {
                                value: 'TLS',
                                display_name: t('admin.environment.smtp.connectionSecurity.option.tls'),
                                display_name_default: 'TLS (Recommended)',
                            },
                            {
                                value: 'STARTTLS',
                                display_name: t('admin.environment.smtp.connectionSecurity.option.starttls'),
                                display_name_default: 'STARTTLS',
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BUTTON,
                        action: testSmtp,
                        key: 'TestSmtpConnection',
                        label: t('admin.environment.smtp.connectionSmtpTest'),
                        label_default: 'Test Connection',
                        loading: t('admin.environment.smtp.testing'),
                        loading_default: 'Testing...',
                        error_message: t('admin.environment.smtp.smtpFail'),
                        error_message_default: 'Connection unsuccessful: {error}',
                        success_message: t('admin.environment.smtp.smtpSuccess'),
                        success_message_default: 'No errors were reported while sending an email. Please check your inbox to make sure.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.SkipServerCertificateVerification',
                        label: t('admin.environment.smtp.skipServerCertificateVerification.title'),
                        label_default: 'Skip Server Certificate Verification:',
                        help_text: t('admin.environment.smtp.skipServerCertificateVerification.description'),
                        help_text_default: 'When true, Mattermost will not verify the email server certificate.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableSecurityFixAlert',
                        label: t('admin.environment.smtp.enableSecurityFixAlert.title'),
                        label_default: 'Enable Security Alerts:',
                        help_text: t('admin.environment.smtp.enableSecurityFixAlert.description'),
                        help_text_default: 'When true, System Administrators are notified by email if a relevant security fix alert has been announced in the last 12 hours. Requires email to be enabled.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                    },
                ],
            },
        },
        push_notification_server: {
            url: 'environment/push_notification_server',
            title: t('admin.sidebar.pushNotificationServer'),
            title_default: 'Push Notification Server',
            searchableStrings: [
                'admin.environment.pushNotificationServer',
                'admin.email.pushTitle',
                'admin.email.pushServerTitle',
                'admin.email.pushContentTitle',
                'admin.email.pushContentDesc',
            ],
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PUSH_NOTIFICATION_SERVER)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PUSH_NOTIFICATION_SERVER)),
            schema: {
                id: 'PushNotificationsSettings',
                component: PushNotificationsSettings,
            },
        },
        high_availability: {
            url: 'environment/high_availability',
            title: t('admin.sidebar.highAvailability'),
            title_default: 'High Availability',
            isHidden: it.any(
                it.not(it.licensedForFeature('Cluster')),
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.HIGH_AVAILABILITY)),
            ),
            searchableStrings: [
                'admin.advance.cluster',
                'admin.cluster.noteDescription',
                'admin.cluster.enableTitle',
                'admin.cluster.enableDescription',
                'admin.cluster.ClusterName',
                'admin.cluster.ClusterNameDesc',
                'admin.cluster.OverrideHostname',
                'admin.cluster.OverrideHostnameDesc',
                'admin.cluster.UseIPAddress',
                'admin.cluster.UseIPAddressDesc',
                'admin.cluster.EnableExperimentalGossipEncryption',
                'admin.cluster.EnableExperimentalGossipEncryptionDesc',
                'admin.cluster.EnableGossipCompression',
                'admin.cluster.EnableGossipCompressionDesc',
                'admin.cluster.GossipPort',
                'admin.cluster.GossipPortDesc',
                'admin.cluster.StreamingPort',
                'admin.cluster.StreamingPortDesc',
            ],
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.HIGH_AVAILABILITY)),
            schema: {
                id: 'ClusterSettings',
                component: ClusterSettings,
            },
        },
        rate_limiting: {
            url: 'environment/rate_limiting',
            title: t('admin.sidebar.rateLimiting'),
            title_default: 'Rate Limiting',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
            ),
            schema: {
                id: 'ServiceSettings',
                name: t('admin.rate.title'),
                name_default: 'Rate Limiting',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BANNER,
                        label: t('admin.rate.noteDescription'),
                        label_default: 'Changing properties other than Site URL in this section will require a server restart before taking effect.',
                        banner_type: 'info',
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'RateLimitSettings.Enable',
                        label: t('admin.rate.enableLimiterTitle'),
                        label_default: 'Enable Rate Limiting:',
                        help_text: t('admin.rate.enableLimiterDescription'),
                        help_text_default: 'When true, APIs are throttled at rates specified below.\n \nRate limiting prevents server overload from too many requests. This is useful to prevent third-party applications or malicous attacks from impacting your server.',
                        help_text_markdown: true,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'RateLimitSettings.PerSec',
                        label: t('admin.rate.queriesTitle'),
                        label_default: 'Maximum Queries per Second:',
                        placeholder: t('admin.rate.queriesExample'),
                        placeholder_default: 'E.g.: "10"',
                        help_text: t('admin.rate.queriesDescription'),
                        help_text_default: 'Throttles API at this number of requests per second.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                            it.stateEquals('RateLimitSettings.Enable', false),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'RateLimitSettings.MaxBurst',
                        label: t('admin.rate.maxBurst'),
                        label_default: 'Maximum Burst Size:',
                        placeholder: t('admin.rate.maxBurstExample'),
                        placeholder_default: 'E.g.: "100"',
                        help_text: t('admin.rate.maxBurstDescription'),
                        help_text_default: 'Maximum number of requests allowed beyond the per second query limit.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                            it.stateEquals('RateLimitSettings.Enable', false),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'RateLimitSettings.MemoryStoreSize',
                        label: t('admin.rate.memoryTitle'),
                        label_default: 'Memory Store Size:',
                        placeholder: t('admin.rate.memoryExample'),
                        placeholder_default: 'E.g.: "10000"',
                        help_text: t('admin.rate.memoryDescription'),
                        help_text_default: 'Maximum number of users sessions connected to the system as determined by "Vary rate limit by remote address" and "Vary rate limit by HTTP header".',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                            it.stateEquals('RateLimitSettings.Enable', false),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'RateLimitSettings.VaryByRemoteAddr',
                        label: t('admin.rate.remoteTitle'),
                        label_default: 'Vary rate limit by remote address:',
                        help_text: t('admin.rate.remoteDescription'),
                        help_text_default: 'When true, rate limit API access by IP address.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                            it.stateEquals('RateLimitSettings.Enable', false),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'RateLimitSettings.VaryByUser',
                        label: t('admin.rate.varyByUser'),
                        label_default: 'Vary rate limit by user:',
                        help_text: t('admin.rate.varyByUserDescription'),
                        help_text_default: 'When true, rate limit API access by user athentication token.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                            it.stateEquals('RateLimitSettings.Enable', false),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'RateLimitSettings.VaryByHeader',
                        label: t('admin.rate.httpHeaderTitle'),
                        label_default: 'Vary rate limit by HTTP header:',
                        placeholder: t('admin.rate.httpHeaderExample'),
                        placeholder_default: 'E.g.: "X-Real-IP", "X-Forwarded-For"',
                        help_text: t('admin.rate.httpHeaderDescription'),
                        help_text_default: 'When filled in, vary rate limiting by HTTP header field specified (e.g. when configuring NGINX set to "X-Real-IP", when configuring AmazonELB set to "X-Forwarded-For").',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                            it.stateEquals('RateLimitSettings.Enable', false),
                            it.stateEquals('RateLimitSettings.VaryByRemoteAddr', true),
                        ),
                    },
                ],
            },
        },
        logging: {
            url: 'environment/logging',
            title: t('admin.sidebar.logging'),
            title_default: 'Logging',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
            ),
            schema: {
                id: 'LogSettings',
                name: t('admin.general.log'),
                name_default: 'Logging',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'LogSettings.EnableConsole',
                        label: t('admin.log.consoleTitle'),
                        label_default: 'Output logs to console: ',
                        help_text: t('admin.log.consoleDescription'),
                        help_text_default: 'Typically set to false in production. Developers may set this field to true to output log messages to console based on the console level option.  If true, server writes messages to the standard output stream (stdout). Changing this setting requires a server restart before taking effect.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'LogSettings.ConsoleLevel',
                        label: t('admin.log.levelTitle'),
                        label_default: 'Console Log Level:',
                        help_text: t('admin.log.levelDescription'),
                        help_text_default: 'This setting determines the level of detail at which log events are written to the console. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.',
                        options: DefinitionConstants.LOG_LEVEL_OPTIONS,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                            it.stateIsFalse('LogSettings.EnableConsole'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'LogSettings.ConsoleJson',
                        label: t('admin.log.consoleJsonTitle'),
                        label_default: 'Output console logs as JSON:',
                        help_text: t('admin.log.jsonDescription'),
                        help_text_default: 'When true, logged events are written in a machine readable JSON format. Otherwise they are printed as plain text. Changing this setting requires a server restart before taking effect.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                            it.stateIsFalse('LogSettings.EnableConsole'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'LogSettings.EnableFile',
                        label: t('admin.log.fileTitle'),
                        label_default: 'Output logs to file: ',
                        help_text: t('admin.log.fileDescription'),
                        help_text_default: 'Typically set to true in production. When true, logged events are written to the mattermost.log file in the directory specified in the File Log Directory field. The logs are rotated at 100 MB and archived to a file in the same directory, and given a name with a datestamp and serial number. For example, mattermost.2017-03-31.001. Changing this setting requires a server restart before taking effect.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'LogSettings.FileLevel',
                        label: t('admin.log.fileLevelTitle'),
                        label_default: 'File Log Level:',
                        help_text: t('admin.log.fileLevelDescription'),
                        help_text_default: 'This setting determines the level of detail at which log events are written to the log file. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.',
                        options: DefinitionConstants.LOG_LEVEL_OPTIONS,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                            it.stateIsFalse('LogSettings.EnableFile'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'LogSettings.FileJson',
                        label: t('admin.log.fileJsonTitle'),
                        label_default: 'Output file logs as JSON:',
                        help_text: t('admin.log.jsonDescription'),
                        help_text_default: 'When true, logged events are written in a machine readable JSON format. Otherwise they are printed as plain text. Changing this setting requires a server restart before taking effect.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                            it.stateIsFalse('LogSettings.EnableFile'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'LogSettings.FileLocation',
                        label: t('admin.log.locationTitle'),
                        label_default: 'File Log Directory:',
                        help_text: t('admin.log.locationDescription'),
                        help_text_default: 'The location of the log files. If blank, they are stored in the ./logs directory. The path that you set must exist and Mattermost must have write permissions in it. Changing this setting requires a server restart before taking effect.',
                        placeholder: t('admin.log.locationPlaceholder'),
                        placeholder_default: 'Enter your file location',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                            it.stateIsFalse('LogSettings.EnableFile'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'LogSettings.EnableWebhookDebugging',
                        label: t('admin.log.enableWebhookDebugging'),
                        label_default: 'Enable Webhook Debugging:',
                        help_text: t('admin.log.enableWebhookDebuggingDescription'),
                        help_text_default: 'When true, sends webhook debug messages to the server logs. To also output the request body of incoming webhooks, set {boldedLogLevel} to "DEBUG".',
                        help_text_values: {
                            boldedLogLevel: (
                                <strong>
                                    <FormattedMessage
                                        id='admin.log.logLevel'
                                        defaultMessage='Log Level'
                                    />
                                </strong>
                            ),
                        },
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'LogSettings.EnableDiagnostics',
                        label: t('admin.log.enableDiagnostics'),
                        label_default: 'Enable Diagnostics and Error Reporting:',
                        help_text: t('admin.log.enableDiagnosticsDescription'),
                        help_text_default: 'Enable this feature to improve the quality and performance of Mattermost by sending error reporting and diagnostic information to Mattermost, Inc. Read our <link>privacy policy</link> to learn more.',
                        help_text_markdown: false,
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/privacy-policy/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        onConfigSave: (displayVal, previousVal) => {
                            if (previousVal && previousVal !== displayVal) {
                                trackEvent('ui', 'diagnostics_disabled');
                            }
                            return displayVal;
                        },
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                    },
                ],
            },
        },
        session_lengths: {
            url: 'environment/session_lengths',
            title: t('admin.sidebar.sessionLengths'),
            title_default: 'Session Lengths',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SESSION_LENGTHS)),
            ),
            searchableStrings: [
                'admin.sessionLengths.title',
                'admin.service.webSessionHoursDesc.extendLength',
                'admin.service.mobileSessionHoursDesc.extendLength',
                'admin.service.ssoSessionHoursDesc.extendLength',
                'admin.service.webSessionHoursDesc',
                'admin.service.mobileSessionHoursDesc',
                'admin.service.ssoSessionHoursDesc',
                'admin.service.sessionIdleTimeout',
                'admin.service.sessionIdleTimeoutDesc',
                'admin.service.extendSessionLengthActivity.label',
                'admin.service.extendSessionLengthActivity.helpText',
                'admin.service.webSessionHours',
                'admin.service.sessionHoursEx',
                'admin.service.mobileSessionHours',
                'admin.service.ssoSessionHours',
                'admin.service.sessionCache',
                'admin.service.sessionCacheDesc',
            ],
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SESSION_LENGTHS)),
            schema: {
                id: 'SessionLengths',
                component: SessionLengthSettings,
            },
        },
        metrics: {
            url: 'environment/performance_monitoring',
            title: t('admin.sidebar.metrics'),
            title_default: 'Performance Monitoring',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PERFORMANCE_MONITORING)),
            ),
            schema: {
                id: 'MetricsSettings',
                name: t('admin.advance.metrics'),
                name_default: 'Performance Monitoring',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'MetricsSettings.Enable',
                        label: t('admin.metrics.enableTitle'),
                        label_default: 'Enable Performance Monitoring:',
                        help_text: t('admin.metrics.enableDescription'),
                        help_text_default: 'When true, Mattermost will enable performance monitoring collection and profiling. Please see <link>documentation</link> to learn more about configuring performance monitoring for Mattermost.',
                        help_text_markdown: false,
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/deployment/metrics.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PERFORMANCE_MONITORING)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'MetricsSettings.ListenAddress',
                        label: t('admin.metrics.listenAddressTitle'),
                        label_default: 'Listen Address:',
                        placeholder: t('admin.metrics.listenAddressEx'),
                        placeholder_default: 'E.g.: ":8067"',
                        help_text: t('admin.metrics.listenAddressDesc'),
                        help_text_default: 'The address the server will listen on to expose performance metrics.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PERFORMANCE_MONITORING)),
                    },
                ],
            },
        },
        developer: {
            url: 'environment/developer',
            title: t('admin.sidebar.developer'),
            title_default: 'Developer',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
            ),
            schema: {
                id: 'ServiceSettings',
                name: t('admin.developer.title'),
                name_default: 'Developer Settings',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableTesting',
                        label: t('admin.service.testingTitle'),
                        label_default: 'Enable Testing Commands:',
                        help_text: t('admin.service.testingDescription'),
                        help_text_default: 'When true, /test slash command is enabled to load test accounts, data and text formatting. Changing this requires a server restart before taking effect.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableDeveloper',
                        label: t('admin.service.developerTitle'),
                        label_default: 'Enable Developer Mode: ',
                        help_text: t('admin.service.developerDesc'),
                        help_text_default: 'When true, JavaScript errors are shown in a purple bar at the top of the user interface. Not recommended for use in production. Changing this requires a server restart before taking effect.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableClientPerformanceDebugging',
                        label: t('admin.service.performanceDebuggingTitle'),
                        label_default: 'Enable Client Performance Debugging: ',
                        help_text: t('admin.service.performanceDebuggingDescription'),
                        help_text_default: 'When true, users can access debugging settings for their account in **Settings > Advanced > Performance Debugging** to assist in diagnosing performance issues. Changing this requires a server restart before taking effect.',
                        help_text_markdown: true,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.AllowedUntrustedInternalConnections',
                        label: t('admin.service.internalConnectionsTitle'),
                        label_default: 'Allow untrusted internal connections to: ',
                        placeholder: t('admin.service.internalConnectionsEx'),
                        placeholder_default: 'webhooks.internal.example.com 127.0.0.1 10.0.16.0/28',
                        help_text: t('admin.service.internalConnectionsDesc'),
                        help_text_default: 'A whitelist of local network addresses that can be requested by the Mattermost server on behalf of a client. Care should be used when configuring this setting to prevent unintended access to your local network. See <link>documentation</link> to learn more. Changing this requires a server restart before taking effect.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/default-allow-untrusted-internal-connections'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                    },
                ],
            },
        },
    },
    site: {
        icon: (
            <CogOutlineIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.site'),
        sectionTitleDefault: 'Site Configuration',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.SITE)),
        customization: {
            url: 'site_config/customization',
            title: t('admin.sidebar.customization'),
            title_default: 'Customization',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
            schema: {
                id: 'Customization',
                name: t('admin.site.customization'),
                name_default: 'Customization',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'TeamSettings.SiteName',
                        label: t('admin.team.siteNameTitle'),
                        label_default: 'Site Name:',
                        help_text: t('admin.team.siteNameDescription'),
                        help_text_default: 'Name of service shown in login screens and UI. When not specified, it defaults to "Mattermost".',
                        placeholder: t('admin.team.siteNameExample'),
                        placeholder_default: 'E.g.: "Mattermost"',
                        max_length: Constants.MAX_SITENAME_LENGTH,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'TeamSettings.CustomDescriptionText',
                        label: t('admin.team.brandDescriptionTitle'),
                        label_default: 'Site Description: ',
                        help_text: t('admin.team.brandDescriptionHelp'),
                        help_text_default: 'Displays as a title above the login form. When not specified, the phrase "Log in" is displayed.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.EnableCustomBrand',
                        label: t('admin.team.brandTitle'),
                        label_default: 'Enable Custom Branding: ',
                        help_text: t('admin.team.brandDesc'),
                        help_text_default: 'Enable custom branding to show an image of your choice, uploaded below, and some help text, written below, on the login page.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: BrandImageSetting,
                        key: 'CustomBrandImage',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            it.stateIsFalse('TeamSettings.EnableCustomBrand'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_LONG_TEXT,
                        key: 'TeamSettings.CustomBrandText',
                        label: t('admin.team.brandTextTitle'),
                        label_default: 'Custom Brand Text:',
                        help_text: t('admin.team.brandTextDescription'),
                        help_text_default: 'Text that will appear below your custom brand image on your login screen. Supports Markdown-formatted text. Maximum 500 characters allowed.',
                        max_length: Constants.MAX_CUSTOM_BRAND_TEXT_LENGTH,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            it.stateIsFalse('TeamSettings.EnableCustomBrand'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SupportSettings.EnableAskCommunityLink',
                        label: t('admin.support.enableAskCommunityTitle'),
                        label_default: 'Enable Ask Community Link:',
                        help_text: t('admin.support.enableAskCommunityDesc'),
                        help_text_default: 'When true, "Ask the community" link appears on the Mattermost user interface and Help Menu, which allows users to join the Mattermost Community to ask questions and help others troubleshoot issues. When false, the link is hidden from users.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SupportSettings.HelpLink',
                        label: t('admin.support.helpTitle'),
                        label_default: 'Help Link:',
                        help_text: t('admin.support.helpDesc'),
                        help_text_default: 'The URL for the Help link on the Mattermost login page, sign-up pages, and Help Menu. If this field is empty, the Help link is hidden from users.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SupportSettings.TermsOfServiceLink',
                        label: t('admin.support.termsTitle'),
                        label_default: 'Terms of Use Link:',
                        help_text: t('admin.support.termsDesc'),
                        help_text_default: 'Link to the terms under which users may use your online service. By default, this includes the "Mattermost Conditions of Use (End Users)" explaining the terms under which Mattermost software is provided to end users. If you change the default link to add your own terms for using the service you provide, your new terms must include a link to the default terms so end users are aware of the Mattermost Conditions of Use (End User) for Mattermost software.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SupportSettings.PrivacyPolicyLink',
                        label: t('admin.support.privacyTitle'),
                        label_default: 'Privacy Policy Link:',
                        help_text: t('admin.support.privacyDesc'),
                        help_text_default: 'The URL for the Privacy link on the login and sign-up pages. If this field is empty, the Privacy link is hidden from users.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SupportSettings.AboutLink',
                        label: t('admin.support.aboutTitle'),
                        label_default: 'About Link:',
                        help_text: t('admin.support.aboutDesc'),
                        help_text_default: 'The URL for the About link on the Mattermost login and sign-up pages. If this field is empty, the About link is hidden from users.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SupportSettings.ReportAProblemLink',
                        label: t('admin.support.problemTitle'),
                        label_default: 'Report a Problem Link:',
                        help_text: t('admin.support.problemDesc'),
                        help_text_default: 'The URL for the Report a Problem link in the Help Menu. If this field is empty, the link is removed from the Help Menu.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'NativeAppSettings.AppDownloadLink',
                        label: t('admin.customization.appDownloadLinkTitle'),
                        label_default: 'Mattermost Apps Download Page Link:',
                        help_text: t('admin.customization.appDownloadLinkDesc'),
                        help_text_default: 'Add a link to a download page for the Mattermost apps. When a link is present, an option to "Download Mattermost Apps" will be added in the Product Menu so users can find the download page. Leave this field blank to hide the option from the Product Menu.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'NativeAppSettings.AndroidAppDownloadLink',
                        label: t('admin.customization.androidAppDownloadLinkTitle'),
                        label_default: 'Android App Download Link:',
                        help_text: t('admin.customization.androidAppDownloadLinkDesc'),
                        help_text_default: 'Add a link to download the Android app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'NativeAppSettings.IosAppDownloadLink',
                        label: t('admin.customization.iosAppDownloadLinkTitle'),
                        label_default: 'iOS App Download Link:',
                        help_text: t('admin.customization.iosAppDownloadLinkDesc'),
                        help_text_default: 'Add a link to download the iOS app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    },
                ],
            },
        },
        localization: {
            url: 'site_config/localization',
            title: t('admin.sidebar.localization'),
            title_default: 'Localization',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
            schema: {
                id: 'LocalizationSettings',
                name: t('admin.site.localization'),
                name_default: 'Localization',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_LANGUAGE,
                        key: 'LocalizationSettings.DefaultServerLocale',
                        label: t('admin.general.localization.serverLocaleTitle'),
                        label_default: 'Default Server Language:',
                        help_text: t('admin.general.localization.serverLocaleDescription'),
                        help_text_default: 'Default language for system messages.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_LANGUAGE,
                        key: 'LocalizationSettings.DefaultClientLocale',
                        label: t('admin.general.localization.clientLocaleTitle'),
                        label_default: 'Default Client Language:',
                        help_text: t('admin.general.localization.clientLocaleDescription'),
                        help_text_default: 'Default language for newly created users and pages where the user hasn\'t logged in.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_LANGUAGE,
                        key: 'LocalizationSettings.AvailableLocales',
                        label: t('admin.general.localization.availableLocalesTitle'),
                        label_default: 'Available Languages:',
                        help_text: t('admin.general.localization.availableLocalesDescription'),
                        help_text_markdown: false,
                        help_text_default: 'Set which languages are available for users in <strong>Settings > Display > Language</strong> (leave this field blank to have all supported languages available). If you\'re manually adding new languages, the <strong>Default Client Language</strong> must be added before saving this setting.\n \nWould like to help with translations? Join the <link>Mattermost Translation Server</link> to contribute.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='http://translate.mattermost.com/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            strong: (msg) => <strong>{msg}</strong>,
                        },
                        multiple: true,
                        no_result: t('admin.general.localization.availableLocalesNoResults'),
                        no_result_default: 'No results found',
                        not_present: t('admin.general.localization.availableLocalesNotPresent'),
                        not_present_default: 'The default client language must be included in the available list',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
                    },
                ],
            },
        },
        users_and_teams: {
            url: 'site_config/users_and_teams',
            title: t('admin.sidebar.usersAndTeams'),
            title_default: 'Users and Teams',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
            schema: {
                id: 'UserAndTeamsSettings',
                name: t('admin.site.usersAndTeams'),
                name_default: 'Users and Teams',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'TeamSettings.MaxUsersPerTeam',
                        label: t('admin.team.maxUsersTitle'),
                        label_default: 'Max Users Per Team:',
                        help_text: t('admin.team.maxUsersDescription'),
                        help_text_default: 'Maximum total number of users per team, including both active and inactive users.',
                        placeholder: t('admin.team.maxUsersExample'),
                        placeholder_default: 'E.g.: "25"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'TeamSettings.MaxChannelsPerTeam',
                        label: t('admin.team.maxChannelsTitle'),
                        label_default: 'Max Channels Per Team:',
                        help_text: t('admin.team.maxChannelsDescription'),
                        help_text_default: 'Maximum total number of channels per team, including both active and archived channels.',
                        placeholder: t('admin.team.maxChannelsExample'),
                        placeholder_default: 'E.g.: "100"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'TeamSettings.RestrictDirectMessage',
                        label: t('admin.team.restrictDirectMessage'),
                        label_default: 'Enable users to open Direct Message channels with:',
                        help_text: t('admin.team.restrictDirectMessageDesc'),
                        help_text_default: '"Any user on the Mattermost server" enables users to open a Direct Message channel with any user on the server, even if they are not on any teams together. "Any member of the team" limits the ability in the Direct Messages "More" menu to only open Direct Message channels with users who are in the same team.\n \nNote: This setting only affects the UI, not permissions on the server.',
                        options: [
                            {
                                value: 'any',
                                display_name: t('admin.team.restrict_direct_message_any'),
                                display_name_default: 'Any user on the Mattermost server',
                            },
                            {
                                value: 'team',
                                display_name: t('admin.team.restrict_direct_message_team'),
                                display_name_default: 'Any member of the team',
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'TeamSettings.TeammateNameDisplay',
                        label: t('admin.team.teammateNameDisplay'),
                        label_default: 'Teammate Name Display:',
                        help_text: t('admin.team.teammateNameDisplayDesc'),
                        help_text_default: 'Set how to display users\' names in posts and the Direct Messages list.',
                        options: [
                            {
                                value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                                display_name: t('admin.team.showUsername'),
                                display_name_default: 'Show username (default)',
                            },
                            {
                                value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME,
                                display_name: t('admin.team.showNickname'),
                                display_name_default: 'Show nickname if one exists, otherwise show first and last name',
                            },
                            {
                                value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                                display_name: t('admin.team.showFullname'),
                                display_name_default: 'Show first and last name',
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.LockTeammateNameDisplay',
                        label: t('admin.lockTeammateNameDisplay'),
                        label_default: 'Lock Teammate Name Display for all users: ',
                        help_text: t('admin.lockTeammateNameDisplayHelpText'),
                        help_text_default: 'When true, disables users\' ability to change settings under <strong>Account Menu > Account Settings > Display > Teammate Name Display</strong>.',
                        help_text_values: {
                            strong: (msg) => <strong>{msg}</strong>,
                        },
                        isHidden: it.not(it.licensedForFeature('LockTeammateNameDisplay')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.ExperimentalViewArchivedChannels',
                        label: t('admin.viewArchivedChannelsTitle'),
                        label_default: 'Allow users to view archived channels: ',
                        help_text: t('admin.viewArchivedChannelsHelpText'),
                        help_text_default: 'When true, allows users to view, share and search for content of channels that have been archived. Users can only view the content in channels of which they were a member before the channel was archived.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'PrivacySettings.ShowEmailAddress',
                        label: t('admin.privacy.showEmailTitle'),
                        label_default: 'Show Email Address:',
                        help_text: t('admin.privacy.showEmailDescription'),
                        help_text_default: 'When false, hides the email address of members from everyone except System Administrators.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'PrivacySettings.ShowFullName',
                        label: t('admin.privacy.showFullNameTitle'),
                        label_default: 'Show Full Name:',
                        help_text: t('admin.privacy.showFullNameDescription'),
                        help_text_default: 'When false, hides the full name of members from everyone except System Administrators. Username is shown in place of full name.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.EnableCustomUserStatuses',
                        label: t('admin.team.customUserStatusesTitle'),
                        label_default: 'Enable Custom Statuses: ',
                        help_text: t('admin.team.customUserStatusesDescription'),
                        help_text_default: 'When true, users can set a descriptive status message and status emoji visible to all users.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.EnableLastActiveTime',
                        label: t('admin.team.lastActiveTimeTitle'),
                        label_default: 'Enable last active time: ',
                        help_text: t('admin.team.lastActiveTimeDescription'),
                        help_text_default: 'When enabled, last active time allows users to see when someone was last online.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableCustomGroups',
                        label: t('admin.team.customUserGroupsTitle'),
                        label_default: 'Enable Custom User Groups (Beta): ',
                        help_text: t('admin.team.customUserGroupsDescription'),
                        help_text_default: 'When true, users with appropriate permissions can create custom user groups and enables at-mentions for those groups.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        isHidden: it.not(it.any(
                            it.licensedForSku(LicenseSkus.Enterprise),
                            it.licensedForSku(LicenseSkus.Professional),
                        )),
                    },
                ],
            },
        },
        notifications: {
            url: 'environment/notifications',
            title: t('admin.sidebar.notifications'),
            title_default: 'Notifications',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
            schema: {
                id: 'notifications',
                name: t('admin.environment.notifications'),
                name_default: 'Notifications',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.EnableConfirmNotificationsToChannel',
                        label: t('admin.environment.notifications.enableConfirmNotificationsToChannel.label'),
                        label_default: 'Show @channel, @all, @here and group mention confirmation dialog:',
                        help_text: t('admin.environment.notifications.enableConfirmNotificationsToChannel.help'),
                        help_text_default: 'When true, users will be prompted to confirm when posting @channel, @all, @here and group mentions in channels with over five members. When false, no confirmation is required.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.SendEmailNotifications',
                        label: t('admin.environment.notifications.enable.label'),
                        label_default: 'Enable Email Notifications:',
                        help_text: t('admin.environment.notifications.enable.help'),
                        help_text_default: 'Typically set to true in production. When true, Mattermost attempts to send email notifications. When false, email invitations and user account setting change emails are still sent as long as the SMTP server is configured. Developers may set this field to false to skip email setup for faster development.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.EnablePreviewModeBanner',
                        label: t('admin.environment.notifications.enablePreviewModeBanner.label'),
                        label_default: 'Enable Preview Mode Banner:',
                        help_text: t('admin.environment.notifications.enablePreviewModeBanner.help'),
                        help_text_default: 'When true, the Preview Mode banner is displayed so users are aware that email notifications are disabled. When false, the Preview Mode banner is not displayed to users.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                            it.stateIsTrue('EmailSettings.SendEmailNotifications'),
                        ),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.EnableEmailBatching',
                        label: t('admin.environment.notifications.enableEmailBatching.label'),
                        label_default: 'Enable Email Batching:',
                        help_text: t('admin.environment.notifications.enableEmailBatching.help'),
                        help_text_default: 'When true, users will have email notifications for multiple direct messages and mentions combined into a single email. Batching will occur at a default interval of 15 minutes, configurable in Settings > Notifications.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                            it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                            it.configIsTrue('ClusterSettings', 'Enable'),
                            it.configIsFalse('ServiceSettings', 'SiteURL'),
                        ),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'EmailSettings.EmailNotificationContentsType',
                        label: t('admin.environment.notifications.contents.label'),
                        label_default: 'Email Notification Contents:',
                        help_text: t('admin.environment.notifications.contents.help'),
                        help_text_default: '**Send full message contents** - Sender name and channel are included in email notifications.\n  **Send generic description with only sender name** - Only the name of the person who sent the message, with no information about channel name or message contents are included in email notifications. Typically used for compliance reasons if Mattermost contains confidential information and policy dictates it cannot be stored in email.',
                        help_text_markdown: true,
                        options: [
                            {
                                value: 'full',
                                display_name: t('admin.environment.notifications.contents.full'),
                                display_name_default: 'Send full message contents',
                            },
                            {
                                value: 'generic',
                                display_name: t('admin.environment.notifications.contents.generic'),
                                display_name_default: 'Send generic description with only sender name',
                            },
                        ],
                        isHidden: it.not(it.licensedForFeature('EmailNotificationContents')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.FeedbackName',
                        label: t('admin.environment.notifications.notificationDisplay.label'),
                        label_default: 'Notification Display Name:',
                        placeholder: t('admin.environment.notifications.notificationDisplay.placeholder'),
                        placeholder_default: 'Ex: "Mattermost Notification", "System", "No-Reply"',
                        help_text: t('admin.environment.notifications.notificationDisplay.help'),
                        help_text_default: 'Display name on email account used when sending notification emails from Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                            it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                        ),
                        validate: validators.isRequired(t('admin.environment.notifications.notificationDisplay.required'), '"Notification Display Name" is required'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.FeedbackEmail',
                        label: t('admin.environment.notifications.feedbackEmail.label'),
                        label_default: 'Notification From Address:',
                        placeholder: t('admin.environment.notifications.feedbackEmail.placeholder'),
                        placeholder_default: 'Ex: "mattermost@yourcompany.com", "admin@yourcompany.com"',
                        help_text: t('admin.environment.notifications.feedbackEmail.help'),
                        help_text_default: 'Email address displayed on email account used when sending notification emails from Mattermost.',
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                            it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                        ),
                        validate: validators.isRequired(t('admin.environment.notifications.feedbackEmail.required'), '"Notification From Address" is required'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SupportSettings.SupportEmail',
                        label: t('admin.environment.notifications.supportEmail.label'),
                        label_default: 'Support Email Address:',
                        placeholder: t('admin.environment.notifications.supportAddress.placeholder'),
                        placeholder_default: 'Ex: "support@yourcompany.com", "admin@yourcompany.com"',
                        help_text: t('admin.environment.notifications.supportEmail.help'),
                        help_text_default: 'Email address displayed on support emails.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        validate: validators.isRequired(t('admin.environment.notifications.supportEmail.required'), '"Support Email Address" is required'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.ReplyToAddress',
                        label: t('admin.environment.notifications.replyToAddress.label'),
                        label_default: 'Notification Reply-To Address:',
                        placeholder: t('admin.environment.notifications.replyToAddress.placeholder'),
                        placeholder_default: 'Ex: "mattermost@yourcompany.com", "admin@yourcompany.com"',
                        help_text: t('admin.environment.notifications.replyToAddress.help'),
                        help_text_default: 'Email address used in the Reply-To header when sending notification emails from Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                            it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'EmailSettings.FeedbackOrganization',
                        label: t('admin.environment.notifications.feedbackOrganization.label'),
                        label_default: 'Notification Footer Mailing Address:',
                        placeholder: t('admin.environment.notifications.feedbackOrganization.placeholder'),
                        placeholder_default: 'Ex: "© ABC Corporation, 565 Knight Way, Palo Alto, California, 94305, USA"',
                        help_text: t('admin.environment.notifications.feedbackOrganization.help'),
                        help_text_default: 'Organization name and address displayed on email notifications from Mattermost, such as "© ABC Corporation, 565 Knight Way, Palo Alto, California, 94305, USA". If the field is left empty, the organization name and address will not be displayed.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                            it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'EmailSettings.PushNotificationContents',
                        label: t('admin.environment.notifications.pushContents.label'),
                        label_default: 'Push Notification Contents:',
                        help_text: t('admin.environment.notifications.pushContents.help'),
                        help_text_default: '**Generic description with only sender name** - Includes only the name of the person who sent the message in push notifications, with no information about channel name or message contents.\n **Generic description with sender and channel names** - Includes the name of the person who sent the message and the channel it was sent in, but not the message contents.\n **Full message content sent in the notification payload** - Includes the message contents in the push notification payload that is relayed through Apple\'s Push Notification Service (APNS) or Google\'s Firebase Cloud Messaging (FCM). It is **highly recommended** this option only be used with an "https" protocol to encrypt the connection and protect confidential information sent in messages.',
                        help_text_markdown: true,
                        options: [
                            {
                                value: 'generic_no_channel',
                                display_name: t('admin.environment.notifications.pushContents.genericNoChannel'),
                                display_name_default: 'Generic description with only sender name',
                            },
                            {
                                value: 'generic',
                                display_name: t('admin.environment.notifications.pushContents.generic'),
                                display_name_default: 'Generic description with sender and channel names',
                            },
                            {
                                value: 'full',
                                display_name: t('admin.environment.notifications.pushContents.full'),
                                display_name_default: 'Full message content sent in the notification payload',
                            },
                        ],
                        isHidden: it.licensedForFeature('IDLoadedPushNotifications'),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'EmailSettings.PushNotificationContents',
                        label: t('admin.environment.notifications.pushContents.label'),
                        label_default: 'Push Notification Contents:',
                        help_text: t('admin.environment.notifications.pushContents.withIdLoaded.help'),
                        help_text_default: '**Generic description with only sender name** - Includes only the name of the person who sent the message in push notifications, with no information about channel name or message contents.\n **Generic description with sender and channel names** - Includes the name of the person who sent the message and the channel it was sent in, but not the message contents.\n **Full message content sent in the notification payload** - Includes the message contents in the push notification payload that is relayed through Apple\'s Push Notification Service (APNS) or Google\'s Firebase Cloud Messaging (FCM). It is **highly recommended** this option only be used with an "https" protocol to encrypt the connection and protect confidential information sent in messages.\n **Full message content fetched from the server on receipt** - The notification payload relayed through APNS or FCM contains no message content, instead it contains a unique message ID used to fetch message content from the server when a push notification is received by a device. If the server cannot be reached, a generic notification will be displayed.',
                        help_text_markdown: true,
                        options: [
                            {
                                value: 'generic_no_channel',
                                display_name: t('admin.environment.notifications.pushContents.genericNoChannel'),
                                display_name_default: 'Generic description with only sender name',
                            },
                            {
                                value: 'generic',
                                display_name: t('admin.environment.notifications.pushContents.generic'),
                                display_name_default: 'Generic description with sender and channel names',
                            },
                            {
                                value: 'full',
                                display_name: t('admin.environment.notifications.pushContents.full'),
                                display_name_default: 'Full message content sent in the notification payload',
                            },
                            {
                                value: 'id_loaded',
                                display_name: t('admin.environment.notifications.pushContents.idLoaded'),
                                display_name_default: 'Full message content fetched from the server on receipt',
                            },
                        ],
                        isHidden: it.not(it.licensedForFeature('IDLoadedPushNotifications')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                    },
                ],
            },
        },
        announcement_banner: {
            url: 'site_config/announcement_banner',
            title: t('admin.sidebar.announcement'),
            title_default: 'Announcement Banner',
            isHidden: it.any(
                it.not(it.licensedForFeature('Announcement')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
            ),
            schema: {
                id: 'AnnouncementSettings',
                name: t('admin.site.announcementBanner'),
                name_default: 'Announcement Banner',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'AnnouncementSettings.EnableBanner',
                        label: t('admin.customization.announcement.enableBannerTitle'),
                        label_default: 'Enable Announcement Banner:',
                        help_text: t('admin.customization.announcement.enableBannerDesc'),
                        help_text_default: 'Enable an announcement banner across all teams.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'AnnouncementSettings.BannerText',
                        label: t('admin.customization.announcement.bannerTextTitle'),
                        label_default: 'Banner Text:',
                        help_text: t('admin.customization.announcement.bannerTextDesc'),
                        help_text_default: 'Text that will appear in the announcement banner.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                            it.stateIsFalse('AnnouncementSettings.EnableBanner'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'AnnouncementSettings.BannerColor',
                        label: t('admin.customization.announcement.bannerColorTitle'),
                        label_default: 'Banner Color:',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                            it.stateIsFalse('AnnouncementSettings.EnableBanner'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'AnnouncementSettings.BannerTextColor',
                        label: t('admin.customization.announcement.bannerTextColorTitle'),
                        label_default: 'Banner Text Color:',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                            it.stateIsFalse('AnnouncementSettings.EnableBanner'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'AnnouncementSettings.AllowBannerDismissal',
                        label: t('admin.customization.announcement.allowBannerDismissalTitle'),
                        label_default: 'Allow Banner Dismissal:',
                        help_text: t('admin.customization.announcement.allowBannerDismissalDesc'),
                        help_text_default: 'When true, users can dismiss the banner until its next update. When false, the banner is permanently visible until it is turned off by the System Admin.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                            it.stateIsFalse('AnnouncementSettings.EnableBanner'),
                        ),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        announcement_banner_feature_discovery: {
            url: 'site_config/announcement_banner',
            isDiscovery: true,
            title: t('admin.sidebar.announcement'),
            title_default: 'Announcement Banner',
            isHidden: it.any(
                it.licensedForFeature('Announcement'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'AnnouncementSettings',
                name: t('admin.site.announcementBanner'),
                name_default: 'Announcement Banner',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: AnnouncementBannerFeatureDiscovery,
                        key: 'AnnouncementBannerFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true),
        },
        emoji: {
            url: 'site_config/emoji',
            title: t('admin.sidebar.emoji'),
            title_default: 'Emoji',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.EMOJI)),
            schema: {
                id: 'EmojiSettings',
                name: t('admin.site.emoji'),
                name_default: 'Emoji',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableEmojiPicker',
                        label: t('admin.customization.enableEmojiPickerTitle'),
                        label_default: 'Enable Emoji Picker:',
                        help_text: t('admin.customization.enableEmojiPickerDesc'),
                        help_text_default: 'The emoji picker allows users to select emoji to add as reactions or use in messages. Enabling the emoji picker with a large number of custom emoji may slow down performance.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.EMOJI)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableCustomEmoji',
                        label: t('admin.customization.enableCustomEmojiTitle'),
                        label_default: 'Enable Custom Emoji:',
                        help_text: t('admin.customization.enableCustomEmojiDesc'),
                        help_text_default: 'Enable users to create custom emoji for use in messages. When enabled, custom emoji settings can be accessed in Channels through the emoji picker.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.EMOJI)),
                    },
                ],
            },
        },
        posts: {
            url: 'site_config/posts',
            title: t('admin.sidebar.posts'),
            title_default: 'Posts',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
            schema: {
                id: 'PostSettings',
                name: t('admin.site.posts'),
                name_default: 'Posts',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.ThreadAutoFollow',
                        label: t('admin.experimental.threadAutoFollow.title'),
                        label_default: 'Automatically Follow Threads',
                        help_text: t('admin.experimental.threadAutoFollow.desc'),
                        help_text_default: 'This setting must be enabled in order to enable Collapsed Reply Threads. When enabled, threads a user starts, participates in, or is mentioned in are automatically followed. A new `Threads` table is added in the database that tracks threads and thread participants, and a `ThreadMembership` table tracks followed threads for each user and the read or unread state of each followed thread. When false, all backend operations to support Collapsed Reply Threads are disabled.',
                        help_text_markdown: true,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'ServiceSettings.CollapsedThreads',
                        label: t('admin.experimental.collapsedThreads.title'),
                        label_default: 'Collapsed Reply Threads',
                        help_text: t('admin.experimental.collapsedThreads.desc'),
                        help_text_default: 'When enabled (default off), users must enable collapsed reply threads in Settings. When disabled, users cannot access Collapsed Reply Threads. Please review our <linkKnownIssues>documentation for known issues</linkKnownIssues> and help provide feedback in our <linkCommunityChannel>Community Channel</linkCommunityChannel>.',
                        help_text_values: {
                            linkKnownIssues: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://support.mattermost.com/hc/en-us/articles/4413183568276'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            linkCommunityChannel: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://community-daily.mattermost.com/core/channels/folded-reply-threads'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        options: [
                            {
                                value: 'disabled',
                                display_name: t('admin.experimental.collapsedThreads.off'),
                                display_name_default: 'Disabled',
                            },
                            {
                                value: 'default_off',
                                display_name: t('admin.experimental.collapsedThreads.default_off'),
                                display_name_default: 'Enabled (Default Off)',
                            },
                            {
                                value: 'default_on',
                                display_name: t('admin.experimental.collapsedThreads.default_on'),
                                display_name_default: 'Enabled (Default On)',
                            },
                            {
                                value: 'always_on',
                                display_name: t('admin.experimental.collapsedThreads.always_on'),
                                display_name_default: 'Always On',
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.PostPriority',
                        label: t('admin.posts.postPriority.title'),
                        label_default: 'Message Priority',
                        help_text: t('admin.posts.postPriority.desc'),
                        help_text_default: 'When enabled, users can configure a visual indicator to communicate messages that are important or urgent. Learn more about message priority in our <link>documentation</link>.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/message-priority/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        isHidden: it.configIsFalse('FeatureFlags', 'PostPriority'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.AllowPersistentNotifications',
                        label: t('admin.posts.persistentNotifications.title'),
                        label_default: 'Persistent Notifications',
                        help_text: t('admin.posts.persistentNotifications.desc'),
                        help_text_default: 'When enabled, users can trigger repeating notifications for the recipients of urgent messages. Learn more about message priority and persistent notifications in our <link>documentation</link>.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/message-priority/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        isHidden: it.any(
                            it.configIsFalse('FeatureFlags', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'PostPriority'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'ServiceSettings.PersistentNotificationMaxRecipients',
                        label: t('admin.posts.persistentNotificationsMaxRecipients.title'),
                        label_default: 'Maximum number of recipients for persistent notifications',
                        help_text: t('admin.posts.persistentNotificationsMaxRecipients.desc'),
                        help_text_default: 'Configure the maximum number of recipients to which users may send persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/message-priority/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        isHidden: it.any(
                            it.configIsFalse('FeatureFlags', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'AllowPersistentNotifications'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'ServiceSettings.PersistentNotificationIntervalMinutes',
                        label: t('admin.posts.persistentNotificationsInterval.title'),
                        label_default: 'Frequency of persistent notifications',
                        help_text: t('admin.posts.persistentNotificationsInterval.desc'),
                        help_text_default: 'Configure the number of minutes between repeated notifications for urgent messages send with persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/message-priority/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        isHidden: it.any(
                            it.configIsFalse('FeatureFlags', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'AllowPersistentNotifications'),
                        ),
                        validate: validators.minValue(2, t('admin.posts.persistentNotificationsInterval.minValue'), 'Frequency cannot not be set to less than 2 minutes'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'ServiceSettings.PersistentNotificationMaxCount',
                        label: t('admin.posts.persistentNotificationsMaxCount.title'),
                        label_default: 'Total number of persistent notification per post',
                        help_text: t('admin.posts.persistentNotificationsMaxCount.desc'),
                        help_text_default: 'Configure the maximum number of times users may receive persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/message-priority/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        isHidden: it.any(
                            it.configIsFalse('FeatureFlags', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'AllowPersistentNotifications'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.AllowPersistentNotificationsForGuests',
                        label: t('admin.posts.persistentNotificationsGuests.title'),
                        label_default: 'Allow guests to send persistent notifications',
                        help_text: t('admin.posts.persistentNotificationsGuests.desc'),
                        help_text_default: 'Whether a guest is able to require persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/message-priority/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        isHidden: it.any(
                            it.configIsFalse('GuestAccountsSettings', 'Enable'),
                            it.configIsFalse('FeatureFlags', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'PostPriority'),
                            it.configIsFalse('ServiceSettings', 'AllowPersistentNotifications'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableLinkPreviews',
                        label: t('admin.customization.enableLinkPreviewsTitle'),
                        label_default: 'Enable website link previews:',
                        help_text: t('admin.customization.enableLinkPreviewsDesc'),
                        help_text_default: 'Display a preview of website content, image links and YouTube links below the message when available. The server must be connected to the internet and have access through the firewall (if applicable) to the websites from which previews are expected. Users can disable these previews from Settings > Display > Website Link Previews.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.RestrictLinkPreviews',
                        label: t('admin.customization.restrictLinkPreviewsTitle'),
                        label_default: 'Disable website link previews from these domains:',
                        help_text: t('admin.customization.restrictLinkPreviewsDesc'),
                        help_text_default: 'Link previews and image link previews will not be shown for the above list of comma-separated domains.',
                        placeholder: t('admin.customization.restrictLinkPreviewsExample'),
                        placeholder_default: 'E.g.: "internal.mycompany.com, images.example.com"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                            it.configIsFalse('ServiceSettings', 'EnableLinkPreviews'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnablePermalinkPreviews',
                        label: t('admin.customization.enablePermalinkPreviewsTitle'),
                        label_default: 'Enable message link previews:',
                        help_text: t('admin.customization.enablePermalinkPreviewsDesc'),
                        help_text_default: 'When enabled, links to Mattermost messages will generate a preview for any users that have access to the original message. Please review our <link>documentation</link> for details.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/messaging/sharing-messages.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableSVGs',
                        label: t('admin.customization.enableSVGsTitle'),
                        label_default: 'Enable SVGs:',
                        help_text: t('admin.customization.enableSVGsDesc'),
                        help_text_default: 'Enable previews for SVG file attachments and allow them to appear in messages.\n\nEnabling SVGs is not recommended in environments where not all users are trusted.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableLatex',
                        label: t('admin.customization.enableLatexTitle'),
                        label_default: 'Enable Latex Rendering:',
                        help_text: t('admin.customization.enableLatexDesc'),
                        help_text_default: 'Enable rendering of Latex in code blocks. If false, Latex code will be highlighted only.\n\nEnabling Latex is not recommended in environments where not all users are trusted.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableInlineLatex',
                        label: t('admin.customization.enableInlineLatexTitle'),
                        label_default: 'Enable Inline Latex Rendering:',
                        help_text: t('admin.customization.enableInlineLatexDesc'),
                        help_text_default: 'Enable rendering of inline Latex code. If false, Latex can only be rendered in a code block using syntax highlighting. Please review our <link>documentation</link> for details about text formatting.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/messaging/formatting-text.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                            it.configIsFalse('ServiceSettings', 'EnableLatex'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: CustomURLSchemesSetting,
                        key: 'DisplaySettings.CustomURLSchemes',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.GoogleDeveloperKey',
                        label: t('admin.service.googleTitle'),
                        label_default: 'Google API Key:',
                        placeholder: t('admin.service.googleExample'),
                        placeholder_default: 'E.g.: "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QV"',
                        help_text: t('admin.service.googleDescription'),
                        help_text_default: 'Set this key to enable the display of titles for embedded YouTube video previews. Without the key, YouTube previews will still be created based on hyperlinks appearing in messages or comments but they will not show the video title. View a <link>Google Developers Tutorial</link> for instructions on how to obtain a key and add YouTube Data API v3 as a service to your key.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://www.youtube.com/watch?v=Im69kzhpR3I'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.AllowSyncedDrafts',
                        label: t('admin.customization.allowSyncedDrafts'),
                        label_default: 'Enable server syncing of message drafts:',
                        help_text: t('admin.customization.allowSyncedDraftsDesc'),
                        help_text_default: 'When enabled, users message drafts will sync with the server so they can be accessed from any device. Users may opt out of this behaviour in Account settings.',
                        help_text_markdown: false,
                    },
                ],
            },
        },
        file_sharing_downloads: {
            url: 'site_config/file_sharing_downloads',
            title: t('admin.sidebar.fileSharingDownloads'),
            title_default: 'File Sharing and Downloads',
            isHidden: it.any(
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
            ),
            schema: {
                id: 'FileSharingDownloads',
                name: t('admin.site.fileSharingDownloads'),
                name_default: 'File Sharing and Downloads',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.EnableFileAttachments',
                        label: t('admin.file.enableFileAttachments'),
                        label_default: 'Allow File Sharing:',
                        help_text: t('admin.file.enableFileAttachmentsDesc'),
                        help_text_default: 'When false, disables file sharing on the server. All file and image uploads on messages are forbidden across clients and devices, including mobile.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.EnableMobileUpload',
                        label: t('admin.file.enableMobileUploadTitle'),
                        label_default: 'Allow File Uploads on Mobile:',
                        help_text: t('admin.file.enableMobileUploadDesc'),
                        help_text_default: 'When false, disables file uploads on mobile apps. If Allow File Sharing is set to true, users can still upload files from a mobile web browser.',
                        isHidden: it.not(it.licensedForFeature('Compliance')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.EnableMobileDownload',
                        label: t('admin.file.enableMobileDownloadTitle'),
                        label_default: 'Allow File Downloads on Mobile:',
                        help_text: t('admin.file.enableMobileDownloadDesc'),
                        help_text_default: 'When false, disables file downloads on mobile apps. Users can still download files from a mobile web browser.',
                        isHidden: it.not(it.licensedForFeature('Compliance')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
                    },
                ],
            },
        },
        public_links: {
            url: 'site_config/public_links',
            title: t('admin.sidebar.publicLinks'),
            title_default: 'Public Links',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.PUBLIC_LINKS)),
            ),
            schema: {
                id: 'PublicLinkSettings',
                name: t('admin.site.public_links'),
                name_default: 'Public Links',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'FileSettings.EnablePublicLink',
                        label: t('admin.image.shareTitle'),
                        label_default: 'Enable Public File Links: ',
                        help_text: t('admin.image.shareDescription'),
                        help_text_default: 'Allow users to share public links to files and images.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.PUBLIC_LINKS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_GENERATED,
                        key: 'FileSettings.PublicLinkSalt',
                        label: t('admin.image.publicLinkTitle'),
                        label_default: 'Public Link Salt:',
                        help_text: t('admin.image.publicLinkDescription'),
                        help_text_default: '32-character salt added to signing of public image links. Randomly generated on install. Click "Regenerate" to create new salt.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.PUBLIC_LINKS)),
                    },
                ],
            },
        },
        notices: {
            url: 'site_config/notices',
            title: t('admin.sidebar.notices'),
            title_default: 'Notices',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.NOTICES)),
            schema: {
                id: 'NoticesSettings',
                name: t('admin.site.notices'),
                name_default: 'Notices',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'AnnouncementSettings.AdminNoticesEnabled',
                        label: t('admin.notices.enableAdminNoticesTitle'),
                        label_default: 'Enable Admin Notices: ',
                        help_text: t('admin.notices.enableAdminNoticesDescription'),
                        help_text_default: 'When enabled, System Admins will receive notices about available server upgrades and relevant system administration features. <link>Learn more about notices</link> in our documentation.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/manage/in-product-notices.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTICES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'AnnouncementSettings.UserNoticesEnabled',
                        label: t('admin.notices.enableEndUserNoticesTitle'),
                        label_default: 'Enable End User Notices: ',
                        help_text: t('admin.notices.enableEndUserNoticesDescription'),
                        help_text_default: 'When enabled, all users will receive notices about available client upgrades and relevant end user features to improve user experience. <link>Learn more about notices</link> in our documentation.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/manage/in-product-notices.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTICES)),
                    },
                ],
            },
        },
    },
    authentication: {
        icon: (
            <ShieldOutlineIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.authentication'),
        sectionTitleDefault: 'Authentication',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.AUTHENTICATION)),
        signup: {
            url: 'authentication/signup',
            title: t('admin.sidebar.signup'),
            title_default: 'Signup',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
            schema: {
                id: 'SignupSettings',
                name: t('admin.authentication.signup'),
                name_default: 'Signup',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.EnableUserCreation',
                        label: t('admin.team.userCreationTitle'),
                        label_default: 'Enable Account Creation: ',
                        help_text: t('admin.team.userCreationDescription'),
                        help_text_default: 'When false, the ability to create accounts is disabled. The create account button displays error when pressed.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'TeamSettings.RestrictCreationToDomains',
                        label: t('admin.team.restrictTitle'),
                        label_default: 'Restrict new system and team members to specified email domains:',
                        help_text: t('admin.team.restrictDescription'),
                        help_text_default: 'New user accounts are restricted to the above specified email domain (e.g. "mattermost.com") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.com"). New teams can only be created by users from the above domain(s). This setting only affects email login for users.',
                        placeholder: t('admin.team.restrictExample'),
                        placeholder_default: 'E.g.: "corp.mattermost.com, mattermost.com"',
                        isHidden: it.all(
                            it.licensed,
                            it.not(it.licensedForSku('starter')),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'TeamSettings.RestrictCreationToDomains',
                        label: t('admin.team.restrictTitle'),
                        label_default: 'Restrict new system and team members to specified email domains:',
                        help_text: t('admin.team.restrictGuestDescription'),
                        help_text_default: 'New user accounts are restricted to the above specified email domain (e.g. "mattermost.com") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.com"). New teams can only be created by users from the above domain(s). This setting affects email login for users. For Guest users, please add domains under Signup > Guest Access.',
                        placeholder: t('admin.team.restrictExample'),
                        placeholder_default: 'E.g.: "corp.mattermost.com, mattermost.com"',
                        isHidden: it.any(
                            it.not(it.licensed),
                            it.licensedForSku('starter'),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.EnableOpenServer',
                        label: t('admin.team.openServerTitle'),
                        label_default: 'Enable Open Server: ',
                        help_text: t('admin.team.openServerDescription'),
                        help_text_default: 'When true, anyone can signup for a user account on this server without the need to be invited.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableEmailInvitations',
                        label: t('admin.team.emailInvitationsTitle'),
                        label_default: 'Enable Email Invitations: ',
                        help_text: t('admin.team.emailInvitationsDescription'),
                        help_text_default: 'When true users can invite others to the system using email.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BUTTON,
                        key: 'InvalidateEmailInvitesButton',
                        action: invalidateAllEmailInvites,
                        label: t('admin.team.invalidateEmailInvitesTitle'),
                        label_default: 'Invalidate pending email invites',
                        help_text: t('admin.team.invalidateEmailInvitesDescription'),
                        help_text_default: 'This will invalidate active email invitations that have not been accepted by the user.  By default email invitations expire after 48 hours.',
                        error_message: t('admin.team.invalidateEmailInvitesFail'),
                        error_message_default: 'Unable to invalidate pending email invites: {error}',
                        success_message: t('admin.team.invalidateEmailInvitesSuccess'),
                        success_message_default: 'Pending email invitations invalidated successfully',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                    },
                ],
            },
        },
        email: {
            url: 'authentication/email',
            title: t('admin.sidebar.email'),
            title_default: 'Email',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
            schema: {
                id: 'EmailSettings',
                name: t('admin.authentication.email'),
                name_default: 'Email',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.EnableSignUpWithEmail',
                        label: t('admin.email.allowSignupTitle'),
                        label_default: 'Enable account creation with email:',
                        help_text: t('admin.email.allowSignupDescription'),
                        help_text_default: 'When true, Mattermost allows account creation using email and password. This value should be false only when you want to limit sign up to a single sign-on service like AD/LDAP, SAML or GitLab.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.RequireEmailVerification',
                        label: t('admin.email.requireVerificationTitle'),
                        label_default: 'Require Email Verification: ',
                        help_text: t('admin.email.requireVerificationDescription'),
                        help_text_default: 'Typically set to true in production. When true, Mattermost requires email verification after account creation prior to allowing login. Developers may set this field to false to skip sending verification emails for faster development.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.EnableSignInWithEmail',
                        label: t('admin.email.allowEmailSignInTitle'),
                        label_default: 'Enable sign-in with email:',
                        help_text: t('admin.email.allowEmailSignInDescription'),
                        help_text_default: 'When true, Mattermost allows users to sign in using their email and password.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.EnableSignInWithUsername',
                        label: t('admin.email.allowUsernameSignInTitle'),
                        label_default: 'Enable sign-in with username:',
                        help_text: t('admin.email.allowUsernameSignInDescription'),
                        help_text_default: 'When true, users with email login can sign in using their username and password. This setting does not affect AD/LDAP login.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                    },
                ],
            },
        },
        password: {
            url: 'authentication/password',
            title: t('admin.sidebar.password'),
            title_default: 'Password',
            searchableStrings: [
                'user.settings.security.passwordMinLength',
                'admin.security.password',
                ['admin.password.minimumLength', {max: '', min: ''}],
                ['admin.password.minimumLengthDescription', {max: '', min: ''}],
                'passwordRequirements',
                'admin.password.lowercase',
                'admin.password.uppercase',
                'admin.password.number',
                'admin.password.symbol',
                'admin.password.preview',
                'admin.service.attemptTitle',
                'admin.service.attemptDescription',
            ],
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.PASSWORD)),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.PASSWORD)),
            schema: {
                id: 'PasswordSettings',
                component: PasswordSettings,
            },
        },
        mfa: {
            url: 'authentication/mfa',
            title: t('admin.sidebar.mfa'),
            title_default: 'MFA',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.MFA)),
            schema: {
                id: 'ServiceSettings',
                name: t('admin.authentication.mfa'),
                name_default: 'Multi-factor Authentication',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BANNER,
                        label: t('admin.mfa.bannerDesc'),
                        label_default: '<link>Multi-factor authentication</link> is available for accounts with AD/LDAP or email login. If other login methods are used, MFA should be configured with the authentication provider.',
                        label_markdown: false,
                        label_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/deployment/auth.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        banner_type: 'info',
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableMultifactorAuthentication',
                        label: t('admin.service.mfaTitle'),
                        label_default: 'Enable Multi-factor Authentication:',
                        help_text: t('admin.service.mfaDesc'),
                        help_text_default: 'When true, users with AD/LDAP or email login can add multi-factor authentication to their account using Google Authenticator.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.MFA)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnforceMultifactorAuthentication',
                        label: t('admin.service.enforceMfaTitle'),
                        label_default: 'Enforce Multi-factor Authentication:',
                        help_text: t('admin.service.enforceMfaDesc'),
                        help_text_markdown: false,
                        help_text_default: 'When true, <link>multi-factor authentication</link> is required for login. New users will be required to configure MFA on signup. Logged in users without MFA configured are redirected to the MFA setup page until configuration is complete.\n \nIf your system has users with login methods other than AD/LDAP and email, MFA must be enforced with the authentication provider outside of Mattermost.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/deployment/auth.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isHidden: it.not(it.licensedForFeature('MFA')),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.MFA)),
                            it.stateIsFalse('ServiceSettings.EnableMultifactorAuthentication'),
                        ),
                    },
                ],
            },
        },
        ldap: {
            url: 'authentication/ldap',
            title: t('admin.sidebar.ldap'),
            title_default: 'AD/LDAP',
            isHidden: it.any(
                it.not(it.licensedForFeature('LDAP')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
            ),
            schema: {
                id: 'LdapSettings',
                name: t('admin.authentication.ldap'),
                name_default: 'AD/LDAP',
                sections: [
                    {
                        title: 'Connection',
                        subtitle: 'Connection and security level to your AD/LDAP server.',
                        settings: [
                            {
                                type: Constants.SettingsTypes.TYPE_BOOL,
                                key: 'LdapSettings.Enable',
                                label: t('admin.ldap.enableTitle'),
                                label_default: 'Enable sign-in with AD/LDAP:',
                                help_text: t('admin.ldap.enableDesc'),
                                help_text_default: 'When true, Mattermost allows login using AD/LDAP',
                                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_BOOL,
                                key: 'LdapSettings.EnableSync',
                                label: t('admin.ldap.enableSyncTitle'),
                                label_default: 'Enable Synchronization with AD/LDAP:',
                                help_text: t('admin.ldap.enableSyncDesc'),
                                help_text_default: 'When true, Mattermost periodically synchronizes users from AD/LDAP. When false, user attributes are updated from AD/LDAP during user login only.',
                                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.LoginFieldName',
                                label: t('admin.ldap.loginNameTitle'),
                                label_default: 'Login Field Name:',
                                placeholder: t('admin.ldap.loginNameEx'),
                                placeholder_default: 'E.g.: "AD/LDAP Username"',
                                help_text: t('admin.ldap.loginNameDesc'),
                                help_text_default: 'The placeholder text that appears in the login field on the login page. Defaults to "AD/LDAP Username".',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.LdapServer',
                                label: t('admin.ldap.serverTitle'),
                                label_default: 'AD/LDAP Server:',
                                help_text: t('admin.ldap.serverDesc'),
                                help_text_default: 'The domain or IP address of AD/LDAP server.',
                                placeholder: t('admin.ldap.serverEx'),
                                placeholder_default: 'E.g.: "10.0.0.23"',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_NUMBER,
                                key: 'LdapSettings.LdapPort',
                                label: t('admin.ldap.portTitle'),
                                label_default: 'AD/LDAP Port:',
                                help_text: t('admin.ldap.portDesc'),
                                help_text_default: 'The port Mattermost will use to connect to the AD/LDAP server. Default is 389.',
                                placeholder: t('admin.ldap.portEx'),
                                placeholder_default: 'E.g.: "389"',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_DROPDOWN,
                                key: 'LdapSettings.ConnectionSecurity',
                                label: t('admin.connectionSecurityTitle'),
                                label_default: 'Connection Security:',
                                help_text: DefinitionConstants.CONNECTION_SECURITY_HELP_TEXT_LDAP,
                                options: [
                                    {
                                        value: '',
                                        display_name: t('admin.connectionSecurityNone'),
                                        display_name_default: 'None',
                                    },
                                    {
                                        value: 'TLS',
                                        display_name: t('admin.connectionSecurityTls'),
                                        display_name_default: 'TLS (Recommended)',
                                    },
                                    {
                                        value: 'STARTTLS',
                                        display_name: t('admin.connectionSecurityStart'),
                                        display_name_default: 'STARTTLS',
                                    },
                                ],
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_BOOL,
                                key: 'LdapSettings.SkipCertificateVerification',
                                label: t('admin.ldap.skipCertificateVerification'),
                                label_default: 'Skip Certificate Verification:',
                                help_text: t('admin.ldap.skipCertificateVerificationDesc'),
                                help_text_default: 'Skips the certificate verification step for TLS or STARTTLS connections. Skipping certificate verification is not recommended for production environments where TLS is required.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.stateIsFalse('LdapSettings.ConnectionSecurity'),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_FILE_UPLOAD,
                                key: 'LdapSettings.PrivateKeyFile',
                                label: t('admin.ldap.privateKeyFileTitle'),
                                label_default: 'Private Key:',
                                help_text: t('admin.ldap.privateKeyFileFileDesc'),
                                help_text_default: 'The private key file for TLS Certificate. If using TLS client certificates as primary authentication mechanism. This will be provided by your LDAP Authentication Provider.',
                                remove_help_text: t('admin.ldap.privateKeyFileFileRemoveDesc'),
                                remove_help_text_default: 'Remove the private key file for TLS Certificate.',
                                remove_button_text: t('admin.ldap.remove.privKey'),
                                remove_button_text_default: 'Remove TLS Certificate Private Key',
                                removing_text: t('admin.ldap.removing.privKey'),
                                removing_text_default: 'Removing Private Key...',
                                uploading_text: t('admin.ldap.uploading.privateKey'),
                                uploading_text_default: 'Uploading Private Key...',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                                fileType: '.key',
                                upload_action: uploadPrivateLdapCertificate,
                                remove_action: removePrivateLdapCertificate,
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_FILE_UPLOAD,
                                key: 'LdapSettings.PublicCertificateFile',
                                label: t('admin.ldap.publicCertificateFileTitle'),
                                label_default: 'Public Certificate:',
                                help_text: t('admin.ldap.publicCertificateFileDesc'),
                                help_text_default: 'The public certificate file for TLS Certificate. If using TLS client certificates as primary authentication mechanism.  This will be provided by your LDAP Authentication Provider.',
                                remove_help_text: t('admin.ldap.publicCertificateFileRemoveDesc'),
                                remove_help_text_default: 'Remove the public certificate file for TLS Certificate.',
                                remove_button_text: t('admin.ldap.remove.sp_certificate'),
                                remove_button_text_default: 'Remove Service Provider Certificate',
                                removing_text: t('admin.ldap.removing.certificate'),
                                removing_text_default: 'Removing Certificate...',
                                uploading_text: t('admin.ldap.uploading.certificate'),
                                uploading_text_default: 'Uploading Certificate...',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                                fileType: '.crt,.cer',
                                upload_action: uploadPublicLdapCertificate,
                                remove_action: removePublicLdapCertificate,
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.BindUsername',
                                label: t('admin.ldap.bindUserTitle'),
                                label_default: 'Bind Username:',
                                help_text: t('admin.ldap.bindUserDesc'),
                                help_text_default: 'The username used to perform the AD/LDAP search. This should typically be an account created specifically for use with Mattermost. It should have access limited to read the portion of the AD/LDAP tree specified in the Base DN field.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.BindPassword',
                                label: t('admin.ldap.bindPwdTitle'),
                                label_default: 'Bind Password:',
                                help_text: t('admin.ldap.bindPwdDesc'),
                                help_text_default: 'Password of the user given in "Bind Username".',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                        ],
                    },
                    {
                        title: 'Base DN & Filters',
                        settings: [
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.BaseDN',
                                label: t('admin.ldap.baseTitle'),
                                label_default: 'Base DN:',
                                help_text: t('admin.ldap.baseDesc'),
                                help_text_default: 'The Base DN is the Distinguished Name of the location where Mattermost should start its search for user and group objects in the AD/LDAP tree.',
                                placeholder: t('admin.ldap.baseEx'),
                                placeholder_default: 'E.g.: "ou=Unit Name,dc=corp,dc=example,dc=com"',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.UserFilter',
                                label: t('admin.ldap.userFilterTitle'),
                                label_default: 'User Filter:',
                                help_text: t('admin.ldap.userFilterDisc'),
                                help_text_default: '(Optional) Enter an AD/LDAP filter to use when searching for user objects. Only the users selected by the query will be able to access Mattermost. For Active Directory, the query to filter out disabled users is (&(objectCategory=Person)(!(UserAccountControl:1.2.840.113556.1.4.803:=2))).',
                                placeholder: t('admin.ldap.userFilterEx'),
                                placeholder_default: 'Ex. "(objectClass=user)"',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.GroupFilter',
                                label: t('admin.ldap.groupFilterTitle'),
                                label_default: 'Group Filter:',
                                help_text: t('admin.ldap.groupFilterFilterDesc'),
                                help_text_markdown: true,
                                help_text_default: '(Optional) Enter an AD/LDAP filter to use when searching for group objects. Only the groups selected by the query will be available to Mattermost. From [User Management > Groups]({siteURL}/admin_console/user_management/groups), select which AD/LDAP groups should be linked and configured.',
                                help_text_values: {siteURL: getSiteURL()},
                                placeholder: t('admin.ldap.groupFilterEx'),
                                placeholder_default: 'E.g.: "(objectClass=group)"',
                                isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.stateIsFalse('LdapSettings.EnableSync'),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_BOOL,
                                key: 'LdapSettings.EnableAdminFilter',
                                label: t('admin.ldap.enableAdminFilterTitle'),
                                label_default: 'Enable Admin Filter:',
                                isDisabled: it.any(
                                    it.not(it.isSystemAdmin),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.AdminFilter',
                                label: t('admin.ldap.adminFilterTitle'),
                                label_default: 'Admin Filter:',
                                help_text: t('admin.ldap.adminFilterFilterDesc'),
                                help_text_default: '(Optional) Enter an AD/LDAP filter to use for designating System Admins. The users selected by the query will have access to your Mattermost server as System Admins. By default, System Admins have complete access to the Mattermost System Console.\n \nExisting members that are identified by this attribute will be promoted from member to System Admin upon next login. The next login is based upon Session lengths set in **System Console > Session Lengths**. It is highly recommend to manually demote users to members in **System Console > User Management** to ensure access is restricted immediately.\n \nNote: If this filter is removed/changed, System Admins that were promoted via this filter will be demoted to members and will not retain access to the System Console. When this filter is not in use, System Admins can be manually promoted/demoted in **System Console > User Management**.',
                                help_text_markdown: true,
                                placeholder: t('admin.ldap.adminFilterEx'),
                                placeholder_default: 'E.g.: "(objectClass=user)"',
                                isDisabled: it.any(
                                    it.not(it.isSystemAdmin),
                                    it.stateIsFalse('LdapSettings.EnableAdminFilter'),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.GuestFilter',
                                label: t('admin.ldap.guestFilterTitle'),
                                label_default: 'Guest Filter:',
                                help_text: t('admin.ldap.guestFilterFilterDesc'),
                                help_text_default: '(Optional) Requires Guest Access to be enabled before being applied. Enter an AD/LDAP filter to use when searching for guest objects. Only the users selected by the query will be able to access Mattermost as Guests. Guests are prevented from accessing teams or channels upon logging in until they are assigned a team and at least one channel.\n \nNote: If this filter is removed/changed, active guests will not be promoted to a member and will retain their Guest role. Guests can be promoted in **System Console > User Management**.\n \n \nExisting members that are identified by this attribute as a guest will be demoted from a member to a guest when they are asked to login next. The next login is based upon Session lengths set in **System Console > Session Lengths**. It is highly recommend to manually demote users to guests in **System Console > User Management ** to ensure access is restricted immediately.',
                                help_text_markdown: true,
                                placeholder: t('admin.ldap.guestFilterEx'),
                                placeholder_default: 'E.g.: "(objectClass=user)"',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.configIsFalse('GuestAccountsSettings', 'Enable'),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                        ],
                    },
                    {
                        title: 'Account Synchronization',
                        settings: [
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.IdAttribute',
                                label: t('admin.ldap.idAttrTitle'),
                                label_default: 'ID Attribute: ',
                                placeholder: t('admin.ldap.idAttrEx'),
                                placeholder_default: 'E.g.: "objectGUID" or "uid"',
                                help_text: t('admin.ldap.idAttrDesc'),
                                help_text_markdown: false,
                                help_text_default: 'The attribute in the AD/LDAP server used as a unique identifier in Mattermost. It should be an AD/LDAP attribute with a value that does not change such as `uid` for LDAP or `objectGUID` for Active Directory. If a user\'s ID Attribute changes, it will create a new Mattermost account unassociated with their old one.\n \nIf you need to change this field after users have already logged in, use the <link>mattermost ldap idmigrate</link> CLI tool.',
                                help_text_values: {
                                    link: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://docs.mattermost.com/manage/command-line-tools.html#mattermost-ldap-idmigrate'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                },
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateEquals('LdapSettings.Enable', false),
                                        it.stateEquals('LdapSettings.EnableSync', false),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.LoginIdAttribute',
                                label: t('admin.ldap.loginAttrTitle'),
                                label_default: 'Login ID Attribute: ',
                                placeholder: t('admin.ldap.loginIdAttrEx'),
                                placeholder_default: 'E.g.: "sAMAccountName"',
                                help_text: t('admin.ldap.loginAttrDesc'),
                                help_text_markdown: false,
                                help_text_default: 'The attribute in the AD/LDAP server used to log in to Mattermost. Normally this attribute is the same as the "Username Attribute" field above.\n \nIf your team typically uses domain/username to log in to other services with AD/LDAP, you may enter domain/username in this field to maintain consistency between sites.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.UsernameAttribute',
                                label: t('admin.ldap.usernameAttrTitle'),
                                label_default: 'Username Attribute:',
                                placeholder: t('admin.ldap.usernameAttrEx'),
                                placeholder_default: 'E.g.: "sAMAccountName"',
                                help_text: t('admin.ldap.usernameAttrDesc'),
                                help_text_default: 'The attribute in the AD/LDAP server used to populate the username field in Mattermost. This may be the same as the Login ID Attribute.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.EmailAttribute',
                                label: t('admin.ldap.emailAttrTitle'),
                                label_default: 'Email Attribute:',
                                placeholder: t('admin.ldap.emailAttrEx'),
                                placeholder_default: 'E.g.: "mail" or "userPrincipalName"',
                                help_text: t('admin.ldap.emailAttrDesc'),
                                help_text_default: 'The attribute in the AD/LDAP server used to populate the email address field in Mattermost.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.FirstNameAttribute',
                                label: t('admin.ldap.firstnameAttrTitle'),
                                label_default: 'First Name Attribute:',
                                placeholder: t('admin.ldap.firstnameAttrEx'),
                                placeholder_default: 'E.g.: "givenName"',
                                help_text: t('admin.ldap.firstnameAttrDesc'),
                                help_text_default: '(Optional) The attribute in the AD/LDAP server used to populate the first name of users in Mattermost. When set, users cannot edit their first name, since it is synchronized with the LDAP server. When left blank, users can set their first name in <strong>Account Menu > Account Settings > Profile</strong>.',
                                help_text_values: {
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.LastNameAttribute',
                                label: t('admin.ldap.lastnameAttrTitle'),
                                label_default: 'Last Name Attribute:',
                                placeholder: t('admin.ldap.lastnameAttrEx'),
                                placeholder_default: 'E.g.: "sn"',
                                help_text: t('admin.ldap.lastnameAttrDesc'),
                                help_text_default: '(Optional) The attribute in the AD/LDAP server used to populate the last name of users in Mattermost. When set, users cannot edit their last name, since it is synchronized with the LDAP server. When left blank, users can set their last name in <strong>Account Menu > Account Settings > Profile</strong>.',
                                help_text_values: {
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.NicknameAttribute',
                                label: t('admin.ldap.nicknameAttrTitle'),
                                label_default: 'Nickname Attribute:',
                                placeholder: t('admin.ldap.nicknameAttrEx'),
                                placeholder_default: 'E.g.: "nickname"',
                                help_text: t('admin.ldap.nicknameAttrDesc'),
                                help_text_default: '(Optional) The attribute in the AD/LDAP server used to populate the nickname of users in Mattermost. When set, users cannot edit their nickname, since it is synchronized with the LDAP server. When left blank, users can set their nickname in <strong>Account Menu > Account Settings > Profile</strong>.',
                                help_text_values: {
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.PositionAttribute',
                                label: t('admin.ldap.positionAttrTitle'),
                                label_default: 'Position Attribute:',
                                placeholder: t('admin.ldap.positionAttrEx'),
                                placeholder_default: 'E.g.: "title"',
                                help_text: t('admin.ldap.positionAttrDesc'),
                                help_text_default: '(Optional) The attribute in the AD/LDAP server used to populate the position field in Mattermost. When set, users cannot edit their position, since it is synchronized with the LDAP server. When left blank, users can set their position in <strong>Account Menu > Account Settings > Profile</strong>.',
                                help_text_values: {
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.PictureAttribute',
                                label: t('admin.ldap.pictureAttrTitle'),
                                label_default: 'Profile Picture Attribute:',
                                placeholder: t('admin.ldap.pictureAttrEx'),
                                placeholder_default: 'E.g.: "thumbnailPhoto" or "jpegPhoto"',
                                help_text: t('admin.ldap.pictureAttrDesc'),
                                help_text_default: 'The attribute in the AD/LDAP server used to populate the profile picture in Mattermost.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                        ],
                    },
                    {
                        title: 'Group Synchronization',
                        settings: [
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.GroupDisplayNameAttribute',
                                label: t('admin.ldap.groupDisplayNameAttributeTitle'),
                                label_default: 'Group Display Name Attribute:',
                                help_text: t('admin.ldap.groupDisplayNameAttributeDesc'),
                                help_text_default: 'The attribute in the AD/LDAP server used to populate the group display names.',
                                placeholder: t('admin.ldap.groupDisplayNameAttributeEx'),
                                placeholder_default: 'E.g.: "cn"',
                                isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.stateIsFalse('LdapSettings.EnableSync'),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_TEXT,
                                key: 'LdapSettings.GroupIdAttribute',
                                label: t('admin.ldap.groupIdAttributeTitle'),
                                label_default: 'Group ID Attribute:',
                                help_text: t('admin.ldap.groupIdAttributeDesc'),
                                help_text_default: 'The attribute in the AD/LDAP server used as a unique identifier for Groups. This should be a AD/LDAP attribute with a value that does not change such as `entryUUID` for LDAP or `objectGUID` for Active Directory.',
                                help_text_markdown: true,
                                placeholder: t('admin.ldap.groupIdAttributeEx'),
                                placeholder_default: 'E.g.: "objectGUID" or "entryUUID"',
                                isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.stateIsFalse('LdapSettings.EnableSync'),
                                ),
                            },
                        ],
                    },
                    {
                        title: 'Synchronization Performance',
                        settings: [
                            {
                                type: Constants.SettingsTypes.TYPE_NUMBER,
                                key: 'LdapSettings.SyncIntervalMinutes',
                                label: t('admin.ldap.syncIntervalTitle'),
                                label_default: 'Synchronization Interval (minutes):',
                                help_text: t('admin.ldap.syncIntervalHelpText'),
                                help_text_default: 'AD/LDAP Synchronization updates Mattermost user information to reflect updates on the AD/LDAP server. For example, when a user\'s name changes on the AD/LDAP server, the change updates in Mattermost when synchronization is performed. Accounts removed from or disabled in the AD/LDAP server have their Mattermost accounts set to "Inactive" and have their account sessions revoked. Mattermost performs synchronization on the interval entered. For example, if 60 is entered, Mattermost synchronizes every 60 minutes.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_NUMBER,
                                key: 'LdapSettings.MaxPageSize',
                                label: t('admin.ldap.maxPageSizeTitle'),
                                label_default: 'Maximum Page Size:',
                                placeholder: t('admin.ldap.maxPageSizeEx'),
                                placeholder_default: 'E.g.: "2000"',
                                help_text: t('admin.ldap.maxPageSizeHelpText'),
                                help_text_default: 'The maximum number of users the Mattermost server will request from the AD/LDAP server at one time. 0 is unlimited.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_NUMBER,
                                key: 'LdapSettings.QueryTimeout',
                                label: t('admin.ldap.queryTitle'),
                                label_default: 'Query Timeout (seconds):',
                                placeholder: t('admin.ldap.queryEx'),
                                placeholder_default: 'E.g.: "60"',
                                help_text: t('admin.ldap.queryDesc'),
                                help_text_default: 'The timeout value for queries to the AD/LDAP server. Increase if you are getting timeout errors caused by a slow AD/LDAP server.',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                            {
                                type: Constants.SettingsTypes.TYPE_BUTTON,
                                action: ldapTest,
                                key: 'LdapSettings.LdapTest',
                                label: t('admin.ldap.ldap_test_button'),
                                label_default: 'AD/LDAP Test',
                                help_text: t('admin.ldap.testHelpText'),
                                help_text_default: 'Tests if the Mattermost server can connect to the AD/LDAP server specified. Please review "System Console > Logs" and <link>documentation</link> to troubleshoot errors.',
                                help_text_values: {
                                    link: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://mattermost.com/default-ldap-docs'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                },
                                help_text_markdown: false,
                                error_message: t('admin.ldap.testFailure'),
                                error_message_default: 'AD/LDAP Test Failure: {error}',
                                success_message: t('admin.ldap.testSuccess'),
                                success_message_default: 'AD/LDAP Test Successful',
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.all(
                                        it.stateIsFalse('LdapSettings.Enable'),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                ),
                            },
                        ],
                    },
                    {
                        title: 'Synchronization History',
                        subtitle: 'See the table below for the status of each synchronization',
                        settings: [
                            {
                                type: Constants.SettingsTypes.TYPE_JOBSTABLE,
                                job_type: Constants.JobTypes.LDAP_SYNC,
                                label: t('admin.ldap.sync_button'),
                                label_default: 'AD/LDAP Synchronize Now',
                                help_text: t('admin.ldap.syncNowHelpText'),
                                help_text_markdown: false,
                                help_text_default: 'Initiates an AD/LDAP synchronization immediately. See the table below for status of each synchronization. Please review "System Console > Logs" and <link>documentation</link> to troubleshoot errors.',
                                help_text_values: {
                                    link: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://mattermost.com/default-ldap-docs'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                },
                                isDisabled: it.any(
                                    it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                    it.stateIsFalse('LdapSettings.EnableSync'),
                                ),
                                render_job: (job) => {
                                    let ldapUsers = 0;
                                    let deleteCount = 0;
                                    let updateCount = 0;
                                    let linkedLdapGroupsCount; // Deprecated.
                                    let totalLdapGroupsCount = 0;
                                    let groupDeleteCount = 0;
                                    let groupMemberDeleteCount = 0;
                                    let groupMemberAddCount = 0;

                                    if (job && job.data) {
                                        if (job.data.ldap_users_count && job.data.ldap_users_count.length > 0) {
                                            ldapUsers = job.data.ldap_users_count;
                                        }

                                        if (job.data.delete_count && job.data.delete_count.length > 0) {
                                            deleteCount = job.data.delete_count;
                                        }

                                        if (job.data.update_count && job.data.update_count.length > 0) {
                                            updateCount = job.data.update_count;
                                        }

                                        // Deprecated groups count representing the number of linked LDAP groups.
                                        if (job.data.ldap_groups_count) {
                                            linkedLdapGroupsCount = job.data.ldap_groups_count;
                                        }

                                        // Groups count representing the total number of LDAP groups available based on
                                        // the configured based DN and groups filter.
                                        if (job.data.total_ldap_groups_count) {
                                            totalLdapGroupsCount = job.data.total_ldap_groups_count;
                                        }

                                        if (job.data.group_delete_count) {
                                            groupDeleteCount = job.data.group_delete_count;
                                        }

                                        if (job.data.group_member_delete_count) {
                                            groupMemberDeleteCount = job.data.group_member_delete_count;
                                        }

                                        if (job.data.group_member_add_count) {
                                            groupMemberAddCount = job.data.group_member_add_count;
                                        }
                                    }

                                    return (
                                        <span>
                                            <FormattedMessage
                                                id={linkedLdapGroupsCount ? 'admin.ldap.jobExtraInfo' : 'admin.ldap.jobExtraInfoTotal'}
                                                defaultMessage={linkedLdapGroupsCount ? 'Scanned {ldapUsers, number} LDAP users and {ldapGroups, number} linked groups.' : 'Scanned {ldapUsers, number} LDAP users and {ldapGroups, number} groups.'}
                                                values={{
                                                    ldapUsers,
                                                    ldapGroups: linkedLdapGroupsCount || totalLdapGroupsCount, // Show the old count for jobs records containing the old JSON key.
                                                }}
                                            />
                                            <ul>
                                                {updateCount > 0 &&
                                                <li>
                                                    <FormattedMessage
                                                        id='admin.ldap.jobExtraInfo.updatedUsers'
                                                        defaultMessage='Updated {updateCount, number} users.'
                                                        values={{
                                                            updateCount,
                                                        }}
                                                    />
                                                </li>
                                                }
                                                {deleteCount > 0 &&
                                                <li>
                                                    <FormattedMessage
                                                        id='admin.ldap.jobExtraInfo.deactivatedUsers'
                                                        defaultMessage='Deactivated {deleteCount, number} users.'
                                                        values={{
                                                            deleteCount,
                                                        }}
                                                    />
                                                </li>
                                                }
                                                {groupDeleteCount > 0 &&
                                                <li>
                                                    <FormattedMessage
                                                        id='admin.ldap.jobExtraInfo.deletedGroups'
                                                        defaultMessage='Deleted {groupDeleteCount, number} groups.'
                                                        values={{
                                                            groupDeleteCount,
                                                        }}
                                                    />
                                                </li>
                                                }
                                                {groupMemberDeleteCount > 0 &&
                                                <li>
                                                    <FormattedMessage
                                                        id='admin.ldap.jobExtraInfo.deletedGroupMembers'
                                                        defaultMessage='Deleted {groupMemberDeleteCount, number} group members.'
                                                        values={{
                                                            groupMemberDeleteCount,
                                                        }}
                                                    />
                                                </li>
                                                }
                                                {groupMemberAddCount > 0 &&
                                                <li>
                                                    <FormattedMessage
                                                        id='admin.ldap.jobExtraInfo.addedGroupMembers'
                                                        defaultMessage='Added {groupMemberAddCount, number} group members.'
                                                        values={{
                                                            groupMemberAddCount,
                                                        }}
                                                    />
                                                </li>
                                                }
                                            </ul>
                                        </span>
                                    );
                                },
                            },
                        ],
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        ldap_feature_discovery: {
            url: 'authentication/ldap',
            isDiscovery: true,
            title: t('admin.sidebar.ldap'),
            title_default: 'AD/LDAP',
            isHidden: it.any(
                it.licensedForFeature('LDAP'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'LdapSettings',
                name: t('admin.authentication.ldap'),
                name_default: 'AD/LDAP',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: LDAPFeatureDiscovery,
                        key: 'LDAPFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true),
        },
        saml: {
            url: 'authentication/saml',
            title: t('admin.sidebar.saml'),
            title_default: 'SAML 2.0',
            isHidden: it.any(
                it.not(it.licensedForFeature('SAML')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
            ),
            schema: {
                id: 'SamlSettings',
                name: t('admin.authentication.saml'),
                name_default: 'SAML 2.0',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.Enable',
                        label: t('admin.saml.enableTitle'),
                        label_default: 'Enable Login With SAML 2.0:',
                        help_text: t('admin.saml.enableDescription'),
                        help_text_default: 'When true, Mattermost allows login using SAML 2.0. Please see <link>documentation</link> to learn more about configuring SAML for Mattermost.',
                        help_text_markdown: false,
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='http://docs.mattermost.com/deployment/sso-saml.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.EnableSyncWithLdap',
                        label: t('admin.saml.enableSyncWithLdapTitle'),
                        label_default: 'Enable Synchronizing SAML Accounts With AD/LDAP:',
                        help_text: t('admin.saml.enableSyncWithLdapDescription'),
                        help_text_default: 'When true, Mattermost periodically synchronizes SAML user attributes, including user deactivation and removal, from AD/LDAP. Enable and configure synchronization settings at <strong>Authentication > AD/LDAP</strong>. When false, user attributes are updated from SAML during user login. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/onboard/ad-ldap.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            strong: (msg) => <strong>{msg}</strong>,
                        },
                        help_text_markdown: false,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.IgnoreGuestsLdapSync',
                        label: t('admin.saml.ignoreGuestsLdapSyncTitle'),
                        label_default: 'Ignore Guest Users when  Synchronizing with AD/LDAP',
                        help_text: t('admin.saml.ignoreGuestsLdapSyncDesc'),
                        help_text_default: 'When true, Mattermost will ignore Guest Users who are identified by the Guest Attribute, when synchronizing with AD/LDAP for user deactivation and removal and Guest deactivation will need to be managed manually via System Console > Users.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.configIsFalse('GuestAccountsSettings', 'Enable'),
                            it.stateIsFalse('SamlSettings.EnableSyncWithLdap'),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.EnableSyncWithLdapIncludeAuth',
                        label: t('admin.saml.enableSyncWithLdapIncludeAuthTitle'),
                        label_default: 'Override SAML bind data with AD/LDAP information:',
                        help_text: t('admin.saml.enableSyncWithLdapIncludeAuthDescription'),
                        help_text_default: 'When true, Mattermost will override the SAML ID attribute with the AD/LDAP ID attribute if configured or override the SAML Email attribute with the AD/LDAP Email attribute if SAML ID attribute is not present.  This will allow you automatically migrate users from Email binding to ID binding to prevent creation of new users when an email address changes for a user. Moving from true to false, will remove the override from happening.\n \n<strong>Note:</strong> SAML IDs must match the LDAP IDs to prevent disabling of user accounts.  Please review <link>documentation</link> for more information.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/deployment/sso-saml-ldapsync.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            strong: (msg) => <strong>{msg}</strong>,
                        },
                        help_text_markdown: false,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                            it.stateIsFalse('SamlSettings.EnableSyncWithLdap'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.IdpMetadataURL',
                        label: t('admin.saml.idpMetadataUrlTitle'),
                        label_default: 'Identity Provider Metadata URL:',
                        help_text: t('admin.saml.idpMetadataUrlDesc'),
                        help_text_default: 'The Metadata URL for the Identity Provider you use for SAML requests',
                        placeholder: t('admin.saml.idpMetadataUrlEx'),
                        placeholder_default: 'E.g.: "https://idp.example.org/SAML2/saml/metadata"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BUTTON,
                        key: 'getSamlMetadataFromIDPButton',
                        action: getSamlMetadataFromIdp,
                        label: t('admin.saml.getSamlMetadataFromIDPUrl'),
                        label_default: 'Get SAML Metadata from IdP',
                        loading: t('admin.saml.getSamlMetadataFromIDPFetching'),
                        loading_default: 'Fetching...',
                        error_message: t('admin.saml.getSamlMetadataFromIDPFail'),
                        error_message_default: 'SAML Metadata URL did not connect and pull data successfully',
                        success_message: t('admin.saml.getSamlMetadataFromIDPSuccess'),
                        success_message_default: 'SAML Metadata retrieved successfully. Two fields below have been updated',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                            it.stateEquals('SamlSettings.IdpMetadataURL', ''),
                        ),
                        sourceUrlKey: 'SamlSettings.IdpMetadataURL',
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.IdpURL',
                        label: t('admin.saml.idpUrlTitle'),
                        label_default: 'SAML SSO URL:',
                        help_text: t('admin.saml.idpUrlDesc'),
                        help_text_default: 'The URL where Mattermost sends a SAML request to start login sequence.',
                        placeholder: t('admin.saml.idpUrlEx'),
                        placeholder_default: 'E.g.: "https://idp.example.org/SAML2/SSO/Login"',
                        setFromMetadataField: 'idp_url',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.IdpDescriptorURL',
                        label: t('admin.saml.idpDescriptorUrlTitle'),
                        label_default: 'Identity Provider Issuer URL:',
                        help_text: t('admin.saml.idpDescriptorUrlDesc'),
                        help_text_default: 'The issuer URL for the Identity Provider you use for SAML requests.',
                        placeholder: t('admin.saml.idpDescriptorUrlEx'),
                        placeholder_default: 'E.g.: "https://idp.example.org/SAML2/issuer"',
                        setFromMetadataField: 'idp_descriptor_url',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_FILE_UPLOAD,
                        key: 'SamlSettings.IdpCertificateFile',
                        label: t('admin.saml.idpCertificateFileTitle'),
                        label_default: 'Identity Provider Public Certificate:',
                        help_text: t('admin.saml.idpCertificateFileDesc'),
                        help_text_default: 'The public authentication certificate issued by your Identity Provider.',
                        remove_help_text: t('admin.saml.idpCertificateFileRemoveDesc'),
                        remove_help_text_default: 'Remove the public authentication certificate issued by your Identity Provider.',
                        remove_button_text: t('admin.saml.remove.idp_certificate'),
                        remove_button_text_default: 'Remove Identity Provider Certificate',
                        removing_text: t('admin.saml.removing.certificate'),
                        removing_text_default: 'Removing Certificate...',
                        uploading_text: t('admin.saml.uploading.certificate'),
                        uploading_text_default: 'Uploading Certificate...',
                        fileType: '.crt,.cer,.cert,.pem',
                        upload_action: uploadIdpSamlCertificate,
                        set_action: setSamlIdpCertificateFromMetadata,
                        remove_action: removeIdpSamlCertificate,
                        setFromMetadataField: 'idp_public_certificate',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.Verify',
                        label: t('admin.saml.verifyTitle'),
                        label_default: 'Verify Signature:',
                        help_text: t('admin.saml.verifyDescription'),
                        help_text_default: 'When false, Mattermost will not verify that the signature sent from a SAML Response matches the Service Provider Login URL. Disabling verification is not recommended for production environments.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.AssertionConsumerServiceURL',
                        label: t('admin.saml.assertionConsumerServiceURLTitle'),
                        label_default: 'Service Provider Login URL:',
                        help_text: t('admin.saml.assertionConsumerServiceURLPopulatedDesc'),
                        help_text_default: 'This field is also known as the Assertion Consumer Service URL.',
                        placeholder: t('admin.saml.assertionConsumerServiceURLEx'),
                        placeholder_default: 'E.g.: "https://<your-mattermost-url>/login/sso/saml"',
                        onConfigLoad: (value, config) => {
                            const siteUrl = config.ServiceSettings.SiteURL;
                            if (siteUrl.length > 0 && value.length === 0) {
                                const addSlashIfNeeded = siteUrl[siteUrl.length - 1] === '/' ? '' : '/';
                                return `${siteUrl}${addSlashIfNeeded}login/sso/saml`;
                            }
                            return value;
                        },
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.ServiceProviderIdentifier',
                        label: t('admin.saml.serviceProviderIdentifierTitle'),
                        label_default: 'Service Provider Identifier:',
                        help_text: t('admin.saml.serviceProviderIdentifierDesc'),
                        help_text_default: 'The unique identifier for the Service Provider, usually the same as Service Provider Login URL. In ADFS, this MUST match the Relying Party Identifier.',
                        placeholder: t('admin.saml.serviceProviderIdentifierEx'),
                        placeholder_default: "E.g.: \"https://'<your-mattermost-url>'/login/sso/saml\"",
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.Encrypt',
                        label: t('admin.saml.encryptTitle'),
                        label_default: 'Enable Encryption:',
                        help_text: t('admin.saml.encryptDescription'),
                        help_text_default: 'When false, Mattermost will not decrypt SAML Assertions encrypted with your Service Provider Public Certificate. Disabling encryption is not recommended for production environments.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_FILE_UPLOAD,
                        key: 'SamlSettings.PrivateKeyFile',
                        label: t('admin.saml.privateKeyFileTitle'),
                        label_default: 'Service Provider Private Key:',
                        help_text: t('admin.saml.privateKeyFileFileDesc'),
                        help_text_default: 'The private key used to decrypt SAML Assertions from the Identity Provider.',
                        remove_help_text: t('admin.saml.privateKeyFileFileRemoveDesc'),
                        remove_help_text_default: 'Remove the private key used to decrypt SAML Assertions from the Identity Provider.',
                        remove_button_text: t('admin.saml.remove.privKey'),
                        remove_button_text_default: 'Remove Service Provider Private Key',
                        removing_text: t('admin.saml.removing.privKey'),
                        removing_text_default: 'Removing Private Key...',
                        uploading_text: t('admin.saml.uploading.privateKey'),
                        uploading_text_default: 'Uploading Private Key...',
                        fileType: '.key',
                        upload_action: uploadPrivateSamlCertificate,
                        remove_action: removePrivateSamlCertificate,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                            it.stateIsFalse('SamlSettings.Encrypt'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_FILE_UPLOAD,
                        key: 'SamlSettings.PublicCertificateFile',
                        label: t('admin.saml.publicCertificateFileTitle'),
                        label_default: 'Service Provider Public Certificate:',
                        help_text: t('admin.saml.publicCertificateFileDesc'),
                        help_text_default: 'The certificate used to generate the signature on a SAML request to the Identity Provider for a service provider initiated SAML login, when Mattermost is the Service Provider.',
                        remove_help_text: t('admin.saml.publicCertificateFileRemoveDesc'),
                        remove_help_text_default: 'Remove the certificate used to generate the signature on a SAML request to the Identity Provider for a service provider initiated SAML login, when Mattermost is the Service Provider.',
                        remove_button_text: t('admin.saml.remove.sp_certificate'),
                        remove_button_text_default: 'Remove Service Provider Certificate',
                        removing_text: t('admin.saml.removing.certificate'),
                        removing_text_default: 'Removing Certificate...',
                        uploading_text: t('admin.saml.uploading.certificate'),
                        uploading_text_default: 'Uploading Certificate...',
                        fileType: '.crt,.cer',
                        upload_action: uploadPublicSamlCertificate,
                        remove_action: removePublicSamlCertificate,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                            it.stateIsFalse('SamlSettings.Encrypt'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.SignRequest',
                        label: t('admin.saml.signRequestTitle'),
                        label_default: 'Sign Request:',
                        help_text: t('admin.saml.signRequestDescription'),
                        help_text_default: 'When true, Mattermost will sign the SAML request using your private key. When false, Mattermost will not sign the SAML request.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Encrypt'),
                            it.stateIsFalse('SamlSettings.PrivateKeyFile'),
                            it.stateIsFalse('SamlSettings.PublicCertificateFile'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'SamlSettings.SignatureAlgorithm',
                        label: t('admin.saml.signatureAlgorithmTitle'),
                        label_default: 'Signature Algorithm',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Encrypt'),
                            it.stateIsFalse('SamlSettings.SignRequest'),
                        ),
                        options: [
                            {
                                value: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA1,
                                display_name: t('admin.saml.signatureAlgorithmDisplay.sha1'),
                                display_name_default: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA1,
                                help_text: t('admin.saml.signatureAlgorithmDescription.sha1'),
                                help_text_default: 'Specify the Signature algorithm used to sign the request (RSAwithSHA1). Please see more information provided at http://www.w3.org/2000/09/xmldsig#rsa-sha1',
                            },
                            {
                                value: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA256,
                                display_name: t('admin.saml.signatureAlgorithmDisplay.sha256'),
                                display_name_default: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA256,
                                help_text: t('admin.saml.signatureAlgorithmDescription.sha256'),
                                help_text_default: 'Specify the Signature algorithm used to sign the request (RSAwithSHA256). Please see more information provided at http://www.w3.org/2001/04/xmldsig-more#rsa-sha256 [section 6.4.2 RSA (PKCS#1 v1.5)]',
                            },
                            {
                                value: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA512,
                                display_name: t('admin.saml.signatureAlgorithmDisplay.sha512'),
                                display_name_default: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA512,
                                help_text: t('admin.saml.signatureAlgorithmDescription.sha512'),
                                help_text_default: 'Specify the Signature algorithm used to sign the request (RSAwithSHA512). Please see more information provided at http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
                            },
                        ],
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'SamlSettings.CanonicalAlgorithm',
                        label: t('admin.saml.canonicalAlgorithmTitle'),
                        label_default: 'Canonicalization Algorithm',
                        options: [
                            {
                                value: SAML_SETTINGS_CANONICAL_ALGORITHM_C14N,
                                display_name: t('admin.saml.canonicalAlgorithmDisplay.n10'),
                                display_name_default: 'Exclusive XML Canonicalization 1.0 (omit comments)',
                                help_text: t('admin.saml.canonicalAlgorithmDescription.exc'),
                                help_text_default: 'Specify the Canonicalization algorithm (Exclusive XML Canonicalization 1.0).  Please see more information provided at http://www.w3.org/2001/10/xml-exc-c14n#',
                            },
                            {
                                value: SAML_SETTINGS_CANONICAL_ALGORITHM_C14N11,
                                display_name: t('admin.saml.canonicalAlgorithmDisplay.n11'),
                                display_name_default: 'Canonical XML 1.1 (omit comments)',
                                help_text: t('admin.saml.canonicalAlgorithmDescription.c14'),
                                help_text_default: 'Specify the Canonicalization algorithm (Canonical XML 1.1).  Please see more information provided at http://www.w3.org/2006/12/xml-c14n11',
                            },
                        ],
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Encrypt'),
                            it.stateIsFalse('SamlSettings.SignRequest'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.EmailAttribute',
                        label: t('admin.saml.emailAttrTitle'),
                        label_default: 'Email Attribute:',
                        placeholder: t('admin.saml.emailAttrEx'),
                        placeholder_default: 'E.g.: "Email" or "PrimaryEmail"',
                        help_text: t('admin.saml.emailAttrDesc'),
                        help_text_default: 'The attribute in the SAML Assertion that will be used to populate the email addresses of users in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.UsernameAttribute',
                        label: t('admin.saml.usernameAttrTitle'),
                        label_default: 'Username Attribute:',
                        placeholder: t('admin.saml.usernameAttrEx'),
                        placeholder_default: 'E.g.: "Username"',
                        help_text: t('admin.saml.usernameAttrDesc'),
                        help_text_default: 'The attribute in the SAML Assertion that will be used to populate the username field in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.IdAttribute',
                        label: t('admin.saml.idAttrTitle'),
                        label_default: 'Id Attribute:',
                        placeholder: t('admin.saml.idAttrEx'),
                        placeholder_default: 'E.g.: "Id"',
                        help_text: t('admin.saml.idAttrDesc'),
                        help_text_default: '(Optional) The attribute in the SAML Assertion that will be used to bind users from SAML to users in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.GuestAttribute',
                        label: t('admin.saml.guestAttrTitle'),
                        label_default: 'Guest Attribute:',
                        placeholder: t('admin.saml.guestAttrEx'),
                        placeholder_default: 'E.g.: "usertype=Guest" or "isGuest=true"',
                        help_text: t('admin.saml.guestAttrDesc'),
                        help_text_default: '(Optional) Requires Guest Access to be enabled before being applied. The attribute in the SAML Assertion that will be used to apply a guest role to users in Mattermost. Guests are prevented from accessing teams or channels upon logging in until they are assigned a team and at least one channel.\n \nNote: If this attribute is removed/changed from your guest user in SAML and the user is still active, they will not be promoted to a member and will retain their Guest role. Guests can be promoted in **System Console > User Management**.\n \n \nExisting members that are identified by this attribute as a guest will be demoted from a member to a guest when they are asked to login next. The next login is based upon Session lengths set in **System Console > Session Lengths**. It is highly recommend to manually demote users to guests in **System Console > User Management ** to ensure access is restricted immediately.',
                        help_text_markdown: true,
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.configIsFalse('GuestAccountsSettings', 'Enable'),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'SamlSettings.EnableAdminAttribute',
                        label: t('admin.saml.enableAdminAttrTitle'),
                        label_default: 'Enable Admin Attribute:',
                        isDisabled: it.any(
                            it.not(it.isSystemAdmin),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.AdminAttribute',
                        label: t('admin.saml.adminAttrTitle'),
                        label_default: 'Admin Attribute:',
                        placeholder: t('admin.saml.adminAttrEx'),
                        placeholder_default: 'E.g.: "usertype=Admin" or "isAdmin=true"',
                        help_text: t('admin.saml.adminAttrDesc'),
                        help_text_default: '(Optional) The attribute in the SAML Assertion for designating System Admins. The users selected by the query will have access to your Mattermost server as System Admins. By default, System Admins have complete access to the Mattermost System Console.\n \nExisting members that are identified by this attribute will be promoted from member to System Admin upon next login. The next login is based upon Session lengths set in **System Console > Session Lengths.** It is highly recommend to manually demote users to members in **System Console > User Management** to ensure access is restricted immediately.\n \nNote: If this filter is removed/changed, System Admins that were promoted via this filter will be demoted to members and will not retain access to the System Console. When this filter is not in use, System Admins can be manually promoted/demoted in **System Console > User Management**.',
                        help_text_markdown: true,
                        isDisabled: it.any(
                            it.not(it.isSystemAdmin),
                            it.stateIsFalse('SamlSettings.EnableAdminAttribute'),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.FirstNameAttribute',
                        label: t('admin.saml.firstnameAttrTitle'),
                        label_default: 'First Name Attribute:',
                        placeholder: t('admin.saml.firstnameAttrEx'),
                        placeholder_default: 'E.g.: "FirstName"',
                        help_text: t('admin.saml.firstnameAttrDesc'),
                        help_text_default: '(Optional) The attribute in the SAML Assertion that will be used to populate the first name of users in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.LastNameAttribute',
                        label: t('admin.saml.lastnameAttrTitle'),
                        label_default: 'Last Name Attribute:',
                        placeholder: t('admin.saml.lastnameAttrEx'),
                        placeholder_default: 'E.g.: "LastName"',
                        help_text: t('admin.saml.lastnameAttrDesc'),
                        help_text_default: '(Optional) The attribute in the SAML Assertion that will be used to populate the last name of users in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.NicknameAttribute',
                        label: t('admin.saml.nicknameAttrTitle'),
                        label_default: 'Nickname Attribute:',
                        placeholder: t('admin.saml.nicknameAttrEx'),
                        placeholder_default: 'E.g.: "Nickname"',
                        help_text: t('admin.saml.nicknameAttrDesc'),
                        help_text_default: '(Optional) The attribute in the SAML Assertion that will be used to populate the nickname of users in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.PositionAttribute',
                        label: t('admin.saml.positionAttrTitle'),
                        label_default: 'Position Attribute:',
                        placeholder: t('admin.saml.positionAttrEx'),
                        placeholder_default: 'E.g.: "Role"',
                        help_text: t('admin.saml.positionAttrDesc'),
                        help_text_default: '(Optional) The attribute in the SAML Assertion that will be used to populate the position of users in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.LocaleAttribute',
                        label: t('admin.saml.localeAttrTitle'),
                        label_default: 'Preferred Language Attribute:',
                        placeholder: t('admin.saml.localeAttrEx'),
                        placeholder_default: 'E.g.: "Locale" or "PrimaryLanguage"',
                        help_text: t('admin.saml.localeAttrDesc'),
                        help_text_default: '(Optional) The attribute in the SAML Assertion that will be used to populate the language of users in Mattermost.',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'SamlSettings.LoginButtonText',
                        label: t('admin.saml.loginButtonTextTitle'),
                        label_default: 'Login Button Text:',
                        placeholder: t('admin.saml.loginButtonTextEx'),
                        placeholder_default: 'E.g.: "OKTA"',
                        help_text: t('admin.saml.loginButtonTextDesc'),
                        help_text_default: '(Optional) The text that appears in the login button on the login page. Defaults to "SAML".',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                            it.stateIsFalse('SamlSettings.Enable'),
                        ),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        saml_feature_discovery: {
            url: 'authentication/saml',
            isDiscovery: true,
            title: t('admin.sidebar.saml'),
            title_default: 'SAML 2.0',
            isHidden: it.any(
                it.licensedForFeature('SAML'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'SamlSettings',
                name: t('admin.authentication.saml'),
                name_default: 'SAML 2.0',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: SAMLFeatureDiscovery,
                        key: 'SAMLFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true),
        },
        gitlab: {
            url: 'authentication/gitlab',
            title: t('admin.sidebar.gitlab'),
            title_default: 'GitLab',
            isHidden: it.any(
                it.licensed,
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
            ),
            schema: {
                id: 'GitLabSettings',
                name: t('admin.authentication.gitlab'),
                name_default: 'GitLab',
                onConfigLoad: (config) => {
                    const newState = {};
                    newState['GitLabSettings.Url'] = config.GitLabSettings.UserAPIEndpoint.replace('/api/v4/user', '');
                    return newState;
                },
                onConfigSave: (config) => {
                    const newConfig = {...config};
                    newConfig.GitLabSettings.UserAPIEndpoint = config.GitLabSettings.Url.replace(/\/$/, '') + '/api/v4/user';
                    return newConfig;
                },
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'GitLabSettings.Enable',
                        label: t('admin.gitlab.enableTitle'),
                        label_default: 'Enable authentication with GitLab: ',
                        help_text: t('admin.gitlab.enableDescription'),
                        help_text_default: "When true, Mattermost allows team creation and account signup using GitLab OAuth.\n \n1. Log in to your GitLab account and go to Profile Settings -> Applications.\n2. Enter Redirect URIs \"'<your-mattermost-url>'/login/gitlab/complete\" (example: http://localhost:8065/login/gitlab/complete) and \"<your-mattermost-url>/signup/gitlab/complete\".\n3. Then use \"Application Secret Key\" and \"Application ID\" fields from GitLab to complete the options below.\n4. Complete the Endpoint URLs below.",
                        help_text_markdown: true,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Id',
                        label: t('admin.gitlab.clientIdTitle'),
                        label_default: 'Application ID:',
                        help_text: t('admin.gitlab.clientIdDescription'),
                        help_text_default: 'Obtain this value via the instructions above for logging into GitLab.',
                        placeholder: t('admin.gitlab.clientIdExample'),
                        placeholder_default: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                            it.stateIsFalse('GitLabSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Secret',
                        label: t('admin.gitlab.clientSecretTitle'),
                        label_default: 'Application Secret Key:',
                        help_text: t('admin.gitlab.clientSecretDescription'),
                        help_text_default: 'Obtain this value via the instructions above for logging into GitLab.',
                        placeholder: t('admin.gitlab.clientSecretExample'),
                        placeholder_default: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                            it.stateIsFalse('GitLabSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Url',
                        label: t('admin.gitlab.siteUrl'),
                        label_default: 'GitLab Site URL:',
                        help_text: t('admin.gitlab.siteUrlDescription'),
                        help_text_default: 'Enter the URL of your GitLab instance, e.g. https://example.com:3000. If your GitLab instance is not set up with SSL, start the URL with http:// instead of https://.',
                        placeholder: t('admin.gitlab.siteUrlExample'),
                        placeholder_default: 'E.g.: https://',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                            it.stateIsFalse('GitLabSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.UserAPIEndpoint',
                        label: t('admin.gitlab.userTitle'),
                        label_default: 'User API Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['GitLabSettings.Url']) {
                                return state['GitLabSettings.Url'].replace(/\/$/, '') + '/api/v4/user';
                            }
                            return '';
                        },
                        isDisabled: true,
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.AuthEndpoint',
                        label: t('admin.gitlab.authTitle'),
                        label_default: 'Auth Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['GitLabSettings.Url']) {
                                return state['GitLabSettings.Url'].replace(/\/$/, '') + '/oauth/authorize';
                            }
                            return '';
                        },
                        isDisabled: true,
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.TokenEndpoint',
                        label: t('admin.gitlab.tokenTitle'),
                        label_default: 'Token Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['GitLabSettings.Url']) {
                                return state['GitLabSettings.Url'].replace(/\/$/, '') + '/oauth/token';
                            }
                            return '';
                        },
                        isDisabled: true,
                    },
                ],
            },
        },
        oauth: {
            url: 'authentication/oauth',
            title: t('admin.sidebar.oauth'),
            title_default: 'OAuth 2.0',
            isHidden: it.any(
                it.any(
                    it.not(it.licensed),
                    it.licensedForSku('starter'),
                ),
                it.all(
                    it.licensedForFeature('OpenId'),
                    it.not(usesLegacyOauth),
                ),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
            ),
            schema: {
                id: 'OAuthSettings',
                name: t('admin.authentication.oauth'),
                name_default: 'OAuth 2.0',
                onConfigLoad: (config) => {
                    const newState = {};
                    if (config.GitLabSettings && config.GitLabSettings.Enable) {
                        newState.oauthType = Constants.GITLAB_SERVICE;
                    }
                    if (config.Office365Settings && config.Office365Settings.Enable) {
                        newState.oauthType = Constants.OFFICE365_SERVICE;
                    }
                    if (config.GoogleSettings && config.GoogleSettings.Enable) {
                        newState.oauthType = Constants.GOOGLE_SERVICE;
                    }

                    newState['GitLabSettings.Url'] = config.GitLabSettings.UserAPIEndpoint.replace('/api/v4/user', '');

                    return newState;
                },
                onConfigSave: (config) => {
                    const newConfig = {...config};
                    newConfig.GitLabSettings = config.GitLabSettings || {};
                    newConfig.Office365Settings = config.Office365Settings || {};
                    newConfig.GoogleSettings = config.GoogleSettings || {};
                    newConfig.OpenIdSettings = config.OpenIdSettings || {};

                    newConfig.GitLabSettings.Enable = false;
                    newConfig.Office365Settings.Enable = false;
                    newConfig.GoogleSettings.Enable = false;
                    newConfig.OpenIdSettings.Enable = false;
                    newConfig.GitLabSettings.UserAPIEndpoint = config.GitLabSettings.Url.replace(/\/$/, '') + '/api/v4/user';

                    if (config.oauthType === Constants.GITLAB_SERVICE) {
                        newConfig.GitLabSettings.Enable = true;
                    }
                    if (config.oauthType === Constants.OFFICE365_SERVICE) {
                        newConfig.Office365Settings.Enable = true;
                    }
                    if (config.oauthType === Constants.GOOGLE_SERVICE) {
                        newConfig.GoogleSettings.Enable = true;
                    }
                    delete newConfig.oauthType;
                    return newConfig;
                },
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: OpenIdConvert,
                        key: 'OpenIdConvert',
                        isHidden: it.any(
                            it.all(it.not(it.licensedForFeature('OpenId')), it.not(it.cloudLicensed)),
                            it.not(usesLegacyOauth),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'oauthType',
                        label: t('admin.openid.select'),
                        label_default: 'Select service provider:',
                        options: [
                            {
                                value: 'off',
                                display_name: t('admin.oauth.off'),
                                display_name_default: 'Do not allow sign-in via an OAuth 2.0 provider.',
                            },
                            {
                                value: Constants.GITLAB_SERVICE,
                                display_name: t('admin.oauth.gitlab'),
                                display_name_default: 'GitLab',
                                help_text: t('admin.gitlab.EnableMarkdownDesc'),
                                help_text_default: '1. Log in to your GitLab account and go to Profile Settings -> Applications.\n2. Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete".\n3. Then use "Application Secret Key" and "Application ID" fields from GitLab to complete the options below.\n4. Complete the Endpoint URLs below.',
                                help_text_markdown: true,
                            },
                            {
                                value: Constants.GOOGLE_SERVICE,
                                display_name: t('admin.oauth.google'),
                                display_name_default: 'Google Apps',
                                isHidden: it.all(it.not(it.licensedForFeature('GoogleOAuth')), it.not(it.cloudLicensed)),
                                help_text: t('admin.google.EnableMarkdownDesc'),
                                help_text_default: '1. <linkLogin>Log in</linkLogin> to your Google account.\n2. Go to <linkConsole>https://console.developers.google.com</linkConsole>, click <strong>Credentials</strong> in the left hand sidebar and enter "Mattermost - your-company-name" as the <strong>Project Name</strong>, then click <strong>Create</strong>.\n3. Click the <strong>OAuth consent screen</strong> header and enter "Mattermost" as the <strong>Product name shown to users</strong>, then click <strong>Save</strong>.\n4. Under the <strong>Credentials</strong> header, click <strong>Create credentials</strong>, choose <strong>OAuth client ID</strong> and select <strong>Web Application</strong>.\n5. Under <strong>Restrictions</strong> and <strong>Authorized redirect URIs</strong> enter <strong>your-mattermost-url/signup/google/complete</strong> (example: http://localhost:8065/signup/google/complete). Click <strong>Create</strong>.\n6. Paste the <strong>Client ID</strong> and <strong>Client Secret</strong> to the fields below, then click <strong>Save</strong>.\n7. Go to the <linkAPI>Google People API</linkAPI> and click <strong>Enable</strong>.',
                                help_text_markdown: false,
                                help_text_values: {
                                    linkLogin: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://accounts.google.com/login'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkConsole: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://console.developers.google.com'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkAPI: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://console.developers.google.com/apis/library/people.googleapis.com'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                            },
                            {
                                value: Constants.OFFICE365_SERVICE,
                                display_name: t('admin.oauth.office365'),
                                display_name_default: 'Office 365',
                                isHidden: it.all(it.not(it.licensedForFeature('Office365OAuth')), it.not(it.cloudLicensed)),
                                help_text: t('admin.office365.EnableMarkdownDesc'),
                                help_text_default: '1. <linkLogin>Log in</linkLogin> to your Microsoft or Office 365 account. Make sure it`s the account on the same <linkTenant>tenant</linkTenant> that you would like users to log in with.\n2. Go to <linkApps>https://apps.dev.microsoft.com</linkApps>, click <strong>Go to app list</strong> > <strong>Add an app</strong> and use "Mattermost - your-company-name" as the <strong>Application Name</strong>.\n3. Under <strong>Application Secrets</strong>, click <strong>Generate New Password</strong> and paste it to the <strong>Application Secret Password<strong> field below.\n4. Under <strong>Platforms</strong>, click <strong>Add Platform</strong>, choose <strong>Web</strong> and enter <strong>your-mattermost-url/signup/office365/complete</strong> (example: http://localhost:8065/signup/office365/complete) under <strong>Redirect URIs</strong>. Also uncheck <strong>Allow Implicit Flow</strong>.\n5. Finally, click <strong>Save</strong> and then paste the <strong>Application ID</strong> below.',
                                help_text_markdown: false,
                                help_text_values: {
                                    linkLogin: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://login.microsoftonline.com/'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkTenant: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://msdn.microsoft.com/en-us/library/azure/jj573650.aspx#Anchor_0'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkApps: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://apps.dev.microsoft.com'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Id',
                        label: t('admin.gitlab.clientIdTitle'),
                        label_default: 'Application ID:',
                        help_text: t('admin.gitlab.clientIdDescription'),
                        help_text_default: 'Obtain this value via the instructions above for logging into GitLab.',
                        placeholder: t('admin.gitlab.clientIdExample'),
                        placeholder_default: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"',
                        isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Secret',
                        label: t('admin.gitlab.clientSecretTitle'),
                        label_default: 'Application Secret Key:',
                        help_text: t('admin.gitlab.clientSecretDescription'),
                        help_text_default: 'Obtain this value via the instructions above for logging into GitLab.',
                        placeholder: t('admin.gitlab.clientSecretExample'),
                        placeholder_default: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"',
                        isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Url',
                        label: t('admin.gitlab.siteUrl'),
                        label_default: 'GitLab Site URL:',
                        help_text: t('admin.gitlab.siteUrlDescription'),
                        help_text_default: 'Enter the URL of your GitLab instance, e.g. https://example.com:3000. If your GitLab instance is not set up with SSL, start the URL with http:// instead of https://.',
                        placeholder: t('admin.gitlab.siteUrlExample'),
                        placeholder_default: 'E.g.: https://',
                        isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.UserAPIEndpoint',
                        label: t('admin.gitlab.userTitle'),
                        label_default: 'User API Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['GitLabSettings.Url']) {
                                return state['GitLabSettings.Url'].replace(/\/$/, '') + '/api/v4/user';
                            }
                            return '';
                        },
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.AuthEndpoint',
                        label: t('admin.gitlab.authTitle'),
                        label_default: 'Auth Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['GitLabSettings.Url']) {
                                return state['GitLabSettings.Url'].replace(/\/$/, '') + '/oauth/authorize';
                            }
                            return '';
                        },
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.TokenEndpoint',
                        label: t('admin.gitlab.tokenTitle'),
                        label_default: 'Token Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['GitLabSettings.Url']) {
                                return state['GitLabSettings.Url'].replace(/\/$/, '') + '/oauth/token';
                            }
                            return '';
                        },
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.Id',
                        label: t('admin.google.clientIdTitle'),
                        label_default: 'Client ID:',
                        help_text: t('admin.google.clientIdDescription'),
                        help_text_default: 'The Client ID you received when registering your application with Google.',
                        placeholder: t('admin.google.clientIdExample'),
                        placeholder_default: 'E.g.: "7602141235235-url0fhs1mayfasbmop5qlfns8dh4.apps.googleusercontent.com"',
                        isHidden: it.not(it.stateEquals('oauthType', 'google')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.Secret',
                        label: t('admin.google.clientSecretTitle'),
                        label_default: 'Client Secret:',
                        help_text: t('admin.google.clientSecretDescription'),
                        help_text_default: 'The Client Secret you received when registering your application with Google.',
                        placeholder: t('admin.google.clientSecretExample'),
                        placeholder_default: 'E.g.: "H8sz0Az-dDs2p15-7QzD231"',
                        isHidden: it.not(it.stateEquals('oauthType', 'google')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.UserAPIEndpoint',
                        label: t('admin.google.userTitle'),
                        label_default: 'User API Endpoint:',
                        dynamic_value: () => 'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,nicknames,metadata',
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'google')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.AuthEndpoint',
                        label: t('admin.google.authTitle'),
                        label_default: 'Auth Endpoint:',
                        dynamic_value: () => 'https://accounts.google.com/o/oauth2/v2/auth',
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'google')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.TokenEndpoint',
                        label: t('admin.google.tokenTitle'),
                        label_default: 'Token Endpoint:',
                        dynamic_value: () => 'https://www.googleapis.com/oauth2/v4/token',
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'google')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.Id',
                        label: t('admin.office365.clientIdTitle'),
                        label_default: 'Application ID:',
                        help_text: t('admin.office365.clientIdDescription'),
                        help_text_default: 'The Application/Client ID you received when registering your application with Microsoft.',
                        placeholder: t('admin.office365.clientIdExample'),
                        placeholder_default: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"',
                        isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.Secret',
                        label: t('admin.office365.clientSecretTitle'),
                        label_default: 'Application Secret Password:',
                        help_text: t('admin.office365.clientSecretDescription'),
                        help_text_default: 'The Application Secret Password you generated when registering your application with Microsoft.',
                        placeholder: t('admin.office365.clientSecretExample'),
                        placeholder_default: 'E.g.: "shAieM47sNBfgl20f8ci294"',
                        isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.DirectoryId',
                        label: t('admin.office365.directoryIdTitle'),
                        label_default: 'Directory (tenant) ID:',
                        help_text: t('admin.office365.directoryIdDescription'),
                        help_text_default: 'The Directory (tenant) ID you received when registering your application with Microsoft.',
                        placeholder: t('admin.office365.directoryIdExample'),
                        placeholder_default: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"',
                        isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.UserAPIEndpoint',
                        label: t('admin.office365.userTitle'),
                        label_default: 'User API Endpoint:',
                        dynamic_value: () => 'https://graph.microsoft.com/v1.0/me',
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.AuthEndpoint',
                        label: t('admin.office365.authTitle'),
                        label_default: 'Auth Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['Office365Settings.DirectoryId']) {
                                return 'https://login.microsoftonline.com/' + state['Office365Settings.DirectoryId'] + '/oauth2/v2.0/authorize';
                            }
                            return 'https://login.microsoftonline.com/{directoryId}/oauth2/v2.0/authorize';
                        },
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.TokenEndpoint',
                        label: t('admin.office365.tokenTitle'),
                        label_default: 'Token Endpoint:',
                        dynamic_value: (value, config, state) => {
                            if (state['Office365Settings.DirectoryId']) {
                                return 'https://login.microsoftonline.com/' + state['Office365Settings.DirectoryId'] + '/oauth2/v2.0/token';
                            }
                            return 'https://login.microsoftonline.com/{directoryId}/oauth2/v2.0/token';
                        },
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                    },
                ],
            },
        },
        openid: {
            url: 'authentication/openid',
            title: t('admin.sidebar.openid'),
            title_default: 'OpenID Connect',
            isHidden: it.any(
                it.all(it.not(it.licensedForFeature('OpenId')), it.not(it.cloudLicensed)),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
            ),
            schema: {
                id: 'OpenIdSettings',
                name: t('admin.authentication.openid'),
                name_default: 'OpenID Connect',
                onConfigLoad: (config) => {
                    const newState = {};
                    if (config.Office365Settings && config.Office365Settings.Enable) {
                        newState.openidType = Constants.OFFICE365_SERVICE;
                    }
                    if (config.GoogleSettings && config.GoogleSettings.Enable) {
                        newState.openidType = Constants.GOOGLE_SERVICE;
                    }
                    if (config.GitLabSettings && config.GitLabSettings.Enable) {
                        newState.openidType = Constants.GITLAB_SERVICE;
                    }
                    if (config.OpenIdSettings && config.OpenIdSettings.Enable) {
                        newState.openidType = Constants.OPENID_SERVICE;
                    }
                    if (config.GitLabSettings.UserAPIEndpoint) {
                        newState['GitLabSettings.Url'] = config.GitLabSettings.UserAPIEndpoint.replace('/api/v4/user', '');
                    } else if (config.GitLabSettings.DiscoveryEndpoint) {
                        newState['GitLabSettings.Url'] = config.GitLabSettings.DiscoveryEndpoint.replace('/.well-known/openid-configuration', '');
                    }

                    return newState;
                },
                onConfigSave: (config) => {
                    const newConfig = {...config};
                    newConfig.Office365Settings = config.Office365Settings || {};
                    newConfig.GoogleSettings = config.GoogleSettings || {};
                    newConfig.GitLabSettings = config.GitLabSettings || {};
                    newConfig.OpenIdSettings = config.OpenIdSettings || {};

                    newConfig.Office365Settings.Enable = false;
                    newConfig.GoogleSettings.Enable = false;
                    newConfig.GitLabSettings.Enable = false;
                    newConfig.OpenIdSettings.Enable = false;

                    let configSetting = '';
                    if (config.openidType === Constants.OFFICE365_SERVICE) {
                        configSetting = 'Office365Settings';
                    } else if (config.openidType === Constants.GOOGLE_SERVICE) {
                        configSetting = 'GoogleSettings';
                    } else if (config.openidType === Constants.GITLAB_SERVICE) {
                        configSetting = 'GitLabSettings';
                    } else if (config.openidType === Constants.OPENID_SERVICE) {
                        configSetting = 'OpenIdSettings';
                    }

                    if (configSetting !== '') {
                        newConfig[configSetting].Enable = true;
                        newConfig[configSetting].Scope = Constants.OPENID_SCOPES;
                        newConfig[configSetting].UserAPIEndpoint = '';
                        newConfig[configSetting].AuthEndpoint = '';
                        newConfig[configSetting].TokenEndpoint = '';
                    }

                    delete newConfig.openidType;
                    return newConfig;
                },
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: OpenIdConvert,
                        key: 'OpenIdConvert',
                        isHidden: it.any(
                            it.not(usesLegacyOauth),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'openidType',
                        label: t('admin.openid.select'),
                        label_default: 'Select service provider:',
                        isHelpHidden: it.all(it.stateEquals('openidType', Constants.OPENID_SERVICE), it.licensedForCloudStarter),
                        options: [
                            {
                                value: 'off',
                                display_name: t('admin.openid.off'),
                                display_name_default: 'Do not allow sign-in via an OpenID provider.',
                            },
                            {
                                value: Constants.GITLAB_SERVICE,
                                display_name: t('admin.openid.gitlab'),
                                display_name_default: 'GitLab',
                                help_text: t('admin.gitlab.EnableMarkdownDesc'),
                                help_text_default: '1. Log in to your GitLab account and go to Profile Settings -> Applications.\n2. Enter Redirect URIs "<your-mattermost-url>/login/gitlab/complete" (example: http://localhost:8065/login/gitlab/complete) and "<your-mattermost-url>/signup/gitlab/complete".\n3. Then use "Application Secret Key" and "Application ID" fields from GitLab to complete the options below.\n4. Complete the Endpoint URLs below.',
                                help_text_markdown: false,
                            },
                            {
                                value: Constants.GOOGLE_SERVICE,
                                display_name: t('admin.openid.google'),
                                display_name_default: 'Google Apps',
                                help_text: t('admin.google.EnableMarkdownDesc'),
                                help_text_default: '1. <linkLogin>Log in</linkLogin> to your Google account.\n2. Go to <linkConsole>https://console.developers.google.com]</linkConsole>, click <strong>Credentials</strong> in the left hand side.\n 3. Under the <strong>Credentials</strong> header, click <strong>Create credentials</strong>, choose <strong>OAuth client ID</strong> and select <strong>Web Application</strong>.\n 4. Enter "Mattermost - your-company-name" as the <strong>Name</strong>.\n 5. Under <strong>Authorized redirect URIs</strong> enter <strong>your-mattermost-url/signup/google/complete</strong> (example: http://localhost:8065/signup/google/complete). Click <strong>Create</strong>.\n 6. Paste the <strong>Client ID</strong> and <strong>Client Secret</strong> to the fields below, then click <strong>Save</strong>.\n 7. Go to the <linkAPI>Google People API</linkAPI> and click <strong>Enable</strong>.',
                                help_text_markdown: false,
                                help_text_values: {
                                    linkLogin: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://accounts.google.com/login'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkConsole: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://console.developers.google.com'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkAPI: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://console.developers.google.com/apis/library/people.googleapis.com'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                            },
                            {
                                value: Constants.OFFICE365_SERVICE,
                                display_name: t('admin.openid.office365'),
                                display_name_default: 'Office 365',
                                help_text: t('admin.office365.EnableMarkdownDesc'),
                                help_text_default: '1. <linkLogin>Log in</linkLogin> to your Microsoft or Office 365 account. Make sure it`s the account on the same <linkTenant>tenant</linkTenant> that you would like users to log in with.\n2. Go to <linkApps>https://apps.dev.microsoft.com</linkApps>, click <strong>Go to Azure Portal</strong> > click <strong>New Registration</strong>.\n3. Use "Mattermost - your-company-name" as the <strong>Application Name</strong>, click <strong>Registration</strong>, paste <strong>Client ID</strong> and <strong>Tenant ID</strong> below.\n4. Click <strong>Authentication</strong>, under <strong>Platforms</strong>, click <strong>Add Platform</strong>, choose <strong>Web</strong> and enter <strong>your-mattermost-url/signup/office365/complete</strong> (example: http://localhost:8065/signup/office365/complete) under <strong>Redirect URIs</strong>. Also uncheck <strong>Allow Implicit Flow</strong>.\n5. Click <strong>Certificates & secrets</strong>, Generate <strong>New client secret</strong> and paste secret value in <strong>Client Secret</strong> field below.',
                                help_text_markdown: false,
                                help_text_values: {
                                    linkLogin: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://login.microsoftonline.com/'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkTenant: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://msdn.microsoft.com/en-us/library/azure/jj573650.aspx#Anchor_0'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    linkApps: (msg) => (
                                        <ExternalLink
                                            location='admin_console'
                                            href='https://apps.dev.microsoft.com'
                                        >
                                            {msg}
                                        </ExternalLink>
                                    ),
                                    strong: (msg) => <strong>{msg}</strong>,
                                },
                            },
                            {
                                value: Constants.OPENID_SERVICE,
                                display_name: t('admin.oauth.openid'),
                                display_name_default: 'OpenID Connect (Other)',
                                help_text: t('admin.openid.EnableMarkdownDesc'),
                                help_text_default: 'Follow provider directions for creating an OpenID Application. Most OpenID Connect providers require authorization of all redirect URIs. In the appropriate field, enter your-mattermost-url/signup/openid/complete (example: http://domain.com/signup/openid/complete)',
                                help_text_markdown: false,
                            },
                        ],
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Url',
                        label: t('admin.gitlab.siteUrl'),
                        label_default: 'GitLab Site URL:',
                        help_text: t('admin.gitlab.siteUrlDescription'),
                        help_text_default: 'Enter the URL of your GitLab instance, e.g. https://example.com:3000. If your GitLab instance is not set up with SSL, start the URL with http:// instead of https://.',
                        placeholder: t('admin.gitlab.siteUrlExample'),
                        placeholder_default: 'E.g.: https://',
                        isHidden: it.not(it.stateEquals('openidType', Constants.GITLAB_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.DiscoveryEndpoint',
                        label: t('admin.openid.discoveryEndpointTitle'),
                        label_default: 'Discovery Endpoint:',
                        help_text: t('admin.gitlab.discoveryEndpointDesc'),
                        help_text_default: 'The URL of the discovery document for OpenID Connect with GitLab.',
                        help_text_markdown: false,
                        dynamic_value: (value, config, state) => {
                            if (state['GitLabSettings.Url']) {
                                return state['GitLabSettings.Url'].replace(/\/$/, '') + '/.well-known/openid-configuration';
                            }
                            return '';
                        },
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('openidType', Constants.GITLAB_SERVICE)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Id',
                        label: t('admin.openid.clientIdTitle'),
                        label_default: 'Client ID:',
                        help_text: t('admin.openid.clientIdDescription'),
                        help_text_default: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.gitlab.clientIdExample'),
                        placeholder_default: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"',
                        isHidden: it.not(it.stateEquals('openidType', Constants.GITLAB_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GitLabSettings.Secret',
                        label: t('admin.openid.clientSecretTitle'),
                        label_default: 'Client Secret:',
                        help_text: t('admin.openid.clientSecretDescription'),
                        help_text_default: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.gitlab.clientSecretExample'),
                        placeholder_default: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx442pnqMxQY"',
                        isHidden: it.not(it.stateEquals('openidType', Constants.GITLAB_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.DiscoveryEndpoint',
                        label: t('admin.openid.discoveryEndpointTitle'),
                        label_default: 'Discovery Endpoint:',
                        help_text: t('admin.google.discoveryEndpointDesc'),
                        help_text_default: 'The URL of the discovery document for OpenID Connect with Google.',
                        help_text_markdown: false,
                        dynamic_value: () => 'https://accounts.google.com/.well-known/openid-configuration',
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('openidType', Constants.GOOGLE_SERVICE)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.Id',
                        label: t('admin.openid.clientIdTitle'),
                        label_default: 'Client ID:',
                        help_text: t('admin.openid.clientIdDescription'),
                        help_text_default: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.google.clientIdExample'),
                        placeholder_default: 'E.g.: "7602141235235-url0fhs1mayfasbmop5qlfns8dh4.apps.googleusercontent.com"',
                        isHidden: it.not(it.stateEquals('openidType', Constants.GOOGLE_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GoogleSettings.Secret',
                        label: t('admin.openid.clientSecretTitle'),
                        label_default: 'Client Secret:',
                        help_text: t('admin.openid.clientSecretDescription'),
                        help_text_default: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.google.clientSecretExample'),
                        placeholder_default: 'E.g.: "H8sz0Az-dDs2p15-7QzD231"',
                        isHidden: it.not(it.stateEquals('openidType', Constants.GOOGLE_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.DirectoryId',
                        label: t('admin.office365.directoryIdTitle'),
                        label_default: 'Directory (tenant) ID:',
                        help_text: t('admin.office365.directoryIdDescription'),
                        help_text_default: 'The Directory (tenant) ID you received when registering your application with Microsoft.',
                        placeholder: t('admin.office365.directoryIdExample'),
                        placeholder_default: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"',
                        isHidden: it.not(it.stateEquals('openidType', Constants.OFFICE365_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.DiscoveryEndpoint',
                        label: t('admin.openid.discoveryEndpointTitle'),
                        label_default: 'Discovery Endpoint:',
                        help_text: t('admin.office365.discoveryEndpointDesc'),
                        help_text_default: 'The URL of the discovery document for OpenID Connect with Office 365.',
                        help_text_markdown: false,
                        dynamic_value: (value, config, state) => {
                            if (state['Office365Settings.DirectoryId']) {
                                return 'https://login.microsoftonline.com/' + state['Office365Settings.DirectoryId'] + '/v2.0/.well-known/openid-configuration';
                            }
                            return 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration';
                        },
                        isDisabled: true,
                        isHidden: it.not(it.stateEquals('openidType', Constants.OFFICE365_SERVICE)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.Id',
                        label: t('admin.openid.clientIdTitle'),
                        label_default: 'Client ID:',
                        help_text: t('admin.openid.clientIdDescription'),
                        help_text_default: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.office365.clientIdExample'),
                        placeholder_default: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"',
                        isHidden: it.not(it.stateEquals('openidType', Constants.OFFICE365_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'Office365Settings.Secret',
                        label: t('admin.openid.clientSecretTitle'),
                        label_default: 'Client Secret:',
                        help_text: t('admin.openid.clientSecretDescription'),
                        help_text_default: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.office365.clientSecretExample'),
                        placeholder_default: 'E.g.: "shAieM47sNBfgl20f8ci294"',
                        isHidden: it.not(it.stateEquals('openidType', Constants.OFFICE365_SERVICE)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },

                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'OpenIdSettings.ButtonText',
                        label: t('admin.openid.buttonTextTitle'),
                        label_default: 'Button Name:',
                        placeholder: t('admin.openid.buttonTextEx'),
                        placeholder_default: 'Custom Button Name',
                        help_text: t('admin.openid.buttonTextDesc'),
                        help_text_default: 'The text that will show on the login button.',
                        isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'OpenIdSettings.ButtonColor',
                        label: t('admin.openid.buttonColorTitle'),
                        label_default: 'Button Color:',
                        help_text: t('admin.openid.buttonColorDesc'),
                        help_text_default: 'Specify the color of the OpenID login button for white labeling purposes. Use a hex code with a #-sign before the code.',
                        help_text_markdown: false,
                        isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'OpenIdSettings.DiscoveryEndpoint',
                        label: t('admin.openid.discoveryEndpointTitle'),
                        label_default: 'Discovery Endpoint:',
                        placeholder: t('admin.openid.discovery.placeholder'),
                        placeholder_default: 'https://id.mydomain.com/.well-known/openid-configuration',
                        help_text: t('admin.openid.discoveryEndpointDesc'),
                        help_text_default: 'Enter the URL of the discovery document of the OpenID Connect provider you want to connect with.',
                        help_text_markdown: false,
                        isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'OpenIdSettings.Id',
                        label: t('admin.openid.clientIdTitle'),
                        label_default: 'Client ID:',
                        help_text: t('admin.openid.clientIdDescription'),
                        help_text_default: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.openid.clientIdExample'),
                        placeholder_default: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"',
                        isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'OpenIdSettings.Secret',
                        label: t('admin.openid.clientSecretTitle'),
                        label_default: 'Client Secret:',
                        help_text: t('admin.openid.clientSecretDescription'),
                        help_text_default: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation',
                        placeholder: t('admin.openid.clientSecretExample'),
                        placeholder_default: 'E.g.: "H8sz0Az-dDs2p15-7QzD231"',
                        isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        key: 'OpenIDCustomFeatureDiscovery',
                        component: OpenIDCustomFeatureDiscovery,
                        isHidden: it.not(it.all(it.stateEquals('openidType', Constants.OPENID_SERVICE), it.licensedForCloudStarter)),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        openid_feature_discovery: {
            url: 'authentication/openid',
            isDiscovery: true,
            title: t('admin.sidebar.openid'),
            title_default: 'OpenID Connect',
            isHidden: it.any(
                it.any(it.licensedForFeature('OpenId'), it.cloudLicensed),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'OpenIdSettings',
                name: t('admin.authentication.openid'),
                name_default: 'OpenID Connect',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: OpenIDFeatureDiscovery,
                        key: 'OpenIDFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true),
        },
        guest_access: {
            url: 'authentication/guest_access',
            title: t('admin.sidebar.guest_access'),
            title_default: 'Guest Access',
            isHidden: it.any(
                it.not(it.licensedForFeature('GuestAccounts')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
            ),
            schema: {
                id: 'GuestAccountsSettings',
                name: t('admin.authentication.guest_access'),
                name_default: 'Guest Access',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: CustomEnableDisableGuestAccountsSetting,
                        key: 'GuestAccountsSettings.Enable',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'GuestAccountsSettings.RestrictCreationToDomains',
                        label: t('admin.guest_access.whitelistedDomainsTitle'),
                        label_default: 'Whitelisted Guest Domains:',
                        help_text: t('admin.guest_access.whitelistedDomainsDescription'),
                        help_text_default: '(Optional) Guest accounts can be created at the system level from this list of allowed guest domains.',
                        help_text_markdown: true,
                        placeholder: t('admin.guest_access.whitelistedDomainsExample'),
                        placeholder_default: 'E.g.: "company.com, othercorp.org"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'GuestAccountsSettings.EnforceMultifactorAuthentication',
                        label: t('admin.guest_access.mfaTitle'),
                        label_default: 'Enforce Multi-factor Authentication: ',
                        help_text: t('admin.guest_access.mfaDescriptionMFANotEnabled'),
                        help_text_default: '[Multi-factor authentication](./mfa) is currently not enabled.',
                        help_text_markdown: true,
                        isHidden: it.configIsTrue('ServiceSettings', 'EnableMultifactorAuthentication'),
                        isDisabled: () => true,
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'GuestAccountsSettings.EnforceMultifactorAuthentication',
                        label: t('admin.guest_access.mfaTitle'),
                        label_default: 'Enforce Multi-factor Authentication: ',
                        help_text: t('admin.guest_access.mfaDescriptionMFANotEnforced'),
                        help_text_default: '[Multi-factor authentication](./mfa) is currently not enforced.',
                        help_text_markdown: true,
                        isHidden: it.any(
                            it.configIsFalse('ServiceSettings', 'EnableMultifactorAuthentication'),
                            it.configIsTrue('ServiceSettings', 'EnforceMultifactorAuthentication'),
                        ),
                        isDisabled: () => true,
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'GuestAccountsSettings.EnforceMultifactorAuthentication',
                        label: t('admin.guest_access.mfaTitle'),
                        label_default: 'Enforce Multi-factor Authentication: ',
                        help_text: t('admin.guest_access.mfaDescription'),
                        help_text_default: 'When true, <link>multi-factor authentication</link> for guests is required for login. New guest users will be required to configure MFA on signup. Logged in guest users without MFA configured are redirected to the MFA setup page until configuration is complete.\n \nIf your system has guest users with login methods other than AD/LDAP and email, MFA must be enforced with the authentication provider outside of Mattermost.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/deployment/auth.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isHidden: it.any(
                            it.configIsFalse('ServiceSettings', 'EnableMultifactorAuthentication'),
                            it.configIsFalse('ServiceSettings', 'EnforceMultifactorAuthentication'),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        guest_access_feature_discovery: {
            isDiscovery: true,
            url: 'authentication/guest_access',
            title: t('admin.sidebar.guest_access'),
            title_default: 'Guest Access',
            isHidden: it.any(
                it.licensedForFeature('GuestAccounts'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'GuestAccountsSettings',
                name: t('admin.authentication.guest_access'),
                name_default: 'Guest Access',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: GuestAccessFeatureDiscovery,
                        key: 'GuestAccessFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true),
        },
    },
    plugins: {
        icon: (
            <PowerPlugOutlineIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.plugins'),
        sectionTitleDefault: 'Plugins',
        id: 'plugins',
        isHidden: it.not(it.userHasReadPermissionOnResource('plugins')),
        plugin_management: {
            url: 'plugins/plugin_management',
            title: t('admin.plugins.pluginManagement'),
            title_default: 'Plugin Management',
            searchableStrings: [
                'admin.plugin.management.title',
                'admin.plugins.settings.enable',
                'admin.plugins.settings.enableDesc',
                'admin.plugin.uploadTitle',
                'admin.plugin.installedTitle',
                'admin.plugin.installedDesc',
                'admin.plugin.uploadDesc',
                'admin.plugin.uploadDisabledDesc',
                'admin.plugins.settings.enableMarketplace',
                'admin.plugins.settings.enableMarketplaceDesc',
                'admin.plugins.settings.enableRemoteMarketplace',
                'admin.plugins.settings.enableRemoteMarketplaceDesc',
                'admin.plugins.settings.automaticPrepackagedPlugins',
                'admin.plugins.settings.automaticPrepackagedPluginsDesc',
                'admin.plugins.settings.marketplaceUrl',
                'admin.plugins.settings.marketplaceUrlDesc',
            ],
            isDisabled: it.not(it.userHasWritePermissionOnResource('plugins')),
            schema: {
                id: 'PluginManagementSettings',
                component: PluginManagement,
            },
        },
        custom: {
            url: 'plugins/plugin_:plugin_id',
            isDisabled: it.not(it.userHasWritePermissionOnResource('plugins')),
            schema: {
                id: 'CustomPluginSettings',
                component: CustomPluginSettings,
            },
        },
    },
    integrations: {
        icon: (
            <SitemapIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.integrations'),
        sectionTitleDefault: 'Integrations',
        id: 'integrations',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.INTEGRATIONS)),
        integration_management: {
            url: 'integrations/integration_management',
            title: t('admin.integrations.integrationManagement'),
            title_default: 'Integration Management',
            isHidden: it.all(
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
            ),
            schema: {
                id: 'CustomIntegrationSettings',
                name: t('admin.integrations.integrationManagement.title'),
                name_default: 'Integration Management',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableIncomingWebhooks',
                        label: t('admin.service.webhooksTitle'),
                        label_default: 'Enable Incoming Webhooks: ',
                        help_text: t('admin.service.webhooksDescription'),
                        help_text_default: 'When true, incoming webhooks will be allowed. To help combat phishing attacks, all posts from webhooks will be labelled by a BOT tag. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    href='https://developers.mattermost.com/integrate/admin-guide/admin-webhooks-incoming/'
                                    location='admin_console'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableOutgoingWebhooks',
                        label: t('admin.service.outWebhooksTitle'),
                        label_default: 'Enable Outgoing Webhooks: ',
                        help_text: t('admin.service.outWebhooksDesc'),
                        help_text_default: 'When true, outgoing webhooks will be allowed. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://developers.mattermost.com/integrate/admin-guide/admin-webhooks-outgoing/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableCommands',
                        label: t('admin.service.cmdsTitle'),
                        label_default: 'Enable Custom Slash Commands: ',
                        help_text: t('admin.service.cmdsDesc'),
                        help_text_default: 'When true, custom slash commands will be allowed. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://developers.mattermost.com/integrate/admin-guide/admin-slash-commands/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableOAuthServiceProvider',
                        label: t('admin.oauth.providerTitle'),
                        label_default: 'Enable OAuth 2.0 Service Provider: ',
                        help_text: t('admin.oauth.providerDescription'),
                        help_text_default: 'When true, Mattermost can act as an OAuth 2.0 service provider allowing Mattermost to authorize API requests from external applications. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://developers.mattermost.com/integrate/admin-guide/admin-oauth2/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        isHidden: it.licensedForFeature('Cloud'),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnablePostUsernameOverride',
                        label: t('admin.service.overrideTitle'),
                        label_default: 'Enable integrations to override usernames:',
                        help_text: t('admin.service.overrideDescription'),
                        help_text_default: 'When true, webhooks, slash commands and other integrations will be allowed to change the username they are posting as. Note: Combined with allowing integrations to override profile picture icons, users may be able to perform phishing attacks by attempting to impersonate other users.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnablePostIconOverride',
                        label: t('admin.service.iconTitle'),
                        label_default: 'Enable integrations to override profile picture icons:',
                        help_text: t('admin.service.iconDescription'),
                        help_text_default: 'When true, webhooks, slash commands and other integrations will be allowed to change the profile picture they post with. Note: Combined with allowing integrations to override usernames, users may be able to perform phishing attacks by attempting to impersonate other users.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableUserAccessTokens',
                        label: t('admin.service.userAccessTokensTitle'),
                        label_default: 'Enable User Access Tokens: ',
                        help_text: t('admin.service.userAccessTokensDescription'),
                        help_text_default: 'When true, users can create <link>user access tokens</link> for integrations in <strong>Account Menu > Account Settings > Security</strong>. They can be used to authenticate against the API and give full access to the account.\n\n To manage who can create personal access tokens or to search users by token ID, go to the <strong>User Management > Users</strong> page.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://developers.mattermost.com/integrate/admin-guide/admin-personal-access-token/'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            strong: (msg) => <strong>{msg}</strong>,
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                    },
                ],
            },
        },
        bot_accounts: {
            url: 'integrations/bot_accounts',
            title: t('admin.integrations.botAccounts'),
            title_default: 'Bot Accounts',
            isHidden: it.all(
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.BOT_ACCOUNTS)),
            ),
            schema: {
                id: 'BotAccountSettings',
                name: t('admin.integrations.botAccounts.title'),
                name_default: 'Bot Accounts',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableBotAccountCreation',
                        label: t('admin.service.enableBotTitle'),
                        label_default: 'Enable Bot Account Creation: ',
                        help_text: t('admin.service.enableBotAccountCreation'),
                        help_text_default: 'When true, System Admins can create bot accounts for integrations in <linkBots>Integrations > Bot Accounts</linkBots>. Bot accounts are similar to user accounts except they cannot be used to log in. See <linkDocumentation>documentation</linkDocumentation> to learn more.',
                        help_text_markdown: false,
                        help_text_values: {
                            siteURL: getSiteURL(),
                            linkDocumentation: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/pl/default-bot-accounts'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            linkBots: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href={`${getSiteURL()}/_redirect/integrations/bots`}
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.BOT_ACCOUNTS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.DisableBotsWhenOwnerIsDeactivated',
                        label: t('admin.service.disableBotOwnerDeactivatedTitle'),
                        label_default: 'Disable bot accounts when owner is deactivated:',
                        help_text: t('admin.service.disableBotWhenOwnerIsDeactivated'),
                        help_text_default: 'When a user is deactivated, disables all bot accounts managed by the user. To re-enable bot accounts, go to [Integrations > Bot Accounts]({siteURL}/_redirect/integrations/bots).',
                        help_text_markdown: true,
                        help_text_values: {siteURL: getSiteURL()},
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.BOT_ACCOUNTS)),
                    },
                ],
            },
        },
        gif: {
            url: 'integrations/gif',
            title: t('admin.sidebar.gif'),
            title_default: 'GIF (Beta)',
            isHidden: it.all(
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.GIF)),
            ),
            schema: {
                id: 'GifSettings',
                name: t('admin.integrations.gif'),
                name_default: 'GIF (Beta)',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableGifPicker',
                        label: t('admin.customization.enableGifPickerTitle'),
                        label_default: 'Enable GIF Picker:',
                        help_text: t('admin.customization.enableGifPickerDesc'),
                        help_text_default: 'Allow users to select GIFs from the emoji picker via a Gfycat integration.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.GIF)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.GfycatAPIKey',
                        label: t('admin.customization.gfycatApiKey'),
                        label_default: 'Gfycat API Key:',
                        help_text: t('admin.customization.gfycatApiKeyDescription'),
                        help_text_default: 'Request an API key at <link>https://developers.gfycat.com/signup/#</link>. Enter the client ID you receive via email to this field. When blank, uses the default API key provided by Gfycat.',
                        help_text_markdown: false,
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://developers.gfycat.com/signup/#'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.GIF)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.GfycatAPISecret',
                        label: t('admin.customization.gfycatApiSecret'),
                        label_default: 'Gfycat API Secret:',
                        help_text: t('admin.customization.gfycatApiSecretDescription'),
                        help_text_default: 'The API secret generated by Gfycat for your API key. When blank, uses the default API secret provided by Gfycat.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.GIF)),
                    },
                ],
            },
        },
        cors: {
            url: 'integrations/cors',
            title: t('admin.sidebar.cors'),
            title_default: 'CORS',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
            ),
            schema: {
                id: 'CORS',
                name: t('admin.integrations.cors'),
                name_default: 'CORS',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.AllowCorsFrom',
                        label: t('admin.service.corsTitle'),
                        label_default: 'Enable cross-origin requests from:',
                        placeholder: t('admin.service.corsEx'),
                        placeholder_default: 'http://example.com',
                        help_text: t('admin.service.corsDescription'),
                        help_text_default: 'Enable HTTP Cross origin request from a specific domain. Use "*" if you want to allow CORS from any domain or leave it blank to disable it. Should not be set to "*" in production.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ServiceSettings.CorsExposedHeaders',
                        label: t('admin.service.corsExposedHeadersTitle'),
                        label_default: 'CORS Exposed Headers:',
                        placeholder: t('admin.service.corsHeadersEx'),
                        placeholder_default: 'X-My-Header',
                        help_text: t('admin.service.corsExposedHeadersDescription'),
                        help_text_default: 'Whitelist of headers that will be accessible to the requester.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.CorsAllowCredentials',
                        label: t('admin.service.corsAllowCredentialsLabel'),
                        label_default: 'CORS Allow Credentials:',
                        help_text: t('admin.service.corsAllowCredentialsDescription'),
                        help_text_default: 'When true, requests that pass validation will include the Access-Control-Allow-Credentials header.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.CorsDebug',
                        label: t('admin.service.CorsDebugLabel'),
                        label_default: 'CORS Debug:',
                        help_text: t('admin.service.corsDebugDescription'),
                        help_text_default: 'When true, prints messages to the logs to help when developing an integration that uses CORS. These messages will include the structured key value pair "source":"cors".',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                    },
                ],
            },
        },
    },
    compliance: {
        icon: (
            <FormatListBulletedIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.compliance'),
        sectionTitleDefault: 'Compliance',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.COMPLIANCE)),
        custom_policy_form_edit: {
            url: 'compliance/data_retention_settings/custom_policy/:policy_id',
            isHidden: it.any(
                it.not(it.licensedForFeature('DataRetention')),
                it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            schema: {
                id: 'CustomDataRetentionForm',
                component: CustomDataRetentionForm,
            },

        },
        custom_policy_form: {
            url: 'compliance/data_retention_settings/custom_policy',
            isHidden: it.any(
                it.not(it.licensedForFeature('DataRetention')),
                it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            schema: {
                id: 'CustomDataRetentionForm',
                component: CustomDataRetentionForm,
            },

        },
        global_policy_form: {
            url: 'compliance/data_retention_settings/global_policy',
            isHidden: it.any(
                it.not(it.licensedForFeature('DataRetention')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            schema: {
                id: 'GlobalDataRetentionForm',
                component: GlobalDataRetentionForm,
            },
        },
        data_retention: {
            url: 'compliance/data_retention_settings',
            title: t('admin.sidebar.dataRetentionSettingsPolicies'),
            title_default: 'Data Retention Policies',
            searchableStrings: [
                'admin.data_retention.title',
                'admin.data_retention.createJob.title',
                'admin.data_retention.settings.title',
                'admin.data_retention.globalPolicy.title',
                'admin.data_retention.globalPolicy.subTitle',
                'admin.data_retention.customPolicies.title',
                'admin.data_retention.customPolicies.subTitle',
                'admin.data_retention.jobCreation.title',
                'admin.data_retention.jobCreation.subTitle',
                'admin.data_retention.createJob.instructions',
            ],
            isHidden: it.any(
                it.not(it.licensedForFeature('DataRetention')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.DATA_RETENTION_POLICY)),
            schema: {
                id: 'DataRetentionSettings',
                component: DataRetentionSettings,
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        data_retention_feature_discovery: {
            url: 'compliance/data_retention',
            isDiscovery: true,
            title: t('admin.sidebar.dataRetentionPolicy'),
            title_default: 'Data Retention Policy',
            isHidden: it.any(
                it.licensedForFeature('DataRetention'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'DataRetentionSettings',
                name: t('admin.data_retention.title'),
                name_default: 'Data Retention Policy',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: DataRetentionFeatureDiscovery,
                        key: 'DataRetentionFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true, LicenseSkus.Enterprise),
        },
        message_export: {
            url: 'compliance/export',
            title: t('admin.sidebar.complianceExport'),
            title_default: 'Compliance Export',
            searchableStrings: [
                'admin.service.complianceExportTitle',
                'admin.service.complianceExportDesc',
                'admin.complianceExport.exportJobStartTime.title',
                'admin.complianceExport.exportJobStartTime.description',
                'admin.complianceExport.exportFormat.title',
                ['admin.complianceExport.exportFormat.description', {siteURL: ''}],
                'admin.complianceExport.createJob.title',
                'admin.complianceExport.createJob.help',
                'admin.complianceExport.globalRelayCustomerType.title',
                'admin.complianceExport.globalRelayCustomerType.description',
                'admin.complianceExport.globalRelaySMTPUsername.title',
                'admin.complianceExport.globalRelaySMTPUsername.description',
                'admin.complianceExport.globalRelaySMTPPassword.title',
                'admin.complianceExport.globalRelaySMTPPassword.description',
                'admin.complianceExport.globalRelayEmailAddress.title',
                'admin.complianceExport.globalRelayEmailAddress.description',
            ],
            isHidden: it.any(
                it.not(it.licensedForFeature('MessageExport')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_EXPORT)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_EXPORT)),
            schema: {
                id: 'MessageExportSettings',
                component: MessageExportSettings,
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        compliance_export_feature_discovery: {
            isDiscovery: true,
            url: 'compliance/export',
            title: t('admin.sidebar.complianceExport'),
            title_default: 'Compliance Export',
            isHidden: it.any(
                it.licensedForFeature('MessageExport'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'MessageExportSettings',
                name: t('admin.complianceExport.title'),
                name_default: 'Compliance Export',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: ComplianceExportFeatureDiscovery,
                        key: 'ComplianceExportFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true, LicenseSkus.Enterprise),
        },
        audits: {
            url: 'compliance/monitoring',
            title: t('admin.sidebar.complianceMonitoring'),
            title_default: 'Compliance Monitoring',
            isHidden: it.any(
                it.not(it.licensedForFeature('Compliance')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
            searchableStrings: [
                'admin.audits.title',
                'admin.audits.reload',
            ],
            schema: {
                id: 'Audits',
                name: t('admin.compliance.complianceMonitoring'),
                name_default: 'Compliance Monitoring',
                component: Audits,
                isHidden: it.not(it.licensedForFeature('Compliance')),
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_BANNER,
                        label: t('admin.compliance.newComplianceExportBanner'),
                        label_markdown: true,
                        label_default: 'This feature is replaced by a new [Compliance Export]({siteURL}/admin_console/compliance/export) feature, and will be removed in a future release. We recommend migrating to the new system.',
                        label_values: {siteURL: getSiteURL()},
                        banner_type: 'info',
                        isHidden: it.not(it.licensedForFeature('Compliance')),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ComplianceSettings.Enable',
                        label: t('admin.compliance.enableTitle'),
                        label_default: 'Enable Compliance Reporting:',
                        help_text: t('admin.compliance.enableDesc'),
                        help_text_default: 'When true, Mattermost allows compliance reporting from the <strong>Compliance and Auditing</strong> tab. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/administration/compliance.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            strong: (msg) => <strong>{msg}</strong>,
                        },
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('Compliance')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'ComplianceSettings.Directory',
                        label: t('admin.compliance.directoryTitle'),
                        label_default: 'Compliance Report Directory:',
                        help_text: t('admin.compliance.directoryDescription'),
                        help_text_default: 'Directory to which compliance reports are written. If blank, will be set to ./data/.',
                        placeholder: t('admin.compliance.directoryExample'),
                        placeholder_default: 'E.g.: "./data/"',
                        isHidden: it.not(it.licensedForFeature('Compliance')),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
                            it.stateIsFalse('ComplianceSettings.Enable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ComplianceSettings.EnableDaily',
                        label: t('admin.compliance.enableDailyTitle'),
                        label_default: 'Enable Daily Report:',
                        help_text: t('admin.compliance.enableDailyDesc'),
                        help_text_default: 'When true, Mattermost will generate a daily compliance report.',
                        isHidden: it.not(it.licensedForFeature('Compliance')),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
                            it.stateIsFalse('ComplianceSettings.Enable'),
                        ),
                    },
                ],
            },
        },
        custom_terms_of_service: {
            url: 'compliance/custom_terms_of_service',
            title: t('admin.sidebar.customTermsOfService'),
            title_default: 'Custom Terms of Service',
            searchableStrings: [
                'admin.support.termsOfServiceTitle',
                'admin.support.enableTermsOfServiceTitle',
                'admin.support.enableTermsOfServiceHelp',
                'admin.support.termsOfServiceTextTitle',
                'admin.support.termsOfServiceTextHelp',
                'admin.support.termsOfServiceReAcceptanceTitle',
                'admin.support.termsOfServiceReAcceptanceHelp',
            ],
            isHidden: it.any(
                it.not(it.licensedForFeature('CustomTermsOfService')),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.COMPLIANCE.CUSTOM_TERMS_OF_SERVICE)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.CUSTOM_TERMS_OF_SERVICE)),
            schema: {
                id: 'TermsOfServiceSettings',
                component: CustomTermsOfServiceSettings,
            },
            restrictedIndicator: getRestrictedIndicator(),
        },
        custom_terms_of_service_feature_discovery: {
            url: 'compliance/custom_terms_of_service',
            isDiscovery: true,
            title: t('admin.sidebar.customTermsOfService'),
            title_default: 'Custom Terms of Service',
            isHidden: it.any(
                it.licensedForFeature('CustomTermsOfService'),
                it.not(it.enterpriseReady),
            ),
            schema: {
                id: 'TermsOfServiceSettings',
                name: t('admin.support.termsOfServiceTitle'),
                name_default: 'Custom Terms of Service',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_CUSTOM,
                        component: CustomTermsOfServiceFeatureDiscovery,
                        key: 'CustomTermsOfServiceFeatureDiscovery',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                    },
                ],
            },
            restrictedIndicator: getRestrictedIndicator(true, LicenseSkus.Enterprise),
        },
    },
    experimental: {
        icon: (
            <FlaskOutlineIcon
                size={16}
                className={'category-icon fa'}
                color={'currentColor'}
            />
        ),
        sectionTitle: t('admin.sidebar.experimental'),
        sectionTitleDefault: 'Experimental',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.EXPERIMENTAL)),
        experimental_features: {
            url: 'experimental/features',
            title: t('admin.sidebar.experimentalFeatures'),
            title_default: 'Features',
            isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
            schema: {
                id: 'ExperimentalSettings',
                name: t('admin.experimental.experimentalFeatures'),
                name_default: 'Experimental Features',
                settings: [
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'LdapSettings.LoginButtonColor',
                        label: t('admin.experimental.ldapSettingsLoginButtonColor.title'),
                        label_default: 'AD/LDAP Login Button Color:',
                        help_text: t('admin.experimental.ldapSettingsLoginButtonColor.desc'),
                        help_text_default: 'Specify the color of the AD/LDAP login button for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('LDAP')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'LdapSettings.LoginButtonBorderColor',
                        label: t('admin.experimental.ldapSettingsLoginButtonBorderColor.title'),
                        label_default: 'AD/LDAP Login Button Border Color:',
                        help_text: t('admin.experimental.ldapSettingsLoginButtonBorderColor.desc'),
                        help_text_default: 'Specify the color of the AD/LDAP login button border for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('LDAP')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'LdapSettings.LoginButtonTextColor',
                        label: t('admin.experimental.ldapSettingsLoginButtonTextColor.title'),
                        label_default: 'AD/LDAP Login Button Text Color:',
                        help_text: t('admin.experimental.ldapSettingsLoginButtonTextColor.desc'),
                        help_text_default: 'Specify the color of the AD/LDAP login button text for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('LDAP')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.ExperimentalEnableAuthenticationTransfer',
                        label: t('admin.experimental.experimentalEnableAuthenticationTransfer.title'),
                        label_default: 'Allow Authentication Transfer:',
                        help_text: t('admin.experimental.experimentalEnableAuthenticationTransfer.desc'),
                        help_text_default: 'When true, users can change their sign-in method to any that is enabled on the server, any via Account Settings or the APIs. When false, Users cannot change their sign-in method, regardless of which authentication options are enabled.',
                        help_text_markdown: false,
                        isHidden: it.any( // documented as E20 and higher, but only E10 in the code
                            it.not(it.licensed),
                            it.licensedForSku('starter'),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'ExperimentalSettings.LinkMetadataTimeoutMilliseconds',
                        label: t('admin.experimental.linkMetadataTimeoutMilliseconds.title'),
                        label_default: 'Link Metadata Timeout:',
                        help_text: t('admin.experimental.linkMetadataTimeoutMilliseconds.desc'),
                        help_text_default: 'The number of milliseconds to wait for metadata from a third-party link. Used with Post Metadata.',
                        help_text_markdown: false,
                        placeholder: t('admin.experimental.linkMetadataTimeoutMilliseconds.example'),
                        placeholder_default: 'E.g.: "5000"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'EmailSettings.EmailBatchingBufferSize',
                        label: t('admin.experimental.emailBatchingBufferSize.title'),
                        label_default: 'Email Batching Buffer Size:',
                        help_text: t('admin.experimental.emailBatchingBufferSize.desc'),
                        help_text_default: 'Specify the maximum number of notifications batched into a single email.',
                        help_text_markdown: false,
                        placeholder: t('admin.experimental.emailBatchingBufferSize.example'),
                        placeholder_default: 'E.g.: "256"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'EmailSettings.EmailBatchingInterval',
                        label: t('admin.experimental.emailBatchingInterval.title'),
                        label_default: 'Email Batching Interval:',
                        help_text: t('admin.experimental.emailBatchingInterval.desc'),
                        help_text_default: 'Specify the maximum frequency, in seconds, which the batching job checks for new notifications. Longer batching intervals will increase performance.',
                        help_text_markdown: false,
                        placeholder: t('admin.experimental.emailBatchingInterval.example'),
                        placeholder_default: 'E.g.: "30"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'EmailSettings.LoginButtonColor',
                        label: t('admin.experimental.emailSettingsLoginButtonColor.title'),
                        label_default: 'Email Login Button Color:',
                        help_text: t('admin.experimental.emailSettingsLoginButtonColor.desc'),
                        help_text_default: 'Specify the color of the email login button for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'EmailSettings.LoginButtonBorderColor',
                        label: t('admin.experimental.emailSettingsLoginButtonBorderColor.title'),
                        label_default: 'Email Login Button Border Color:',
                        help_text: t('admin.experimental.emailSettingsLoginButtonBorderColor.desc'),
                        help_text_default: 'Specify the color of the email login button border for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'EmailSettings.LoginButtonTextColor',
                        label: t('admin.experimental.emailSettingsLoginButtonTextColor.title'),
                        label_default: 'Email Login Button Text Color:',
                        help_text: t('admin.experimental.emailSettingsLoginButtonTextColor.desc'),
                        help_text_default: 'Specify the color of the email login button text for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.EnableUserDeactivation',
                        label: t('admin.experimental.enableUserDeactivation.title'),
                        label_default: 'Enable Account Deactivation:',
                        help_text: t('admin.experimental.enableUserDeactivation.desc'),
                        help_text_default: 'When true, users may deactivate their own account from **Settings > Advanced**. If a user deactivates their own account, they will get an email notification confirming they were deactivated. When false, users may not deactivate their own account.',
                        help_text_markdown: true,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'TeamSettings.ExperimentalEnableAutomaticReplies',
                        label: t('admin.experimental.experimentalEnableAutomaticReplies.title'),
                        label_default: 'Enable Automatic Replies:',
                        help_text: t('admin.experimental.experimentalEnableAutomaticReplies.desc'),
                        help_text_default: 'When true, users can enable Automatic Replies in **Settings > Notifications**. Users set a custom message that will be automatically sent in response to Direct Messages. When false, disables the Automatic Direct Message Replies feature and hides it from Settings.',
                        help_text_markdown: true,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableChannelViewedMessages',
                        label: t('admin.experimental.enableChannelViewedMessages.title'),
                        label_default: 'Enable Channel Viewed WebSocket Messages:',
                        help_text: t('admin.experimental.enableChannelViewedMessages.desc'),
                        help_text_default: 'This setting determines whether `channel_viewed` WebSocket events are sent, which synchronize unread notifications across clients and devices. Disabling the setting in larger deployments may improve server performance.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ExperimentalSettings.ClientSideCertEnable',
                        label: t('admin.experimental.clientSideCertEnable.title'),
                        label_default: 'Enable Client-Side Certification:',
                        help_text: t('admin.experimental.clientSideCertEnable.desc'),
                        help_text_default: 'Enables client-side certification for your Mattermost server. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/deployment/certificate-based-authentication.html'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isHidden: it.not(it.any(
                            it.licensedForSku(LicenseSkus.Enterprise),
                            it.licensedForSku(LicenseSkus.E20))),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'ExperimentalSettings.ClientSideCertCheck',
                        label: t('admin.experimental.clientSideCertCheck.title'),
                        label_default: 'Client-Side Certification Login Method:',
                        help_text: t('admin.experimental.clientSideCertCheck.desc'),
                        help_text_default: 'When **primary**, after the client side certificate is verified, user’s email is retrieved from the certificate and is used to log in without a password. When **secondary**, after the client side certificate is verified, user’s email is retrieved from the certificate and matched against the one supplied by the user. If they match, the user logs in with regular email/password credentials.',
                        help_text_markdown: true,
                        options: [
                            {
                                value: 'primary',
                                display_name: 'primary',
                                display_name_default: 'primary',
                            },
                            {
                                value: 'secondary',
                                display_name: 'secondary',
                                display_name_default: 'secondary',
                            },
                        ],
                        isHidden: it.not(it.any(
                            it.licensedForSku(LicenseSkus.Enterprise),
                            it.licensedForSku(LicenseSkus.E20))),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                            it.stateIsFalse('ExperimentalSettings.ClientSideCertEnable'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages',
                        label: t('admin.experimental.experimentalEnableDefaultChannelLeaveJoinMessages.title'),
                        label_default: 'Enable Default Channel Leave/Join System Messages:',
                        help_text: t('admin.experimental.experimentalEnableDefaultChannelLeaveJoinMessages.desc'),
                        help_text_default: 'This setting determines whether team leave/join system messages are posted in the default town-square channel.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.ExperimentalEnableHardenedMode',
                        label: t('admin.experimental.experimentalEnableHardenedMode.title'),
                        label_default: 'Enable Hardened Mode:',
                        help_text: t('admin.experimental.experimentalEnableHardenedMode.desc'),
                        help_text_default: 'Enables a hardened mode for Mattermost that makes user experience trade-offs in the interest of security. See <link>documentation</link> to learn more.',
                        help_text_values: {
                            link: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://docs.mattermost.com/administration/config-settings.html#enable-hardened-mode-experimental'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnablePreviewFeatures',
                        label: t('admin.experimental.enablePreviewFeatures.title'),
                        label_default: 'Enable Preview Features:',
                        help_text: t('admin.experimental.enablePreviewFeatures.desc'),
                        help_text_default: 'When true, preview features can be enabled from **Settings > Advanced > Preview pre-release features**. When false, disables and hides preview features from **Settings > Advanced > Preview pre-release features**.',
                        help_text_markdown: true,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ThemeSettings.EnableThemeSelection',
                        label: t('admin.experimental.enableThemeSelection.title'),
                        label_default: 'Enable Theme Selection:',
                        help_text: t('admin.experimental.enableThemeSelection.desc'),
                        help_text_default: 'Enables the **Display > Theme** tab in Settings so users can select their theme.',
                        help_text_markdown: true,
                        isHidden: it.any(
                            it.not(it.licensed),
                            it.licensedForSku('starter'),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ThemeSettings.AllowCustomThemes',
                        label: t('admin.experimental.allowCustomThemes.title'),
                        label_default: 'Allow Custom Themes:',
                        help_text: t('admin.experimental.allowCustomThemes.desc'),
                        help_text_default: 'Enables the **Display > Theme > Custom Theme** section in Settings.',
                        help_text_markdown: true,
                        isHidden: it.any(
                            it.not(it.licensed),
                            it.licensedForSku('starter'),
                        ),
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                            it.stateIsFalse('ThemeSettings.EnableThemeSelection'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_DROPDOWN,
                        key: 'ThemeSettings.DefaultTheme',
                        label: t('admin.experimental.defaultTheme.title'),
                        label_default: 'Default Theme:',
                        help_text: t('admin.experimental.defaultTheme.desc'),
                        help_text_default: 'Set a default theme that applies to all new users on the system.',
                        help_text_markdown: true,
                        options: [
                            {
                                value: 'denim',
                                display_name: 'Denim',
                                display_name_default: 'Denim',
                            },
                            {
                                value: 'sapphire',
                                display_name: 'Sapphire',
                                display_name_default: 'Sapphire',
                            },
                            {
                                value: 'quartz',
                                display_name: 'Quartz',
                                display_name_default: 'Quartz',
                            },
                            {
                                value: 'indigo',
                                display_name: 'Indigo',
                                display_name_default: 'Indigo',
                            },
                            {
                                value: 'onyx',
                                display_name: 'Onyx',
                                display_name_default: 'Onyx',
                            },
                        ],
                        isHidden: it.any(
                            it.not(it.licensed),
                            it.licensedForSku('starter'),
                        ),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableTutorial',
                        label: t('admin.experimental.enableTutorial.title'),
                        label_default: 'Enable Tutorial:',
                        help_text: t('admin.experimental.enableTutorial.desc'),
                        help_text_default: 'When true, users are prompted with a tutorial when they open Mattermost for the first time after account creation. When false, the tutorial is disabled, and users are placed in Town Square when they open Mattermost for the first time after account creation.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableOnboardingFlow',
                        label: t('admin.experimental.enableOnboardingFlow.title'),
                        label_default: 'Enable Onboarding:',
                        help_text: t('admin.experimental.enableOnboardingFlow.desc'),
                        help_text_default: 'When true, new users are shown steps to complete as part of an onboarding process',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ServiceSettings.EnableUserTypingMessages',
                        label: t('admin.experimental.enableUserTypingMessages.title'),
                        label_default: 'Enable User Typing Messages:',
                        help_text: t('admin.experimental.enableUserTypingMessages.desc'),
                        help_text_default: 'This setting determines whether "user is typing..." messages are displayed below the message box. Disabling the setting in larger deployments may improve server performance.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds',
                        label: t('admin.experimental.timeBetweenUserTypingUpdatesMilliseconds.title'),
                        label_default: 'User Typing Timeout:',
                        help_text: t('admin.experimental.timeBetweenUserTypingUpdatesMilliseconds.desc'),
                        help_text_default: 'The number of milliseconds to wait between emitting user typing websocket events.',
                        help_text_markdown: false,
                        placeholder: t('admin.experimental.timeBetweenUserTypingUpdatesMilliseconds.example'),
                        placeholder_default: 'E.g.: "5000"',
                        isDisabled: it.any(
                            it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                            it.stateIsFalse('ServiceSettings.EnableUserTypingMessages'),
                        ),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_TEXT,
                        key: 'TeamSettings.ExperimentalPrimaryTeam',
                        label: t('admin.experimental.experimentalPrimaryTeam.title'),
                        label_default: 'Primary Team:',
                        help_text: t('admin.experimental.experimentalPrimaryTeam.desc'),
                        help_text_default: 'The primary team of which users on the server are members. When a primary team is set, the options to join other teams or leave the primary team are disabled.',
                        help_text_markdown: true,
                        placeholder: t('admin.experimental.experimentalPrimaryTeam.example'),
                        placeholder_default: 'E.g.: "teamname"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ExperimentalSettings.UseNewSAMLLibrary',
                        label: t('admin.experimental.experimentalUseNewSAMLLibrary.title'),
                        label_default: 'Use Improved SAML Library (Beta):',
                        help_text: t('admin.experimental.experimentalUseNewSAMLLibrary.desc'),
                        help_text_default: 'Enable an updated SAML Library, which does not require the XML Security Library (xmlsec1) to be installed. Warning: Not all providers have been tested. If you experience issues, please contact <linkSupport>support</linkSupport>. Changing this setting requires a server restart before taking effect.',
                        help_text_markdown: false,
                        help_text_values: {
                            linkSupport: (msg) => (
                                <ExternalLink
                                    location='admin_console'
                                    href='https://mattermost.com/support'
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        },
                        isHidden: true || it.not(it.licensedForFeature('SAML')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'SamlSettings.LoginButtonColor',
                        label: t('admin.experimental.samlSettingsLoginButtonColor.title'),
                        label_default: 'SAML Login Button Color:',
                        help_text: t('admin.experimental.samlSettingsLoginButtonColor.desc'),
                        help_text_default: 'Specify the color of the SAML login button for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('SAML')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'SamlSettings.LoginButtonBorderColor',
                        label: t('admin.experimental.samlSettingsLoginButtonBorderColor.title'),
                        label_default: 'SAML Login Button Border Color:',
                        help_text: t('admin.experimental.samlSettingsLoginButtonBorderColor.desc'),
                        help_text_default: 'Specify the color of the SAML login button border for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('SAML')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_COLOR,
                        key: 'SamlSettings.LoginButtonTextColor',
                        label: t('admin.experimental.samlSettingsLoginButtonTextColor.title'),
                        label_default: 'SAML Login Button Text Color:',
                        help_text: t('admin.experimental.samlSettingsLoginButtonTextColor.desc'),
                        help_text_default: 'Specify the color of the SAML login button text for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.',
                        help_text_markdown: false,
                        isHidden: it.not(it.licensedForFeature('SAML')),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'DisplaySettings.ExperimentalTimezone',
                        label: t('admin.experimental.experimentalTimezone.title'),
                        label_default: 'Timezone:',
                        help_text: t('admin.experimental.experimentalTimezone.desc'),
                        help_text_default: 'Select the timezone used for timestamps in the user interface and email notifications. When true, the Timezone section is visible in the Settings and a time zone is automatically assigned in the next active session. When false, the Timezone setting is hidden in the Settings.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'EmailSettings.UseChannelInEmailNotifications',
                        label: t('admin.experimental.useChannelInEmailNotifications.title'),
                        label_default: 'Use Channel Name in Email Notifications:',
                        help_text: t('admin.experimental.useChannelInEmailNotifications.desc'),
                        help_text_default: 'When true, channel and team name appears in email notification subject lines. Useful for servers using only one team. When false, only team name appears in email notification subject line.',
                        help_text_markdown: false,
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_NUMBER,
                        key: 'TeamSettings.UserStatusAwayTimeout',
                        label: t('admin.experimental.userStatusAwayTimeout.title'),
                        label_default: 'User Status Away Timeout:',
                        help_text: t('admin.experimental.userStatusAwayTimeout.desc'),
                        help_text_default: 'This setting defines the number of seconds after which the user’s status indicator changes to "Away", when they are away from Mattermost.',
                        help_text_markdown: false,
                        placeholder: t('admin.experimental.userStatusAwayTimeout.example'),
                        placeholder_default: 'E.g.: "300"',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ExperimentalSettings.EnableSharedChannels',
                        label: t('admin.experimental.enableSharedChannels.title'),
                        label_default: 'Enable Shared Channels:',
                        help_text: t('admin.experimental.enableSharedChannels.desc'),
                        help_text_default: 'Toggles Shared Channels',
                        help_text_markdown: false,
                        isHidden: it.not(it.any(
                            it.licensedForFeature('SharedChannels'),
                            it.licensedForSku(LicenseSkus.Enterprise),
                            it.licensedForSku(LicenseSkus.Professional),
                        )),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ExperimentalSettings.EnableAppBar',
                        label: t('admin.experimental.enableAppBar.title'),
                        label_default: 'Enable App Bar:',
                        help_text: t('admin.experimental.enableAppBar.desc'),
                        help_text_default: 'When true, all integrations move from the channel header to the App Bar. Channel header plugin icons that haven\'t explicitly registered an App Bar icon will be moved to the App Bar which may result in rendering issues. [See the documentation to learn more](https://docs.mattermost.com/welcome/what-changed-in-v70.html).',
                        help_text_markdown: true,
                        isHidden: it.licensedForFeature('Cloud'),
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ExperimentalSettings.DisableRefetchingOnBrowserFocus',
                        label: t('admin.experimental.disableRefetchingOnBrowserFocus.title'),
                        label_default: 'Disable data refetching on browser refocus:',
                        help_text: t('admin.experimental.disableRefetchingOnBrowserFocus.desc'),
                        help_text_default: 'When true, Mattermost will not refetch channels and channel members when the browser regains focus. This may result in improved performance for users with many channels and channel members.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                    {
                        type: Constants.SettingsTypes.TYPE_BOOL,
                        key: 'ExperimentalSettings.DelayChannelAutocomplete',
                        label: t('admin.experimental.delayChannelAutocomplete.title'),
                        label_default: 'Delay Channel Autocomplete:',
                        help_text: t('admin.experimental.delayChannelAutocomplete.desc'),
                        help_text_default: 'When true, the autocomplete for channel links (such as ~town-square) will only trigger after typing a tilde followed by a couple letters. When false, the autocomplete will appear as soon as the user types a tilde.',
                        isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                    },
                ],
            },
        },
        feature_flags: {
            url: 'experimental/feature_flags',
            title: t('admin.feature_flags.title'),
            title_default: 'Feature Flags',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURE_FLAGS)),
            ),
            isDisabled: true,
            searchableStrings: [
                'admin.feature_flags.title',
            ],
            schema: {
                id: 'Feature Flags',
                component: FeatureFlags,
            },
        },
        bleve: {
            url: 'experimental/blevesearch',
            title: t('admin.sidebar.blevesearch'),
            title_default: 'Bleve',
            isHidden: it.any(
                it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.BLEVE)),
            ),
            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.BLEVE)),
            searchableStrings: [
                'admin.bleve.title',
                'admin.bleve.enableIndexingTitle',
                ['admin.bleve.enableIndexingDescription', {documentationLink: ''}],
                'admin.bleve.enableIndexingDescription.documentationLinkText',
                'admin.bleve.bulkIndexingTitle',
                'admin.bleve.createJob.help',
                'admin.bleve.purgeIndexesHelpText',
                'admin.bleve.purgeIndexesButton',
                'admin.bleve.purgeIndexesButton.label',
                'admin.bleve.enableSearchingTitle',
                'admin.bleve.enableSearchingDescription',
            ],
            schema: {
                id: 'BleveSettings',
                component: BleveSettings,
            },
        },
    },
};

t('admin.field_names.allowBannerDismissal');
t('admin.field_names.bannerColor');
t('admin.field_names.bannerText');
t('admin.field_names.bannerTextColor');
t('admin.field_names.enableBanner');
t('admin.field_names.enableCommands');
t('admin.field_names.enableConfirmNotificationsToChannel');
t('admin.field_names.enableIncomingWebhooks');
t('admin.field_names.enableOAuthServiceProvider');
t('admin.field_names.enableOutgoingWebhooks');
t('admin.field_names.enablePostIconOverride');
t('admin.field_names.enablePostUsernameOverride');
t('admin.field_names.enableUserAccessTokens');
t('admin.field_names.enableUserCreation');
t('admin.field_names.maxChannelsPerTeam');
t('admin.field_names.maxNotificationsPerChannel');
t('admin.field_names.maxUsersPerTeam');
t('admin.field_names.postEditTimeLimit');
t('admin.field_names.restrictCreationToDomains');
t('admin.field_names.restrictDirectMessage');
t('admin.field_names.teammateNameDisplay');

export default AdminDefinition;
