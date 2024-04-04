// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';

import {AccountMultipleOutlineIcon, ChartBarIcon, CogOutlineIcon, CreditCardOutlineIcon, FlaskOutlineIcon, FormatListBulletedIcon, InformationOutlineIcon, PowerPlugOutlineIcon, ServerVariantIcon, ShieldOutlineIcon, SitemapIcon} from '@mattermost/compass-icons/components';
import type {CloudState, Product} from '@mattermost/types/cloud';
import type {AdminConfig, ClientLicense} from '@mattermost/types/config';
import type {Job} from '@mattermost/types/jobs';

import {RESOURCE_KEYS} from 'mattermost-redux/constants/permissions_sysconsole';

import {
    ldapTest, invalidateAllCaches, reloadConfig, testS3Connection,
    removeIdpSamlCertificate, uploadIdpSamlCertificate,
    removePrivateSamlCertificate, uploadPrivateSamlCertificate,
    removePublicSamlCertificate, uploadPublicSamlCertificate,
    removePrivateLdapCertificate, uploadPrivateLdapCertificate,
    removePublicLdapCertificate, uploadPublicLdapCertificate,
    invalidateAllEmailInvites, testSmtp, testSiteURL, getSamlMetadataFromIdp, setSamlIdpCertificateFromMetadata,
} from 'actions/admin_actions';
import {trackEvent} from 'actions/telemetry_actions.jsx';

import CustomPluginSettings from 'components/admin_console/custom_plugin_settings';
import PluginManagement from 'components/admin_console/plugin_management';
import SystemAnalytics from 'components/analytics/system_analytics';
import {searchableStrings as systemAnalyticsSearchableStrings} from 'components/analytics/system_analytics/system_analytics';
import TeamAnalytics from 'components/analytics/team_analytics';
import {searchableStrings as teamAnalyticsSearchableStrings} from 'components/analytics/team_analytics/team_analytics';
import ExternalLink from 'components/external_link';
import RestrictedIndicator from 'components/widgets/menu/menu_items/restricted_indicator';

import {Constants, CloudProducts, LicenseSkus, AboutLinks, DocLinks, DeveloperLinks} from 'utils/constants';
import {isCloudLicense} from 'utils/license_utils';
import {getSiteURL} from 'utils/url';

