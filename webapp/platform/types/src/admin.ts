// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ReactElement} from 'react';
import {DeepPartial} from 'redux';

import {Audit} from './audits';
import {CloudState, Product} from './cloud';
import {Compliance} from './compliance';
import {AdminConfig, ClientLicense, EnvironmentConfig} from './config';
import {DataRetentionCustomPolicies} from './data_retention';
import {MixedUnlinkedGroupRedux} from './groups';
import {PluginRedux, PluginStatusRedux} from './plugins';
import {SamlCertificateStatus, SamlMetadataResponse} from './saml';
import {Team} from './teams';
import {UserAccessToken, UserProfile} from './users';
import {RelationOneToOne} from './utilities';

export enum LogLevelEnum {
    SILLY = 'silly',
    DEBUG = 'debug',
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

export type LogServerNames = string[];
export type LogLevels = LogLevelEnum[];
export type LogDateFrom = string; // epoch
export type LogDateTo = string; // epoch

export type LogObject = {
    caller: string;
    job_id: string;
    level: LogLevelEnum;
    msg: string;
    timestamp: string;
    worker: string;
}

export type LogFilter = {
    serverNames: LogServerNames;
    logLevels: LogLevels;
    dateFrom: LogDateFrom;
    dateTo: LogDateTo;
}

export type AdminState = {
    logs: LogObject[];
    audits: Record<string, Audit>;
    config: Partial<AdminConfig>;
    environmentConfig: Partial<EnvironmentConfig>;
    complianceReports: Record<string, Compliance>;
    ldapGroups: Record<string, MixedUnlinkedGroupRedux>;
    ldapGroupsCount: number;
    userAccessTokens: Record<string, UserAccessToken>;
    clusterInfo: ClusterInfo[];
    samlCertStatus?: SamlCertificateStatus;
    analytics?: Record<string, number | AnalyticsRow[]>;
    teamAnalytics?: RelationOneToOne<Team, Record<string, number | AnalyticsRow[]>>;
    userAccessTokensByUser?: RelationOneToOne<UserProfile, Record<string, UserAccessToken>>;
    plugins?: Record<string, PluginRedux>;
    pluginStatuses?: Record<string, PluginStatusRedux>;
    samlMetadataResponse?: SamlMetadataResponse;
    dataRetentionCustomPolicies: DataRetentionCustomPolicies;
    dataRetentionCustomPoliciesCount: number;
    prevTrialLicense: ClientLicense;
};

export type ClusterInfo = {
    id: string;
    version: string;
    config_hash: string;
    ipaddress: string;
    hostname: string;
};

export type AnalyticsRow = {
    name: string;
    value: number;
};

export type IndexedPluginAnalyticsRow = {
    [key: string]: PluginAnalyticsRow;
}

export type PluginAnalyticsRow = {
    id: string;
    name: React.ReactNode;
    icon: string;
    value: number;
};

export type SchemaMigration = {
    version: number;
    name: string;
};

export type ConsoleAccess = {
    read: Record<string, boolean>;
    write: Record<string, boolean>;
}

export type CheckFunction = (config?: DeepPartial<AdminConfig>, state?: Record<string, any>, license?: ClientLicense, enterpriseReady?: boolean, consoleAccess?: ConsoleAccess, cloud?: CloudState, isSystemAdmin?: boolean) => boolean;

export type AdminSectionPages = {
    id: string;
    url: string;

    /** If the title of the page is not provided it will not render in the sidebar */
    title?: string;
    title_default?: string;
    isDiscovery?: boolean;
    schema: {
        id: string;
        component?: React.ElementType;
        isHidden?: CheckFunction | boolean;
        translate?: boolean;
        name?: string;
        name_default?: string;
        settings?: Record<string, any>[];
        sections?: Record<string, any>[];
        onConfigLoad?: (config: any) => unknown | undefined;
        onConfigSave?: (config: any) => unknown | undefined;
    };
    searchableStrings?: Array<string | [string, Record<string, string>]>;
    isHidden: CheckFunction | boolean;
    isDisabled: CheckFunction | boolean;
    restrictedIndicator?: {
        value: (cloud: CloudState) => JSX.Element;
        shouldDisplay: (license: ClientLicense, subscriptionProduct: Product | undefined) => boolean;
    };
}

export type AdminSection<T extends string> = {
    icon: JSX.Element | ReactElement<any, any>;
    sectionTitle: string;
    sectionTitleDefault: string;
    isHidden: CheckFunction | boolean;
    id?: string;

    /** Every page here will be rendered into the sidebar */
    pages: Array<AdminSectionPages>;
};

type AboutSections = 'license'
type ReportingSections = 'workspace_optimization' | 'system_analytics' | 'team_statistics' | 'server_logs';
type BillingSections = 'billing_history' | 'subscription' | 'company_info' | 'company_info_edit' | 'payment_info' | 'payment_info_edit';
type UserManagementSections = 'system_users' | 'system_user_detail' | 'group_detail' | 'groups' | 'groups_feature_discovery' | 'team_detail' | 'teams' | 'channel_detail' | 'channel' | 'systemScheme' | 'teamSchemeDetail' | 'teamScheme' | 'permissions' | 'system_role' | 'system_roles' | 'system_roles_feature_discovery';
type EnvironmentSections = 'web_server' | 'database' | 'elasticsearch' | 'storage' | 'image_proxy' | 'smtp' | 'push_notification_server' | 'high_availability' | 'rate_limiting' | 'logging' | 'session_lengths' | 'metrics' | 'developer';
type SiteSections = 'customization' | 'localization' | 'users_and_teams' |'notifications' | 'announcement_banner' | 'announcement_banner_feature_discovery' | 'emoji' | 'posts' | 'file_sharing_downloads' | 'public_links' | 'notices';
type AuthenticationSections = 'signup' | 'email' | 'password' | 'mfa' | 'ldap' | 'ldap_feature_discovery' | 'saml' | 'saml_feature_discovery' | 'gitlab' | 'oauth' | 'openid' | 'openid_feature_discovery' | 'guest_access' | 'guest_access_feature_discovery';
type PluginsSections = 'plugin_management' | 'custom';
type ProductsSections = 'boards';
type IntegrationsSections = 'integration_management' | 'bot_accounts' | 'gif' | 'cors';
type ComplianceSections = 'custom_policy_form_edit' | 'custom_policy_form' | 'global_policy_form' | 'data_retention' | 'data_retention_feature_discovery' | 'message_export' | 'compliance_export_feature_discovery' | 'audits' | 'custom_terms_of_service' | 'custom_terms_of_service_feature_discovery';
type ExperimentalSections = 'experimental_features' | 'feature_flags' | 'bleve';

export type AdminDefinitions = {
    about: AdminSection<AboutSections>;
    reporting: AdminSection<ReportingSections>;
    billing: AdminSection<BillingSections>;
    user_management: AdminSection<UserManagementSections>;
    environment: AdminSection<EnvironmentSections>;
    site: AdminSection<SiteSections>;
    authentication: AdminSection<AuthenticationSections>;
    plugins: AdminSection<PluginsSections>;
    products: AdminSection<ProductsSections>;
    integrations: AdminSection<IntegrationsSections>;
    compliance: AdminSection<ComplianceSections>;
    experimental: AdminSection<ExperimentalSections>;
} & Record<string, AdminSection<string>>;