import * as DefinitionConstants from './admin_definition_constants';
import Audits from './audits';
import {searchableStrings as auditSearchableStrings} from './audits/audits';
import BillingHistory, {searchableStrings as billingHistorySearchableStrings} from './billing/billing_history';
import BillingSubscriptions, {searchableStrings as billingSubscriptionSearchableStrings} from './billing/billing_subscriptions';
import CompanyInfo, {searchableStrings as billingCompanyInfoSearchableStrings} from './billing/company_info';
import CompanyInfoEdit from './billing/company_info_edit';
import PaymentInfo, {searchableStrings as billingPaymentInfoSearchableStrings} from './billing/payment_info';
import PaymentInfoEdit from './billing/payment_info_edit';
import BleveSettings, {searchableStrings as bleveSearchableStrings} from './bleve_settings';
import BrandImageSetting from './brand_image_setting/brand_image_setting';
import ClusterSettings, {searchableStrings as clusterSearchableStrings} from './cluster_settings';
import CustomEnableDisableGuestAccountsSetting from './custom_enable_disable_guest_accounts_setting';
import CustomTermsOfServiceSettings from './custom_terms_of_service_settings';
import {messages as customTermsOfServiceMessages, searchableStrings as customTermsOfServiceSearchableStrings} from './custom_terms_of_service_settings/custom_terms_of_service_settings';
import CustomURLSchemesSetting from './custom_url_schemes_setting';
import DataRetentionSettings from './data_retention_settings';
import CustomDataRetentionForm from './data_retention_settings/custom_policy_form';
import {searchableStrings as dataRetentionSearchableStrings} from './data_retention_settings/data_retention_settings';
import GlobalDataRetentionForm from './data_retention_settings/global_policy_form';
import DatabaseSettings, {searchableStrings as databaseSearchableStrings} from './database_settings';
import ElasticSearchSettings, {searchableStrings as elasticSearchSearchableStrings} from './elasticsearch_settings';
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
import FeatureFlags, {messages as featureFlagsMessages} from './feature_flags';
import GroupDetails from './group_settings/group_details';
import GroupSettings from './group_settings/group_settings';
import IPFiltering from './ip_filtering';
import LicenseSettings from './license_settings';
import {searchableStrings as licenseSettingsSearchableStrings} from './license_settings/license_settings';
import MessageExportSettings, {searchableStrings as messageExportSearchableStrings} from './message_export_settings';
import OpenIdConvert from './openid_convert';
import PasswordSettings, {searchableStrings as passwordSearchableStrings} from './password_settings';
import PermissionSchemesSettings from './permission_schemes_settings';
import {searchableStrings as PermissionSchemeSearchableStrings} from './permission_schemes_settings/permission_schemes_settings';
import PermissionSystemSchemeSettings from './permission_schemes_settings/permission_system_scheme_settings';
import PermissionTeamSchemeSettings from './permission_schemes_settings/permission_team_scheme_settings';
import {searchableStrings as pluginManagementSearchableStrings} from './plugin_management/plugin_management';
import PushNotificationsSettings, {searchableStrings as pushSearchableStrings} from './push_settings';
import ServerLogs from './server_logs';
import {searchableStrings as serverLogsSearchableStrings} from './server_logs/logs';
import SessionLengthSettings, {searchableStrings as sessionLengthSearchableStrings} from './session_length_settings';
import SystemRoles from './system_roles';
import SystemRole from './system_roles/system_role';
import SystemUserDetail from './system_user_detail';
import SystemUsers from './system_users';
import {searchableStrings as systemUsersSearchableStrings} from './system_users/system_users';
import ChannelSettings from './team_channel_settings/channel';
import ChannelDetails from './team_channel_settings/channel/details';
import TeamSettings from './team_channel_settings/team';
import TeamDetails from './team_channel_settings/team/details';
import type {Check, AdminDefinition as AdminDefinitionType, ConsoleAccess} from './types';
import ValidationResult from './validation';
import WorkspaceOptimizationDashboard from './workspace-optimization/dashboard';

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
    not: (func: Check) => (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => {
        return typeof func === 'function' ? !func(config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) : !func;
    },
    all: (...funcs: Check[]) => (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => {
        for (const func of funcs) {
            if (typeof func === 'function' ? !func(config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) : !func) {
                return false;
            }
        }
        return true;
    },
    any: (...funcs: Check[]) => (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => {
        for (const func of funcs) {
            if (typeof func === 'function' ? func(config, state, license, enterpriseReady, consoleAccess, cloud, isSystemAdmin) : func) {
                return true;
            }
        }
        return false;
    },
    stateMatches: (key: string, regex: RegExp) => (config: Partial<AdminConfig>, state: any) => state[key].match(regex),
    stateEquals: (key: string, value: any) => (config: Partial<AdminConfig>, state: any) => state[key] === value,
    stateIsTrue: (key: string) => (config: Partial<AdminConfig>, state: any) => Boolean(state[key]),
    stateIsFalse: (key: string) => (config: Partial<AdminConfig>, state: any) => !state[key],
    configIsTrue: (group: keyof Partial<AdminConfig>, setting: string) => (config: Partial<AdminConfig>) => Boolean((config[group] as any)?.[setting]),
    configIsFalse: (group: keyof Partial<AdminConfig>, setting: string) => (config: Partial<AdminConfig>) => !(config[group] as any)?.[setting],
    configContains: (group: keyof Partial<AdminConfig>, setting: string, word: string) => (config: Partial<AdminConfig>) => Boolean((config[group] as any)?.[setting]?.includes(word)),
    enterpriseReady: (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean) => Boolean(enterpriseReady),
    licensed: (config: Partial<AdminConfig>, state: any, license?: ClientLicense) => license?.IsLicensed === 'true',
    cloudLicensed: (config: Partial<AdminConfig>, state: any, license?: ClientLicense) => Boolean(license?.IsLicensed && isCloudLicense(license)),
    licensedForFeature: (feature: string) => (config: Partial<AdminConfig>, state: any, license?: ClientLicense) => Boolean(license?.IsLicensed && license[feature] === 'true'),
    licensedForSku: (skuName: string) => (config: Partial<AdminConfig>, state: any, license?: ClientLicense) => Boolean(license?.IsLicensed && license.SkuShortName === skuName),
    licensedForCloudStarter: (config: Partial<AdminConfig>, state: any, license?: ClientLicense) => Boolean(license?.IsLicensed && isCloudLicense(license) && license.SkuShortName === LicenseSkus.Starter),
    hidePaymentInfo: (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState) => {
        if (!cloud) {
            return true;
        }
        const productId = cloud?.subscription?.product_id;
        if (!productId) {
            return false;
        }
        return cloud?.subscription?.is_free_trial === 'true';
    },
    userHasReadPermissionOnResource: (key: string) => (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess) => (consoleAccess?.read as any)?.[key],
    userHasReadPermissionOnSomeResources: (key: string | {[key: string]: string}) => Object.values(key).some((resource) => it.userHasReadPermissionOnResource(resource)),
    userHasWritePermissionOnResource: (key: string) => (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess) => (consoleAccess?.write as any)?.[key],
    isSystemAdmin: (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => Boolean(isSystemAdmin),
};

export const validators = {
    isRequired: (text: MessageDescriptor | string) => (value: string) => new ValidationResult(Boolean(value), text),
    minValue: (min: number, text: MessageDescriptor | string) => (value: number) => new ValidationResult((value >= min), text),
    maxValue: (max: number, text: MessageDescriptor | string) => (value: number) => new ValidationResult((value <= max), text),
};

const usesLegacyOauth = (config: Partial<AdminConfig>, state: any, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState) => {
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
    value: (cloud: CloudState) => (
        <RestrictedIndicator
            useModal={false}
            blocked={displayBlocked || !(cloud?.subscription?.is_free_trial === 'true')}
            minimumPlanRequiredForFeature={minimumPlanRequiredForFeature}
            tooltipMessageBlocked={defineMessage({
                id: 'admin.sidebar.restricted_indicator.tooltip.message.blocked',
                defaultMessage: 'This is {article} {minimumPlanRequiredForFeature} feature, available with an upgrade or free {trialLength}-day trial',
            })}
        />
    ),
    shouldDisplay: (license: ClientLicense, subscriptionProduct: Product|undefined) => displayBlocked || (isCloudLicense(license) && subscriptionProduct?.sku === CloudProducts.STARTER),
});

const adminDefinitionMessages = defineMessages({
    data_retention_title: {id: 'admin.data_retention.title', defaultMessage: 'Data Retention Policy'},
    ip_filtering_title: {id: 'admin.sidebar.ip_filtering', defaultMessage: 'IP Filtering'},
});
const AdminDefinition: AdminDefinitionType = {
    about: {
        icon: (
            <InformationOutlineIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.about', defaultMessage: 'About'}),
        isHidden: it.any(
            it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
            it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.ABOUT)),
        ),
        subsections: {
            license: {
                url: 'about/license',
                title: defineMessage({id: 'admin.sidebar.license', defaultMessage: 'Edition and License'}),
                searchableStrings: licenseSettingsSearchableStrings,
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                schema: {
                    id: 'LicenseSettings',
                    component: LicenseSettings,
                },
            },
        },
    },
    billing: {
        icon: (
            <CreditCardOutlineIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.billing', defaultMessage: 'Billing & Account'}),
        isHidden: it.any(
            it.not(it.enterpriseReady),
            it.not(it.userHasReadPermissionOnResource('billing')),
            it.not(it.licensed),
            it.all(
                it.not(it.licensedForFeature('Cloud')),
                it.configIsFalse('ServiceSettings', 'SelfHostedPurchase'),
            ),
        ),
        subsections: {
            subscription: {
                url: 'billing/subscription',
                title: defineMessage({id: 'admin.sidebar.subscription', defaultMessage: 'Subscription'}),
                searchableStrings: billingSubscriptionSearchableStrings,
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
                title: defineMessage({id: 'admin.sidebar.billing_history', defaultMessage: 'Billing History'}),
                searchableStrings: billingHistorySearchableStrings,
                schema: {
                    id: 'BillingHistory',
                    component: BillingHistory,
                },
                isDisabled: it.not(it.userHasWritePermissionOnResource('billing')),
            },
            company_info: {
                url: 'billing/company_info',
                title: defineMessage({id: 'admin.sidebar.company_info', defaultMessage: 'Company Information'}),
                searchableStrings: billingCompanyInfoSearchableStrings,
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
                title: defineMessage({id: 'admin.sidebar.payment_info', defaultMessage: 'Payment Information'}),
                isHidden: it.any(
                    it.hidePaymentInfo,

                    // cloud only view
                    it.not(it.licensedForFeature('Cloud')),
                ),
                searchableStrings: billingPaymentInfoSearchableStrings,
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
    },
    reporting: {
        icon: (
            <ChartBarIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.reporting', defaultMessage: 'Reporting'}),
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.REPORTING)),
        subsections: {
            workspace_optimization: {
                url: 'reporting/workspace_optimization',
                title: defineMessage({id: 'admin.sidebar.workspaceOptimization', defaultMessage: 'Workspace Optimization'}),
                schema: {
                    id: 'WorkspaceOptimizationDashboard',
                    component: WorkspaceOptimizationDashboard,
                },
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
            },
            system_analytics: {
                url: 'reporting/system_analytics',
                title: defineMessage({id: 'admin.sidebar.siteStatistics', defaultMessage: 'Site Statistics'}),
                searchableStrings: systemAnalyticsSearchableStrings,
                schema: {
                    id: 'SystemAnalytics',
                    component: SystemAnalytics,
                },
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.SITE_STATISTICS)),
            },
            team_statistics: {
                url: 'reporting/team_statistics',
                title: defineMessage({id: 'admin.sidebar.teamStatistics', defaultMessage: 'Team Statistics'}),
                searchableStrings: teamAnalyticsSearchableStrings,
                schema: {
                    id: 'TeamAnalytics',
                    component: TeamAnalytics,
                },
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.TEAM_STATISTICS)),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.TEAM_STATISTICS)),
            },
            server_logs: {
                url: 'reporting/server_logs',
                title: defineMessage({id: 'admin.sidebar.logs', defaultMessage: 'Server Logs'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.REPORTING.SERVER_LOGS)),
                ),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.REPORTING.SERVER_LOGS)),
                searchableStrings: serverLogsSearchableStrings,
                schema: {
                    id: 'ServerLogs',
                    component: ServerLogs,
                },
            },
        },
    },
    user_management: {
        icon: (
            <AccountMultipleOutlineIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.userManagement', defaultMessage: 'User Management'}),
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.USER_MANAGEMENT)),
        subsections: {
            system_users: {
                url: 'user_management/users',
                title: defineMessage({id: 'admin.sidebar.users', defaultMessage: 'Users'}),
                searchableStrings: systemUsersSearchableStrings,
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.USER_MANAGEMENT.USERS)),
                schema: {
                    id: 'SystemUsers',
                    component: SystemUsers,
                },
            },
            system_user_detail: {
                url: 'user_management/user/:user_id',
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
                title: defineMessage({id: 'admin.sidebar.groups', defaultMessage: 'Groups'}),
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
                title: defineMessage({id: 'admin.sidebar.groups', defaultMessage: 'Groups'}),
                isHidden: it.any(
                    it.licensedForFeature('LDAPGroups'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'Groups',
                    name: defineMessage({id: 'admin.group_settings.groupsPageTitle', defaultMessage: 'Groups'}),
                    settings: [
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.teams', defaultMessage: 'Teams'}),
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
                title: defineMessage({id: 'admin.sidebar.channels', defaultMessage: 'Channels'}),
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
                title: defineMessage({id: 'admin.sidebar.permissions', defaultMessage: 'Permissions'}),
                searchableStrings: PermissionSchemeSearchableStrings,
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
                title: defineMessage({id: 'admin.sidebar.systemRoles', defaultMessage: 'System Roles'}),
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
                title: defineMessage({id: 'admin.sidebar.systemRoles', defaultMessage: 'System Roles'}),
                isHidden: it.any(
                    it.licensedForFeature('LDAPGroups'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'SystemRoles',
                    name: defineMessage({id: 'admin.permissions.systemRoles', defaultMessage: 'System Roles'}),
                    settings: [
                        {
                            type: 'custom',
                            component: SystemRolesFeatureDiscovery,
                            key: 'SystemRolesFeatureDiscovery',
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                        },
                    ],
                },
                restrictedIndicator: getRestrictedIndicator(true, LicenseSkus.Enterprise),
            },
        },
    },
    environment: {
        icon: (
            <ServerVariantIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.environment', defaultMessage: 'Environment'}),
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.ENVIRONMENT)),
        subsections: {
            web_server: {
                url: 'environment/web_server',
                title: defineMessage({id: 'admin.sidebar.webServer', defaultMessage: 'Web Server'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                ),
                schema: {
                    id: 'ServiceSettings',
                    name: defineMessage({id: 'admin.environment.webServer', defaultMessage: 'Web Server'}),
                    settings: [
                        {
                            type: 'banner',
                            label: defineMessage({id: 'admin.rate.noteDescription', defaultMessage: 'Changing properties in this section will require a server restart before taking effect.'}),
                            banner_type: 'info',
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.SiteURL',
                            label: defineMessage({id: 'admin.service.siteURL', defaultMessage: 'Site URL:'}),
                            help_text: defineMessage({id: 'admin.service.siteURLDescription', defaultMessage: 'The URL that users will use to access Mattermost. Standard ports, such as 80 and 443, can be omitted, but non-standard ports are required. For example: http://example.com:8065. This setting is required. Mattermost may be hosted at a subpath. For example: http://example.com:8065/company/mattermost. A restart is required before the server will work correctly.'}),
                            help_text_markdown: true,
                            placeholder: defineMessage({id: 'admin.service.siteURLExample', defaultMessage: 'E.g.: "http://example.com:8065"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'button',
                            key: 'TestSiteURL',
                            action: testSiteURL,
                            label: defineMessage({id: 'admin.service.testSiteURL', defaultMessage: 'Test Live URL'}),
                            loading: defineMessage({id: 'admin.service.testSiteURLTesting', defaultMessage: 'Testing...'}),
                            error_message: defineMessage({id: 'admin.service.testSiteURLFail', defaultMessage: 'Test unsuccessful: {error}'}),
                            success_message: defineMessage({id: 'admin.service.testSiteURLSuccess', defaultMessage: 'Test successful. This is a valid URL.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.ListenAddress',
                            label: defineMessage({id: 'admin.service.listenAddress', defaultMessage: 'Listen Address:'}),
                            placeholder: defineMessage({id: 'admin.service.listenExample', defaultMessage: 'E.g.: ":8065"'}),
                            help_text: defineMessage({id: 'admin.service.listenDescription', defaultMessage: 'The address and port to which to bind and listen. Specifying ":8065" will bind to all network interfaces. Specifying "127.0.0.1:8065" will only bind to the network interface having that IP address. If you choose a port of a lower level (called "system ports" or "well-known ports", in the range of 0-1023), you must have permissions to bind to that port. On Linux you can use: "sudo setcap cap_net_bind_service=+ep ./bin/mattermost" to allow Mattermost to bind to well-known ports.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.Forward80To443',
                            label: defineMessage({id: 'admin.service.forward80To443', defaultMessage: 'Forward port 80 to 443:'}),
                            help_text: defineMessage({id: 'admin.service.forward80To443Description', defaultMessage: 'Forwards all insecure traffic from port 80 to secure port 443. Not recommended when using a proxy server.'}),
                            disabled_help_text: defineMessage({id: 'admin.service.forward80To443Description.disabled', defaultMessage: 'Forwards all insecure traffic from port 80 to secure port 443. Not recommended when using a proxy server. This setting cannot be enabled until your server is [listening](#ServiceSettings.ListenAddress) on port 443.'}),
                            disabled_help_text_markdown: true,
                            isDisabled: it.any(
                                it.cloudLicensed,
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                                it.not(it.stateMatches('ServiceSettings.ListenAddress', /:443$/)),
                            ),
                        },
                        {
                            type: 'dropdown',
                            key: 'ServiceSettings.ConnectionSecurity',
                            label: defineMessage({id: 'admin.connectionSecurityTitle', defaultMessage: 'Connection Security:'}),
                            help_text: DefinitionConstants.CONNECTION_SECURITY_HELP_TEXT_WEBSERVER,
                            options: [
                                {
                                    value: '',
                                    display_name: defineMessage({id: 'admin.connectionSecurityNone', defaultMessage: 'None'}),
                                },
                                {
                                    value: 'TLS',
                                    display_name: defineMessage({id: 'admin.connectionSecurityTls', defaultMessage: 'TLS (Recommended)'}),
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.TLSCertFile',
                            label: defineMessage({id: 'admin.service.tlsCertFile', defaultMessage: 'TLS Certificate File:'}),
                            help_text: defineMessage({id: 'admin.service.tlsCertFileDescription', defaultMessage: 'The certificate file to use.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                                it.stateIsTrue('ServiceSettings.UseLetsEncrypt'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.TLSKeyFile',
                            label: defineMessage({id: 'admin.service.tlsKeyFile', defaultMessage: 'TLS Key File:'}),
                            help_text: defineMessage({id: 'admin.service.tlsKeyFileDescription', defaultMessage: 'The private key file to use.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                                it.stateIsTrue('ServiceSettings.UseLetsEncrypt'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.UseLetsEncrypt',
                            label: defineMessage({id: 'admin.service.useLetsEncrypt', defaultMessage: 'Use Let\'s Encrypt:'}),
                            help_text: defineMessage({id: 'admin.service.useLetsEncryptDescription', defaultMessage: 'Enable the automatic retrieval of certificates from Let\'s Encrypt. The certificate will be retrieved when a client attempts to connect from a new domain. This will work with multiple domains.'}),
                            disabled_help_text: defineMessage({id: 'admin.service.useLetsEncryptDescription.disabled', defaultMessage: "Enable the automatic retrieval of certificates from Let's Encrypt. The certificate will be retrieved when a client attempts to connect from a new domain. This will work with multiple domains. This setting cannot be enabled unless the [Forward port 80 to 443](#SystemSettings.Forward80To443) setting is set to true."}),
                            disabled_help_text_markdown: true,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                                it.stateIsFalse('ServiceSettings.Forward80To443'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.LetsEncryptCertificateCacheFile',
                            label: defineMessage({id: 'admin.service.letsEncryptCertificateCacheFile', defaultMessage: 'Let\'s Encrypt Certificate Cache File:'}),
                            help_text: defineMessage({id: 'admin.service.letsEncryptCertificateCacheFileDescription', defaultMessage: 'Certificates retrieved and other data about the Let\'s Encrypt service will be stored in this file.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                                it.stateIsFalse('ServiceSettings.UseLetsEncrypt'),
                            ),
                        },
                        {
                            type: 'number',
                            key: 'ServiceSettings.ReadTimeout',
                            label: defineMessage({id: 'admin.service.readTimeout', defaultMessage: 'Read Timeout:'}),
                            help_text: defineMessage({id: 'admin.service.readTimeoutDescription', defaultMessage: 'Maximum time allowed from when the connection is accepted to when the request body is fully read.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'number',
                            key: 'ServiceSettings.WriteTimeout',
                            label: defineMessage({id: 'admin.service.writeTimeout', defaultMessage: 'Write Timeout:'}),
                            help_text: defineMessage({id: 'admin.service.writeTimeoutDescription', defaultMessage: 'If using HTTP (insecure), this is the maximum time allowed from the end of reading the request headers until the response is written. If using HTTPS, it is the total time from when the connection is accepted until the response is written.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'dropdown',
                            key: 'ServiceSettings.WebserverMode',
                            label: defineMessage({id: 'admin.webserverModeTitle', defaultMessage: 'Webserver Mode:'}),
                            help_text: DefinitionConstants.WEBSERVER_MODE_HELP_TEXT,
                            options: [
                                {
                                    value: 'gzip',
                                    display_name: defineMessage({id: 'admin.webserverModeGzip', defaultMessage: 'gzip'}),
                                },
                                {
                                    value: 'uncompressed',
                                    display_name: defineMessage({id: 'admin.webserverModeUncompressed', defaultMessage: 'Uncompressed'}),
                                },
                                {
                                    value: 'disabled',
                                    display_name: defineMessage({id: 'admin.webserverModeDisabled', defaultMessage: 'Disabled'}),
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableInsecureOutgoingConnections',
                            label: defineMessage({id: 'admin.service.insecureTlsTitle', defaultMessage: 'Enable Insecure Outgoing Connections: '}),
                            help_text: defineMessage({id: 'admin.service.insecureTlsDesc', defaultMessage: 'When true, any outgoing HTTPS requests will accept unverified, self-signed certificates. For example, outgoing webhooks to a server with a self-signed TLS certificate, using any domain, will be allowed. Note that this makes these connections susceptible to man-in-the-middle attacks.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.ManagedResourcePaths',
                            label: defineMessage({id: 'admin.service.managedResourcePaths', defaultMessage: 'Managed Resource Paths:'}),
                            help_text: defineMessage({id: 'admin.service.managedResourcePathsDescription', defaultMessage: 'A comma-separated list of paths on the Mattermost server that are managed by another service. See <link>here</link> for more information.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.DESKTOP_MANAGED_RESOURCES}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'button',
                            action: reloadConfig,
                            key: 'ReloadConfigButton',
                            label: defineMessage({id: 'admin.reload.button', defaultMessage: 'Reload Configuration From Disk'}),
                            help_text: defineMessage({id: 'admin.reload.reloadDescription', defaultMessage: 'Deployments using multiple databases can switch from one master database to another without restarting the Mattermost server by updating "config.json" to the new desired configuration and using the {featureName} feature to load the new settings while the server is running. The administrator should then use the {recycleDatabaseConnections} feature to recycle the database connections based on the new settings.'}),
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
                            error_message: defineMessage({id: 'admin.reload.reloadFail', defaultMessage: 'Reload unsuccessful: {error}'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                        {
                            type: 'button',
                            key: 'PurgeButton',
                            action: invalidateAllCaches,
                            label: defineMessage({id: 'admin.purge.button', defaultMessage: 'Purge All Caches'}),
                            help_text: defineMessage({id: 'admin.purge.purgeDescription', defaultMessage: 'This will purge all the in-memory caches for things like sessions, accounts, channels, etc. Deployments using High Availability will attempt to purge all the servers in the cluster. Purging the caches may adversely impact performance.'}),
                            error_message: defineMessage({id: 'admin.purge.purgeFail', defaultMessage: 'Purging unsuccessful: {error}'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.WEB_SERVER)),
                        },
                    ],
                },
            },
            database: {
                url: 'environment/database',
                title: defineMessage({id: 'admin.sidebar.database', defaultMessage: 'Database'}),
                searchableStrings: databaseSearchableStrings,
                isHidden: it.any(
                    it.cloudLicensed,
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
                title: defineMessage({id: 'admin.sidebar.elasticsearch', defaultMessage: 'Elasticsearch'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('Elasticsearch')),
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.ELASTICSEARCH)),
                ),
                searchableStrings: elasticSearchSearchableStrings,
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.ELASTICSEARCH)),
                schema: {
                    id: 'ElasticSearchSettings',
                    component: ElasticSearchSettings,
                },
            },
            storage: {
                url: 'environment/file_storage',
                title: defineMessage({id: 'admin.sidebar.fileStorage', defaultMessage: 'File Storage'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                ),
                schema: {
                    id: 'FileSettings',
                    name: defineMessage({id: 'admin.environment.fileStorage', defaultMessage: 'File Storage'}),
                    settings: [
                        {
                            type: 'dropdown',
                            key: 'FileSettings.DriverName',
                            label: defineMessage({id: 'admin.image.storeTitle', defaultMessage: 'File Storage System:'}),
                            help_text: defineMessage({id: 'admin.image.storeDescription', defaultMessage: 'Storage system where files and image attachments are saved. Selecting "Amazon S3" enables fields to enter your Amazon credentials and bucket details. Selecting "Local File System" enables the field to specify a local file directory.'}),
                            help_text_markdown: true,
                            options: [
                                {
                                    value: FILE_STORAGE_DRIVER_LOCAL,
                                    display_name: defineMessage({id: 'admin.image.storeLocal', defaultMessage: 'Local File System'}),
                                },
                                {
                                    value: FILE_STORAGE_DRIVER_S3,
                                    display_name: defineMessage({id: 'admin.image.storeAmazonS3', defaultMessage: 'Amazon S3'}),
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.Directory',
                            label: defineMessage({id: 'admin.image.localTitle', defaultMessage: 'Local Storage Directory:'}),
                            help_text: defineMessage({id: 'admin.image.localDescription', defaultMessage: 'Directory to which files and images are written. If blank, defaults to ./data/.'}),
                            placeholder: defineMessage({id: 'admin.image.localExample', defaultMessage: 'E.g.: "./data/"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_LOCAL)),
                            ),
                        },
                        {
                            type: 'number',
                            key: 'FileSettings.MaxFileSize',
                            label: defineMessage({id: 'admin.image.maxFileSizeTitle', defaultMessage: 'Maximum File Size:'}),
                            help_text: defineMessage({id: 'admin.image.maxFileSizeDescription', defaultMessage: 'Maximum file size for message attachments in megabytes. Caution: Verify server memory can support your setting choice. Large file sizes increase the risk of server crashes and failed uploads due to network interruptions.'}),
                            placeholder: defineMessage({id: 'admin.image.maxFileSizeExample', defaultMessage: '50'}),
                            onConfigLoad: (configVal) => configVal / MEBIBYTE,
                            onConfigSave: (displayVal) => displayVal * MEBIBYTE,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.ExtractContent',
                            label: defineMessage({id: 'admin.image.extractContentTitle', defaultMessage: 'Enable document search by content:'}),
                            help_text: defineMessage({id: 'admin.image.extractContentDescription', defaultMessage: 'When enabled, supported document types are searchable by their content. Search results for existing documents may be incomplete <link>until a data migration is executed</link>.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.CONFIGURE_DOCUMENT_CONTENT_SEARCH}
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
                            type: 'bool',
                            key: 'FileSettings.ArchiveRecursion',
                            label: defineMessage({id: 'admin.image.archiveRecursionTitle', defaultMessage: 'Enable searching content of documents within ZIP files:'}),
                            help_text: defineMessage({id: 'admin.image.archiveRecursionDescription', defaultMessage: 'When enabled, content of documents within ZIP files will be returned in search results. This may have an impact on server performance for large files. '}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.configIsFalse('FileSettings', 'ExtractContent'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.AmazonS3Bucket',
                            label: defineMessage({id: 'admin.image.amazonS3BucketTitle', defaultMessage: 'Amazon S3 Bucket:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3BucketDescription', defaultMessage: 'Name you selected for your S3 bucket in AWS.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3BucketExample', defaultMessage: 'E.g.: "mattermost-media"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.AmazonS3PathPrefix',
                            label: defineMessage({id: 'admin.image.amazonS3PathPrefixTitle', defaultMessage: 'Amazon S3 Path Prefix:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3PathPrefixDescription', defaultMessage: 'Prefix you selected for your S3 bucket in AWS.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3PathPrefixExample', defaultMessage: 'E.g.: "subdir1/" or you can leave it .'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.AmazonS3Region',
                            label: defineMessage({id: 'admin.image.amazonS3RegionTitle', defaultMessage: 'Amazon S3 Region:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3RegionDescription', defaultMessage: 'AWS region you selected when creating your S3 bucket. If no region is set, Mattermost attempts to get the appropriate region from AWS, or sets it to "us-east-1" if none found.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3RegionExample', defaultMessage: 'E.g.: "us-east-1"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.AmazonS3AccessKeyId',
                            label: defineMessage({id: 'admin.image.amazonS3IdTitle', defaultMessage: 'Amazon S3 Access Key ID:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3IdDescription', defaultMessage: '(Optional) Only required if you do not want to authenticate to S3 using an <link>IAM role</link>. Enter the Access Key ID provided by your Amazon EC2 administrator.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            placeholder: defineMessage({id: 'admin.image.amazonS3IdExample', defaultMessage: 'E.g.: "AKIADTOVBGERKLCBV"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.AmazonS3Endpoint',
                            label: defineMessage({id: 'admin.image.amazonS3EndpointTitle', defaultMessage: 'Amazon S3 Endpoint:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3EndpointDescription', defaultMessage: 'Hostname of your S3 Compatible Storage provider. Defaults to "s3.amazonaws.com".'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3EndpointExample', defaultMessage: 'E.g.: "s3.amazonaws.com"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.AmazonS3SecretAccessKey',
                            label: defineMessage({id: 'admin.image.amazonS3SecretTitle', defaultMessage: 'Amazon S3 Secret Access Key:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3SecretDescription', defaultMessage: '(Optional) The secret access key associated with your Amazon S3 Access Key ID.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3SecretExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.AmazonS3SSL',
                            label: defineMessage({id: 'admin.image.amazonS3SSLTitle', defaultMessage: 'Enable Secure Amazon S3 Connections:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3SSLDescription', defaultMessage: 'When false, allow insecure connections to Amazon S3. Defaults to secure connections only.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.AmazonS3SSE',
                            label: defineMessage({id: 'admin.image.amazonS3SSETitle', defaultMessage: 'Enable Server-Side Encryption for Amazon S3:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3SSEDescription', defaultMessage: 'When true, encrypt files in Amazon S3 using server-side encryption with Amazon S3-managed keys. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.SESSION_LENGTHS}
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
                            type: 'bool',
                            key: 'FileSettings.AmazonS3Trace',
                            label: defineMessage({id: 'admin.image.amazonS3TraceTitle', defaultMessage: 'Enable Amazon S3 Debugging:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3TraceDescription', defaultMessage: '(Development Mode) When true, log additional debugging information to the system logs.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.not(it.stateEquals('FileSettings.DriverName', FILE_STORAGE_DRIVER_S3)),
                            ),
                        },
                        {
                            type: 'button',
                            action: testS3Connection,
                            key: 'TestS3Connection',
                            label: defineMessage({id: 'admin.s3.connectionS3Test', defaultMessage: 'Test Connection'}),
                            loading: defineMessage({id: 'admin.s3.testing', defaultMessage: 'Testing...'}),
                            error_message: defineMessage({id: 'admin.s3.s3Fail', defaultMessage: 'Connection unsuccessful: {error}'}),
                            success_message: defineMessage({id: 'admin.s3.s3Success', defaultMessage: 'Connection was successful'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                        },
                    ],
                },
            },
            export_storage: {
                url: 'environment/export_storage',
                title: defineMessage({id: 'admin.sidebar.exportStorage', defaultMessage: 'Export Storage'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('Cloud')),
                    it.not(it.licensedForSku(LicenseSkus.Enterprise)),
                    it.configIsFalse('FeatureFlags', 'CloudDedicatedExportUI'),
                ),
                schema: {
                    id: 'ExportFileSettings',
                    name: defineMessage({id: 'admin.sidebar.exportStorage', defaultMessage: 'Export Storage'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'FileSettings.DedicatedExportStore',
                            label: defineMessage({id: 'admin.exportStorage.dedicatedExportStore', defaultMessage: 'Enable Dedicated Export Store:'}),
                            help_text: defineMessage({id: 'admin.exportStorage.dedicatedExportStoreDescription', defaultMessage: 'When enabled, Mattermost will use a dedicated export storage bucket for all export operations. This is required for Mattermost Cloud deployments.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                        },
                        {
                            type: 'dropdown',
                            key: 'FileSettings.ExportDriverName',
                            label: defineMessage({id: 'admin.exportStorage.exportDriverName', defaultMessage: 'Export Storage Driver:'}),
                            isDisabled: true,
                            isHidden: it.stateEquals('FileSettings.DedicatedExportStore', false),
                            options: [
                                {
                                    value: FILE_STORAGE_DRIVER_S3,
                                    display_name: defineMessage({id: 'admin.image.storeAmazonS3', defaultMessage: 'Amazon S3'}),
                                },
                            ],
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.ExportDirectory',
                            label: defineMessage({id: 'admin.exportStorage.exportDirectory', defaultMessage: 'Export Directory'}),
                            help_text: defineMessage({id: 'admin.image.exportDirectoryDescription', defaultMessage: 'Directory to which files are written. If blank, defaults to ./data/.'}),
                            placeholder: defineMessage({id: 'admin.image.localExample', defaultMessage: 'E.g.: "./data/"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.ExportAmazonS3AccessKeyId',
                            label: defineMessage({id: 'admin.image.amazonS3IdTitle', defaultMessage: 'Amazon S3 Access Key ID:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3IdDescription', defaultMessage: '(Optional) Only required if you do not want to authenticate to S3 using an <link>IAM role</link>. Enter the Access Key ID provided by your Amazon EC2 administrator.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-ec2_instance-profiles.html'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            placeholder: defineMessage({id: 'admin.image.amazonS3IdExample', defaultMessage: 'E.g.: "AKIADTOVBGERKLCBV"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.ExportAmazonS3SecretAccessKey',
                            label: defineMessage({id: 'admin.image.amazonS3SecretTitle', defaultMessage: 'Amazon S3 Secret Access Key:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3SecretDescription', defaultMessage: '(Optional) The secret access key associated with your Amazon S3 Access Key ID.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3SecretExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.ExportAmazonS3Bucket',
                            label: defineMessage({id: 'admin.image.amazonS3BucketTitle', defaultMessage: 'Amazon S3 Bucket:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3BucketDescription', defaultMessage: 'Name you selected for your S3 bucket in AWS.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3BucketExample', defaultMessage: 'E.g.: "mattermost-export"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.ExportAmazonS3PathPrefix',
                            label: defineMessage({id: 'admin.image.amazonS3PathPrefixTitle', defaultMessage: 'Amazon S3 Path Prefix:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3PathPrefixDescription', defaultMessage: 'Prefix you selected for your S3 bucket in AWS.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3PathPrefixExample', defaultMessage: 'E.g.: "subdir1/" or you can leave it .'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.ExportAmazonS3Region',
                            label: defineMessage({id: 'admin.image.amazonS3RegionTitle', defaultMessage: 'Amazon S3 Region:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3RegionDescription', defaultMessage: 'AWS region you selected when creating your S3 bucket. If no region is set, Mattermost attempts to get the appropriate region from AWS, or sets it to "us-east-1" if none found.'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3RegionExample', defaultMessage: 'E.g.: "us-east-1"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'text',
                            key: 'FileSettings.ExportAmazonS3Endpoint',
                            label: defineMessage({id: 'admin.image.amazonS3EndpointTitle', defaultMessage: 'Amazon S3 Endpoint:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3EndpointDescription', defaultMessage: 'Hostname of your S3 Compatible Storage provider. Defaults to "s3.amazonaws.com".'}),
                            placeholder: defineMessage({id: 'admin.image.amazonS3EndpointExample', defaultMessage: 'E.g.: "s3.amazonaws.com"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.ExportAmazonS3SSL',
                            label: defineMessage({id: 'admin.image.amazonS3SSLTitle', defaultMessage: 'Enable Secure Amazon S3 Connections:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3SSLDescription', defaultMessage: 'When false, allow insecure connections to Amazon S3. Defaults to secure connections only.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.ExportAmazonSignV2',
                            label: defineMessage({id: 'admin.image.amazonS3SignV2', defaultMessage: 'Enable Sign V2'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3SignV2Description', defaultMessage: 'When true, use Sign V2 for Amazon S3 connections'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.ExportAmazonS3SSE',
                            label: defineMessage({id: 'admin.image.amazonS3SSETitle', defaultMessage: 'Enable Server-Side Encryption for Amazon S3:'}),
                            help_text: defineMessage({id: 'admin.image.amazonS3SSEDescription', defaultMessage: 'When true, encrypt files in Amazon S3 using server-side encryption with Amazon S3-managed keys. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.SESSION_LENGTHS}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                                it.stateEquals('FileSettings.DedicatedExportStore', false),
                            ),
                        },
                        {
                            type: 'button',
                            action: testS3Connection,
                            key: 'TestS3Connection',
                            label: defineMessage({id: 'admin.s3.connectionS3Test', defaultMessage: 'Test Connection'}),
                            loading: defineMessage({id: 'admin.s3.testing', defaultMessage: 'Testing...'}),
                            error_message: defineMessage({id: 'admin.s3.s3Fail', defaultMessage: 'Connection unsuccessful: {error}'}),
                            success_message: defineMessage({id: 'admin.s3.s3Success', defaultMessage: 'Connection was successful'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.FILE_STORAGE)),
                            isHidden: it.any(it.stateEquals('FileSettings.ExportDriverName', 'NONE'), it.stateEquals('FileSettings.DedicatedExportStore', false)),
                        },
                    ],
                },
            },
            image_proxy: {
                url: 'environment/image_proxy',
                title: defineMessage({id: 'admin.sidebar.imageProxy', defaultMessage: 'Image Proxy'}),
                isHidden: it.any(
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                ),
                schema: {
                    id: 'ImageProxy',
                    name: defineMessage({id: 'admin.environment.imageProxy', defaultMessage: 'Image Proxy'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'ImageProxySettings.Enable',
                            label: defineMessage({id: 'admin.image.enableProxy', defaultMessage: 'Enable Image Proxy:'}),
                            help_text: defineMessage({id: 'admin.image.enableProxyDescription', defaultMessage: 'When true, enables an image proxy for loading all Markdown images.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                        },
                        {
                            type: 'dropdown',
                            key: 'ImageProxySettings.ImageProxyType',
                            label: defineMessage({id: 'admin.image.proxyType', defaultMessage: 'Image Proxy Type:'}),
                            help_text: defineMessage({id: 'admin.image.proxyTypeDescription', defaultMessage: 'Configure an image proxy to load all Markdown images through a proxy. The image proxy prevents users from making insecure image requests, provides caching for increased performance, and automates image adjustments such as resizing. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.SETUP_IMAGE_PROXY}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            options: [
                                {
                                    value: 'atmos/camo',
                                    display_name: defineMessage({id: 'atmos/camo', defaultMessage: 'atmos/camo'}),
                                },
                                {
                                    value: 'local',
                                    display_name: defineMessage({id: 'local', defaultMessage: 'local'}),
                                },
                            ],
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                                it.stateIsFalse('ImageProxySettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'ImageProxySettings.RemoteImageProxyURL',
                            label: defineMessage({id: 'admin.image.proxyURL', defaultMessage: 'Remote Image Proxy URL:'}),
                            help_text: defineMessage({id: 'admin.image.proxyURLDescription', defaultMessage: 'URL of your remote image proxy server.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.IMAGE_PROXY)),
                                it.stateIsFalse('ImageProxySettings.Enable'),
                                it.stateEquals('ImageProxySettings.ImageProxyType', 'local'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'ImageProxySettings.RemoteImageProxyOptions',
                            label: defineMessage({id: 'admin.image.proxyOptions', defaultMessage: 'Remote Image Proxy Options:'}),
                            help_text: defineMessage({id: 'admin.image.proxyOptionsDescription', defaultMessage: 'Additional options such as the URL signing key. Refer to your image proxy documentation to learn more about what options are supported.'}),
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
                title: defineMessage({id: 'admin.sidebar.smtp', defaultMessage: 'SMTP'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                ),
                schema: {
                    id: 'SMTP',
                    name: defineMessage({id: 'admin.environment.smtp', defaultMessage: 'SMTP'}),
                    settings: [
                        {
                            type: 'text',
                            key: 'EmailSettings.SMTPServer',
                            label: defineMessage({id: 'admin.environment.smtp.smtpServer.title', defaultMessage: 'SMTP Server:'}),
                            placeholder: defineMessage({id: 'admin.environment.smtp.smtpServer.placeholder', defaultMessage: 'Ex: "smtp.yourcompany.com", "email-smtp.us-east-1.amazonaws.com"'}),
                            help_text: defineMessage({id: 'admin.environment.smtp.smtpServer.description', defaultMessage: 'Location of SMTP email server.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                        },
                        {
                            type: 'text',
                            key: 'EmailSettings.SMTPPort',
                            label: defineMessage({id: 'admin.environment.smtp.smtpPort.title', defaultMessage: 'SMTP Server Port:'}),
                            placeholder: defineMessage({id: 'admin.environment.smtp.smtpPort.placeholder', defaultMessage: 'Ex: "25", "465", "587"'}),
                            help_text: defineMessage({id: 'admin.environment.smtp.smtpPort.description', defaultMessage: 'Port of SMTP email server.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnableSMTPAuth',
                            label: defineMessage({id: 'admin.environment.smtp.smtpAuth.title', defaultMessage: 'Enable SMTP Authentication:'}),
                            help_text: defineMessage({id: 'admin.environment.smtp.smtpAuth.description', defaultMessage: 'When true, SMTP Authentication is enabled.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                        },
                        {
                            type: 'text',
                            key: 'EmailSettings.SMTPUsername',
                            label: defineMessage({id: 'admin.environment.smtp.smtpUsername.title', defaultMessage: 'SMTP Server Username:'}),
                            placeholder: defineMessage({id: 'admin.environment.smtp.smtpUsername.placeholder', defaultMessage: 'Ex: "admin@yourcompany.com", "AKIADTOVBGERKLCBV"'}),
                            help_text: defineMessage({id: 'admin.environment.smtp.smtpUsername.description', defaultMessage: 'Obtain this credential from administrator setting up your email server.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                                it.stateIsFalse('EmailSettings.EnableSMTPAuth'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'EmailSettings.SMTPPassword',
                            label: defineMessage({id: 'admin.environment.smtp.smtpPassword.title', defaultMessage: 'SMTP Server Password:'}),
                            placeholder: defineMessage({id: 'admin.environment.smtp.smtpPassword.placeholder', defaultMessage: 'Ex: "yourpassword", "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            help_text: defineMessage({id: 'admin.environment.smtp.smtpPassword.description', defaultMessage: 'Obtain this credential from administrator setting up your email server.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                                it.stateIsFalse('EmailSettings.EnableSMTPAuth'),
                            ),
                        },
                        {
                            type: 'dropdown',
                            key: 'EmailSettings.ConnectionSecurity',
                            label: defineMessage({id: 'admin.environment.smtp.connectionSecurity.title', defaultMessage: 'Connection Security:'}),
                            help_text: DefinitionConstants.CONNECTION_SECURITY_HELP_TEXT_EMAIL,
                            options: [
                                {
                                    value: '',
                                    display_name: defineMessage({id: 'admin.environment.smtp.connectionSecurity.option.none', defaultMessage: 'None'}),
                                },
                                {
                                    value: 'TLS',
                                    display_name: defineMessage({id: 'admin.environment.smtp.connectionSecurity.option.tls', defaultMessage: 'TLS (Recommended)'}),
                                },
                                {
                                    value: 'STARTTLS',
                                    display_name: defineMessage({id: 'admin.environment.smtp.connectionSecurity.option.starttls', defaultMessage: 'STARTTLS'}),
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                        },
                        {
                            type: 'button',
                            action: testSmtp,
                            key: 'TestSmtpConnection',
                            label: defineMessage({id: 'admin.environment.smtp.connectionSmtpTest', defaultMessage: 'Test Connection'}),
                            loading: defineMessage({id: 'admin.environment.smtp.testing', defaultMessage: 'Testing...'}),
                            error_message: defineMessage({id: 'admin.environment.smtp.smtpFail', defaultMessage: 'Connection unsuccessful: {error}'}),
                            success_message: defineMessage({id: 'admin.environment.smtp.smtpSuccess', defaultMessage: 'No errors were reported while sending an email. Please check your inbox to make sure.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.SkipServerCertificateVerification',
                            label: defineMessage({id: 'admin.environment.smtp.skipServerCertificateVerification.title', defaultMessage: 'Skip Server Certificate Verification:'}),
                            help_text: defineMessage({id: 'admin.environment.smtp.skipServerCertificateVerification.description', defaultMessage: 'When true, Mattermost will not verify the email server certificate.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableSecurityFixAlert',
                            label: defineMessage({id: 'admin.environment.smtp.enableSecurityFixAlert.title', defaultMessage: 'Enable Security Alerts:'}),
                            help_text: defineMessage({id: 'admin.environment.smtp.enableSecurityFixAlert.description', defaultMessage: 'When true, System Administrators are notified by email if a relevant security fix alert has been announced in the last 12 hours. Requires email to be enabled.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SMTP)),
                        },
                    ],
                },
            },
            push_notification_server: {
                url: 'environment/push_notification_server',
                title: defineMessage({id: 'admin.sidebar.pushNotificationServer', defaultMessage: 'Push Notification Server'}),
                searchableStrings: pushSearchableStrings,
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
                title: defineMessage({id: 'admin.sidebar.highAvailability', defaultMessage: 'High Availability'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('Cluster')),
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.HIGH_AVAILABILITY)),
                ),
                searchableStrings: clusterSearchableStrings,
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.HIGH_AVAILABILITY)),
                schema: {
                    id: 'ClusterSettings',
                    component: ClusterSettings,
                },
            },
            rate_limiting: {
                url: 'environment/rate_limiting',
                title: defineMessage({id: 'admin.sidebar.rateLimiting', defaultMessage: 'Rate Limiting'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                ),
                schema: {
                    id: 'ServiceSettings',
                    name: defineMessage({id: 'admin.rate.title', defaultMessage: 'Rate Limiting'}),
                    settings: [
                        {
                            type: 'banner',
                            label: defineMessage({id: 'admin.rate.noteDescription', defaultMessage: 'Changing properties other than Site URL in this section will require a server restart before taking effect.'}),
                            banner_type: 'info',
                        },
                        {
                            type: 'bool',
                            key: 'RateLimitSettings.Enable',
                            label: defineMessage({id: 'admin.rate.enableLimiterTitle', defaultMessage: 'Enable Rate Limiting:'}),
                            help_text: defineMessage({id: 'admin.rate.enableLimiterDescription', defaultMessage: 'When true, APIs are throttled at rates specified below. Rate limiting prevents server overload from too many requests. This is useful to prevent third-party applications or malicous attacks from impacting your server.'}),
                            help_text_markdown: true,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                        },
                        {
                            type: 'number',
                            key: 'RateLimitSettings.PerSec',
                            label: defineMessage({id: 'admin.rate.queriesTitle', defaultMessage: 'Maximum Queries per Second:'}),
                            placeholder: defineMessage({id: 'admin.rate.queriesExample', defaultMessage: 'E.g.: "10"'}),
                            help_text: defineMessage({id: 'admin.rate.queriesDescription', defaultMessage: 'Throttles API at this number of requests per second.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                                it.stateEquals('RateLimitSettings.Enable', false),
                            ),
                        },
                        {
                            type: 'number',
                            key: 'RateLimitSettings.MaxBurst',
                            label: defineMessage({id: 'admin.rate.maxBurst', defaultMessage: 'Maximum Burst Size:'}),
                            placeholder: defineMessage({id: 'admin.rate.maxBurstExample', defaultMessage: 'E.g.: "100"'}),
                            help_text: defineMessage({id: 'admin.rate.maxBurstDescription', defaultMessage: 'Maximum number of requests allowed beyond the per second query limit.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                                it.stateEquals('RateLimitSettings.Enable', false),
                            ),
                        },
                        {
                            type: 'number',
                            key: 'RateLimitSettings.MemoryStoreSize',
                            label: defineMessage({id: 'admin.rate.memoryTitle', defaultMessage: 'Memory Store Size:'}),
                            placeholder: defineMessage({id: 'admin.rate.memoryExample', defaultMessage: 'E.g.: "10000"'}),
                            help_text: defineMessage({id: 'admin.rate.memoryDescription', defaultMessage: 'Maximum number of users sessions connected to the system as determined by "Vary rate limit by remote address" and "Vary rate limit by HTTP header".'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                                it.stateEquals('RateLimitSettings.Enable', false),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'RateLimitSettings.VaryByRemoteAddr',
                            label: defineMessage({id: 'admin.rate.remoteTitle', defaultMessage: 'Vary rate limit by remote address:'}),
                            help_text: defineMessage({id: 'admin.rate.remoteDescription', defaultMessage: 'When true, rate limit API access by IP address.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                                it.stateEquals('RateLimitSettings.Enable', false),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'RateLimitSettings.VaryByUser',
                            label: defineMessage({id: 'admin.rate.varyByUser', defaultMessage: 'Vary rate limit by user:'}),
                            help_text: defineMessage({id: 'admin.rate.varyByUserDescription', defaultMessage: 'When true, rate limit API access by user athentication token.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.RATE_LIMITING)),
                                it.stateEquals('RateLimitSettings.Enable', false),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'RateLimitSettings.VaryByHeader',
                            label: defineMessage({id: 'admin.rate.httpHeaderTitle', defaultMessage: 'Vary rate limit by HTTP header:'}),
                            placeholder: defineMessage({id: 'admin.rate.httpHeaderExample', defaultMessage: 'E.g.: "X-Real-IP", "X-Forwarded-For"'}),
                            help_text: defineMessage({id: 'admin.rate.httpHeaderDescription', defaultMessage: 'When filled in, vary rate limiting by HTTP header field specified (e.g. when configuring NGINX set to "X-Real-IP", when configuring AmazonELB set to "X-Forwarded-For").'}),
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
                title: defineMessage({id: 'admin.sidebar.logging', defaultMessage: 'Logging'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                ),
                schema: {
                    id: 'LogSettings',
                    name: defineMessage({id: 'admin.general.log', defaultMessage: 'Logging'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'LogSettings.EnableConsole',
                            label: defineMessage({id: 'admin.log.consoleTitle', defaultMessage: 'Output logs to console: '}),
                            help_text: defineMessage({id: 'admin.log.consoleDescription', defaultMessage: 'Typically set to false in production. Developers may set this field to true to output log messages to console based on the console level option. If true, server writes messages to the standard output stream (stdout). Changing this setting requires a server restart before taking effect.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                        },
                        {
                            type: 'dropdown',
                            key: 'LogSettings.ConsoleLevel',
                            label: defineMessage({id: 'admin.log.levelTitle', defaultMessage: 'Console Log Level:'}),
                            help_text: defineMessage({id: 'admin.log.levelDescription', defaultMessage: 'This setting determines the level of detail at which log events are written to the console. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'}),
                            options: DefinitionConstants.LOG_LEVEL_OPTIONS,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                                it.stateIsFalse('LogSettings.EnableConsole'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'LogSettings.ConsoleJson',
                            label: defineMessage({id: 'admin.log.consoleJsonTitle', defaultMessage: 'Output console logs as JSON:'}),
                            help_text: defineMessage({id: 'admin.log.jsonDescription', defaultMessage: 'When true, logged events are written in a machine readable JSON format. Otherwise they are printed as plain text. Changing this setting requires a server restart before taking effect.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                                it.stateIsFalse('LogSettings.EnableConsole'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'LogSettings.EnableFile',
                            label: defineMessage({id: 'admin.log.fileTitle', defaultMessage: 'Output logs to file: '}),
                            help_text: defineMessage({id: 'admin.log.fileDescription', defaultMessage: 'Typically set to true in production. When true, logged events are written to the mattermost.log file in the directory specified in the File Log Directory field. The logs are rotated at 100 MB and archived to a file in the same directory, and given a name with a datestamp and serial number. For example, mattermost.2017-03-31.001. Changing this setting requires a server restart before taking effect.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                        },
                        {
                            type: 'dropdown',
                            key: 'LogSettings.FileLevel',
                            label: defineMessage({id: 'admin.log.fileLevelTitle', defaultMessage: 'File Log Level:'}),
                            help_text: defineMessage({id: 'admin.log.fileLevelDescription', defaultMessage: 'This setting determines the level of detail at which log events are written to the log file. ERROR: Outputs only error messages. INFO: Outputs error messages and information around startup and initialization. DEBUG: Prints high detail for developers working on debugging issues.'}),
                            options: DefinitionConstants.LOG_LEVEL_OPTIONS,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                                it.stateIsFalse('LogSettings.EnableFile'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'LogSettings.FileJson',
                            label: defineMessage({id: 'admin.log.fileJsonTitle', defaultMessage: 'Output file logs as JSON:'}),
                            help_text: defineMessage({id: 'admin.log.jsonDescription', defaultMessage: 'When true, logged events are written in a machine readable JSON format. Otherwise they are printed as plain text. Changing this setting requires a server restart before taking effect.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                                it.stateIsFalse('LogSettings.EnableFile'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'LogSettings.FileLocation',
                            label: defineMessage({id: 'admin.log.locationTitle', defaultMessage: 'File Log Directory:'}),
                            help_text: defineMessage({id: 'admin.log.locationDescription', defaultMessage: 'The location of the log files. If blank, they are stored in the ./logs directory. The path that you set must exist and Mattermost must have write permissions in it. Changing this setting requires a server restart before taking effect.'}),
                            placeholder: defineMessage({id: 'admin.log.locationPlaceholder', defaultMessage: 'Enter your file location'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                                it.stateIsFalse('LogSettings.EnableFile'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'LogSettings.EnableWebhookDebugging',
                            label: defineMessage({id: 'admin.log.enableWebhookDebugging', defaultMessage: 'Enable Webhook Debugging:'}),
                            help_text: defineMessage({id: 'admin.log.enableWebhookDebuggingDescription', defaultMessage: 'When true, sends webhook debug messages to the server logs. To also output the request body of incoming webhooks, set {boldedLogLevel} to "DEBUG".'}),
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
                            type: 'bool',
                            key: 'LogSettings.EnableDiagnostics',
                            label: defineMessage({id: 'admin.log.enableDiagnostics', defaultMessage: 'Enable Diagnostics and Error Reporting:'}),
                            help_text: defineMessage({id: 'admin.log.enableDiagnosticsDescription', defaultMessage: 'Enable this feature to improve the quality and performance of Mattermost by sending error reporting and diagnostic information to Mattermost, Inc. Read our <link>privacy policy</link> to learn more.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={AboutLinks.PRIVACY_POLICY}
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
                        {
                            type: 'longtext',
                            key: 'LogSettings.AdvancedLoggingJSON',
                            label: defineMessage({id: 'admin.log.AdvancedLoggingJSONTitle', defaultMessage: 'Advanced Logging:'}),
                            help_text: defineMessage({id: 'admin.log.AdvancedLoggingJSONDescription', defaultMessage: 'The JSON configuration for Advanced Logging. Please see <link>documentation</link> to learn more about Advanced Logging and the JSON format it uses.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.ADVANCED_LOGGING}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            placeholder: defineMessage({id: 'admin.log.AdvancedLoggingJSONPlaceholder', defaultMessage: 'Enter your JSON configuration'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.LOGGING)),
                            validate: (value) => {
                                const valid = new ValidationResult(true, '');
                                if (!value) {
                                    return valid;
                                }
                                try {
                                    JSON.parse(value);
                                    return valid;
                                } catch (error) {
                                    return new ValidationResult(false, error.message);
                                }
                            },
                            onConfigLoad: (configVal) => JSON.stringify(configVal, null, '  '),
                            onConfigSave: (displayVal) => {
                                // Handle case where field is empty
                                if (!displayVal) {
                                    return {undefined};
                                }

                                return JSON.parse(displayVal);
                            },
                        },
                    ],
                },
            },
            session_lengths: {
                url: 'environment/session_lengths',
                title: defineMessage({id: 'admin.sidebar.sessionLengths', defaultMessage: 'Session Lengths'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SESSION_LENGTHS)),
                ),
                searchableStrings: sessionLengthSearchableStrings,
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.SESSION_LENGTHS)),
                schema: {
                    id: 'SessionLengths',
                    component: SessionLengthSettings,
                },
            },
            metrics: {
                url: 'environment/performance_monitoring',
                title: defineMessage({id: 'admin.sidebar.metrics', defaultMessage: 'Performance Monitoring'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PERFORMANCE_MONITORING)),
                ),
                schema: {
                    id: 'MetricsSettings',
                    name: defineMessage({id: 'admin.advance.metrics', defaultMessage: 'Performance Monitoring'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'MetricsSettings.Enable',
                            label: defineMessage({id: 'admin.metrics.enableTitle', defaultMessage: 'Enable Performance Monitoring:'}),
                            help_text: defineMessage({id: 'admin.metrics.enableDescription', defaultMessage: 'When true, Mattermost will enable performance monitoring collection and profiling. Please see <link>documentation</link> to learn more about configuring performance monitoring for Mattermost.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.SETUP_PERFORMANCE_MONITORING}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PERFORMANCE_MONITORING)),
                        },
                        {
                            type: 'text',
                            key: 'MetricsSettings.ListenAddress',
                            label: defineMessage({id: 'admin.metrics.listenAddressTitle', defaultMessage: 'Listen Address:'}),
                            placeholder: defineMessage({id: 'admin.metrics.listenAddressEx', defaultMessage: 'E.g.: ":8067"'}),
                            help_text: defineMessage({id: 'admin.metrics.listenAddressDesc', defaultMessage: 'The address the server will listen on to expose performance metrics.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.PERFORMANCE_MONITORING)),
                        },
                    ],
                },
            },
            developer: {
                url: 'environment/developer',
                title: defineMessage({id: 'admin.sidebar.developer', defaultMessage: 'Developer'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                ),
                schema: {
                    id: 'ServiceSettings',
                    name: defineMessage({id: 'admin.developer.title', defaultMessage: 'Developer Settings'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableTesting',
                            label: defineMessage({id: 'admin.service.testingTitle', defaultMessage: 'Enable Testing Commands:'}),
                            help_text: defineMessage({id: 'admin.service.testingDescription', defaultMessage: 'When true, /test slash command is enabled to load test accounts, data and text formatting. Changing this requires a server restart before taking effect.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableDeveloper',
                            label: defineMessage({id: 'admin.service.developerTitle', defaultMessage: 'Enable Developer Mode: '}),
                            help_text: defineMessage({id: 'admin.service.developerDesc', defaultMessage: 'When true, JavaScript errors are shown in a purple bar at the top of the user interface. Not recommended for use in production. Changing this requires a server restart before taking effect.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableClientPerformanceDebugging',
                            label: defineMessage({id: 'admin.service.performanceDebuggingTitle', defaultMessage: 'Enable Client Performance Debugging: '}),
                            help_text: defineMessage({id: 'admin.service.performanceDebuggingDescription', defaultMessage: 'When true, users can access debugging settings for their account in **Settings > Advanced > Performance Debugging** to assist in diagnosing performance issues. Changing this requires a server restart before taking effect.'}),
                            help_text_markdown: true,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ENVIRONMENT.DEVELOPER)),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.AllowedUntrustedInternalConnections',
                            label: defineMessage({id: 'admin.service.internalConnectionsTitle', defaultMessage: 'Allow untrusted internal connections to: '}),
                            placeholder: defineMessage({id: 'admin.service.internalConnectionsEx', defaultMessage: 'webhooks.internal.example.com 127.0.0.1 10.0.16.0/28'}),
                            help_text: defineMessage({id: 'admin.service.internalConnectionsDesc', defaultMessage: 'A whitelist of local network addresses that can be requested by the Mattermost server on behalf of a client. Care should be used when configuring this setting to prevent unintended access to your local network. See <link>documentation</link> to learn more. Changing this requires a server restart before taking effect.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
    },
    site: {
        icon: (
            <CogOutlineIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.site', defaultMessage: 'Site Configuration'}),
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.SITE)),
        subsections: {
            customization: {
                url: 'site_config/customization',
                title: defineMessage({id: 'admin.sidebar.customization', defaultMessage: 'Customization'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                schema: {
                    id: 'Customization',
                    name: defineMessage({id: 'admin.site.customization', defaultMessage: 'Customization'}),
                    settings: [
                        {
                            type: 'text',
                            key: 'TeamSettings.SiteName',
                            label: defineMessage({id: 'admin.team.siteNameTitle', defaultMessage: 'Site Name:'}),
                            help_text: defineMessage({id: 'admin.team.siteNameDescription', defaultMessage: 'Name of service shown in login screens and UI. When not specified, it defaults to "Mattermost".'}),
                            placeholder: defineMessage({id: 'admin.team.siteNameExample', defaultMessage: 'E.g.: "Mattermost"'}),
                            max_length: Constants.MAX_SITENAME_LENGTH,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        },
                        {
                            type: 'text',
                            key: 'TeamSettings.CustomDescriptionText',
                            label: defineMessage({id: 'admin.team.brandDescriptionTitle', defaultMessage: 'Site Description: '}),
                            help_text: defineMessage({id: 'admin.team.brandDescriptionHelp', defaultMessage: 'Displays as a title above the login form. When not specified, the phrase "Log in" is displayed.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableCustomBrand',
                            label: defineMessage({id: 'admin.team.brandTitle', defaultMessage: 'Enable Custom Branding: '}),
                            help_text: defineMessage({id: 'admin.team.brandDesc', defaultMessage: 'Enable custom branding to show an image of your choice, uploaded below, and some help text, written below, on the login page.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        },
                        {
                            type: 'custom',
                            component: BrandImageSetting,
                            key: 'CustomBrandImage',
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                                it.stateIsFalse('TeamSettings.EnableCustomBrand'),
                            ),
                        },
                        {
                            type: 'longtext',
                            key: 'TeamSettings.CustomBrandText',
                            label: defineMessage({id: 'admin.team.brandTextTitle', defaultMessage: 'Custom Brand Text:'}),
                            help_text: defineMessage({id: 'admin.team.brandTextDescription', defaultMessage: 'Text that will appear below your custom brand image on your login screen. Supports Markdown-formatted text. Maximum 500 characters allowed.'}),
                            max_length: Constants.MAX_CUSTOM_BRAND_TEXT_LENGTH,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                                it.stateIsFalse('TeamSettings.EnableCustomBrand'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'SupportSettings.EnableAskCommunityLink',
                            label: defineMessage({id: 'admin.support.enableAskCommunityTitle', defaultMessage: 'Enable Ask Community Link:'}),
                            help_text: defineMessage({id: 'admin.support.enableAskCommunityDesc', defaultMessage: 'When true, "Ask the community" link appears on the Mattermost user interface and Help Menu, which allows users to join the Mattermost Community to ask questions and help others troubleshoot issues. When false, the link is hidden from users.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        },
                        {
                            type: 'text',
                            key: 'SupportSettings.HelpLink',
                            label: defineMessage({id: 'admin.support.helpTitle', defaultMessage: 'Help Link:'}),
                            help_text: defineMessage({id: 'admin.support.helpDesc', defaultMessage: 'The URL for the Help link on the Mattermost login page, sign-up pages, and Help Menu. If this field is empty, the Help link is hidden from users.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                        },
                        {
                            type: 'text',
                            key: 'SupportSettings.TermsOfServiceLink',
                            label: defineMessage({id: 'admin.support.termsTitle', defaultMessage: 'Terms of Use Link:'}),
                            help_text: defineMessage({id: 'admin.support.termsDesc', defaultMessage: 'Link to the terms under which users may use your online service. By default, this includes the "Mattermost Conditions of Use (End Users)" explaining the terms under which Mattermost software is provided to end users. If you change the default link to add your own terms for using the service you provide, your new terms must include a link to the default terms so end users are aware of the Mattermost Conditions of Use (End User) for Mattermost software.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                        {
                            type: 'text',
                            key: 'SupportSettings.PrivacyPolicyLink',
                            label: defineMessage({id: 'admin.support.privacyTitle', defaultMessage: 'Privacy Policy Link:'}),
                            help_text: defineMessage({id: 'admin.support.privacyDesc', defaultMessage: 'The URL for the Privacy link on the login and sign-up pages. If this field is empty, the Privacy link is hidden from users.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                        {
                            type: 'text',
                            key: 'SupportSettings.AboutLink',
                            label: defineMessage({id: 'admin.support.aboutTitle', defaultMessage: 'About Link:'}),
                            help_text: defineMessage({id: 'admin.support.aboutDesc', defaultMessage: 'The URL for the About link on the Mattermost login and sign-up pages. If this field is empty, the About link is hidden from users.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                        {
                            type: 'text',
                            key: 'SupportSettings.ForgotPasswordLink',
                            label: defineMessage({id: 'admin.support.forgotPasswordTitle', defaultMessage: 'Forgot Password Custom Link:'}),
                            help_text: defineMessage({id: 'admin.support.forgotPasswordDesc', defaultMessage: 'The URL for the Forgot Password link on the Mattermost login page. If this field is empty the Forgot Password link takes users to the Password Reset page.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                        {
                            type: 'text',
                            key: 'SupportSettings.ReportAProblemLink',
                            label: defineMessage({id: 'admin.support.problemTitle', defaultMessage: 'Report a Problem Link:'}),
                            help_text: defineMessage({id: 'admin.support.problemDesc', defaultMessage: 'The URL for the Report a Problem link in the Help Menu. If this field is empty, the link is removed from the Help Menu.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                        {
                            type: 'text',
                            key: 'NativeAppSettings.AppDownloadLink',
                            label: defineMessage({id: 'admin.customization.appDownloadLinkTitle', defaultMessage: 'Mattermost Apps Download Page Link:'}),
                            help_text: defineMessage({id: 'admin.customization.appDownloadLinkDesc', defaultMessage: 'Add a link to a download page for the Mattermost apps. When a link is present, an option to "Download Mattermost Apps" will be added in the Product Menu so users can find the download page. Leave this field blank to hide the option from the Product Menu.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                        {
                            type: 'text',
                            key: 'NativeAppSettings.AndroidAppDownloadLink',
                            label: defineMessage({id: 'admin.customization.androidAppDownloadLinkTitle', defaultMessage: 'Android App Download Link:'}),
                            help_text: defineMessage({id: 'admin.customization.androidAppDownloadLinkDesc', defaultMessage: 'Add a link to download the Android app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                        {
                            type: 'text',
                            key: 'NativeAppSettings.IosAppDownloadLink',
                            label: defineMessage({id: 'admin.customization.iosAppDownloadLinkTitle', defaultMessage: 'iOS App Download Link:'}),
                            help_text: defineMessage({id: 'admin.customization.iosAppDownloadLinkDesc', defaultMessage: 'Add a link to download the iOS app. Users who access the site on a mobile web browser will be prompted with a page giving them the option to download the app. Leave this field blank to prevent the page from appearing.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                        },
                    ],
                },
            },
            localization: {
                url: 'site_config/localization',
                title: defineMessage({id: 'admin.sidebar.localization', defaultMessage: 'Localization'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
                schema: {
                    id: 'LocalizationSettings',
                    name: defineMessage({id: 'admin.site.localization', defaultMessage: 'Localization'}),
                    settings: [
                        {
                            type: 'language',
                            key: 'LocalizationSettings.DefaultServerLocale',
                            label: defineMessage({id: 'admin.general.localization.serverLocaleTitle', defaultMessage: 'Default Server Language:'}),
                            help_text: defineMessage({id: 'admin.general.localization.serverLocaleDescription', defaultMessage: 'Default language for system messages.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
                        },
                        {
                            type: 'language',
                            key: 'LocalizationSettings.DefaultClientLocale',
                            label: defineMessage({id: 'admin.general.localization.clientLocaleTitle', defaultMessage: 'Default Client Language:'}),
                            help_text: defineMessage({id: 'admin.general.localization.clientLocaleDescription', defaultMessage: 'Default language for newly created users and pages where the user hasn\'t logged in.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
                        },
                        {
                            type: 'language',
                            key: 'LocalizationSettings.AvailableLocales',
                            label: defineMessage({id: 'admin.general.localization.availableLocalesTitle', defaultMessage: 'Available Languages:'}),
                            help_text: defineMessage({id: 'admin.general.localization.availableLocalesDescription', defaultMessage: 'Set which languages are available for users in <strong>Settings > Display > Language</strong> (leave this field blank to have all supported languages available). If you\'re manually adding new languages, the <strong>Default Client Language</strong> must be added before saving this setting.\n \nWould like to help with translations? Join the <link>Mattermost Translation Server</link> to contribute.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='http://translate.mattermost.com/'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                strong: (msg: string) => <strong>{msg}</strong>,
                            },
                            multiple: true,
                            no_result: defineMessage({id: 'admin.general.localization.availableLocalesNoResults', defaultMessage: 'No results found'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.LOCALIZATION)),
                        },
                    ],
                },
            },
            users_and_teams: {
                url: 'site_config/users_and_teams',
                title: defineMessage({id: 'admin.sidebar.usersAndTeams', defaultMessage: 'Users and Teams'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                schema: {
                    id: 'UserAndTeamsSettings',
                    name: defineMessage({id: 'admin.site.usersAndTeams', defaultMessage: 'Users and Teams'}),
                    settings: [
                        {
                            type: 'number',
                            key: 'TeamSettings.MaxUsersPerTeam',
                            label: defineMessage({id: 'admin.team.maxUsersTitle', defaultMessage: 'Max Users Per Team:'}),
                            help_text: defineMessage({id: 'admin.team.maxUsersDescription', defaultMessage: 'Maximum total number of users per team, including both active and inactive users.'}),
                            placeholder: defineMessage({id: 'admin.team.maxUsersExample', defaultMessage: 'E.g.: "25"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'number',
                            key: 'TeamSettings.MaxChannelsPerTeam',
                            label: defineMessage({id: 'admin.team.maxChannelsTitle', defaultMessage: 'Max Channels Per Team:'}),
                            help_text: defineMessage({id: 'admin.team.maxChannelsDescription', defaultMessage: 'Maximum total number of channels per team, including both active and archived channels.'}),
                            placeholder: defineMessage({id: 'admin.team.maxChannelsExample', defaultMessage: 'E.g.: "100"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableJoinLeaveMessageByDefault',
                            label: defineMessage({id: 'admin.team.enableJoinLeaveMessageTitle', defaultMessage: 'Enable join/leave messages by default:'}),
                            help_text: defineMessage({id: 'admin.team.enableJoinLeaveMessageDescription', defaultMessage: 'Choose the default configuration of system messages displayed when users join or leave channels. Users can override this default by configuring Join/Leave messages in Account Settings > Advanced.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'dropdown',
                            key: 'TeamSettings.RestrictDirectMessage',
                            label: defineMessage({id: 'admin.team.restrictDirectMessage', defaultMessage: 'Enable users to open Direct Message channels with:'}),
                            help_text: defineMessage({id: 'admin.team.restrictDirectMessageDesc', defaultMessage: '"Any user on the Mattermost server" enables users to open a Direct Message channel with any user on the server, even if they are not on any teams together. "Any member of the team" limits the ability in the Direct Messages "More" menu to only open Direct Message channels with users who are in the same team. Note: This setting only affects the UI, not permissions on the server.'}),
                            options: [
                                {
                                    value: 'any',
                                    display_name: defineMessage({id: 'admin.team.restrict_direct_message_any', defaultMessage: 'Any user on the Mattermost server'}),
                                },
                                {
                                    value: 'team',
                                    display_name: defineMessage({id: 'admin.team.restrict_direct_message_team', defaultMessage: 'Any member of the team'}),
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'dropdown',
                            key: 'TeamSettings.TeammateNameDisplay',
                            label: defineMessage({id: 'admin.team.teammateNameDisplay', defaultMessage: 'Teammate Name Display:'}),
                            help_text: defineMessage({id: 'admin.team.teammateNameDisplayDesc', defaultMessage: 'Set how to display users\' names in posts and the Direct Messages list.'}),
                            options: [
                                {
                                    value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
                                    display_name: defineMessage({id: 'admin.team.showUsername', defaultMessage: 'Show username (default)'}),
                                },
                                {
                                    value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME,
                                    display_name: defineMessage({id: 'admin.team.showNickname', defaultMessage: 'Show nickname if one exists, otherwise show first and last name'}),
                                },
                                {
                                    value: Constants.TEAMMATE_NAME_DISPLAY.SHOW_FULLNAME,
                                    display_name: defineMessage({id: 'admin.team.showFullname', defaultMessage: 'Show first and last name'}),
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.LockTeammateNameDisplay',
                            label: defineMessage({id: 'admin.lockTeammateNameDisplay', defaultMessage: 'Lock Teammate Name Display for all users: '}),
                            help_text: defineMessage({id: 'admin.lockTeammateNameDisplayHelpText', defaultMessage: 'When true, disables users\' ability to change settings under <strong>Account Menu > Account Settings > Display > Teammate Name Display</strong>.'}),
                            help_text_values: {
                                strong: (msg: string) => <strong>{msg}</strong>,
                            },
                            isHidden: it.not(it.licensedForFeature('LockTeammateNameDisplay')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.ExperimentalViewArchivedChannels',
                            label: defineMessage({id: 'admin.viewArchivedChannelsTitle', defaultMessage: 'Allow users to view archived channels: '}),
                            help_text: defineMessage({id: 'admin.viewArchivedChannelsHelpText', defaultMessage: 'When true, allows users to view, share and search for content of channels that have been archived. Users can only view the content in channels of which they were a member before the channel was archived.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                            isHidden: it.licensedForFeature('Cloud'),
                        },
                        {
                            type: 'bool',
                            key: 'PrivacySettings.ShowEmailAddress',
                            label: defineMessage({id: 'admin.privacy.showEmailTitle', defaultMessage: 'Show Email Address:'}),
                            help_text: defineMessage({id: 'admin.privacy.showEmailDescription', defaultMessage: 'When false, hides the email address of members from everyone except System Administrators and the System Roles with read/write access to Compliance, Billing, or User Management.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'bool',
                            key: 'PrivacySettings.ShowFullName',
                            label: defineMessage({id: 'admin.privacy.showFullNameTitle', defaultMessage: 'Show Full Name:'}),
                            help_text: defineMessage({id: 'admin.privacy.showFullNameDescription', defaultMessage: 'When false, hides the full name of members from everyone except System Administrators. Username is shown in place of full name.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableCustomUserStatuses',
                            label: defineMessage({id: 'admin.team.customUserStatusesTitle', defaultMessage: 'Enable Custom Statuses: '}),
                            help_text: defineMessage({id: 'admin.team.customUserStatusesDescription', defaultMessage: 'When true, users can set a descriptive status message and status emoji visible to all users.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableLastActiveTime',
                            label: defineMessage({id: 'admin.team.lastActiveTimeTitle', defaultMessage: 'Enable last active time: '}),
                            help_text: defineMessage({id: 'admin.team.lastActiveTimeDescription', defaultMessage: 'When enabled, last active time allows users to see when someone was last online.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableCustomGroups',
                            label: defineMessage({id: 'admin.team.customUserGroupsTitle', defaultMessage: 'Enable Custom User Groups (Beta): '}),
                            help_text: defineMessage({id: 'admin.team.customUserGroupsDescription', defaultMessage: 'When true, users with appropriate permissions can create custom user groups and enables at-mentions for those groups.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                            isHidden: it.not(it.any(
                                it.licensedForSku(LicenseSkus.Enterprise),
                                it.licensedForSku(LicenseSkus.Professional),
                            )),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.RefreshPostStatsRunTime',
                            label: defineMessage({id: 'admin.team.refreshPostStatsRunTimeTitle', defaultMessage: 'User Statistics Update Time:'}),
                            help_text: defineMessage({id: 'admin.team.refreshPostStatsRunTimeDescription', defaultMessage: "Set the server time for updating the user post statistics, including each user's total post count and the timestamp of their most recent post. Must be a 24-hour time stamp in the form HH:MM based on the local time of the server."}),
                            placeholder: defineMessage({id: 'admin.team.refreshPostStatsRunTimeExample', defaultMessage: 'E.g.: "00:00"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.USERS_AND_TEAMS)),
                        },
                    ],
                },
            },
            notifications: {
                url: 'environment/notifications',
                title: defineMessage({id: 'admin.sidebar.notifications', defaultMessage: 'Notifications'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                schema: {
                    id: 'notifications',
                    name: defineMessage({id: 'admin.environment.notifications', defaultMessage: 'Notifications'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableConfirmNotificationsToChannel',
                            label: defineMessage({id: 'admin.environment.notifications.enableConfirmNotificationsToChannel.label', defaultMessage: 'Show @channel, @all, @here and group mention confirmation dialog:'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.enableConfirmNotificationsToChannel.help', defaultMessage: 'When true, users will be prompted to confirm when posting @channel, @all, @here and group mentions in channels with over five members. When false, no confirmation is required.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.SendEmailNotifications',
                            label: defineMessage({id: 'admin.environment.notifications.enable.label', defaultMessage: 'Enable Email Notifications:'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.enable.help', defaultMessage: 'Typically set to true in production. When true, Mattermost attempts to send email notifications. When false, email invitations and user account setting change emails are still sent as long as the SMTP server is configured. Developers may set this field to false to skip email setup for faster development.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                            isHidden: it.licensedForFeature('Cloud'),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnablePreviewModeBanner',
                            label: defineMessage({id: 'admin.environment.notifications.enablePreviewModeBanner.label', defaultMessage: 'Enable Preview Mode Banner:'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.enablePreviewModeBanner.help', defaultMessage: 'When true, the Preview Mode banner is displayed so users are aware that email notifications are disabled. When false, the Preview Mode banner is not displayed to users.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                                it.stateIsTrue('EmailSettings.SendEmailNotifications'),
                            ),
                            isHidden: it.licensedForFeature('Cloud'),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnableEmailBatching',
                            label: defineMessage({id: 'admin.environment.notifications.enableEmailBatching.label', defaultMessage: 'Enable Email Batching:'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.enableEmailBatching.help', defaultMessage: 'When true, users will have email notifications for multiple direct messages and mentions combined into a single email. Batching will occur at a default interval of 15 minutes, configurable in Settings > Notifications.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                                it.configIsTrue('ClusterSettings', 'Enable'),
                                it.configIsFalse('ServiceSettings', 'SiteURL'),
                            ),
                            isHidden: it.licensedForFeature('Cloud'),
                        },
                        {
                            type: 'dropdown',
                            key: 'EmailSettings.EmailNotificationContentsType',
                            label: defineMessage({id: 'admin.environment.notifications.contents.label', defaultMessage: 'Email Notification Contents:'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.contents.help', defaultMessage: '**Send full message contents** - Sender name and channel are included in email notifications. **Send generic description with only sender name** - Only the name of the person who sent the message, with no information about channel name or message contents are included in email notifications. Typically used for compliance reasons if Mattermost contains confidential information and policy dictates it cannot be stored in email.'}),
                            help_text_markdown: true,
                            options: [
                                {
                                    value: 'full',
                                    display_name: defineMessage({id: 'admin.environment.notifications.contents.full', defaultMessage: 'Send full message contents'}),
                                },
                                {
                                    value: 'generic',
                                    display_name: defineMessage({id: 'admin.environment.notifications.contents.generic', defaultMessage: 'Send generic description with only sender name'}),
                                },
                            ],
                            isHidden: it.not(it.licensedForFeature('EmailNotificationContents')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                        },
                        {
                            type: 'text',
                            key: 'EmailSettings.FeedbackName',
                            label: defineMessage({id: 'admin.environment.notifications.notificationDisplay.label', defaultMessage: 'Notification Display Name:'}),
                            placeholder: defineMessage({id: 'admin.environment.notifications.notificationDisplay.placeholder', defaultMessage: 'Ex: "Mattermost Notification", "System", "No-Reply"'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.notificationDisplay.help', defaultMessage: 'Display name on email account used when sending notification emails from Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                            ),
                            validate: validators.isRequired(defineMessage({id: 'admin.environment.notifications.notificationDisplay.required', defaultMessage: '"Notification Display Name" is required'})),
                        },
                        {
                            type: 'text',
                            key: 'EmailSettings.FeedbackEmail',
                            label: defineMessage({id: 'admin.environment.notifications.feedbackEmail.label', defaultMessage: 'Notification From Address:'}),
                            placeholder: defineMessage({id: 'admin.environment.notifications.feedbackEmail.placeholder', defaultMessage: 'Ex: "mattermost@yourcompany.com", "admin@yourcompany.com"'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.feedbackEmail.help', defaultMessage: 'Email address displayed on email account used when sending notification emails from Mattermost.'}),
                            isHidden: it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                            ),
                            validate: validators.isRequired(defineMessage({id: 'admin.environment.notifications.feedbackEmail.required', defaultMessage: '"Notification From Address" is required'})),
                        },
                        {
                            type: 'text',
                            key: 'SupportSettings.SupportEmail',
                            label: defineMessage({id: 'admin.environment.notifications.supportEmail.label', defaultMessage: 'Support Email Address:'}),
                            placeholder: defineMessage({id: 'admin.environment.notifications.supportAddress.placeholder', defaultMessage: 'Ex: "support@yourcompany.com", "admin@yourcompany.com"'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.supportEmail.help', defaultMessage: 'Email address displayed on support emails.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.CUSTOMIZATION)),
                            validate: validators.isRequired(defineMessage({id: 'admin.environment.notifications.supportEmail.required', defaultMessage: '"Support Email Address" is required'})),
                        },
                        {
                            type: 'text',
                            key: 'EmailSettings.ReplyToAddress',
                            label: defineMessage({id: 'admin.environment.notifications.replyToAddress.label', defaultMessage: 'Notification Reply-To Address:'}),
                            placeholder: defineMessage({id: 'admin.environment.notifications.replyToAddress.placeholder', defaultMessage: 'Ex: "mattermost@yourcompany.com", "admin@yourcompany.com"'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.replyToAddress.help', defaultMessage: 'Email address used in the Reply-To header when sending notification emails from Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'EmailSettings.FeedbackOrganization',
                            label: defineMessage({id: 'admin.environment.notifications.feedbackOrganization.label', defaultMessage: 'Notification Footer Mailing Address:'}),
                            placeholder: defineMessage({id: 'admin.environment.notifications.feedbackOrganization.placeholder', defaultMessage: 'Ex: "© ABC Corporation, 565 Knight Way, Palo Alto, California, 94305, USA"'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.feedbackOrganization.help', defaultMessage: 'Organization name and address displayed on email notifications from Mattermost, such as "© ABC Corporation, 565 Knight Way, Palo Alto, California, 94305, USA". If the field is left empty, the organization name and address will not be displayed.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                                it.stateIsFalse('EmailSettings.SendEmailNotifications'),
                            ),
                        },
                        {
                            type: 'dropdown',
                            key: 'EmailSettings.PushNotificationContents',
                            label: defineMessage({id: 'admin.environment.notifications.pushContents.label', defaultMessage: 'Push Notification Contents:'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.pushContents.help', defaultMessage: "**Generic description with only sender name** - Includes only the name of the person who sent the message in push notifications, with no information about channel name or message contents. **Generic description with sender and channel names** - Includes the name of the person who sent the message and the channel it was sent in, but not the message contents. **Full message content sent in the notification payload** - Includes the message contents in the push notification payload that is relayed through Apple's Push Notification Service (APNS) or Google's Firebase Cloud Messaging (FCM). It is **highly recommended** this option only be used with an \"https\" protocol to encrypt the connection and protect confidential information sent in messages."}),
                            help_text_markdown: true,
                            options: [
                                {
                                    value: 'generic_no_channel',
                                    display_name: defineMessage({id: 'admin.environment.notifications.pushContents.genericNoChannel', defaultMessage: 'Generic description with only sender name'}),
                                },
                                {
                                    value: 'generic',
                                    display_name: defineMessage({id: 'admin.environment.notifications.pushContents.generic', defaultMessage: 'Generic description with sender and channel names'}),
                                },
                                {
                                    value: 'full',
                                    display_name: defineMessage({id: 'admin.environment.notifications.pushContents.full', defaultMessage: 'Full message content sent in the notification payload'}),
                                },
                            ],
                            isHidden: it.licensedForFeature('IDLoadedPushNotifications'),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTIFICATIONS)),
                        },
                        {
                            type: 'dropdown',
                            key: 'EmailSettings.PushNotificationContents',
                            label: defineMessage({id: 'admin.environment.notifications.pushContents.label', defaultMessage: 'Push Notification Contents:'}),
                            help_text: defineMessage({id: 'admin.environment.notifications.pushContents.withIdLoaded.help', defaultMessage: "**Generic description with only sender name** - Includes only the name of the person who sent the message in push notifications, with no information about channel name or message contents. **Generic description with sender and channel names** - Includes the name of the person who sent the message and the channel it was sent in, but not the message contents. **Full message content sent in the notification payload** - Includes the message contents in the push notification payload that is relayed through Apple's Push Notification Service (APNS) or Google's Firebase Cloud Messaging (FCM). It is **highly recommended** this option only be used with an \"https\" protocol to encrypt the connection and protect confidential information sent in messages. **Full message content fetched from the server on receipt** - The notification payload relayed through APNS or FCM contains no message content, instead it contains a unique message ID used to fetch message content from the server when a push notification is received by a device. If the server cannot be reached, a generic notification will be displayed."}),
                            help_text_markdown: true,
                            options: [
                                {
                                    value: 'generic_no_channel',
                                    display_name: defineMessage({id: 'admin.environment.notifications.pushContents.genericNoChannel', defaultMessage: 'Generic description with only sender name'}),
                                },
                                {
                                    value: 'generic',
                                    display_name: defineMessage({id: 'admin.environment.notifications.pushContents.generic', defaultMessage: 'Generic description with sender and channel names'}),
                                },
                                {
                                    value: 'full',
                                    display_name: defineMessage({id: 'admin.environment.notifications.pushContents.full', defaultMessage: 'Full message content sent in the notification payload'}),
                                },
                                {
                                    value: 'id_loaded',
                                    display_name: defineMessage({id: 'admin.environment.notifications.pushContents.idLoaded', defaultMessage: 'Full message content fetched from the server on receipt'}),
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
                title: defineMessage({id: 'admin.sidebar.announcement', defaultMessage: 'Announcement Banner'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('Announcement')),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                ),
                schema: {
                    id: 'AnnouncementSettings',
                    name: defineMessage({id: 'admin.site.announcementBanner', defaultMessage: 'Announcement Banner'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'AnnouncementSettings.EnableBanner',
                            label: defineMessage({id: 'admin.customization.announcement.enableBannerTitle', defaultMessage: 'Enable Announcement Banner:'}),
                            help_text: defineMessage({id: 'admin.customization.announcement.enableBannerDesc', defaultMessage: 'Enable an announcement banner across all teams.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                        },
                        {
                            type: 'text',
                            key: 'AnnouncementSettings.BannerText',
                            label: defineMessage({id: 'admin.customization.announcement.bannerTextTitle', defaultMessage: 'Banner Text:'}),
                            help_text: defineMessage({id: 'admin.customization.announcement.bannerTextDesc', defaultMessage: 'Text that will appear in the announcement banner.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                                it.stateIsFalse('AnnouncementSettings.EnableBanner'),
                            ),
                        },
                        {
                            type: 'color',
                            key: 'AnnouncementSettings.BannerColor',
                            label: defineMessage({id: 'admin.customization.announcement.bannerColorTitle', defaultMessage: 'Banner Color:'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                                it.stateIsFalse('AnnouncementSettings.EnableBanner'),
                            ),
                        },
                        {
                            type: 'color',
                            key: 'AnnouncementSettings.BannerTextColor',
                            label: defineMessage({id: 'admin.customization.announcement.bannerTextColorTitle', defaultMessage: 'Banner Text Color:'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.ANNOUNCEMENT_BANNER)),
                                it.stateIsFalse('AnnouncementSettings.EnableBanner'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'AnnouncementSettings.AllowBannerDismissal',
                            label: defineMessage({id: 'admin.customization.announcement.allowBannerDismissalTitle', defaultMessage: 'Allow Banner Dismissal:'}),
                            help_text: defineMessage({id: 'admin.customization.announcement.allowBannerDismissalDesc', defaultMessage: 'When true, users can dismiss the banner until its next update. When false, the banner is permanently visible until it is turned off by the System Admin.'}),
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
                title: defineMessage({id: 'admin.sidebar.announcement', defaultMessage: 'Announcement Banner'}),
                isHidden: it.any(
                    it.licensedForFeature('Announcement'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'AnnouncementSettings',
                    name: defineMessage({id: 'admin.site.announcementBanner', defaultMessage: 'Announcement Banner'}),
                    settings: [
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.emoji', defaultMessage: 'Emoji'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.EMOJI)),
                schema: {
                    id: 'EmojiSettings',
                    name: defineMessage({id: 'admin.site.emoji', defaultMessage: 'Emoji'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableEmojiPicker',
                            label: defineMessage({id: 'admin.customization.enableEmojiPickerTitle', defaultMessage: 'Enable Emoji Picker:'}),
                            help_text: defineMessage({id: 'admin.customization.enableEmojiPickerDesc', defaultMessage: 'The emoji picker allows users to select emoji to add as reactions or use in messages. Enabling the emoji picker with a large number of custom emoji may slow down performance.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.EMOJI)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableCustomEmoji',
                            label: defineMessage({id: 'admin.customization.enableCustomEmojiTitle', defaultMessage: 'Enable Custom Emoji:'}),
                            help_text: defineMessage({id: 'admin.customization.enableCustomEmojiDesc', defaultMessage: 'Enable users to create custom emoji for use in messages. When enabled, custom emoji settings can be accessed in Channels through the emoji picker.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.EMOJI)),
                        },
                    ],
                },
            },
            posts: {
                url: 'site_config/posts',
                title: defineMessage({id: 'admin.sidebar.posts', defaultMessage: 'Posts'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                schema: {
                    id: 'PostSettings',
                    name: defineMessage({id: 'admin.site.posts', defaultMessage: 'Posts'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.ThreadAutoFollow',
                            label: defineMessage({id: 'admin.experimental.threadAutoFollow.title', defaultMessage: 'Automatically Follow Threads'}),
                            help_text: defineMessage({id: 'admin.experimental.threadAutoFollow.desc', defaultMessage: 'This setting must be enabled in order to enable Collapsed Reply Threads. When enabled, threads a user starts, participates in, or is mentioned in are automatically followed. A new `Threads` table is added in the database that tracks threads and thread participants, and a `ThreadMembership` table tracks followed threads for each user and the read or unread state of each followed thread. When false, all backend operations to support Collapsed Reply Threads are disabled.'}),
                            help_text_markdown: true,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                            isHidden: it.licensedForFeature('Cloud'),
                        },
                        {
                            type: 'dropdown',
                            key: 'ServiceSettings.CollapsedThreads',
                            label: defineMessage({id: 'admin.experimental.collapsedThreads.title', defaultMessage: 'Collapsed Reply Threads'}),
                            help_text: defineMessage({id: 'admin.experimental.collapsedThreads.desc', defaultMessage: 'When enabled (default off), users must enable collapsed reply threads in Settings. When disabled, users cannot access Collapsed Reply Threads. Please review our <linkKnownIssues>documentation for known issues</linkKnownIssues> and help provide feedback in our <linkCommunityChannel>Community Channel</linkCommunityChannel>.'}),
                            help_text_values: {
                                linkKnownIssues: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='https://support.mattermost.com/hc/en-us/articles/4413183568276'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                linkCommunityChannel: (msg: string) => (
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
                                    display_name: defineMessage({id: 'admin.experimental.collapsedThreads.off', defaultMessage: 'Disabled'}),
                                },
                                {
                                    value: 'default_off',
                                    display_name: defineMessage({id: 'admin.experimental.collapsedThreads.default_off', defaultMessage: 'Enabled (Default Off)'}),
                                },
                                {
                                    value: 'default_on',
                                    display_name: defineMessage({id: 'admin.experimental.collapsedThreads.default_on', defaultMessage: 'Enabled (Default On)'}),
                                },
                                {
                                    value: 'always_on',
                                    display_name: defineMessage({id: 'admin.experimental.collapsedThreads.always_on', defaultMessage: 'Always On'}),
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.PostPriority',
                            label: defineMessage({id: 'admin.posts.postPriority.title', defaultMessage: 'Message Priority'}),
                            help_text: defineMessage({id: 'admin.posts.postPriority.desc', defaultMessage: 'When enabled, users can configure a visual indicator to communicate messages that are important or urgent. Learn more about message priority in our <link>documentation</link>.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
                            type: 'bool',
                            key: 'ServiceSettings.AllowPersistentNotifications',
                            label: defineMessage({id: 'admin.posts.persistentNotifications.title', defaultMessage: 'Persistent Notifications'}),
                            help_text: defineMessage({id: 'admin.posts.persistentNotifications.desc', defaultMessage: 'When enabled, users can trigger repeating notifications for the recipients of urgent messages. Learn more about message priority and persistent notifications in our <link>documentation</link>.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
                            type: 'number',
                            key: 'ServiceSettings.PersistentNotificationMaxRecipients',
                            label: defineMessage({id: 'admin.posts.persistentNotificationsMaxRecipients.title', defaultMessage: 'Maximum number of recipients for persistent notifications'}),
                            help_text: defineMessage({id: 'admin.posts.persistentNotificationsMaxRecipients.desc', defaultMessage: 'Configure the maximum number of recipients to which users may send persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
                            type: 'number',
                            key: 'ServiceSettings.PersistentNotificationIntervalMinutes',
                            label: defineMessage({id: 'admin.posts.persistentNotificationsInterval.title', defaultMessage: 'Frequency of persistent notifications'}),
                            help_text: defineMessage({id: 'admin.posts.persistentNotificationsInterval.desc', defaultMessage: 'Configure the number of minutes between repeated notifications for urgent messages send with persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
                            validate: validators.minValue(2, defineMessage({id: 'admin.posts.persistentNotificationsInterval.minValue', defaultMessage: 'Frequency cannot not be set to less than 2 minutes'})),
                        },
                        {
                            type: 'number',
                            key: 'ServiceSettings.PersistentNotificationMaxCount',
                            label: defineMessage({id: 'admin.posts.persistentNotificationsMaxCount.title', defaultMessage: 'Total number of persistent notification per post'}),
                            help_text: defineMessage({id: 'admin.posts.persistentNotificationsMaxCount.desc', defaultMessage: 'Configure the maximum number of times users may receive persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
                            type: 'bool',
                            key: 'ServiceSettings.AllowPersistentNotificationsForGuests',
                            label: defineMessage({id: 'admin.posts.persistentNotificationsGuests.title', defaultMessage: 'Allow guests to send persistent notifications'}),
                            help_text: defineMessage({id: 'admin.posts.persistentNotificationsGuests.desc', defaultMessage: 'Whether a guest is able to require persistent notifications. Learn more about message priority and persistent notifications in our <link>documentation</link>.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
                            type: 'bool',
                            key: 'ServiceSettings.EnableLinkPreviews',
                            label: defineMessage({id: 'admin.customization.enableLinkPreviewsTitle', defaultMessage: 'Enable website link previews:'}),
                            help_text: defineMessage({id: 'admin.customization.enableLinkPreviewsDesc', defaultMessage: 'Display a preview of website content, image links and YouTube links below the message when available. The server must be connected to the internet and have access through the firewall (if applicable) to the websites from which previews are expected. Users can disable these previews from Settings > Display > Website Link Previews.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.RestrictLinkPreviews',
                            label: defineMessage({id: 'admin.customization.restrictLinkPreviewsTitle', defaultMessage: 'Disable website link previews from these domains:'}),
                            help_text: defineMessage({id: 'admin.customization.restrictLinkPreviewsDesc', defaultMessage: 'Link previews and image link previews will not be shown for the above list of comma-separated domains.'}),
                            placeholder: defineMessage({id: 'admin.customization.restrictLinkPreviewsExample', defaultMessage: 'E.g.: "internal.mycompany.com, images.example.com"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                                it.configIsFalse('ServiceSettings', 'EnableLinkPreviews'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnablePermalinkPreviews',
                            label: defineMessage({id: 'admin.customization.enablePermalinkPreviewsTitle', defaultMessage: 'Enable message link previews:'}),
                            help_text: defineMessage({id: 'admin.customization.enablePermalinkPreviewsDesc', defaultMessage: 'When enabled, links to Mattermost messages will generate a preview for any users that have access to the original message. Please review our <link>documentation</link> for details.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.SHARE_LINKS_TO_MESSAGES}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableSVGs',
                            label: defineMessage({id: 'admin.customization.enableSVGsTitle', defaultMessage: 'Enable SVGs:'}),
                            help_text: defineMessage({id: 'admin.customization.enableSVGsDesc', defaultMessage: 'Enable previews for SVG file attachments and allow them to appear in messages. Enabling SVGs is not recommended in environments where not all users are trusted.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableLatex',
                            label: defineMessage({id: 'admin.customization.enableLatexTitle', defaultMessage: 'Enable Latex Rendering:'}),
                            help_text: defineMessage({id: 'admin.customization.enableLatexDesc', defaultMessage: 'Enable rendering of Latex in code blocks. If false, Latex code will be highlighted only. Enabling Latex is not recommended in environments where not all users are trusted.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableInlineLatex',
                            label: defineMessage({id: 'admin.customization.enableInlineLatexTitle', defaultMessage: 'Enable Inline Latex Rendering:'}),
                            help_text: defineMessage({id: 'admin.customization.enableInlineLatexDesc', defaultMessage: 'Enable rendering of inline Latex code. If false, Latex can only be rendered in a code block using syntax highlighting. Please review our <link>documentation</link> for details about text formatting.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.FORMAT_MESSAGES}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                                it.stateIsFalse('ServiceSettings.EnableLatex'),
                            ),
                        },
                        {
                            type: 'custom',
                            component: CustomURLSchemesSetting,
                            key: 'DisplaySettings.CustomURLSchemes',
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        },
                        {
                            type: 'number',
                            key: 'DisplaySettings.MaxMarkdownNodes',
                            label: defineMessage({id: 'admin.customization.maxMarkdownNodesTitle', defaultMessage: 'Max Markdown Nodes:'}),
                            help_text: defineMessage({id: 'admin.customization.maxMarkdownNodesDesc', defaultMessage: 'When rendering Markdown text in the mobile app, controls the maximum number of Markdown elements (eg. emojis, links, table cells, etc) that can be in a single piece of text. If set to 0, a default limit will be used.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.POSTS)),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.GoogleDeveloperKey',
                            label: defineMessage({id: 'admin.service.googleTitle', defaultMessage: 'Google API Key:'}),
                            placeholder: defineMessage({id: 'admin.service.googleExample', defaultMessage: 'E.g.: "7rAh6iwQCkV4cA1Gsg3fgGOXJAQ43QV"'}),
                            help_text: defineMessage({id: 'admin.service.googleDescription', defaultMessage: 'Set this key to enable the display of titles for embedded YouTube video previews. Without the key, YouTube previews will still be created based on hyperlinks appearing in messages or comments but they will not show the video title. View a <link>Google Developers Tutorial</link> for instructions on how to obtain a key and add YouTube Data API v3 as a service to your key.'}),
                            help_text_values: {
                                link: (msg: string) => (
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
                            type: 'bool',
                            key: 'ServiceSettings.AllowSyncedDrafts',
                            label: defineMessage({id: 'admin.customization.allowSyncedDrafts', defaultMessage: 'Enable server syncing of message drafts:'}),
                            help_text: defineMessage({id: 'admin.customization.allowSyncedDraftsDesc', defaultMessage: 'When enabled, users message drafts will sync with the server so they can be accessed from any device. Users may opt out of this behaviour in Account settings.'}),
                            help_text_markdown: false,
                        },
                        {
                            type: 'number',
                            key: 'ServiceSettings.UniqueEmojiReactionLimitPerPost',
                            label: defineMessage({id: 'admin.customization.uniqueEmojiReactionLimitPerPost', defaultMessage: 'Unique Emoji Reaction Limit:'}),
                            placeholder: defineMessage({id: 'admin.customization.uniqueEmojiReactionLimitPerPostPlaceholder', defaultMessage: 'E.g.: 25'}),
                            help_text: defineMessage({id: 'admin.customization.uniqueEmojiReactionLimitPerPostDesc', defaultMessage: 'The number of unique emoji reactions that can be added to a post. Increasing this limit could lead to poor client performance. Maximum is 500.'}),
                            help_text_markdown: false,
                            validate: (value) => {
                                const maxResult = validators.maxValue(
                                    500,
                                    defineMessage({id: 'admin.customization.uniqueEmojiReactionLimitPerPost.maxValue', defaultMessage: 'Cannot increase the limit to a value above 500.'}),
                                )(value);
                                if (!maxResult.isValid()) {
                                    return maxResult;
                                }
                                const minResult = validators.minValue(
                                    0,
                                    defineMessage({id: 'admin.customization.uniqueEmojiReactionLimitPerPost.minValue', defaultMessage: 'Cannot decrease the limit below 0.'}),
                                )(value);
                                if (!minResult.isValid()) {
                                    return minResult;
                                }

                                return new ValidationResult(true, '');
                            },
                        },
                    ],
                },
            },
            wrangler: {
                url: 'site_config/wrangler',
                title: defineMessage({id: 'admin.sidebar.move_thread', defaultMessage: 'Move Thread (Beta)'}),
                isHidden: it.any(it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.POSTS)), it.configIsFalse('FeatureFlags', 'MoveThreadsEnabled'), it.not(it.licensed)),
                schema: {
                    id: 'WranglerSettings',
                    name: defineMessage({id: 'admin.site.move_thread', defaultMessage: 'Move Thread (Beta)'}),
                    settings: [
                        {
                            type: 'roles',
                            multiple: true,
                            key: 'WranglerSettings.PermittedWranglerRoles',
                            label: defineMessage({id: 'admin.experimental.PermittedMoveThreadRoles.title', defaultMessage: 'Permitted Roles'}),
                            help_text: defineMessage({id: 'admin.experimental.PermittedMoveThreadRoles.desc', defaultMessage: 'Choose who is allowed to move threads to other channels based on roles. (Other permissions below still apply).'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'text',
                            key: 'WranglerSettings.AllowedEmailDomain',
                            multiple: true,
                            label: defineMessage({id: 'admin.experimental.allowedEmailDomain.title', defaultMessage: 'Allowed Email Domain'}),
                            help_text: defineMessage({id: 'admin.experimental.allowedEmailDomain.desc', defaultMessage: '(Optional) When set, users must have an email ending in this domain to move threads. Multiple domains can be specified by separating them with commas.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'number',
                            key: 'WranglerSettings.MoveThreadMaxCount',
                            label: defineMessage({id: 'admin.experimental.moveThreadMaxCount.title', defaultMessage: 'Max Thread Count Move Size'}),
                            help_text: defineMessage({id: 'admin.experimental.moveThreadMaxCount.desc', defaultMessage: 'The maximum number of messages in a thread that the plugin is allowed to move. Leave empty for unlimited messages.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'WranglerSettings.MoveThreadToAnotherTeamEnable',
                            label: defineMessage({id: 'admin.experimental.moveThreadToAnotherTeamEnable.title', defaultMessage: 'Enable Moving Threads To Different Teams'}),
                            help_text: defineMessage({id: 'admin.experimental.moveThreadToAnotherTeamEnable.desc', defaultMessage: 'Control whether Wrangler is permitted to move message threads from one team to another or not.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'WranglerSettings.MoveThreadFromPrivateChannelEnable',
                            label: defineMessage({id: 'admin.experimental.moveThreadFromPrivateChannelEnable.title', defaultMessage: 'Enable Moving Threads From Private Channels'}),
                            help_text: defineMessage({id: 'admin.experimental.moveThreadFromPrivateChannelEnable.desc', defaultMessage: 'Control whether Wrangler is permitted to move message threads from private channels or not.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'WranglerSettings.MoveThreadFromDirectMessageChannelEnable',
                            label: defineMessage({id: 'admin.experimental.moveThreadFromDirectMessageChannelEnable.title', defaultMessage: 'Enable Moving Threads From Direct Message Channels'}),
                            help_text: defineMessage({id: 'admin.experimental.moveThreadFromDirectMessageChannelEnable.desc', defaultMessage: 'Control whether Wrangler is permitted to move message threads from direct message channels or not.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'WranglerSettings.MoveThreadFromGroupMessageChannelEnable',
                            label: defineMessage({id: 'admin.experimental.moveThreadFromGroupMessageChannelEnable.title', defaultMessage: 'Enable Moving Threads From Group Message Channels'}),
                            help_text: defineMessage({id: 'admin.experimental.moveThreadFromGroupMessageChannelEnable.desc', defaultMessage: 'Control whether Wrangler is permitted to move message threads from group message channels or not.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                    ],
                },
            },
            file_sharing_downloads: {
                url: 'site_config/file_sharing_downloads',
                title: defineMessage({id: 'admin.sidebar.fileSharingDownloads', defaultMessage: 'File Sharing and Downloads'}),
                isHidden: it.any(
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
                ),
                schema: {
                    id: 'FileSharingDownloads',
                    name: defineMessage({id: 'admin.site.fileSharingDownloads', defaultMessage: 'File Sharing and Downloads'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'FileSettings.EnableFileAttachments',
                            label: defineMessage({id: 'admin.file.enableFileAttachments', defaultMessage: 'Allow File Sharing:'}),
                            help_text: defineMessage({id: 'admin.file.enableFileAttachmentsDesc', defaultMessage: 'When false, disables file sharing on the server. All file and image uploads on messages are forbidden across clients and devices, including mobile.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.EnableMobileUpload',
                            label: defineMessage({id: 'admin.file.enableMobileUploadTitle', defaultMessage: 'Allow File Uploads on Mobile:'}),
                            help_text: defineMessage({id: 'admin.file.enableMobileUploadDesc', defaultMessage: 'When false, disables file uploads on mobile apps. If Allow File Sharing is set to true, users can still upload files from a mobile web browser.'}),
                            isHidden: it.not(it.licensedForFeature('Compliance')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
                        },
                        {
                            type: 'bool',
                            key: 'FileSettings.EnableMobileDownload',
                            label: defineMessage({id: 'admin.file.enableMobileDownloadTitle', defaultMessage: 'Allow File Downloads on Mobile:'}),
                            help_text: defineMessage({id: 'admin.file.enableMobileDownloadDesc', defaultMessage: 'When false, disables file downloads on mobile apps. Users can still download files from a mobile web browser.'}),
                            isHidden: it.not(it.licensedForFeature('Compliance')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.FILE_SHARING_AND_DOWNLOADS)),
                        },
                    ],
                },
            },
            public_links: {
                url: 'site_config/public_links',
                title: defineMessage({id: 'admin.sidebar.publicLinks', defaultMessage: 'Public Links'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.PUBLIC_LINKS)),
                ),
                schema: {
                    id: 'PublicLinkSettings',
                    name: defineMessage({id: 'admin.site.public_links', defaultMessage: 'Public Links'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'FileSettings.EnablePublicLink',
                            label: defineMessage({id: 'admin.image.shareTitle', defaultMessage: 'Enable Public File Links: '}),
                            help_text: defineMessage({id: 'admin.image.shareDescription', defaultMessage: 'Allow users to share public links to files and images.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.PUBLIC_LINKS)),
                        },
                        {
                            type: 'generated',
                            key: 'FileSettings.PublicLinkSalt',
                            label: defineMessage({id: 'admin.image.publicLinkTitle', defaultMessage: 'Public Link Salt:'}),
                            help_text: defineMessage({id: 'admin.image.publicLinkDescription', defaultMessage: '32-character salt added to signing of public links. Randomly generated on install. Select "Regenerate" to create new salt.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.PUBLIC_LINKS)),
                        },
                    ],
                },
            },
            notices: {
                url: 'site_config/notices',
                title: defineMessage({id: 'admin.sidebar.notices', defaultMessage: 'Notices'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.SITE.NOTICES)),
                schema: {
                    id: 'NoticesSettings',
                    name: defineMessage({id: 'admin.site.notices', defaultMessage: 'Notices'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'AnnouncementSettings.AdminNoticesEnabled',
                            label: defineMessage({id: 'admin.notices.enableAdminNoticesTitle', defaultMessage: 'Enable Admin Notices: '}),
                            help_text: defineMessage({id: 'admin.notices.enableAdminNoticesDescription', defaultMessage: 'When enabled, System Admins will receive notices about available server upgrades and relevant system administration features. <link>Learn more about notices</link> in our documentation.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.IN_PRODUCT_NOTICES}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.NOTICES)),
                        },
                        {
                            type: 'bool',
                            key: 'AnnouncementSettings.UserNoticesEnabled',
                            label: defineMessage({id: 'admin.notices.enableEndUserNoticesTitle', defaultMessage: 'Enable End User Notices: '}),
                            help_text: defineMessage({id: 'admin.notices.enableEndUserNoticesDescription', defaultMessage: 'When enabled, all users will receive notices about available client upgrades and relevant end user features to improve user experience. <link>Learn more about notices</link> in our documentation.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.IN_PRODUCT_NOTICES}
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
            ip_filtering: {
                url: 'site_config/ip_filtering',
                title: adminDefinitionMessages.ip_filtering_title,
                isHidden: it.not(it.all(it.configIsTrue('FeatureFlags', 'CloudIPFiltering'), it.licensedForSku('enterprise'))),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.SITE.IP_FILTERING)),
                searchableStrings: [adminDefinitionMessages.ip_filtering_title],
                schema: {
                    id: 'IPFiltering',
                    component: IPFiltering,
                },
            },
        },
    },
    authentication: {
        icon: (
            <ShieldOutlineIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.authentication', defaultMessage: 'Authentication'}),
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.AUTHENTICATION)),
        subsections: {
            signup: {
                url: 'authentication/signup',
                title: defineMessage({id: 'admin.sidebar.signup', defaultMessage: 'Signup'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                schema: {
                    id: 'SignupSettings',
                    name: defineMessage({id: 'admin.authentication.signup', defaultMessage: 'Signup'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableUserCreation',
                            label: defineMessage({id: 'admin.team.userCreationTitle', defaultMessage: 'Enable Account Creation: '}),
                            help_text: defineMessage({id: 'admin.team.userCreationDescription', defaultMessage: 'When false, the ability to create accounts is disabled. The create account button displays error when pressed.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                        },
                        {
                            type: 'text',
                            key: 'TeamSettings.RestrictCreationToDomains',
                            label: defineMessage({id: 'admin.team.restrictTitle', defaultMessage: 'Restrict new system and team members to specified email domains:'}),
                            help_text: defineMessage({id: 'admin.team.restrictDescription', defaultMessage: 'New user accounts are restricted to the above specified email domain (e.g. "mattermost.com") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.com"). New teams can only be created by users from the above domain(s). This setting only affects email login for users.'}),
                            placeholder: defineMessage({id: 'admin.team.restrictExample', defaultMessage: 'E.g.: "corp.mattermost.com, mattermost.com"'}),
                            isHidden: it.all(
                                it.licensed,
                                it.not(it.licensedForSku('starter')),
                            ),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                        },
                        {
                            type: 'text',
                            key: 'TeamSettings.RestrictCreationToDomains',
                            label: defineMessage({id: 'admin.team.restrictTitle', defaultMessage: 'Restrict new system and team members to specified email domains:'}),
                            help_text: defineMessage({id: 'admin.team.restrictGuestDescription', defaultMessage: 'New user accounts are restricted to the above specified email domain (e.g. "mattermost.com") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.com"). New teams can only be created by users from the above domain(s). This setting affects email login for users. For Guest users, please add domains under Signup > Guest Access.'}),
                            placeholder: defineMessage({id: 'admin.team.restrictExample', defaultMessage: 'E.g.: "corp.mattermost.com, mattermost.com"'}),
                            isHidden: it.any(
                                it.not(it.licensed),
                                it.licensedForSku('starter'),
                            ),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableOpenServer',
                            label: defineMessage({id: 'admin.team.openServerTitle', defaultMessage: 'Enable Open Server: '}),
                            help_text: defineMessage({id: 'admin.team.openServerDescription', defaultMessage: 'When true, anyone can signup for a user account on this server without the need to be invited.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableEmailInvitations',
                            label: defineMessage({id: 'admin.team.emailInvitationsTitle', defaultMessage: 'Enable Email Invitations: '}),
                            help_text: defineMessage({id: 'admin.team.emailInvitationsDescription', defaultMessage: 'When true users can invite others to the system using email.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                            isHidden: it.licensedForFeature('Cloud'),
                        },
                        {
                            type: 'button',
                            key: 'InvalidateEmailInvitesButton',
                            action: invalidateAllEmailInvites,
                            label: defineMessage({id: 'admin.team.invalidateEmailInvitesTitle', defaultMessage: 'Invalidate pending email invites'}),
                            help_text: defineMessage({id: 'admin.team.invalidateEmailInvitesDescription', defaultMessage: 'This will invalidate active email invitations that have not been accepted by the user. By default email invitations expire after 48 hours.'}),
                            error_message: defineMessage({id: 'admin.team.invalidateEmailInvitesFail', defaultMessage: 'Unable to invalidate pending email invites: {error}'}),
                            success_message: defineMessage({id: 'admin.team.invalidateEmailInvitesSuccess', defaultMessage: 'Pending email invitations invalidated successfully'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SIGNUP)),
                        },
                    ],
                },
            },
            email: {
                url: 'authentication/email',
                title: defineMessage({id: 'admin.sidebar.email', defaultMessage: 'Email'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                schema: {
                    id: 'EmailSettings',
                    name: defineMessage({id: 'admin.authentication.email', defaultMessage: 'Email'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnableSignUpWithEmail',
                            label: defineMessage({id: 'admin.email.allowSignupTitle', defaultMessage: 'Enable account creation with email:'}),
                            help_text: defineMessage({id: 'admin.email.allowSignupDescription', defaultMessage: 'When true, Mattermost allows account creation using email and password. This value should be false only when you want to limit sign up to a single sign-on service like AD/LDAP, SAML or GitLab.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.RequireEmailVerification',
                            label: defineMessage({id: 'admin.email.requireVerificationTitle', defaultMessage: 'Require Email Verification: '}),
                            help_text: defineMessage({id: 'admin.email.requireVerificationDescription', defaultMessage: 'Typically set to true in production. When true, Mattermost requires email verification after account creation prior to allowing login. Developers may set this field to false to skip sending verification emails for faster development.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                            isHidden: it.licensedForFeature('Cloud'),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnableSignInWithEmail',
                            label: defineMessage({id: 'admin.email.allowEmailSignInTitle', defaultMessage: 'Enable sign-in with email:'}),
                            help_text: defineMessage({id: 'admin.email.allowEmailSignInDescription', defaultMessage: 'When true, Mattermost allows users to sign in using their email and password.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.EnableSignInWithUsername',
                            label: defineMessage({id: 'admin.email.allowUsernameSignInTitle', defaultMessage: 'Enable sign-in with username:'}),
                            help_text: defineMessage({id: 'admin.email.allowUsernameSignInDescription', defaultMessage: 'When true, users with email login can sign in using their username and password. This setting does not affect AD/LDAP login.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.EMAIL)),
                        },
                    ],
                },
            },
            password: {
                url: 'authentication/password',
                title: defineMessage({id: 'admin.sidebar.password', defaultMessage: 'Password'}),
                searchableStrings: passwordSearchableStrings,
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.PASSWORD)),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.PASSWORD)),
                schema: {
                    id: 'PasswordSettings',
                    component: PasswordSettings,
                },
            },
            mfa: {
                url: 'authentication/mfa',
                title: defineMessage({id: 'admin.sidebar.mfa', defaultMessage: 'MFA'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.MFA)),
                schema: {
                    id: 'ServiceSettings',
                    name: defineMessage({id: 'admin.authentication.mfa', defaultMessage: 'Multi-factor Authentication'}),
                    settings: [
                        {
                            type: 'banner',
                            label: defineMessage({id: 'admin.mfa.bannerDesc', defaultMessage: '<link>Multi-factor authentication</link> is available for accounts with AD/LDAP or email login. If other login methods are used, MFA should be configured with the authentication provider.'}),
                            label_markdown: false,
                            label_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.MULTI_FACTOR_AUTH}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            banner_type: 'info',
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableMultifactorAuthentication',
                            label: defineMessage({id: 'admin.service.mfaTitle', defaultMessage: 'Enable Multi-factor Authentication:'}),
                            help_text: defineMessage({id: 'admin.service.mfaDesc', defaultMessage: 'When true, users with AD/LDAP or email login can add multi-factor authentication to their account using Google Authenticator.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.MFA)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnforceMultifactorAuthentication',
                            label: defineMessage({id: 'admin.service.enforceMfaTitle', defaultMessage: 'Enforce Multi-factor Authentication:'}),
                            help_text: defineMessage({id: 'admin.service.enforceMfaDesc', defaultMessage: 'When true, <link>multi-factor authentication</link> is required for login. New users will be required to configure MFA on signup. Logged in users without MFA configured are redirected to the MFA setup page until configuration is complete.\n \nIf your system has users with login methods other than AD/LDAP and email, MFA must be enforced with the authentication provider outside of Mattermost.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.MULTI_FACTOR_AUTH}
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
                title: defineMessage({id: 'admin.sidebar.ldap', defaultMessage: 'AD/LDAP'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('LDAP')),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                ),
                schema: {
                    id: 'LdapSettings',
                    name: defineMessage({id: 'admin.authentication.ldap', defaultMessage: 'AD/LDAP'}),
                    sections: [
                        {
                            title: 'Connection',
                            subtitle: 'Connection and security level to your AD/LDAP server.',
                            settings: [
                                {
                                    type: 'bool',
                                    key: 'LdapSettings.Enable',
                                    label: defineMessage({id: 'admin.ldap.enableTitle', defaultMessage: 'Enable sign-in with AD/LDAP:'}),
                                    help_text: defineMessage({id: 'admin.ldap.enableDesc', defaultMessage: 'When true, Mattermost allows login using AD/LDAP'}),
                                    isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                },
                                {
                                    type: 'bool',
                                    key: 'LdapSettings.EnableSync',
                                    label: defineMessage({id: 'admin.ldap.enableSyncTitle', defaultMessage: 'Enable Synchronization with AD/LDAP:'}),
                                    help_text: defineMessage({id: 'admin.ldap.enableSyncDesc', defaultMessage: 'When true, Mattermost periodically synchronizes users from AD/LDAP. When false, user attributes are updated from AD/LDAP during user login only.'}),
                                    isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.LoginFieldName',
                                    label: defineMessage({id: 'admin.ldap.loginNameTitle', defaultMessage: 'Login Field Name:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.loginNameEx', defaultMessage: 'E.g.: "AD/LDAP Username"'}),
                                    help_text: defineMessage({id: 'admin.ldap.loginNameDesc', defaultMessage: 'The placeholder text that appears in the login field on the login page. Defaults to "AD/LDAP Username".'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.LdapServer',
                                    label: defineMessage({id: 'admin.ldap.serverTitle', defaultMessage: 'AD/LDAP Server:'}),
                                    help_text: defineMessage({id: 'admin.ldap.serverDesc', defaultMessage: 'The domain or IP address of AD/LDAP server.'}),
                                    placeholder: defineMessage({id: 'admin.ldap.serverEx', defaultMessage: 'E.g.: "10.0.0.23"'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'number',
                                    key: 'LdapSettings.LdapPort',
                                    label: defineMessage({id: 'admin.ldap.portTitle', defaultMessage: 'AD/LDAP Port:'}),
                                    help_text: defineMessage({id: 'admin.ldap.portDesc', defaultMessage: 'The port Mattermost will use to connect to the AD/LDAP server. Default is 389.'}),
                                    placeholder: defineMessage({id: 'admin.ldap.portEx', defaultMessage: 'E.g.: "389"'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'dropdown',
                                    key: 'LdapSettings.ConnectionSecurity',
                                    label: defineMessage({id: 'admin.connectionSecurityTitle', defaultMessage: 'Connection Security:'}),
                                    help_text: DefinitionConstants.CONNECTION_SECURITY_HELP_TEXT_LDAP,
                                    options: [
                                        {
                                            value: '',
                                            display_name: defineMessage({id: 'admin.connectionSecurityNone', defaultMessage: 'None'}),
                                        },
                                        {
                                            value: 'TLS',
                                            display_name: defineMessage({id: 'admin.connectionSecurityTls', defaultMessage: 'TLS (Recommended)'}),
                                        },
                                        {
                                            value: 'STARTTLS',
                                            display_name: defineMessage({id: 'admin.connectionSecurityStart', defaultMessage: 'STARTTLS'}),
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
                                    type: 'bool',
                                    key: 'LdapSettings.SkipCertificateVerification',
                                    label: defineMessage({id: 'admin.ldap.skipCertificateVerification', defaultMessage: 'Skip Certificate Verification:'}),
                                    help_text: defineMessage({id: 'admin.ldap.skipCertificateVerificationDesc', defaultMessage: 'Skips the certificate verification step for TLS or STARTTLS connections. Skipping certificate verification is not recommended for production environments where TLS is required.'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.stateIsFalse('LdapSettings.ConnectionSecurity'),
                                    ),
                                },
                                {
                                    type: 'fileupload',
                                    key: 'LdapSettings.PrivateKeyFile',
                                    label: defineMessage({id: 'admin.ldap.privateKeyFileTitle', defaultMessage: 'Private Key:'}),
                                    help_text: defineMessage({id: 'admin.ldap.privateKeyFileFileDesc', defaultMessage: 'The private key file for TLS Certificate. If using TLS client certificates as primary authentication mechanism. This will be provided by your LDAP Authentication Provider.'}),
                                    remove_help_text: defineMessage({id: 'admin.ldap.privateKeyFileFileRemoveDesc', defaultMessage: 'Remove the private key file for TLS Certificate.'}),
                                    remove_button_text: defineMessage({id: 'admin.ldap.remove.privKey', defaultMessage: 'Remove TLS Certificate Private Key'}),
                                    removing_text: defineMessage({id: 'admin.ldap.removing.privKey', defaultMessage: 'Removing Private Key...'}),
                                    uploading_text: defineMessage({id: 'admin.ldap.uploading.privateKey', defaultMessage: 'Uploading Private Key...'}),
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
                                    type: 'fileupload',
                                    key: 'LdapSettings.PublicCertificateFile',
                                    label: defineMessage({id: 'admin.ldap.publicCertificateFileTitle', defaultMessage: 'Public Certificate:'}),
                                    help_text: defineMessage({id: 'admin.ldap.publicCertificateFileDesc', defaultMessage: 'The public certificate file for TLS Certificate. If using TLS client certificates as primary authentication mechanism. This will be provided by your LDAP Authentication Provider.'}),
                                    remove_help_text: defineMessage({id: 'admin.ldap.publicCertificateFileRemoveDesc', defaultMessage: 'Remove the public certificate file for TLS Certificate.'}),
                                    remove_button_text: defineMessage({id: 'admin.ldap.remove.sp_certificate', defaultMessage: 'Remove Service Provider Certificate'}),
                                    removing_text: defineMessage({id: 'admin.ldap.removing.certificate', defaultMessage: 'Removing Certificate...'}),
                                    uploading_text: defineMessage({id: 'admin.ldap.uploading.certificate', defaultMessage: 'Uploading Certificate...'}),
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
                                    type: 'text',
                                    key: 'LdapSettings.BindUsername',
                                    label: defineMessage({id: 'admin.ldap.bindUserTitle', defaultMessage: 'Bind Username:'}),
                                    help_text: defineMessage({id: 'admin.ldap.bindUserDesc', defaultMessage: 'The username used to perform the AD/LDAP search. This should typically be an account created specifically for use with Mattermost. It should have access limited to read the portion of the AD/LDAP tree specified in the Base DN field.'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.BindPassword',
                                    label: defineMessage({id: 'admin.ldap.bindPwdTitle', defaultMessage: 'Bind Password:'}),
                                    help_text: defineMessage({id: 'admin.ldap.bindPwdDesc', defaultMessage: 'Password of the user given in "Bind Username".'}),
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
                                    type: 'text',
                                    key: 'LdapSettings.BaseDN',
                                    label: defineMessage({id: 'admin.ldap.baseTitle', defaultMessage: 'Base DN:'}),
                                    help_text: defineMessage({id: 'admin.ldap.baseDesc', defaultMessage: 'The Base DN is the Distinguished Name of the location where Mattermost should start its search for user and group objects in the AD/LDAP tree.'}),
                                    placeholder: defineMessage({id: 'admin.ldap.baseEx', defaultMessage: 'E.g.: "ou=Unit Name,dc=corp,dc=example,dc=com"'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.UserFilter',
                                    label: defineMessage({id: 'admin.ldap.userFilterTitle', defaultMessage: 'User Filter:'}),
                                    help_text: defineMessage({id: 'admin.ldap.userFilterDisc', defaultMessage: '(Optional) Enter an AD/LDAP filter to use when searching for user objects. Only the users selected by the query will be able to access Mattermost. For Active Directory, the query to filter out disabled users is (&(objectCategory=Person)(!(UserAccountControl:1.2.840.113556.1.4.803:=2))).'}),
                                    placeholder: defineMessage({id: 'admin.ldap.userFilterEx', defaultMessage: 'Ex. "(objectClass=user)"'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.GroupFilter',
                                    label: defineMessage({id: 'admin.ldap.groupFilterTitle', defaultMessage: 'Group Filter:'}),
                                    help_text: defineMessage({id: 'admin.ldap.groupFilterFilterDesc', defaultMessage: '(Optional) Enter an AD/LDAP filter to use when searching for group objects. Only the groups selected by the query will be available to Mattermost. From [User Management > Groups]({siteURL}/admin_console/user_management/groups), select which AD/LDAP groups should be linked and configured.'}),
                                    help_text_markdown: true,
                                    help_text_values: {siteURL: getSiteURL()},
                                    placeholder: defineMessage({id: 'admin.ldap.groupFilterEx', defaultMessage: 'E.g.: "(objectClass=group)"'}),
                                    isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                },
                                {
                                    type: 'bool',
                                    key: 'LdapSettings.EnableAdminFilter',
                                    label: defineMessage({id: 'admin.ldap.enableAdminFilterTitle', defaultMessage: 'Enable Admin Filter:'}),
                                    isDisabled: it.any(
                                        it.not(it.isSystemAdmin),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.AdminFilter',
                                    label: defineMessage({id: 'admin.ldap.adminFilterTitle', defaultMessage: 'Admin Filter:'}),
                                    help_text: defineMessage({id: 'admin.ldap.adminFilterFilterDesc', defaultMessage: '(Optional) Enter an AD/LDAP filter to use for designating System Admins. The users selected by the query will have access to your Mattermost server as System Admins. By default, System Admins have complete access to the Mattermost System Console. Existing members that are identified by this attribute will be promoted from member to System Admin upon next login. The next login is based upon Session lengths set in **System Console > Session Lengths**. It is highly recommend to manually demote users to members in **System Console > User Management** to ensure access is restricted immediately. Note: If this filter is removed/changed, System Admins that were promoted via this filter will be demoted to members and will not retain access to the System Console. When this filter is not in use, System Admins can be manually promoted/demoted in **System Console > User Management**.'}),
                                    help_text_markdown: true,
                                    placeholder: defineMessage({id: 'admin.ldap.adminFilterEx', defaultMessage: 'E.g.: "(objectClass=user)"'}),
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
                                    type: 'text',
                                    key: 'LdapSettings.GuestFilter',
                                    label: defineMessage({id: 'admin.ldap.guestFilterTitle', defaultMessage: 'Guest Filter:'}),
                                    help_text: defineMessage({id: 'admin.ldap.guestFilterFilterDesc', defaultMessage: '(Optional) Requires Guest Access to be enabled before being applied. Enter an AD/LDAP filter to use when searching for guest objects. Only the users selected by the query will be able to access Mattermost as Guests. Guests are prevented from accessing teams or channels upon logging in until they are assigned a team and at least one channel. Note: If this filter is removed/changed, active guests will not be promoted to a member and will retain their Guest role. Guests can be promoted in **System Console > User Management**. Existing members that are identified by this attribute as a guest will be demoted from a member to a guest when they are asked to login next. The next login is based upon Session lengths set in **System Console > Session Lengths**. It is highly recommend to manually demote users to guests in **System Console > User Management ** to ensure access is restricted immediately.'}),
                                    help_text_markdown: true,
                                    placeholder: defineMessage({id: 'admin.ldap.guestFilterEx', defaultMessage: 'E.g.: "(objectClass=user)"'}),
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
                                    type: 'text',
                                    key: 'LdapSettings.IdAttribute',
                                    label: defineMessage({id: 'admin.ldap.idAttrTitle', defaultMessage: 'ID Attribute: '}),
                                    placeholder: defineMessage({id: 'admin.ldap.idAttrEx', defaultMessage: 'E.g.: "objectGUID" or "uid"'}),
                                    help_text: defineMessage({id: 'admin.ldap.idAttrDesc', defaultMessage: "The attribute in the AD/LDAP server used as a unique identifier in Mattermost. It should be an AD/LDAP attribute with a value that does not change such as `uid` for LDAP or `objectGUID` for Active Directory. If a user's ID Attribute changes, it will create a new Mattermost account unassociated with their old one. If you need to change this field after users have already logged in, use the <link>mattermost ldap idmigrate</link> CLI tool."}),
                                    help_text_markdown: false,
                                    help_text_values: {
                                        link: (msg: string) => (
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
                                    type: 'text',
                                    key: 'LdapSettings.LoginIdAttribute',
                                    label: defineMessage({id: 'admin.ldap.loginAttrTitle', defaultMessage: 'Login ID Attribute: '}),
                                    placeholder: defineMessage({id: 'admin.ldap.loginIdAttrEx', defaultMessage: 'E.g.: "sAMAccountName"'}),
                                    help_text: defineMessage({id: 'admin.ldap.loginAttrDesc', defaultMessage: 'The attribute in the AD/LDAP server used to log in to Mattermost. Normally this attribute is the same as the "Username Attribute" field above. If your team typically uses domain/username to log in to other services with AD/LDAP, you may enter domain/username in this field to maintain consistency between sites.'}),
                                    help_text_markdown: false,
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.UsernameAttribute',
                                    label: defineMessage({id: 'admin.ldap.usernameAttrTitle', defaultMessage: 'Username Attribute:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.usernameAttrEx', defaultMessage: 'E.g.: "sAMAccountName"'}),
                                    help_text: defineMessage({id: 'admin.ldap.usernameAttrDesc', defaultMessage: 'The attribute in the AD/LDAP server used to populate the username field in Mattermost. This may be the same as the Login ID Attribute.'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.EmailAttribute',
                                    label: defineMessage({id: 'admin.ldap.emailAttrTitle', defaultMessage: 'Email Attribute:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.emailAttrEx', defaultMessage: 'E.g.: "mail" or "userPrincipalName"'}),
                                    help_text: defineMessage({id: 'admin.ldap.emailAttrDesc', defaultMessage: 'The attribute in the AD/LDAP server used to populate the email address field in Mattermost.'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.FirstNameAttribute',
                                    label: defineMessage({id: 'admin.ldap.firstnameAttrTitle', defaultMessage: 'First Name Attribute:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.firstnameAttrEx', defaultMessage: 'E.g.: "givenName"'}),
                                    help_text: defineMessage({id: 'admin.ldap.firstnameAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the first name of users in Mattermost. When set, users cannot edit their first name, since it is synchronized with the LDAP server. When left blank, users can set their first name in <strong>Account Menu > Account Settings > Profile</strong>.'}),
                                    help_text_values: {
                                        strong: (msg: string) => <strong>{msg}</strong>,
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
                                    type: 'text',
                                    key: 'LdapSettings.LastNameAttribute',
                                    label: defineMessage({id: 'admin.ldap.lastnameAttrTitle', defaultMessage: 'Last Name Attribute:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.lastnameAttrEx', defaultMessage: 'E.g.: "sn"'}),
                                    help_text: defineMessage({id: 'admin.ldap.lastnameAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the last name of users in Mattermost. When set, users cannot edit their last name, since it is synchronized with the LDAP server. When left blank, users can set their last name in <strong>Account Menu > Account Settings > Profile</strong>.'}),
                                    help_text_values: {
                                        strong: (msg: string) => <strong>{msg}</strong>,
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
                                    type: 'text',
                                    key: 'LdapSettings.NicknameAttribute',
                                    label: defineMessage({id: 'admin.ldap.nicknameAttrTitle', defaultMessage: 'Nickname Attribute:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.nicknameAttrEx', defaultMessage: 'E.g.: "nickname"'}),
                                    help_text: defineMessage({id: 'admin.ldap.nicknameAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the nickname of users in Mattermost. When set, users cannot edit their nickname, since it is synchronized with the LDAP server. When left blank, users can set their nickname in <strong>Account Menu > Account Settings > Profile</strong>.'}),
                                    help_text_values: {
                                        strong: (msg: string) => <strong>{msg}</strong>,
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
                                    type: 'text',
                                    key: 'LdapSettings.PositionAttribute',
                                    label: defineMessage({id: 'admin.ldap.positionAttrTitle', defaultMessage: 'Position Attribute:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.positionAttrEx', defaultMessage: 'E.g.: "title"'}),
                                    help_text: defineMessage({id: 'admin.ldap.positionAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the position field in Mattermost. When set, users cannot edit their position, since it is synchronized with the LDAP server. When left blank, users can set their position in <strong>Account Menu > Account Settings > Profile</strong>.'}),
                                    help_text_values: {
                                        strong: (msg: string) => <strong>{msg}</strong>,
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
                                    type: 'text',
                                    key: 'LdapSettings.PictureAttribute',
                                    label: defineMessage({id: 'admin.ldap.pictureAttrTitle', defaultMessage: 'Profile Picture Attribute:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.pictureAttrEx', defaultMessage: 'E.g.: "thumbnailPhoto" or "jpegPhoto"'}),
                                    help_text: defineMessage({id: 'admin.ldap.pictureAttrDesc', defaultMessage: '(Optional) The attribute in the AD/LDAP server used to populate the profile picture in Mattermost.'}),
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
                                    type: 'text',
                                    key: 'LdapSettings.GroupDisplayNameAttribute',
                                    label: defineMessage({id: 'admin.ldap.groupDisplayNameAttributeTitle', defaultMessage: 'Group Display Name Attribute:'}),
                                    help_text: defineMessage({id: 'admin.ldap.groupDisplayNameAttributeDesc', defaultMessage: 'The attribute in the AD/LDAP server used to populate the group display names.'}),
                                    placeholder: defineMessage({id: 'admin.ldap.groupDisplayNameAttributeEx', defaultMessage: 'E.g.: "cn"'}),
                                    isHidden: it.not(it.licensedForFeature('LDAPGroups')),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                },
                                {
                                    type: 'text',
                                    key: 'LdapSettings.GroupIdAttribute',
                                    label: defineMessage({id: 'admin.ldap.groupIdAttributeTitle', defaultMessage: 'Group ID Attribute:'}),
                                    help_text: defineMessage({id: 'admin.ldap.groupIdAttributeDesc', defaultMessage: 'The attribute in the AD/LDAP server used as a unique identifier for Groups. This should be a AD/LDAP attribute with a value that does not change such as `entryUUID` for LDAP or `objectGUID` for Active Directory.'}),
                                    help_text_markdown: true,
                                    placeholder: defineMessage({id: 'admin.ldap.groupIdAttributeEx', defaultMessage: 'E.g.: "objectGUID" or "entryUUID"'}),
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
                                    type: 'number',
                                    key: 'LdapSettings.SyncIntervalMinutes',
                                    label: defineMessage({id: 'admin.ldap.syncIntervalTitle', defaultMessage: 'Synchronization Interval (minutes):'}),
                                    help_text: defineMessage({id: 'admin.ldap.syncIntervalHelpText', defaultMessage: 'AD/LDAP Synchronization updates Mattermost user information to reflect updates on the AD/LDAP server. For example, when a user\'s name changes on the AD/LDAP server, the change updates in Mattermost when synchronization is performed. Accounts removed from or disabled in the AD/LDAP server have their Mattermost accounts set to "Inactive" and have their account sessions revoked. Mattermost performs synchronization on the interval entered. For example, if 60 is entered, Mattermost synchronizes every 60 minutes.'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'number',
                                    key: 'LdapSettings.MaxPageSize',
                                    label: defineMessage({id: 'admin.ldap.maxPageSizeTitle', defaultMessage: 'Maximum Page Size:'}),
                                    placeholder: defineMessage({id: 'admin.ldap.maxPageSizeEx', defaultMessage: 'E.g.: "2000"'}),
                                    help_text: defineMessage({id: 'admin.ldap.maxPageSizeHelpText', defaultMessage: 'The maximum number of users the Mattermost server will request from the AD/LDAP server at one time. 0 is unlimited.'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'number',
                                    key: 'LdapSettings.QueryTimeout',
                                    label: defineMessage({id: 'admin.ldap.queryTitle', defaultMessage: 'Query Timeout (seconds):'}),
                                    placeholder: defineMessage({id: 'admin.ldap.queryEx', defaultMessage: 'E.g.: "60"'}),
                                    help_text: defineMessage({id: 'admin.ldap.queryDesc', defaultMessage: 'The timeout value for queries to the AD/LDAP server. Increase if you are getting timeout errors caused by a slow AD/LDAP server.'}),
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.all(
                                            it.stateIsFalse('LdapSettings.Enable'),
                                            it.stateIsFalse('LdapSettings.EnableSync'),
                                        ),
                                    ),
                                },
                                {
                                    type: 'button',
                                    action: ldapTest,
                                    key: 'LdapSettings.LdapTest',
                                    label: defineMessage({id: 'admin.ldap.ldap_test_button', defaultMessage: 'AD/LDAP Test'}),
                                    help_text: defineMessage({id: 'admin.ldap.testHelpText', defaultMessage: 'Tests if the Mattermost server can connect to the AD/LDAP server specified. Please review "System Console > Logs" and <link>documentation</link> to troubleshoot errors.'}),
                                    help_text_values: {
                                        link: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href={DocLinks.CONFIGURE_AD_LDAP_QUERY_TIMEOUT}
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                    },
                                    help_text_markdown: false,
                                    error_message: defineMessage({id: 'admin.ldap.testFailure', defaultMessage: 'AD/LDAP Test Failure: {error}'}),
                                    success_message: defineMessage({id: 'admin.ldap.testSuccess', defaultMessage: 'AD/LDAP Test Successful'}),
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
                                    type: 'jobstable',
                                    job_type: Constants.JobTypes.LDAP_SYNC,
                                    label: defineMessage({id: 'admin.ldap.sync_button', defaultMessage: 'AD/LDAP Synchronize Now'}),
                                    help_text: defineMessage({id: 'admin.ldap.syncNowHelpText', defaultMessage: 'Initiates an AD/LDAP synchronization immediately. See the table below for status of each synchronization. Please review "System Console > Logs" and <link>documentation</link> to troubleshoot errors.'}),
                                    help_text_markdown: false,
                                    help_text_values: {
                                        link: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href={DocLinks.SETUP_LDAP}
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                    },
                                    isDisabled: it.any(
                                        it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.LDAP)),
                                        it.stateIsFalse('LdapSettings.EnableSync'),
                                    ),
                                    render_job: (job: Job) => {
                                        if (job.status === 'pending') {
                                            return <span>{'--'}</span>;
                                        }

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
                title: defineMessage({id: 'admin.sidebar.ldap', defaultMessage: 'AD/LDAP'}),
                isHidden: it.any(
                    it.licensedForFeature('LDAP'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'LdapSettings',
                    name: defineMessage({id: 'admin.authentication.ldap', defaultMessage: 'AD/LDAP'}),
                    settings: [
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.saml', defaultMessage: 'SAML 2.0'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('SAML')),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                ),
                schema: {
                    id: 'SamlSettings',
                    name: defineMessage({id: 'admin.authentication.saml', defaultMessage: 'SAML 2.0'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'SamlSettings.Enable',
                            label: defineMessage({id: 'admin.saml.enableTitle', defaultMessage: 'Enable Login With SAML 2.0:'}),
                            help_text: defineMessage({id: 'admin.saml.enableDescription', defaultMessage: 'When true, Mattermost allows login using SAML 2.0. Please see <link>documentation</link> to learn more about configuring SAML for Mattermost.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                link: (msg: string) => (
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
                            type: 'bool',
                            key: 'SamlSettings.EnableSyncWithLdap',
                            label: defineMessage({id: 'admin.saml.enableSyncWithLdapTitle', defaultMessage: 'Enable Synchronizing SAML Accounts With AD/LDAP:'}),
                            help_text: defineMessage({id: 'admin.saml.enableSyncWithLdapDescription', defaultMessage: 'When true, Mattermost periodically synchronizes SAML user attributes, including user deactivation and removal, from AD/LDAP. Enable and configure synchronization settings at <strong>Authentication > AD/LDAP</strong>. When false, user attributes are updated from SAML during user login. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.SETUP_LDAP}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                strong: (msg: string) => <strong>{msg}</strong>,
                            },
                            help_text_markdown: false,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'SamlSettings.IgnoreGuestsLdapSync',
                            label: defineMessage({id: 'admin.saml.ignoreGuestsLdapSyncTitle', defaultMessage: 'Ignore Guest Users when Synchronizing with AD/LDAP'}),
                            help_text: defineMessage({id: 'admin.saml.ignoreGuestsLdapSyncDesc', defaultMessage: 'When true, Mattermost will ignore Guest Users who are identified by the Guest Attribute, when synchronizing with AD/LDAP for user deactivation and removal and Guest deactivation will need to be managed manually via System Console > Users.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.configIsFalse('GuestAccountsSettings', 'Enable'),
                                it.stateIsFalse('SamlSettings.EnableSyncWithLdap'),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'SamlSettings.EnableSyncWithLdapIncludeAuth',
                            label: defineMessage({id: 'admin.saml.enableSyncWithLdapIncludeAuthTitle', defaultMessage: 'Override SAML bind data with AD/LDAP information:'}),
                            help_text: defineMessage({id: 'admin.saml.enableSyncWithLdapIncludeAuthDescription', defaultMessage: 'When true, Mattermost will override the SAML ID attribute with the AD/LDAP ID attribute if configured or override the SAML Email attribute with the AD/LDAP Email attribute if SAML ID attribute is not present. This will allow you automatically migrate users from Email binding to ID binding to prevent creation of new users when an email address changes for a user. Moving from true to false, will remove the override from happening. <strong>Note:</strong> SAML IDs must match the LDAP IDs to prevent disabling of user accounts. Please review <link>documentation</link> for more information.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.CONFIGURE_OVERRIDE_SAML_BIND_DATA_WITH_LDAP}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                strong: (msg: string) => <strong>{msg}</strong>,
                            },
                            help_text_markdown: false,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                                it.stateIsFalse('SamlSettings.EnableSyncWithLdap'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.IdpMetadataURL',
                            label: defineMessage({id: 'admin.saml.idpMetadataUrlTitle', defaultMessage: 'Identity Provider Metadata URL:'}),
                            help_text: defineMessage({id: 'admin.saml.idpMetadataUrlDesc', defaultMessage: 'The Metadata URL for the Identity Provider you use for SAML requests'}),
                            placeholder: defineMessage({id: 'admin.saml.idpMetadataUrlEx', defaultMessage: 'E.g.: "https://idp.example.org/SAML2/saml/metadata"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'button',
                            key: 'getSamlMetadataFromIDPButton',
                            action: getSamlMetadataFromIdp,
                            label: defineMessage({id: 'admin.saml.getSamlMetadataFromIDPUrl', defaultMessage: 'Get SAML Metadata from IdP'}),
                            loading: defineMessage({id: 'admin.saml.getSamlMetadataFromIDPFetching', defaultMessage: 'Fetching...'}),
                            error_message: defineMessage({id: 'admin.saml.getSamlMetadataFromIDPFail', defaultMessage: 'SAML Metadata URL did not connect and pull data successfully'}),
                            success_message: defineMessage({id: 'admin.saml.getSamlMetadataFromIDPSuccess', defaultMessage: 'SAML Metadata retrieved successfully. Two fields below have been updated'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                                it.stateEquals('SamlSettings.IdpMetadataURL', ''),
                            ),
                            sourceUrlKey: 'SamlSettings.IdpMetadataURL',
                            skipSaveNeeded: true,
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.IdpURL',
                            label: defineMessage({id: 'admin.saml.idpUrlTitle', defaultMessage: 'SAML SSO URL:'}),
                            help_text: defineMessage({id: 'admin.saml.idpUrlDesc', defaultMessage: 'The URL where Mattermost sends a SAML request to start login sequence.'}),
                            placeholder: defineMessage({id: 'admin.saml.idpUrlEx', defaultMessage: 'E.g.: "https://idp.example.org/SAML2/SSO/Login"'}),
                            setFromMetadataField: 'idp_url',
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.IdpDescriptorURL',
                            label: defineMessage({id: 'admin.saml.idpDescriptorUrlTitle', defaultMessage: 'Identity Provider Issuer URL:'}),
                            help_text: defineMessage({id: 'admin.saml.idpDescriptorUrlDesc', defaultMessage: 'The issuer URL for the Identity Provider you use for SAML requests.'}),
                            placeholder: defineMessage({id: 'admin.saml.idpDescriptorUrlEx', defaultMessage: 'E.g.: "https://idp.example.org/SAML2/issuer"'}),
                            setFromMetadataField: 'idp_descriptor_url',
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'fileupload',
                            key: 'SamlSettings.IdpCertificateFile',
                            label: defineMessage({id: 'admin.saml.idpCertificateFileTitle', defaultMessage: 'Identity Provider Public Certificate:'}),
                            help_text: defineMessage({id: 'admin.saml.idpCertificateFileDesc', defaultMessage: 'The public authentication certificate issued by your Identity Provider.'}),
                            remove_help_text: defineMessage({id: 'admin.saml.idpCertificateFileRemoveDesc', defaultMessage: 'Remove the public authentication certificate issued by your Identity Provider.'}),
                            remove_button_text: defineMessage({id: 'admin.saml.remove.idp_certificate', defaultMessage: 'Remove Identity Provider Certificate'}),
                            removing_text: defineMessage({id: 'admin.saml.removing.certificate', defaultMessage: 'Removing Certificate...'}),
                            uploading_text: defineMessage({id: 'admin.saml.uploading.certificate', defaultMessage: 'Uploading Certificate...'}),
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
                            type: 'bool',
                            key: 'SamlSettings.Verify',
                            label: defineMessage({id: 'admin.saml.verifyTitle', defaultMessage: 'Verify Signature:'}),
                            help_text: defineMessage({id: 'admin.saml.verifyDescription', defaultMessage: 'When false, Mattermost will not verify that the signature sent from a SAML Response matches the Service Provider Login URL. Disabling verification is not recommended for production environments.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.AssertionConsumerServiceURL',
                            label: defineMessage({id: 'admin.saml.assertionConsumerServiceURLTitle', defaultMessage: 'Service Provider Login URL:'}),
                            help_text: defineMessage({id: 'admin.saml.assertionConsumerServiceURLPopulatedDesc', defaultMessage: 'This field is also known as the Assertion Consumer Service URL.'}),
                            placeholder: defineMessage({id: 'admin.saml.assertionConsumerServiceURLEx', defaultMessage: 'E.g.: "<urlChunk>your-mattermost-url</urlChunk>"'}),
                            placeholder_values: {
                                urlChunk: (chunk: string) => `https://'<${chunk}>'/login/sso/saml`,
                            },
                            onConfigLoad: (value, config) => {
                                const siteUrl = config.ServiceSettings?.SiteURL || '';
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
                            type: 'text',
                            key: 'SamlSettings.ServiceProviderIdentifier',
                            label: defineMessage({id: 'admin.saml.serviceProviderIdentifierTitle', defaultMessage: 'Service Provider Identifier:'}),
                            help_text: defineMessage({id: 'admin.saml.serviceProviderIdentifierDesc', defaultMessage: 'The unique identifier for the Service Provider, usually the same as Service Provider Login URL. In ADFS, this MUST match the Relying Party Identifier.'}),
                            placeholder: defineMessage({id: 'admin.saml.serviceProviderIdentifierEx', defaultMessage: 'E.g.: "<urlChunk>your-mattermost-url</urlChunk>"'}),
                            placeholder_values: {
                                urlChunk: (chunk: string) => `https://'<${chunk}>'/login/sso/saml`,
                            },
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'SamlSettings.Encrypt',
                            label: defineMessage({id: 'admin.saml.encryptTitle', defaultMessage: 'Enable Encryption:'}),
                            help_text: defineMessage({id: 'admin.saml.encryptDescription', defaultMessage: 'When false, Mattermost will not decrypt SAML Assertions encrypted with your Service Provider Public Certificate. Disabling encryption is not recommended for production environments.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'fileupload',
                            key: 'SamlSettings.PrivateKeyFile',
                            label: defineMessage({id: 'admin.saml.privateKeyFileTitle', defaultMessage: 'Service Provider Private Key:'}),
                            help_text: defineMessage({id: 'admin.saml.privateKeyFileFileDesc', defaultMessage: 'The private key used to decrypt SAML Assertions from the Identity Provider.'}),
                            remove_help_text: defineMessage({id: 'admin.saml.privateKeyFileFileRemoveDesc', defaultMessage: 'Remove the private key used to decrypt SAML Assertions from the Identity Provider.'}),
                            remove_button_text: defineMessage({id: 'admin.saml.remove.privKey', defaultMessage: 'Remove Service Provider Private Key'}),
                            removing_text: defineMessage({id: 'admin.saml.removing.privKey', defaultMessage: 'Removing Private Key...'}),
                            uploading_text: defineMessage({id: 'admin.saml.uploading.privateKey', defaultMessage: 'Uploading Private Key...'}),
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
                            type: 'fileupload',
                            key: 'SamlSettings.PublicCertificateFile',
                            label: defineMessage({id: 'admin.saml.publicCertificateFileTitle', defaultMessage: 'Service Provider Public Certificate:'}),
                            help_text: defineMessage({id: 'admin.saml.publicCertificateFileDesc', defaultMessage: 'The certificate used to generate the signature on a SAML request to the Identity Provider for a service provider initiated SAML login, when Mattermost is the Service Provider.'}),
                            remove_help_text: defineMessage({id: 'admin.saml.publicCertificateFileRemoveDesc', defaultMessage: 'Remove the certificate used to generate the signature on a SAML request to the Identity Provider for a service provider initiated SAML login, when Mattermost is the Service Provider.'}),
                            remove_button_text: defineMessage({id: 'admin.saml.remove.sp_certificate', defaultMessage: 'Remove Service Provider Certificate'}),
                            removing_text: defineMessage({id: 'admin.saml.removing.certificate', defaultMessage: 'Removing Certificate...'}),
                            uploading_text: defineMessage({id: 'admin.saml.uploading.certificate', defaultMessage: 'Uploading Certificate...'}),
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
                            type: 'bool',
                            key: 'SamlSettings.SignRequest',
                            label: defineMessage({id: 'admin.saml.signRequestTitle', defaultMessage: 'Sign Request:'}),
                            help_text: defineMessage({id: 'admin.saml.signRequestDescription', defaultMessage: 'When true, Mattermost will sign the SAML request using your private key. When false, Mattermost will not sign the SAML request.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Encrypt'),
                                it.stateIsFalse('SamlSettings.PrivateKeyFile'),
                                it.stateIsFalse('SamlSettings.PublicCertificateFile'),
                            ),
                        },
                        {
                            type: 'dropdown',
                            key: 'SamlSettings.SignatureAlgorithm',
                            label: defineMessage({id: 'admin.saml.signatureAlgorithmTitle', defaultMessage: 'Signature Algorithm'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Encrypt'),
                                it.stateIsFalse('SamlSettings.SignRequest'),
                            ),
                            options: [
                                {
                                    value: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA1,
                                    display_name: defineMessage({id: 'admin.saml.signatureAlgorithmDisplay.sha1', defaultMessage: 'RSAwithSHA1'}),
                                    help_text: defineMessage({id: 'admin.saml.signatureAlgorithmDescription.sha1', defaultMessage: 'Specify the Signature algorithm used to sign the request (RSAwithSHA1). Please see more information provided at http://www.w3.org/2000/09/xmldsig#rsa-sha1'}),
                                },
                                {
                                    value: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA256,
                                    display_name: defineMessage({id: 'admin.saml.signatureAlgorithmDisplay.sha256', defaultMessage: 'RSAwithSHA256'}),
                                    help_text: defineMessage({id: 'admin.saml.signatureAlgorithmDescription.sha256', defaultMessage: 'Specify the Signature algorithm used to sign the request (RSAwithSHA256). Please see more information provided at http://www.w3.org/2001/04/xmldsig-more#rsa-sha256 [section 6.4.2 RSA (PKCS#1 v1.5)]'}),
                                },
                                {
                                    value: SAML_SETTINGS_SIGNATURE_ALGORITHM_SHA512,
                                    display_name: defineMessage({id: 'admin.saml.signatureAlgorithmDisplay.sha512', defaultMessage: 'RSAwithSHA512'}),
                                    help_text: defineMessage({id: 'admin.saml.signatureAlgorithmDescription.sha512', defaultMessage: 'Specify the Signature algorithm used to sign the request (RSAwithSHA512). Please see more information provided at http://www.w3.org/2001/04/xmldsig-more#rsa-sha512'}),
                                },
                            ],
                        },
                        {
                            type: 'dropdown',
                            key: 'SamlSettings.CanonicalAlgorithm',
                            label: defineMessage({id: 'admin.saml.canonicalAlgorithmTitle', defaultMessage: 'Canonicalization Algorithm'}),
                            options: [
                                {
                                    value: SAML_SETTINGS_CANONICAL_ALGORITHM_C14N,
                                    display_name: defineMessage({id: 'admin.saml.canonicalAlgorithmDisplay.n10', defaultMessage: 'Exclusive XML Canonicalization 1.0 (omit comments)'}),
                                    help_text: defineMessage({id: 'admin.saml.canonicalAlgorithmDescription.exc', defaultMessage: 'Specify the Canonicalization algorithm (Exclusive XML Canonicalization 1.0). Please see more information provided at http://www.w3.org/2001/10/xml-exc-c14n#'}),
                                },
                                {
                                    value: SAML_SETTINGS_CANONICAL_ALGORITHM_C14N11,
                                    display_name: defineMessage({id: 'admin.saml.canonicalAlgorithmDisplay.n11', defaultMessage: 'Canonical XML 1.1 (omit comments)'}),
                                    help_text: defineMessage({id: 'admin.saml.canonicalAlgorithmDescription.c14', defaultMessage: 'Specify the Canonicalization algorithm (Canonical XML 1.1). Please see more information provided at http://www.w3.org/2006/12/xml-c14n11'}),
                                },
                            ],
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Encrypt'),
                                it.stateIsFalse('SamlSettings.SignRequest'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.EmailAttribute',
                            label: defineMessage({id: 'admin.saml.emailAttrTitle', defaultMessage: 'Email Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.emailAttrEx', defaultMessage: 'E.g.: "Email" or "PrimaryEmail"'}),
                            help_text: defineMessage({id: 'admin.saml.emailAttrDesc', defaultMessage: 'The attribute in the SAML Assertion that will be used to populate the email addresses of users in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.UsernameAttribute',
                            label: defineMessage({id: 'admin.saml.usernameAttrTitle', defaultMessage: 'Username Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.usernameAttrEx', defaultMessage: 'E.g.: "Username"'}),
                            help_text: defineMessage({id: 'admin.saml.usernameAttrDesc', defaultMessage: 'The attribute in the SAML Assertion that will be used to populate the username field in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.IdAttribute',
                            label: defineMessage({id: 'admin.saml.idAttrTitle', defaultMessage: 'Id Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.idAttrEx', defaultMessage: 'E.g.: "Id"'}),
                            help_text: defineMessage({id: 'admin.saml.idAttrDesc', defaultMessage: '(Optional) The attribute in the SAML Assertion that will be used to bind users from SAML to users in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.GuestAttribute',
                            label: defineMessage({id: 'admin.saml.guestAttrTitle', defaultMessage: 'Guest Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.guestAttrEx', defaultMessage: 'E.g.: "usertype=Guest" or "isGuest=true"'}),
                            help_text: defineMessage({id: 'admin.saml.guestAttrDesc', defaultMessage: '(Optional) Requires Guest Access to be enabled before being applied. The attribute in the SAML Assertion that will be used to apply a guest role to users in Mattermost. Guests are prevented from accessing teams or channels upon logging in until they are assigned a team and at least one channel. Note: If this attribute is removed/changed from your guest user in SAML and the user is still active, they will not be promoted to a member and will retain their Guest role. Guests can be promoted in **System Console > User Management**. Existing members that are identified by this attribute as a guest will be demoted from a member to a guest when they are asked to login next. The next login is based upon Session lengths set in **System Console > Session Lengths**. It is highly recommend to manually demote users to guests in **System Console > User Management ** to ensure access is restricted immediately.'}),
                            help_text_markdown: true,
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.configIsFalse('GuestAccountsSettings', 'Enable'),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'SamlSettings.EnableAdminAttribute',
                            label: defineMessage({id: 'admin.saml.enableAdminAttrTitle', defaultMessage: 'Enable Admin Attribute:'}),
                            isDisabled: it.any(
                                it.not(it.isSystemAdmin),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.AdminAttribute',
                            label: defineMessage({id: 'admin.saml.adminAttrTitle', defaultMessage: 'Admin Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.adminAttrEx', defaultMessage: 'E.g.: "usertype=Admin" or "isAdmin=true"'}),
                            help_text: defineMessage({id: 'admin.saml.adminAttrDesc', defaultMessage: '(Optional) The attribute in the SAML Assertion for designating System Admins. The users selected by the query will have access to your Mattermost server as System Admins. By default, System Admins have complete access to the Mattermost System Console. Existing members that are identified by this attribute will be promoted from member to System Admin upon next login. The next login is based upon Session lengths set in **System Console > Session Lengths.** It is highly recommend to manually demote users to members in **System Console > User Management** to ensure access is restricted immediately. Note: If this filter is removed/changed, System Admins that were promoted via this filter will be demoted to members and will not retain access to the System Console. When this filter is not in use, System Admins can be manually promoted/demoted in **System Console > User Management**.'}),
                            help_text_markdown: true,
                            isDisabled: it.any(
                                it.not(it.isSystemAdmin),
                                it.stateIsFalse('SamlSettings.EnableAdminAttribute'),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.FirstNameAttribute',
                            label: defineMessage({id: 'admin.saml.firstnameAttrTitle', defaultMessage: 'First Name Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.firstnameAttrEx', defaultMessage: 'E.g.: "FirstName"'}),
                            help_text: defineMessage({id: 'admin.saml.firstnameAttrDesc', defaultMessage: '(Optional) The attribute in the SAML Assertion that will be used to populate the first name of users in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.LastNameAttribute',
                            label: defineMessage({id: 'admin.saml.lastnameAttrTitle', defaultMessage: 'Last Name Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.lastnameAttrEx', defaultMessage: 'E.g.: "LastName"'}),
                            help_text: defineMessage({id: 'admin.saml.lastnameAttrDesc', defaultMessage: '(Optional) The attribute in the SAML Assertion that will be used to populate the last name of users in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.NicknameAttribute',
                            label: defineMessage({id: 'admin.saml.nicknameAttrTitle', defaultMessage: 'Nickname Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.nicknameAttrEx', defaultMessage: 'E.g.: "Nickname"'}),
                            help_text: defineMessage({id: 'admin.saml.nicknameAttrDesc', defaultMessage: '(Optional) The attribute in the SAML Assertion that will be used to populate the nickname of users in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.PositionAttribute',
                            label: defineMessage({id: 'admin.saml.positionAttrTitle', defaultMessage: 'Position Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.positionAttrEx', defaultMessage: 'E.g.: "Role"'}),
                            help_text: defineMessage({id: 'admin.saml.positionAttrDesc', defaultMessage: '(Optional) The attribute in the SAML Assertion that will be used to populate the position of users in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.LocaleAttribute',
                            label: defineMessage({id: 'admin.saml.localeAttrTitle', defaultMessage: 'Preferred Language Attribute:'}),
                            placeholder: defineMessage({id: 'admin.saml.localeAttrEx', defaultMessage: 'E.g.: "Locale" or "PrimaryLanguage"'}),
                            help_text: defineMessage({id: 'admin.saml.localeAttrDesc', defaultMessage: '(Optional) The attribute in the SAML Assertion that will be used to populate the language of users in Mattermost.'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.SAML)),
                                it.stateIsFalse('SamlSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'SamlSettings.LoginButtonText',
                            label: defineMessage({id: 'admin.saml.loginButtonTextTitle', defaultMessage: 'Login Button Text:'}),
                            placeholder: defineMessage({id: 'admin.saml.loginButtonTextEx', defaultMessage: 'E.g.: "OKTA"'}),
                            help_text: defineMessage({id: 'admin.saml.loginButtonTextDesc', defaultMessage: '(Optional) The text that appears in the login button on the login page. Defaults to "SAML".'}),
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
                title: defineMessage({id: 'admin.sidebar.saml', defaultMessage: 'SAML 2.0'}),
                isHidden: it.any(
                    it.licensedForFeature('SAML'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'SamlSettings',
                    name: defineMessage({id: 'admin.authentication.saml', defaultMessage: 'SAML 2.0'}),
                    settings: [
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.gitlab', defaultMessage: 'GitLab'}),
                isHidden: it.any(
                    it.licensed,
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                ),
                schema: {
                    id: 'GitLabSettings',
                    name: defineMessage({id: 'admin.authentication.gitlab', defaultMessage: 'GitLab'}),
                    onConfigLoad: (config) => {
                        const newState: {'GitLabSettings.Url'?: string} = {};
                        newState['GitLabSettings.Url'] = config.GitLabSettings?.UserAPIEndpoint?.replace('/api/v4/user', '');
                        return newState;
                    },
                    onConfigSave: (config) => {
                        const newConfig = {...config};
                        newConfig.GitLabSettings.UserAPIEndpoint = config.GitLabSettings.Url.replace(/\/$/, '') + '/api/v4/user';
                        return newConfig;
                    },
                    settings: [
                        {
                            type: 'bool',
                            key: 'GitLabSettings.Enable',
                            label: defineMessage({id: 'admin.gitlab.enableTitle', defaultMessage: 'Enable authentication with GitLab: '}),
                            help_text: defineMessage({id: 'admin.gitlab.enableDescription', defaultMessage: 'When true, Mattermost allows team creation and account signup using GitLab OAuth.{lineBreak} {lineBreak}1. Log in to your GitLab account and go to Profile Settings -> Applications.{lineBreak}2. Enter Redirect URIs "<loginUrlChunk>your-mattermost-url</loginUrlChunk>" (example: http://localhost:8065/login/gitlab/complete) and "<signupUrlChunk>your-mattermost-url</signupUrlChunk>".\n3. Then use "Application Secret Key" and "Application ID" fields from GitLab to complete the options below.\n4. Complete the Endpoint URLs below.'}),
                            help_text_values: {
                                lineBreak: '\n',
                                loginUrlChunk: (chunk: string) => `<${chunk}>/login/gitlab/complete"`,
                                signupUrlChunk: (chunk: string) => `<${chunk}>/signup/gitlab/complete"`,
                            },
                            help_text_markdown: true,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Id',
                            label: defineMessage({id: 'admin.gitlab.clientIdTitle', defaultMessage: 'Application ID:'}),
                            help_text: defineMessage({id: 'admin.gitlab.clientIdDescription', defaultMessage: 'Obtain this value via the instructions above for logging into GitLab.'}),
                            placeholder: defineMessage({id: 'admin.gitlab.clientIdExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                                it.stateIsFalse('GitLabSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Secret',
                            label: defineMessage({id: 'admin.gitlab.clientSecretTitle', defaultMessage: 'Application Secret Key:'}),
                            help_text: defineMessage({id: 'admin.gitlab.clientSecretDescription', defaultMessage: 'Obtain this value via the instructions above for logging into GitLab.'}),
                            placeholder: defineMessage({id: 'admin.gitlab.clientSecretExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                                it.stateIsFalse('GitLabSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Url',
                            label: defineMessage({id: 'admin.gitlab.siteUrl', defaultMessage: 'GitLab Site URL:'}),
                            help_text: defineMessage({id: 'admin.gitlab.siteUrlDescription', defaultMessage: 'Enter the URL of your GitLab instance, e.g. https://example.com:3000. If your GitLab instance is not set up with SSL, start the URL with http:// instead of https://.'}),
                            placeholder: defineMessage({id: 'admin.gitlab.siteUrlExample', defaultMessage: 'E.g.: https://'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                                it.stateIsFalse('GitLabSettings.Enable'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.UserAPIEndpoint',
                            label: defineMessage({id: 'admin.gitlab.userTitle', defaultMessage: 'User API Endpoint:'}),
                            dynamic_value: (value, config, state) => {
                                if (state['GitLabSettings.Url']) {
                                    return state['GitLabSettings.Url'].replace(/\/$/, '') + '/api/v4/user';
                                }
                                return '';
                            },
                            isDisabled: true,
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.AuthEndpoint',
                            label: defineMessage({id: 'admin.gitlab.authTitle', defaultMessage: 'Auth Endpoint:'}),
                            dynamic_value: (value, config, state) => {
                                if (state['GitLabSettings.Url']) {
                                    return state['GitLabSettings.Url'].replace(/\/$/, '') + '/oauth/authorize';
                                }
                                return '';
                            },
                            isDisabled: true,
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.TokenEndpoint',
                            label: defineMessage({id: 'admin.gitlab.tokenTitle', defaultMessage: 'Token Endpoint:'}),
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
                title: defineMessage({id: 'admin.sidebar.oauth', defaultMessage: 'OAuth 2.0'}),
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
                    name: defineMessage({id: 'admin.authentication.oauth', defaultMessage: 'OAuth 2.0'}),
                    onConfigLoad: (config) => {
                        const newState: {oauthType?: string; 'GitLabSettings.Url'?: string} = {};
                        if (config.GitLabSettings?.Enable) {
                            newState.oauthType = Constants.GITLAB_SERVICE;
                        }
                        if (config.Office365Settings?.Enable) {
                            newState.oauthType = Constants.OFFICE365_SERVICE;
                        }
                        if (config.GoogleSettings?.Enable) {
                            newState.oauthType = Constants.GOOGLE_SERVICE;
                        }

                        newState['GitLabSettings.Url'] = config.GitLabSettings?.UserAPIEndpoint?.replace('/api/v4/user', '');

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
                            type: 'custom',
                            component: OpenIdConvert,
                            key: 'OpenIdConvert',
                            isHidden: it.any(
                                it.all(it.not(it.licensedForFeature('OpenId')), it.not(it.cloudLicensed)),
                                it.not(usesLegacyOauth),
                            ),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'dropdown',
                            key: 'oauthType',
                            label: defineMessage({id: 'admin.openid.select', defaultMessage: 'Select service provider:'}),
                            options: [
                                {
                                    value: 'off',
                                    display_name: defineMessage({id: 'admin.oauth.off', defaultMessage: 'Do not allow sign-in via an OAuth 2.0 provider.'}),
                                },
                                {
                                    value: Constants.GITLAB_SERVICE,
                                    display_name: defineMessage({id: 'admin.oauth.gitlab', defaultMessage: 'GitLab'}),
                                    help_text: defineMessage({id: 'admin.gitlab.EnableMarkdownDesc', defaultMessage: '1. Log in to your GitLab account and go to Profile Settings -> Applications.\n2. Enter Redirect URIs "<loginUrlChunk>your-mattermost-url</loginUrlChunk>" (example: http://localhost:8065/login/gitlab/complete) and "<signupUrlChunk>your-mattermost-url</signupUrlChunk>".\n3. Then use "Application Secret Key" and "Application ID" fields from GitLab to complete the options below.\n4. Complete the Endpoint URLs below.'}),
                                    help_text_values: {
                                        loginUrlChunk: (chunk: string) => `<${chunk}>/login/gitlab/complete`,
                                        signupUrlChunk: (chunk: string) => `<${chunk}>/signup/gitlab/complete`,
                                    },
                                    help_text_markdown: true,
                                },
                                {
                                    value: Constants.GOOGLE_SERVICE,
                                    display_name: defineMessage({id: 'admin.oauth.google', defaultMessage: 'Google Apps'}),
                                    isHidden: it.all(it.not(it.licensedForFeature('GoogleOAuth')), it.not(it.cloudLicensed)),
                                    help_text: defineMessage({id: 'admin.google.EnableMarkdownDesc', defaultMessage: '1. <linkLogin>Log in</linkLogin> to your Google account.\n2. Go to <linkConsole>https://console.developers.google.com</linkConsole>, click <strong>Credentials</strong> in the left hand sidebar and enter "Mattermost - your-company-name" as the <strong>Project Name</strong>, then click <strong>Create</strong>.\n3. Click the <strong>OAuth consent screen</strong> header and enter "Mattermost" as the <strong>Product name shown to users</strong>, then click <strong>Save</strong>.\n4. Under the <strong>Credentials</strong> header, click <strong>Create credentials</strong>, choose <strong>OAuth client ID</strong> and select <strong>Web Application</strong>.\n5. Under <strong>Restrictions</strong> and <strong>Authorized redirect URIs</strong> enter <strong>your-mattermost-url/signup/google/complete</strong> (example: http://localhost:8065/signup/google/complete). Click <strong>Create</strong>.\n6. Paste the <strong>Client ID</strong> and <strong>Client Secret</strong> to the fields below, then click <strong>Save</strong>.\n7. Go to the <linkAPI>Google People API</linkAPI> and click <strong>Enable</strong>.'}),
                                    help_text_markdown: false,
                                    help_text_values: {
                                        linkLogin: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://accounts.google.com/login'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkConsole: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://console.developers.google.com'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkAPI: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://console.developers.google.com/apis/library/people.googleapis.com'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        strong: (msg: string) => <strong>{msg}</strong>,
                                    },
                                },
                                {
                                    value: Constants.OFFICE365_SERVICE,
                                    display_name: defineMessage({id: 'admin.oauth.office365', defaultMessage: 'Office 365'}),
                                    isHidden: it.all(it.not(it.licensedForFeature('Office365OAuth')), it.not(it.cloudLicensed)),
                                    help_text: defineMessage({id: 'admin.office365.EnableMarkdownDesc', defaultMessage: '1. <linkLogin>Log in</linkLogin> to your Microsoft or Office 365 account. Make sure it`s the account on the same <linkTenant>tenant</linkTenant> that you would like users to log in with.\n2. Go to <linkApps>https://apps.dev.microsoft.com</linkApps>, click <strong>Go to app list</strong> > <strong>Add an app</strong> and use "Mattermost - your-company-name" as the <strong>Application Name</strong>.\n3. Under <strong>Application Secrets</strong>, click <strong>Generate New Password</strong> and paste it to the <strong>Application Secret Password</strong> field below.\n4. Under <strong>Platforms</strong>, click <strong>Add Platform</strong>, choose <strong>Web</strong> and enter <strong>your-mattermost-url/signup/office365/complete</strong> (example: http://localhost:8065/signup/office365/complete) under <strong>Redirect URIs</strong>. Also uncheck <strong>Allow Implicit Flow</strong>.\n5. Finally, click <strong>Save</strong> and then paste the <strong>Application ID</strong> below.'}),
                                    help_text_markdown: false,
                                    help_text_values: {
                                        linkLogin: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://login.microsoftonline.com/'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkTenant: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://msdn.microsoft.com/en-us/library/azure/jj573650.aspx#Anchor_0'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkApps: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://apps.dev.microsoft.com'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        strong: (msg: string) => <strong>{msg}</strong>,
                                    },
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Id',
                            label: defineMessage({id: 'admin.gitlab.clientIdTitle', defaultMessage: 'Application ID:'}),
                            help_text: defineMessage({id: 'admin.gitlab.clientIdDescription', defaultMessage: 'Obtain this value via the instructions above for logging into GitLab.'}),
                            placeholder: defineMessage({id: 'admin.gitlab.clientIdExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Secret',
                            label: defineMessage({id: 'admin.gitlab.clientSecretTitle', defaultMessage: 'Application Secret Key:'}),
                            help_text: defineMessage({id: 'admin.gitlab.clientSecretDescription', defaultMessage: 'Obtain this value via the instructions above for logging into GitLab.'}),
                            placeholder: defineMessage({id: 'admin.gitlab.clientSecretExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Url',
                            label: defineMessage({id: 'admin.gitlab.siteUrl', defaultMessage: 'GitLab Site URL:'}),
                            help_text: defineMessage({id: 'admin.gitlab.siteUrlDescription', defaultMessage: 'Enter the URL of your GitLab instance, e.g. https://example.com:3000. If your GitLab instance is not set up with SSL, start the URL with http:// instead of https://.'}),
                            placeholder: defineMessage({id: 'admin.gitlab.siteUrlExample', defaultMessage: 'E.g.: https://'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'gitlab')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.UserAPIEndpoint',
                            label: defineMessage({id: 'admin.gitlab.userTitle', defaultMessage: 'User API Endpoint:'}),
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
                            type: 'text',
                            key: 'GitLabSettings.AuthEndpoint',
                            label: defineMessage({id: 'admin.gitlab.authTitle', defaultMessage: 'Auth Endpoint:'}),
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
                            type: 'text',
                            key: 'GitLabSettings.TokenEndpoint',
                            label: defineMessage({id: 'admin.gitlab.tokenTitle', defaultMessage: 'Token Endpoint:'}),
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
                            type: 'text',
                            key: 'GoogleSettings.Id',
                            label: defineMessage({id: 'admin.google.clientIdTitle', defaultMessage: 'Client ID:'}),
                            help_text: defineMessage({id: 'admin.google.clientIdDescription', defaultMessage: 'The Client ID you received when registering your application with Google.'}),
                            placeholder: defineMessage({id: 'admin.google.clientIdExample', defaultMessage: 'E.g.: "7602141235235-url0fhs1mayfasbmop5qlfns8dh4.apps.googleusercontent.com"'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'google')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GoogleSettings.Secret',
                            label: defineMessage({id: 'admin.google.clientSecretTitle', defaultMessage: 'Client Secret:'}),
                            help_text: defineMessage({id: 'admin.google.clientSecretDescription', defaultMessage: 'The Client Secret you received when registering your application with Google.'}),
                            placeholder: defineMessage({id: 'admin.google.clientSecretExample', defaultMessage: 'E.g.: "H8sz0Az-dDs2p15-7QzD231"'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'google')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GoogleSettings.UserAPIEndpoint',
                            label: defineMessage({id: 'admin.google.userTitle', defaultMessage: 'User API Endpoint:'}),
                            dynamic_value: () => 'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,nicknames,metadata',
                            isDisabled: true,
                            isHidden: it.not(it.stateEquals('oauthType', 'google')),
                        },
                        {
                            type: 'text',
                            key: 'GoogleSettings.AuthEndpoint',
                            label: defineMessage({id: 'admin.google.authTitle', defaultMessage: 'Auth Endpoint:'}),
                            dynamic_value: () => 'https://accounts.google.com/o/oauth2/v2/auth',
                            isDisabled: true,
                            isHidden: it.not(it.stateEquals('oauthType', 'google')),
                        },
                        {
                            type: 'text',
                            key: 'GoogleSettings.TokenEndpoint',
                            label: defineMessage({id: 'admin.google.tokenTitle', defaultMessage: 'Token Endpoint:'}),
                            dynamic_value: () => 'https://www.googleapis.com/oauth2/v4/token',
                            isDisabled: true,
                            isHidden: it.not(it.stateEquals('oauthType', 'google')),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.Id',
                            label: defineMessage({id: 'admin.office365.clientIdTitle', defaultMessage: 'Application ID:'}),
                            help_text: defineMessage({id: 'admin.office365.clientIdDescription', defaultMessage: 'The Application/Client ID you received when registering your application with Microsoft.'}),
                            placeholder: defineMessage({id: 'admin.office365.clientIdExample', defaultMessage: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.Secret',
                            label: defineMessage({id: 'admin.office365.clientSecretTitle', defaultMessage: 'Application Secret Password:'}),
                            help_text: defineMessage({id: 'admin.office365.clientSecretDescription', defaultMessage: 'The Application Secret Password you generated when registering your application with Microsoft.'}),
                            placeholder: defineMessage({id: 'admin.office365.clientSecretExample', defaultMessage: 'E.g.: "shAieM47sNBfgl20f8ci294"'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.DirectoryId',
                            label: defineMessage({id: 'admin.office365.directoryIdTitle', defaultMessage: 'Directory (tenant) ID:'}),
                            help_text: defineMessage({id: 'admin.office365.directoryIdDescription', defaultMessage: 'The Directory (tenant) ID you received when registering your application with Microsoft.'}),
                            placeholder: defineMessage({id: 'admin.office365.directoryIdExample', defaultMessage: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"'}),
                            isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.UserAPIEndpoint',
                            label: defineMessage({id: 'admin.office365.userTitle', defaultMessage: 'User API Endpoint:'}),
                            dynamic_value: () => 'https://graph.microsoft.com/v1.0/me',
                            isDisabled: true,
                            isHidden: it.not(it.stateEquals('oauthType', 'office365')),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.AuthEndpoint',
                            label: defineMessage({id: 'admin.office365.authTitle', defaultMessage: 'Auth Endpoint:'}),
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
                            type: 'text',
                            key: 'Office365Settings.TokenEndpoint',
                            label: defineMessage({id: 'admin.office365.tokenTitle', defaultMessage: 'Token Endpoint:'}),
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
                title: defineMessage({id: 'admin.sidebar.openid', defaultMessage: 'OpenID Connect'}),
                isHidden: it.any(
                    it.all(it.not(it.licensedForFeature('OpenId')), it.not(it.cloudLicensed)),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                ),
                schema: {
                    id: 'OpenIdSettings',
                    name: defineMessage({id: 'admin.authentication.openid', defaultMessage: 'OpenID Connect'}),
                    onConfigLoad: (config) => {
                        const newState: {openidType?: string; 'GitLabSettings.Url'?: string} = {};
                        if (config.Office365Settings?.Enable) {
                            newState.openidType = Constants.OFFICE365_SERVICE;
                        }
                        if (config.GoogleSettings?.Enable) {
                            newState.openidType = Constants.GOOGLE_SERVICE;
                        }
                        if (config.GitLabSettings?.Enable) {
                            newState.openidType = Constants.GITLAB_SERVICE;
                        }
                        if (config.OpenIdSettings?.Enable) {
                            newState.openidType = Constants.OPENID_SERVICE;
                        }
                        if (config.GitLabSettings?.UserAPIEndpoint) {
                            newState['GitLabSettings.Url'] = config.GitLabSettings.UserAPIEndpoint.replace('/api/v4/user', '');
                        } else if (config.GitLabSettings?.DiscoveryEndpoint) {
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
                            type: 'custom',
                            component: OpenIdConvert,
                            key: 'OpenIdConvert',
                            isHidden: it.any(
                                it.not(usesLegacyOauth),
                            ),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'dropdown',
                            key: 'openidType',
                            label: defineMessage({id: 'admin.openid.select', defaultMessage: 'Select service provider:'}),
                            isHelpHidden: it.all(it.stateEquals('openidType', Constants.OPENID_SERVICE), it.licensedForCloudStarter),
                            options: [
                                {
                                    value: 'off',
                                    display_name: defineMessage({id: 'admin.openid.off', defaultMessage: 'Do not allow sign-in via an OpenID provider.'}),
                                },
                                {
                                    value: Constants.GITLAB_SERVICE,
                                    display_name: defineMessage({id: 'admin.openid.gitlab', defaultMessage: 'GitLab'}),
                                    help_text: defineMessage({id: 'admin.gitlab.EnableMarkdownDesc', defaultMessage: '1. Log in to your GitLab account and go to Profile Settings -> Applications.\n2. Enter Redirect URIs "<loginUrlChunk>your-mattermost-url</loginUrlChunk>" (example: http://localhost:8065/login/gitlab/complete) and "<signupUrlChunk>your-mattermost-url</signupUrlChunk>".\n3. Then use "Application Secret Key" and "Application ID" fields from GitLab to complete the options below.\n4. Complete the Endpoint URLs below.'}),
                                    help_text_values: {
                                        loginUrlChunk: (chunk: string) => `<${chunk}>/login/gitlab/complete`,
                                        signupUrlChunk: (chunk: string) => `<${chunk}>/signup/gitlab/complete`,
                                    },
                                    help_text_markdown: false,
                                },
                                {
                                    value: Constants.GOOGLE_SERVICE,
                                    display_name: defineMessage({id: 'admin.openid.google', defaultMessage: 'Google Apps'}),
                                    help_text: defineMessage({id: 'admin.google.EnableMarkdownDesc', defaultMessage: '1. <linkLogin>Log in</linkLogin> to your Google account.\n2. Go to <linkConsole>https://console.developers.google.com]</linkConsole>, click <strong>Credentials</strong> in the left hand side.\n 3. Under the <strong>Credentials</strong> header, click <strong>Create credentials</strong>, choose <strong>OAuth client ID</strong> and select <strong>Web Application</strong>.\n 4. Enter "Mattermost - your-company-name" as the <strong>Name</strong>.\n 5. Under <strong>Authorized redirect URIs</strong> enter <strong>your-mattermost-url/signup/google/complete</strong> (example: http://localhost:8065/signup/google/complete). Click <strong>Create</strong>.\n 6. Paste the <strong>Client ID</strong> and <strong>Client Secret</strong> to the fields below, then click <strong>Save</strong>.\n 7. Go to the <linkAPI>Google People API</linkAPI> and click <strong>Enable</strong>.'}),
                                    help_text_markdown: false,
                                    help_text_values: {
                                        linkLogin: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://accounts.google.com/login'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkConsole: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://console.developers.google.com'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkAPI: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://console.developers.google.com/apis/library/people.googleapis.com'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        strong: (msg: string) => <strong>{msg}</strong>,
                                    },
                                },
                                {
                                    value: Constants.OFFICE365_SERVICE,
                                    display_name: defineMessage({id: 'admin.openid.office365', defaultMessage: 'Office 365'}),
                                    help_text: defineMessage({id: 'admin.office365.EnableMarkdownDesc', defaultMessage: '1. <linkLogin>Log in</linkLogin> to your Microsoft or Office 365 account. Make sure it`s the account on the same <linkTenant>tenant</linkTenant> that you would like users to log in with.\n2. Go to <linkApps>https://apps.dev.microsoft.com</linkApps>, click <strong>Go to Azure Portal</strong> > click <strong>New Registration</strong>.\n3. Use "Mattermost - your-company-name" as the <strong>Application Name</strong>, click <strong>Registration</strong>, paste <strong>Client ID</strong> and <strong>Tenant ID</strong> below.\n4. Click <strong>Authentication</strong>, under <strong>Platforms</strong>, click <strong>Add Platform</strong>, choose <strong>Web</strong> and enter <strong>your-mattermost-url/signup/office365/complete</strong> (example: http://localhost:8065/signup/office365/complete) under <strong>Redirect URIs</strong>. Also uncheck <strong>Allow Implicit Flow</strong>.\n5. Click <strong>Certificates & secrets</strong>, Generate <strong>New client secret</strong> and paste secret value in <strong>Client Secret</strong> field below.'}),
                                    help_text_markdown: false,
                                    help_text_values: {
                                        linkLogin: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://login.microsoftonline.com/'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkTenant: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://msdn.microsoft.com/en-us/library/azure/jj573650.aspx#Anchor_0'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        linkApps: (msg: string) => (
                                            <ExternalLink
                                                location='admin_console'
                                                href='https://apps.dev.microsoft.com'
                                            >
                                                {msg}
                                            </ExternalLink>
                                        ),
                                        strong: (msg: string) => <strong>{msg}</strong>,
                                    },
                                },
                                {
                                    value: Constants.OPENID_SERVICE,
                                    display_name: defineMessage({id: 'admin.oauth.openid', defaultMessage: 'OpenID Connect (Other)'}),
                                    help_text: defineMessage({id: 'admin.openid.EnableMarkdownDesc', defaultMessage: 'Follow provider directions for creating an OpenID Application. Most OpenID Connect providers require authorization of all redirect URIs. In the appropriate field, enter your-mattermost-url/signup/openid/complete (example: http://domain.com/signup/openid/complete)'}),
                                    help_text_markdown: false,
                                },
                            ],
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Url',
                            label: defineMessage({id: 'admin.gitlab.siteUrl', defaultMessage: 'GitLab Site URL:'}),
                            help_text: defineMessage({id: 'admin.gitlab.siteUrlDescription', defaultMessage: 'Enter the URL of your GitLab instance, e.g. https://example.com:3000. If your GitLab instance is not set up with SSL, start the URL with http:// instead of https://.'}),
                            placeholder: defineMessage({id: 'admin.gitlab.siteUrlExample', defaultMessage: 'E.g.: https://'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.GITLAB_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.DiscoveryEndpoint',
                            label: defineMessage({id: 'admin.openid.discoveryEndpointTitle', defaultMessage: 'Discovery Endpoint:'}),
                            help_text: defineMessage({id: 'admin.gitlab.discoveryEndpointDesc', defaultMessage: 'The URL of the discovery document for OpenID Connect with GitLab.'}),
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
                            type: 'text',
                            key: 'GitLabSettings.Id',
                            label: defineMessage({id: 'admin.openid.clientIdTitle', defaultMessage: 'Client ID:'}),
                            help_text: defineMessage({id: 'admin.openid.clientIdDescription', defaultMessage: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.gitlab.clientIdExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx42pnqMxQY"'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.GITLAB_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GitLabSettings.Secret',
                            label: defineMessage({id: 'admin.openid.clientSecretTitle', defaultMessage: 'Client Secret:'}),
                            help_text: defineMessage({id: 'admin.openid.clientSecretDescription', defaultMessage: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.gitlab.clientSecretExample', defaultMessage: 'E.g.: "jcuS8PuvcpGhpgHhlcpT1Mx442pnqMxQY"'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.GITLAB_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GoogleSettings.DiscoveryEndpoint',
                            label: defineMessage({id: 'admin.openid.discoveryEndpointTitle', defaultMessage: 'Discovery Endpoint:'}),
                            help_text: defineMessage({id: 'admin.google.discoveryEndpointDesc', defaultMessage: 'The URL of the discovery document for OpenID Connect with Google.'}),
                            help_text_markdown: false,
                            dynamic_value: () => 'https://accounts.google.com/.well-known/openid-configuration',
                            isDisabled: true,
                            isHidden: it.not(it.stateEquals('openidType', Constants.GOOGLE_SERVICE)),
                        },
                        {
                            type: 'text',
                            key: 'GoogleSettings.Id',
                            label: defineMessage({id: 'admin.openid.clientIdTitle', defaultMessage: 'Client ID:'}),
                            help_text: defineMessage({id: 'admin.openid.clientIdDescription', defaultMessage: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.google.clientIdExample', defaultMessage: 'E.g.: "7602141235235-url0fhs1mayfasbmop5qlfns8dh4.apps.googleusercontent.com"'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.GOOGLE_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'GoogleSettings.Secret',
                            label: defineMessage({id: 'admin.openid.clientSecretTitle', defaultMessage: 'Client Secret:'}),
                            help_text: defineMessage({id: 'admin.openid.clientSecretDescription', defaultMessage: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.google.clientSecretExample', defaultMessage: 'E.g.: "H8sz0Az-dDs2p15-7QzD231"'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.GOOGLE_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.DirectoryId',
                            label: defineMessage({id: 'admin.office365.directoryIdTitle', defaultMessage: 'Directory (tenant) ID:'}),
                            help_text: defineMessage({id: 'admin.office365.directoryIdDescription', defaultMessage: 'The Directory (tenant) ID you received when registering your application with Microsoft.'}),
                            placeholder: defineMessage({id: 'admin.office365.directoryIdExample', defaultMessage: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.OFFICE365_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.DiscoveryEndpoint',
                            label: defineMessage({id: 'admin.openid.discoveryEndpointTitle', defaultMessage: 'Discovery Endpoint:'}),
                            help_text: defineMessage({id: 'admin.office365.discoveryEndpointDesc', defaultMessage: 'The URL of the discovery document for OpenID Connect with Office 365.'}),
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
                            type: 'text',
                            key: 'Office365Settings.Id',
                            label: defineMessage({id: 'admin.openid.clientIdTitle', defaultMessage: 'Client ID:'}),
                            help_text: defineMessage({id: 'admin.openid.clientIdDescription', defaultMessage: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.office365.clientIdExample', defaultMessage: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.OFFICE365_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'Office365Settings.Secret',
                            label: defineMessage({id: 'admin.openid.clientSecretTitle', defaultMessage: 'Client Secret:'}),
                            help_text: defineMessage({id: 'admin.openid.clientSecretDescription', defaultMessage: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.office365.clientSecretExample', defaultMessage: 'E.g.: "shAieM47sNBfgl20f8ci294"'}),
                            isHidden: it.not(it.stateEquals('openidType', Constants.OFFICE365_SERVICE)),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },

                        {
                            type: 'text',
                            key: 'OpenIdSettings.ButtonText',
                            label: defineMessage({id: 'admin.openid.buttonTextTitle', defaultMessage: 'Button Name:'}),
                            placeholder: defineMessage({id: 'admin.openid.buttonTextEx', defaultMessage: 'Custom Button Name'}),
                            help_text: defineMessage({id: 'admin.openid.buttonTextDesc', defaultMessage: 'The text that will show on the login button.'}),
                            isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'color',
                            key: 'OpenIdSettings.ButtonColor',
                            label: defineMessage({id: 'admin.openid.buttonColorTitle', defaultMessage: 'Button Color:'}),
                            help_text: defineMessage({id: 'admin.openid.buttonColorDesc', defaultMessage: 'Specify the color of the OpenID login button for white labeling purposes. Use a hex code with a #-sign before the code.'}),
                            help_text_markdown: false,
                            isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'OpenIdSettings.DiscoveryEndpoint',
                            label: defineMessage({id: 'admin.openid.discoveryEndpointTitle', defaultMessage: 'Discovery Endpoint:'}),
                            placeholder: defineMessage({id: 'admin.openid.discovery.placeholder', defaultMessage: 'https://id.mydomain.com/.well-known/openid-configuration'}),
                            help_text: defineMessage({id: 'admin.openid.discoveryEndpointDesc', defaultMessage: 'Enter the URL of the discovery document of the OpenID Connect provider you want to connect with.'}),
                            help_text_markdown: false,
                            isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'OpenIdSettings.Id',
                            label: defineMessage({id: 'admin.openid.clientIdTitle', defaultMessage: 'Client ID:'}),
                            help_text: defineMessage({id: 'admin.openid.clientIdDescription', defaultMessage: 'Obtaining the Client ID differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.openid.clientIdExample', defaultMessage: 'E.g.: "adf3sfa2-ag3f-sn4n-ids0-sh1hdax192qq"'}),
                            isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'text',
                            key: 'OpenIdSettings.Secret',
                            label: defineMessage({id: 'admin.openid.clientSecretTitle', defaultMessage: 'Client Secret:'}),
                            help_text: defineMessage({id: 'admin.openid.clientSecretDescription', defaultMessage: 'Obtaining the Client Secret differs across providers. Please check you provider\'s documentation'}),
                            placeholder: defineMessage({id: 'admin.openid.clientSecretExample', defaultMessage: 'E.g.: "H8sz0Az-dDs2p15-7QzD231"'}),
                            isHidden: it.any(it.not(it.stateEquals('openidType', Constants.OPENID_SERVICE)), it.licensedForCloudStarter),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.OPENID)),
                        },
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.openid', defaultMessage: 'OpenID Connect'}),
                isHidden: it.any(
                    it.any(it.licensedForFeature('OpenId'), it.cloudLicensed),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'OpenIdSettings',
                    name: defineMessage({id: 'admin.authentication.openid', defaultMessage: 'OpenID Connect'}),
                    settings: [
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.guest_access', defaultMessage: 'Guest Access'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('GuestAccounts')),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
                ),
                schema: {
                    id: 'GuestAccountsSettings',
                    name: defineMessage({id: 'admin.authentication.guest_access', defaultMessage: 'Guest Access'}),
                    settings: [
                        {
                            type: 'custom',
                            component: CustomEnableDisableGuestAccountsSetting,
                            key: 'GuestAccountsSettings.Enable',
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
                        },
                        {
                            type: 'bool',
                            key: 'GuestAccountsSettings.HideTags',
                            label: defineMessage({id: 'admin.guest_access.hideTags', defaultMessage: 'Hide guest tag'}),
                            help_text: defineMessage({id: 'admin.guest_access.hideTagsDescription', defaultMessage: 'When true, the "guest" tag will not be shown next to the name of all guest users in the Mattermost chat interface.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
                        },
                        {
                            type: 'text',
                            key: 'GuestAccountsSettings.RestrictCreationToDomains',
                            label: defineMessage({id: 'admin.guest_access.whitelistedDomainsTitle', defaultMessage: 'Whitelisted Guest Domains:'}),
                            help_text: defineMessage({id: 'admin.guest_access.whitelistedDomainsDescription', defaultMessage: '(Optional) Guest accounts can be created at the system level from this list of allowed guest domains.'}),
                            help_text_markdown: true,
                            placeholder: defineMessage({id: 'admin.guest_access.whitelistedDomainsExample', defaultMessage: 'E.g.: "company.com, othercorp.org"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.AUTHENTICATION.GUEST_ACCESS)),
                        },
                        {
                            type: 'bool',
                            key: 'GuestAccountsSettings.EnforceMultifactorAuthentication',
                            label: defineMessage({id: 'admin.guest_access.mfaTitle', defaultMessage: 'Enforce Multi-factor Authentication: '}),
                            help_text: defineMessage({id: 'admin.guest_access.mfaDescriptionMFANotEnabled', defaultMessage: '[Multi-factor authentication](./mfa) is currently not enabled.'}),
                            help_text_markdown: true,
                            isHidden: it.configIsTrue('ServiceSettings', 'EnableMultifactorAuthentication'),
                            isDisabled: () => true,
                        },
                        {
                            type: 'bool',
                            key: 'GuestAccountsSettings.EnforceMultifactorAuthentication',
                            label: defineMessage({id: 'admin.guest_access.mfaTitle', defaultMessage: 'Enforce Multi-factor Authentication: '}),
                            help_text: defineMessage({id: 'admin.guest_access.mfaDescriptionMFANotEnforced', defaultMessage: '[Multi-factor authentication](./mfa) is currently not enforced.'}),
                            help_text_markdown: true,
                            isHidden: it.any(
                                it.configIsFalse('ServiceSettings', 'EnableMultifactorAuthentication'),
                                it.configIsTrue('ServiceSettings', 'EnforceMultifactorAuthentication'),
                            ),
                            isDisabled: () => true,
                        },
                        {
                            type: 'bool',
                            key: 'GuestAccountsSettings.EnforceMultifactorAuthentication',
                            label: defineMessage({id: 'admin.guest_access.mfaTitle', defaultMessage: 'Enforce Multi-factor Authentication: '}),
                            help_text: defineMessage({id: 'admin.guest_access.mfaDescription', defaultMessage: 'When true, <link>multi-factor authentication</link> for guests is required for login. New guest users will be required to configure MFA on signup. Logged in guest users without MFA configured are redirected to the MFA setup page until configuration is complete.\n \nIf your system has guest users with login methods other than AD/LDAP and email, MFA must be enforced with the authentication provider outside of Mattermost.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.MULTI_FACTOR_AUTH}
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
                title: defineMessage({id: 'admin.sidebar.guest_access', defaultMessage: 'Guest Access'}),
                isHidden: it.any(
                    it.licensedForFeature('GuestAccounts'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'GuestAccountsSettings',
                    name: defineMessage({id: 'admin.authentication.guest_access', defaultMessage: 'Guest Access'}),
                    settings: [
                        {
                            type: 'custom',
                            component: GuestAccessFeatureDiscovery,
                            key: 'GuestAccessFeatureDiscovery',
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                        },
                    ],
                },
                restrictedIndicator: getRestrictedIndicator(true),
            },
        },
    },
    plugins: {
        icon: (
            <PowerPlugOutlineIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.plugins', defaultMessage: 'Plugins'}),
        id: 'plugins',
        isHidden: it.not(it.userHasReadPermissionOnResource('plugins')),
        subsections: {
            plugin_management: {
                url: 'plugins/plugin_management',
                title: defineMessage({id: 'admin.plugins.pluginManagement', defaultMessage: 'Plugin Management'}),
                searchableStrings: pluginManagementSearchableStrings,
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
    },
    integrations: {
        icon: (
            <SitemapIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.integrations', defaultMessage: 'Integrations'}),
        id: 'integrations',
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.INTEGRATIONS)),
        subsections: {
            integration_management: {
                url: 'integrations/integration_management',
                title: defineMessage({id: 'admin.integrations.integrationManagement', defaultMessage: 'Integration Management'}),
                isHidden: it.all(
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                ),
                schema: {
                    id: 'CustomIntegrationSettings',
                    name: defineMessage({id: 'admin.integrations.integrationManagement.title', defaultMessage: 'Integration Management'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableIncomingWebhooks',
                            label: defineMessage({id: 'admin.service.webhooksTitle', defaultMessage: 'Enable Incoming Webhooks: '}),
                            help_text: defineMessage({id: 'admin.service.webhooksDescription', defaultMessage: 'When true, incoming webhooks will be allowed. To help combat phishing attacks, all posts from webhooks will be labelled by a BOT tag. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        href={DeveloperLinks.INCOMING_WEBHOOKS}
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
                            type: 'bool',
                            key: 'ServiceSettings.EnableOutgoingWebhooks',
                            label: defineMessage({id: 'admin.service.outWebhooksTitle', defaultMessage: 'Enable Outgoing Webhooks: '}),
                            help_text: defineMessage({id: 'admin.service.outWebhooksDesc', defaultMessage: 'When true, outgoing webhooks will be allowed. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.OUTGOING_WEBHOOKS}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableOutgoingOAuthConnections',
                            label: defineMessage({id: 'admin.service.outgoingOAuthConnectionsTitle', defaultMessage: 'Enable Outgoing OAuth Connections: '}),
                            help_text: defineMessage({id: 'admin.service.outgoingOAuthConnectionsDesc', defaultMessage: 'When true, outgoing webhooks and slash commands will use set up oauth connections to authenticate with third party services. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (text: string) => (
                                    <a href='https://mattermost.com/pl/outgoing-oauth-connections'>{text}</a>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableCommands',
                            label: defineMessage({id: 'admin.service.cmdsTitle', defaultMessage: 'Enable Custom Slash Commands: '}),
                            help_text: defineMessage({id: 'admin.service.cmdsDesc', defaultMessage: 'When true, custom slash commands will be allowed. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.SETUP_CUSTOM_SLASH_COMMANDS}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableOAuthServiceProvider',
                            label: defineMessage({id: 'admin.oauth.providerTitle', defaultMessage: 'Enable OAuth 2.0 Service Provider: '}),
                            help_text: defineMessage({id: 'admin.oauth.providerDescription', defaultMessage: 'When true, Mattermost can act as an OAuth 2.0 service provider allowing Mattermost to authorize API requests from external applications. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.ENABLE_OAUTH2}
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
                            type: 'number',
                            key: 'ServiceSettings.OutgoingIntegrationRequestsTimeout',
                            label: defineMessage({id: 'admin.service.integrationRequestTitle', defaultMessage: 'Integration request timeout: '}),
                            help_text: defineMessage({id: 'admin.service.integrationRequestDesc', defaultMessage: 'The number of seconds to wait for Integration requests. That includes <slashCommands>Slash Commands</slashCommands>, <outgoingWebhooks>Outgoing Webhooks</outgoingWebhooks>, <interactiveMessages>Interactive Messages</interactiveMessages> and <interactiveDialogs>Interactive Dialogs</interactiveDialogs>.'}),
                            help_text_values: {
                                slashCommands: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.CUSTOM_SLASH_COMMANDS}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                outgoingWebhooks: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.OUTGOING_WEBHOOKS}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                interactiveMessages: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.INTERACTIVE_MESSAGES}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                interactiveDialogs: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.INTERACTIVE_DIALOGS}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnablePostUsernameOverride',
                            label: defineMessage({id: 'admin.service.overrideTitle', defaultMessage: 'Enable integrations to override usernames:'}),
                            help_text: defineMessage({id: 'admin.service.overrideDescription', defaultMessage: 'When true, webhooks, slash commands and other integrations will be allowed to change the username they are posting as. Note: Combined with allowing integrations to override profile picture icons, users may be able to perform phishing attacks by attempting to impersonate other users.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnablePostIconOverride',
                            label: defineMessage({id: 'admin.service.iconTitle', defaultMessage: 'Enable integrations to override profile picture icons:'}),
                            help_text: defineMessage({id: 'admin.service.iconDescription', defaultMessage: 'When true, webhooks, slash commands and other integrations will be allowed to change the profile picture they post with. Note: Combined with allowing integrations to override usernames, users may be able to perform phishing attacks by attempting to impersonate other users.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableUserAccessTokens',
                            label: defineMessage({id: 'admin.service.userAccessTokensTitle', defaultMessage: 'Enable User Access Tokens: '}),
                            help_text: defineMessage({id: 'admin.service.userAccessTokensDescription', defaultMessage: 'When true, users can create <link>user access tokens</link> for integrations in <strong>Account Menu > Account Settings > Security</strong>. They can be used to authenticate against the API and give full access to the account.\n\n To manage who can create personal access tokens or to search users by token ID, go to the <strong>User Management > Users</strong> page.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DeveloperLinks.PERSONAL_ACCESS_TOKENS}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                strong: (msg: string) => <strong>{msg}</strong>,
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.INTEGRATION_MANAGEMENT)),
                        },
                    ],
                },
            },
            bot_accounts: {
                url: 'integrations/bot_accounts',
                title: defineMessage({id: 'admin.integrations.botAccounts', defaultMessage: 'Bot Accounts'}),
                isHidden: it.all(
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.BOT_ACCOUNTS)),
                ),
                schema: {
                    id: 'BotAccountSettings',
                    name: defineMessage({id: 'admin.integrations.botAccounts.title', defaultMessage: 'Bot Accounts'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableBotAccountCreation',
                            label: defineMessage({id: 'admin.service.enableBotTitle', defaultMessage: 'Enable Bot Account Creation: '}),
                            help_text: defineMessage({id: 'admin.service.enableBotAccountCreation', defaultMessage: 'When true, System Admins can create bot accounts for integrations in <linkBots>Integrations > Bot Accounts</linkBots>. Bot accounts are similar to user accounts except they cannot be used to log in. See <linkDocumentation>documentation</linkDocumentation> to learn more.'}),
                            help_text_markdown: false,
                            help_text_values: {
                                siteURL: getSiteURL(),
                                linkDocumentation: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href='https://mattermost.com/pl/default-bot-accounts'
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                linkBots: (msg: string) => (
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
                            type: 'bool',
                            key: 'ServiceSettings.DisableBotsWhenOwnerIsDeactivated',
                            label: defineMessage({id: 'admin.service.disableBotOwnerDeactivatedTitle', defaultMessage: 'Disable bot accounts when owner is deactivated:'}),
                            help_text: defineMessage({id: 'admin.service.disableBotWhenOwnerIsDeactivated', defaultMessage: 'When a user is deactivated, disables all bot accounts managed by the user. To re-enable bot accounts, go to [Integrations > Bot Accounts]({siteURL}/_redirect/integrations/bots).'}),
                            help_text_markdown: true,
                            help_text_values: {siteURL: getSiteURL()},
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.BOT_ACCOUNTS)),
                        },
                    ],
                },
            },
            gif: {
                url: 'integrations/gif',
                title: defineMessage({id: 'admin.sidebar.gif', defaultMessage: 'GIF (Beta)'}),
                isHidden: it.all(
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.GIF)),
                ),
                schema: {
                    id: 'GifSettings',
                    name: defineMessage({id: 'admin.integrations.gif', defaultMessage: 'GIF (Beta)'}),
                    settings: [
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableGifPicker',
                            label: defineMessage({id: 'admin.customization.enableGifPickerTitle', defaultMessage: 'Enable GIF Picker:'}),
                            help_text: defineMessage({id: 'admin.customization.enableGifPickerDesc', defaultMessage: 'Allows users to select GIFs from the emoji picker.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.GIF)),
                        },
                    ],
                },
            },
            cors: {
                url: 'integrations/cors',
                title: defineMessage({id: 'admin.sidebar.cors', defaultMessage: 'CORS'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                ),
                schema: {
                    id: 'CORS',
                    name: defineMessage({id: 'admin.integrations.cors', defaultMessage: 'CORS'}),
                    settings: [
                        {
                            type: 'text',
                            key: 'ServiceSettings.AllowCorsFrom',
                            label: defineMessage({id: 'admin.service.corsTitle', defaultMessage: 'Enable cross-origin requests from:'}),
                            placeholder: defineMessage({id: 'admin.service.corsEx', defaultMessage: 'http://example.com'}),
                            help_text: defineMessage({id: 'admin.service.corsDescription', defaultMessage: 'Enable HTTP Cross origin request from a specific domain. Use "*" if you want to allow CORS from any domain or leave it blank to disable it. Should not be set to "*" in production.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                        },
                        {
                            type: 'text',
                            key: 'ServiceSettings.CorsExposedHeaders',
                            label: defineMessage({id: 'admin.service.corsExposedHeadersTitle', defaultMessage: 'CORS Exposed Headers:'}),
                            placeholder: defineMessage({id: 'admin.service.corsHeadersEx', defaultMessage: 'X-My-Header'}),
                            help_text: defineMessage({id: 'admin.service.corsExposedHeadersDescription', defaultMessage: 'Whitelist of headers that will be accessible to the requester.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.CorsAllowCredentials',
                            label: defineMessage({id: 'admin.service.corsAllowCredentialsLabel', defaultMessage: 'CORS Allow Credentials:'}),
                            help_text: defineMessage({id: 'admin.service.corsAllowCredentialsDescription', defaultMessage: 'When true, requests that pass validation will include the Access-Control-Allow-Credentials header.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.CorsDebug',
                            label: defineMessage({id: 'admin.service.CorsDebugLabel', defaultMessage: 'CORS Debug:'}),
                            help_text: defineMessage({id: 'admin.service.corsDebugDescription', defaultMessage: 'When true, prints messages to the logs to help when developing an integration that uses CORS. These messages will include the structured key value pair "source":"cors".'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.INTEGRATIONS.CORS)),
                        },
                    ],
                },
            },
        },
    },
    compliance: {
        icon: (
            <FormatListBulletedIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.compliance', defaultMessage: 'Compliance'}),
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.COMPLIANCE)),
        subsections: {
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
                title: defineMessage({id: 'admin.sidebar.dataRetentionSettingsPolicies', defaultMessage: 'Data Retention Policies'}),
                searchableStrings: [
                    adminDefinitionMessages.data_retention_title,
                    ...dataRetentionSearchableStrings,
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
                title: defineMessage({id: 'admin.sidebar.dataRetentionPolicy', defaultMessage: 'Data Retention Policy'}),
                isHidden: it.any(
                    it.licensedForFeature('DataRetention'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'DataRetentionSettings',
                    name: adminDefinitionMessages.data_retention_title,
                    settings: [
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.complianceExport', defaultMessage: 'Compliance Export'}),
                searchableStrings: messageExportSearchableStrings,
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
                title: defineMessage({id: 'admin.sidebar.complianceExport', defaultMessage: 'Compliance Export'}),
                isHidden: it.any(
                    it.licensedForFeature('MessageExport'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'MessageExportSettings',
                    name: defineMessage({id: 'admin.complianceExport.title', defaultMessage: 'Compliance Export'}),
                    settings: [
                        {
                            type: 'custom',
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
                title: defineMessage({id: 'admin.sidebar.complianceMonitoring', defaultMessage: 'Compliance Monitoring'}),
                isHidden: it.any(
                    it.not(it.licensedForFeature('Compliance')),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
                ),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
                searchableStrings: auditSearchableStrings,
                schema: {
                    id: 'Audits',
                    name: defineMessage({id: 'admin.compliance.complianceMonitoring', defaultMessage: 'Compliance Monitoring'}),
                    component: Audits,
                    isHidden: it.not(it.licensedForFeature('Compliance')),
                    settings: [
                        {
                            type: 'banner',
                            label: defineMessage({id: 'admin.compliance.newComplianceExportBanner', defaultMessage: 'This feature is replaced by a new [Compliance Export]({siteURL}/admin_console/compliance/export) feature, and will be removed in a future release. We recommend migrating to the new system.'}),
                            label_markdown: true,
                            label_values: {siteURL: getSiteURL()},
                            banner_type: 'info',
                            isHidden: it.not(it.licensedForFeature('Compliance')),
                        },
                        {
                            type: 'bool',
                            key: 'ComplianceSettings.Enable',
                            label: defineMessage({id: 'admin.compliance.enableTitle', defaultMessage: 'Enable Compliance Reporting:'}),
                            help_text: defineMessage({id: 'admin.compliance.enableDesc', defaultMessage: 'When true, Mattermost allows compliance reporting from the <strong>Compliance and Auditing</strong> tab. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.COMPILANCE_MONITORING}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                                strong: (msg: string) => <strong>{msg}</strong>,
                            },
                            help_text_markdown: false,
                            isHidden: it.not(it.licensedForFeature('Compliance')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
                        },
                        {
                            type: 'text',
                            key: 'ComplianceSettings.Directory',
                            label: defineMessage({id: 'admin.compliance.directoryTitle', defaultMessage: 'Compliance Report Directory:'}),
                            help_text: defineMessage({id: 'admin.compliance.directoryDescription', defaultMessage: 'Directory to which compliance reports are written. If blank, will be set to ./data/.'}),
                            placeholder: defineMessage({id: 'admin.compliance.directoryExample', defaultMessage: 'E.g.: "./data/"'}),
                            isHidden: it.not(it.licensedForFeature('Compliance')),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.COMPLIANCE.COMPLIANCE_MONITORING)),
                                it.stateIsFalse('ComplianceSettings.Enable'),
                            ),
                        },
                        {
                            type: 'bool',
                            key: 'ComplianceSettings.EnableDaily',
                            label: defineMessage({id: 'admin.compliance.enableDailyTitle', defaultMessage: 'Enable Daily Report:'}),
                            help_text: defineMessage({id: 'admin.compliance.enableDailyDesc', defaultMessage: 'When true, Mattermost will generate a daily compliance report.'}),
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
                title: defineMessage({id: 'admin.sidebar.customTermsOfService', defaultMessage: 'Custom Terms of Service'}),
                searchableStrings: customTermsOfServiceSearchableStrings,
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
                title: defineMessage({id: 'admin.sidebar.customTermsOfService', defaultMessage: 'Custom Terms of Service'}),
                isHidden: it.any(
                    it.licensedForFeature('CustomTermsOfService'),
                    it.not(it.enterpriseReady),
                ),
                schema: {
                    id: 'TermsOfServiceSettings',
                    name: customTermsOfServiceMessages.termsOfServiceTitle,
                    settings: [
                        {
                            type: 'custom',
                            component: CustomTermsOfServiceFeatureDiscovery,
                            key: 'CustomTermsOfServiceFeatureDiscovery',
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.ABOUT.EDITION_AND_LICENSE)),
                        },
                    ],
                },
                restrictedIndicator: getRestrictedIndicator(true, LicenseSkus.Enterprise),
            },
        },
    },
    experimental: {
        icon: (
            <FlaskOutlineIcon
                size={16}
                color={'currentColor'}
            />
        ),
        sectionTitle: defineMessage({id: 'admin.sidebar.experimental', defaultMessage: 'Experimental'}),
        isHidden: it.not(it.userHasReadPermissionOnSomeResources(RESOURCE_KEYS.EXPERIMENTAL)),
        subsections: {
            experimental_features: {
                url: 'experimental/features',
                title: defineMessage({id: 'admin.sidebar.experimentalFeatures', defaultMessage: 'Features'}),
                isHidden: it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                schema: {
                    id: 'ExperimentalSettings',
                    name: defineMessage({id: 'admin.experimental.experimentalFeatures', defaultMessage: 'Experimental Features'}),
                    settings: [
                        {
                            type: 'color',
                            key: 'LdapSettings.LoginButtonColor',
                            label: defineMessage({id: 'admin.experimental.ldapSettingsLoginButtonColor.title', defaultMessage: 'AD/LDAP Login Button Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.ldapSettingsLoginButtonColor.desc', defaultMessage: 'Specify the color of the AD/LDAP login button for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isHidden: it.not(it.licensedForFeature('LDAP')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'LdapSettings.LoginButtonBorderColor',
                            label: defineMessage({id: 'admin.experimental.ldapSettingsLoginButtonBorderColor.title', defaultMessage: 'AD/LDAP Login Button Border Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.ldapSettingsLoginButtonBorderColor.desc', defaultMessage: 'Specify the color of the AD/LDAP login button border for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isHidden: it.not(it.licensedForFeature('LDAP')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'LdapSettings.LoginButtonTextColor',
                            label: defineMessage({id: 'admin.experimental.ldapSettingsLoginButtonTextColor.title', defaultMessage: 'AD/LDAP Login Button Text Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.ldapSettingsLoginButtonTextColor.desc', defaultMessage: 'Specify the color of the AD/LDAP login button text for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isHidden: it.not(it.licensedForFeature('LDAP')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.ExperimentalEnableAuthenticationTransfer',
                            label: defineMessage({id: 'admin.experimental.experimentalEnableAuthenticationTransfer.title', defaultMessage: 'Allow Authentication Transfer:'}),
                            help_text: defineMessage({id: 'admin.experimental.experimentalEnableAuthenticationTransfer.desc', defaultMessage: 'When true, users can change their sign-in method to any that is enabled on the server, any via Account Settings or the APIs. When false, Users cannot change their sign-in method, regardless of which authentication options are enabled.'}),
                            help_text_markdown: false,
                            isHidden: it.any( // documented as E20 and higher, but only E10 in the code
                                it.not(it.licensed),
                                it.licensedForSku('starter'),
                            ),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'number',
                            key: 'ExperimentalSettings.LinkMetadataTimeoutMilliseconds',
                            label: defineMessage({id: 'admin.experimental.linkMetadataTimeoutMilliseconds.title', defaultMessage: 'Link Metadata Timeout:'}),
                            help_text: defineMessage({id: 'admin.experimental.linkMetadataTimeoutMilliseconds.desc', defaultMessage: 'The number of milliseconds to wait for metadata from a third-party link. Used with Post Metadata.'}),
                            help_text_markdown: false,
                            placeholder: defineMessage({id: 'admin.experimental.linkMetadataTimeoutMilliseconds.example', defaultMessage: 'E.g.: "5000"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'number',
                            key: 'EmailSettings.EmailBatchingBufferSize',
                            label: defineMessage({id: 'admin.experimental.emailBatchingBufferSize.title', defaultMessage: 'Email Batching Buffer Size:'}),
                            help_text: defineMessage({id: 'admin.experimental.emailBatchingBufferSize.desc', defaultMessage: 'Specify the maximum number of notifications batched into a single email.'}),
                            help_text_markdown: false,
                            placeholder: defineMessage({id: 'admin.experimental.emailBatchingBufferSize.example', defaultMessage: 'E.g.: "256"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'number',
                            key: 'EmailSettings.EmailBatchingInterval',
                            label: defineMessage({id: 'admin.experimental.emailBatchingInterval.title', defaultMessage: 'Email Batching Interval:'}),
                            help_text: defineMessage({id: 'admin.experimental.emailBatchingInterval.desc', defaultMessage: 'Specify the maximum frequency, in seconds, which the batching job checks for new notifications. Longer batching intervals will increase performance.'}),
                            help_text_markdown: false,
                            placeholder: defineMessage({id: 'admin.experimental.emailBatchingInterval.example', defaultMessage: 'E.g.: "30"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'EmailSettings.LoginButtonColor',
                            label: defineMessage({id: 'admin.experimental.emailSettingsLoginButtonColor.title', defaultMessage: 'Email Login Button Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.emailSettingsLoginButtonColor.desc', defaultMessage: 'Specify the color of the email login button for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'EmailSettings.LoginButtonBorderColor',
                            label: defineMessage({id: 'admin.experimental.emailSettingsLoginButtonBorderColor.title', defaultMessage: 'Email Login Button Border Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.emailSettingsLoginButtonBorderColor.desc', defaultMessage: 'Specify the color of the email login button border for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'EmailSettings.LoginButtonTextColor',
                            label: defineMessage({id: 'admin.experimental.emailSettingsLoginButtonTextColor.title', defaultMessage: 'Email Login Button Text Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.emailSettingsLoginButtonTextColor.desc', defaultMessage: 'Specify the color of the email login button text for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.EnableUserDeactivation',
                            label: defineMessage({id: 'admin.experimental.enableUserDeactivation.title', defaultMessage: 'Enable Account Deactivation:'}),
                            help_text: defineMessage({id: 'admin.experimental.enableUserDeactivation.desc', defaultMessage: 'When true, users may deactivate their own account from **Settings > Advanced**. If a user deactivates their own account, they will get an email notification confirming they were deactivated. When false, users may not deactivate their own account.'}),
                            help_text_markdown: true,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'TeamSettings.ExperimentalEnableAutomaticReplies',
                            label: defineMessage({id: 'admin.experimental.experimentalEnableAutomaticReplies.title', defaultMessage: 'Enable Automatic Replies:'}),
                            help_text: defineMessage({id: 'admin.experimental.experimentalEnableAutomaticReplies.desc', defaultMessage: 'When true, users can enable Automatic Replies in **Settings > Notifications**. Users set a custom message that will be automatically sent in response to Direct Messages. When false, disables the Automatic Direct Message Replies feature and hides it from Settings.'}),
                            help_text_markdown: true,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableChannelViewedMessages',
                            label: defineMessage({id: 'admin.experimental.enableChannelViewedMessages.title', defaultMessage: 'Enable Channel Viewed WebSocket Messages:'}),
                            help_text: defineMessage({id: 'admin.experimental.enableChannelViewedMessages.desc', defaultMessage: 'This setting determines whether `channel_viewed` WebSocket events are sent, which synchronize unread notifications across clients and devices. Disabling the setting in larger deployments may improve server performance.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ExperimentalSettings.ClientSideCertEnable',
                            label: defineMessage({id: 'admin.experimental.clientSideCertEnable.title', defaultMessage: 'Enable Client-Side Certification:'}),
                            help_text: defineMessage({id: 'admin.experimental.clientSideCertEnable.desc', defaultMessage: 'Enables client-side certification for your Mattermost server. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.ENABLE_CLIENT_SIDE_CERTIFICATION}
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
                            type: 'dropdown',
                            key: 'ExperimentalSettings.ClientSideCertCheck',
                            label: defineMessage({id: 'admin.experimental.clientSideCertCheck.title', defaultMessage: 'Client-Side Certification Login Method:'}),
                            help_text: defineMessage({id: 'admin.experimental.clientSideCertCheck.desc', defaultMessage: 'When **primary**, after the client side certificate is verified, user’s email is retrieved from the certificate and is used to log in without a password. When **secondary**, after the client side certificate is verified, user’s email is retrieved from the certificate and matched against the one supplied by the user. If they match, the user logs in with regular email/password credentials.'}),
                            help_text_markdown: true,
                            options: [
                                {
                                    value: 'primary',
                                    display_name: defineMessage({id: 'admin.experimental.clientSideCertCheck.options.primary', defaultMessage: 'primary'}),
                                },
                                {
                                    value: 'secondary',
                                    display_name: defineMessage({id: 'admin.experimental.clientSideCertCheck.options.secondary', defaultMessage: 'secondary'}),
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
                            type: 'bool',
                            key: 'ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages',
                            label: defineMessage({id: 'admin.experimental.experimentalEnableDefaultChannelLeaveJoinMessages.title', defaultMessage: 'Enable Default Channel Leave/Join System Messages:'}),
                            help_text: defineMessage({id: 'admin.experimental.experimentalEnableDefaultChannelLeaveJoinMessages.desc', defaultMessage: 'This setting determines whether team leave/join system messages are posted in the default town-square channel.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.ExperimentalEnableHardenedMode',
                            label: defineMessage({id: 'admin.experimental.experimentalEnableHardenedMode.title', defaultMessage: 'Enable Hardened Mode:'}),
                            help_text: defineMessage({id: 'admin.experimental.experimentalEnableHardenedMode.desc', defaultMessage: 'Enables a hardened mode for Mattermost that makes user experience trade-offs in the interest of security. See <link>documentation</link> to learn more.'}),
                            help_text_values: {
                                link: (msg: string) => (
                                    <ExternalLink
                                        location='admin_console'
                                        href={DocLinks.ENABLE_HARDENED_MODE}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            },
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnablePreviewFeatures',
                            label: defineMessage({id: 'admin.experimental.enablePreviewFeatures.title', defaultMessage: 'Enable Preview Features:'}),
                            help_text: defineMessage({id: 'admin.experimental.enablePreviewFeatures.desc', defaultMessage: 'When true, preview features can be enabled from **Settings > Advanced > Preview pre-release features**. When false, disables and hides preview features from **Settings > Advanced > Preview pre-release features**.'}),
                            help_text_markdown: true,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ThemeSettings.EnableThemeSelection',
                            label: defineMessage({id: 'admin.experimental.enableThemeSelection.title', defaultMessage: 'Enable Theme Selection:'}),
                            help_text: defineMessage({id: 'admin.experimental.enableThemeSelection.desc', defaultMessage: 'Enables the **Display > Theme** tab in Settings so users can select their theme.'}),
                            help_text_markdown: true,
                            isHidden: it.any(
                                it.not(it.licensed),
                                it.licensedForSku('starter'),
                            ),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ThemeSettings.AllowCustomThemes',
                            label: defineMessage({id: 'admin.experimental.allowCustomThemes.title', defaultMessage: 'Allow Custom Themes:'}),
                            help_text: defineMessage({id: 'admin.experimental.allowCustomThemes.desc', defaultMessage: 'Enables the **Display > Theme > Custom Theme** section in Settings.'}),
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
                            type: 'dropdown',
                            key: 'ThemeSettings.DefaultTheme',
                            label: defineMessage({id: 'admin.experimental.defaultTheme.title', defaultMessage: 'Default Theme:'}),
                            help_text: defineMessage({id: 'admin.experimental.defaultTheme.desc', defaultMessage: 'Set a default theme that applies to all new users on the system.'}),
                            help_text_markdown: true,
                            options: [
                                {
                                    value: 'denim',
                                    display_name: defineMessage({id: 'admin.experimental.defaultTheme.options.denim', defaultMessage: 'Denim'}),
                                },
                                {
                                    value: 'sapphire',
                                    display_name: defineMessage({id: 'admin.experimental.defaultTheme.options.sapphire', defaultMessage: 'Sapphire'}),
                                },
                                {
                                    value: 'quartz',
                                    display_name: defineMessage({id: 'admin.experimental.defaultTheme.options.quartz', defaultMessage: 'Quartz'}),
                                },
                                {
                                    value: 'indigo',
                                    display_name: defineMessage({id: 'admin.experimental.defaultTheme.options.indigo', defaultMessage: 'Indigo'}),
                                },
                                {
                                    value: 'onyx',
                                    display_name: defineMessage({id: 'admin.experimental.defaultTheme.options.onyx', defaultMessage: 'Onyx'}),
                                },
                            ],
                            isHidden: it.any(
                                it.not(it.licensed),
                                it.licensedForSku('starter'),
                            ),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableTutorial',
                            label: defineMessage({id: 'admin.experimental.enableTutorial.title', defaultMessage: 'Enable Tutorial:'}),
                            help_text: defineMessage({id: 'admin.experimental.enableTutorial.desc', defaultMessage: 'When true, users are prompted with a tutorial when they open Mattermost for the first time after account creation. When false, the tutorial is disabled, and users are placed in Town Square when they open Mattermost for the first time after account creation.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableOnboardingFlow',
                            label: defineMessage({id: 'admin.experimental.enableOnboardingFlow.title', defaultMessage: 'Enable Onboarding:'}),
                            help_text: defineMessage({id: 'admin.experimental.enableOnboardingFlow.desc', defaultMessage: 'When true, new users are shown steps to complete as part of an onboarding process'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ServiceSettings.EnableUserTypingMessages',
                            label: defineMessage({id: 'admin.experimental.enableUserTypingMessages.title', defaultMessage: 'Enable User Typing Messages:'}),
                            help_text: defineMessage({id: 'admin.experimental.enableUserTypingMessages.desc', defaultMessage: 'This setting determines whether "user is typing..." messages are displayed below the message box. Disabling the setting in larger deployments may improve server performance.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'number',
                            key: 'ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds',
                            label: defineMessage({id: 'admin.experimental.timeBetweenUserTypingUpdatesMilliseconds.title', defaultMessage: 'User Typing Timeout:'}),
                            help_text: defineMessage({id: 'admin.experimental.timeBetweenUserTypingUpdatesMilliseconds.desc', defaultMessage: 'The number of milliseconds to wait between emitting user typing websocket events.'}),
                            help_text_markdown: false,
                            placeholder: defineMessage({id: 'admin.experimental.timeBetweenUserTypingUpdatesMilliseconds.example', defaultMessage: 'E.g.: "5000"'}),
                            isDisabled: it.any(
                                it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                                it.stateIsFalse('ServiceSettings.EnableUserTypingMessages'),
                            ),
                        },
                        {
                            type: 'text',
                            key: 'TeamSettings.ExperimentalPrimaryTeam',
                            label: defineMessage({id: 'admin.experimental.experimentalPrimaryTeam.title', defaultMessage: 'Primary Team:'}),
                            help_text: defineMessage({id: 'admin.experimental.experimentalPrimaryTeam.desc', defaultMessage: 'The primary team of which users on the server are members. When a primary team is set, the options to join other teams or leave the primary team are disabled.'}),
                            help_text_markdown: true,
                            placeholder: defineMessage({id: 'admin.experimental.experimentalPrimaryTeam.example', defaultMessage: 'E.g.: "teamname"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'SamlSettings.LoginButtonColor',
                            label: defineMessage({id: 'admin.experimental.samlSettingsLoginButtonColor.title', defaultMessage: 'SAML Login Button Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.samlSettingsLoginButtonColor.desc', defaultMessage: 'Specify the color of the SAML login button for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isHidden: it.not(it.licensedForFeature('SAML')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'SamlSettings.LoginButtonBorderColor',
                            label: defineMessage({id: 'admin.experimental.samlSettingsLoginButtonBorderColor.title', defaultMessage: 'SAML Login Button Border Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.samlSettingsLoginButtonBorderColor.desc', defaultMessage: 'Specify the color of the SAML login button border for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isHidden: it.not(it.licensedForFeature('SAML')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'color',
                            key: 'SamlSettings.LoginButtonTextColor',
                            label: defineMessage({id: 'admin.experimental.samlSettingsLoginButtonTextColor.title', defaultMessage: 'SAML Login Button Text Color:'}),
                            help_text: defineMessage({id: 'admin.experimental.samlSettingsLoginButtonTextColor.desc', defaultMessage: 'Specify the color of the SAML login button text for white labeling purposes. Use a hex code with a #-sign before the code. This setting only applies to the mobile apps.'}),
                            help_text_markdown: false,
                            isHidden: it.not(it.licensedForFeature('SAML')),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'EmailSettings.UseChannelInEmailNotifications',
                            label: defineMessage({id: 'admin.experimental.useChannelInEmailNotifications.title', defaultMessage: 'Use Channel Name in Email Notifications:'}),
                            help_text: defineMessage({id: 'admin.experimental.useChannelInEmailNotifications.desc', defaultMessage: 'When true, channel and team name appears in email notification subject lines. Useful for servers using only one team. When false, only team name appears in email notification subject line.'}),
                            help_text_markdown: false,
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'number',
                            key: 'TeamSettings.UserStatusAwayTimeout',
                            label: defineMessage({id: 'admin.experimental.userStatusAwayTimeout.title', defaultMessage: 'User Status Away Timeout:'}),
                            help_text: defineMessage({id: 'admin.experimental.userStatusAwayTimeout.desc', defaultMessage: 'This setting defines the number of seconds after which the user’s status indicator changes to "Away", when they are away from Mattermost.'}),
                            help_text_markdown: false,
                            placeholder: defineMessage({id: 'admin.experimental.userStatusAwayTimeout.example', defaultMessage: 'E.g.: "300"'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ExperimentalSettings.EnableSharedChannels',
                            label: defineMessage({id: 'admin.experimental.enableSharedChannels.title', defaultMessage: 'Enable Shared Channels:'}),
                            help_text: defineMessage({id: 'admin.experimental.enableSharedChannels.desc', defaultMessage: 'Toggles Shared Channels'}),
                            help_text_markdown: false,
                            isHidden: it.not(it.any(
                                it.licensedForFeature('SharedChannels'),
                                it.licensedForSku(LicenseSkus.Enterprise),
                                it.licensedForSku(LicenseSkus.Professional),
                            )),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ExperimentalSettings.DisableAppBar',
                            label: defineMessage({id: 'admin.experimental.disableAppBar.title', defaultMessage: 'Disable Apps Bar:'}),
                            help_text: defineMessage({id: 'admin.experimental.disableAppBar.desc', defaultMessage: 'When false, all integrations move from the channel header to the Apps Bar. Channel header plugin icons that haven\'t explicitly registered an Apps Bar icon will be moved to the Apps Bar which may result in rendering issues.'}),
                            help_text_markdown: true,
                            isHidden: it.licensedForFeature('Cloud'),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ExperimentalSettings.DisableRefetchingOnBrowserFocus',
                            label: defineMessage({id: 'admin.experimental.disableRefetchingOnBrowserFocus.title', defaultMessage: 'Disable data refetching on browser refocus:'}),
                            help_text: defineMessage({id: 'admin.experimental.disableRefetchingOnBrowserFocus.desc', defaultMessage: 'When true, Mattermost will not refetch channels and channel members when the browser regains focus. This may result in improved performance for users with many channels and channel members.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                        {
                            type: 'bool',
                            key: 'ExperimentalSettings.DelayChannelAutocomplete',
                            label: defineMessage({id: 'admin.experimental.delayChannelAutocomplete.title', defaultMessage: 'Delay Channel Autocomplete:'}),
                            help_text: defineMessage({id: 'admin.experimental.delayChannelAutocomplete.desc', defaultMessage: 'When true, the autocomplete for channel links (such as ~town-square) will only trigger after typing a tilde followed by a couple letters. When false, the autocomplete will appear as soon as the user types a tilde.'}),
                            isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURES)),
                        },
                    ],
                },
            },
            feature_flags: {
                url: 'experimental/feature_flags',
                title: featureFlagsMessages.title,
                isHidden: it.any(
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.FEATURE_FLAGS)),
                ),
                isDisabled: true,
                searchableStrings: [
                    featureFlagsMessages.title,
                ],
                schema: {
                    id: 'Feature Flags',
                    component: FeatureFlags,
                },
            },
            bleve: {
                url: 'experimental/blevesearch',
                title: defineMessage({id: 'admin.sidebar.blevesearch', defaultMessage: 'Bleve'}),
                isHidden: it.any(
                    it.configIsTrue('ExperimentalSettings', 'RestrictSystemAdmin'),
                    it.not(it.userHasReadPermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.BLEVE)),
                ),
                isDisabled: it.not(it.userHasWritePermissionOnResource(RESOURCE_KEYS.EXPERIMENTAL.BLEVE)),
                searchableStrings: bleveSearchableStrings,
                schema: {
                    id: 'BleveSettings',
                    component: BleveSettings,
                },
            },
        },
    },
};

export default AdminDefinition;
