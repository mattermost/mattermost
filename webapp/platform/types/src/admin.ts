// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Audit} from './audits';
import type {Compliance} from './compliance';
import type {AdminConfig, ClientLicense, EnvironmentConfig} from './config';
import type {DataRetentionCustomPolicies} from './data_retention';
import type {MixedUnlinkedGroupRedux} from './groups';
import type {PluginRedux, PluginStatusRedux} from './plugins';
import type {SamlCertificateStatus, SamlMetadataResponse} from './saml';
import type {Team} from './teams';
import type {UserAccessToken, UserProfile} from './users';
import type {RelationOneToOne} from './utilities';

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

export type LogFilterQuery = {
    server_names: LogServerNames;
    log_levels: LogLevels;
    date_from: LogDateFrom;
    date_to: LogDateTo;
}

export type AdminState = {
    logs: LogObject[];
    plainLogs: string[];
    audits: Record<string, Audit>;
    config: Partial<AdminConfig>;
    environmentConfig: Partial<EnvironmentConfig>;
    complianceReports: Record<string, Compliance>;
    ldapGroups: Record<string, MixedUnlinkedGroupRedux>;
    ldapGroupsCount: number;
    userAccessTokens: Record<string, UserAccessToken>;
    clusterInfo: ClusterInfo[];
    samlCertStatus?: SamlCertificateStatus;
    analytics: AnalyticsState;
    teamAnalytics: RelationOneToOne<Team, AnalyticsState>;
    userAccessTokensByUser?: RelationOneToOne<UserProfile, Record<string, UserAccessToken>>;
    plugins?: Record<string, PluginRedux>;
    pluginStatuses?: Record<string, PluginStatusRedux>;
    samlMetadataResponse?: SamlMetadataResponse;
    dataRetentionCustomPolicies: DataRetentionCustomPolicies;
    dataRetentionCustomPoliciesCount: number;
    prevTrialLicense: ClientLicense;
};

export type AnalyticsState = {
    POST_PER_DAY?: AnalyticsRow[];
    BOT_POST_PER_DAY?: AnalyticsRow[];
    USERS_WITH_POSTS_PER_DAY?: AnalyticsRow[];

    TOTAL_PUBLIC_CHANNELS?: number;
    TOTAL_PRIVATE_GROUPS?: number;
    TOTAL_POSTS?: number;
    TOTAL_USERS?: number;
    TOTAL_INACTIVE_USERS?: number;
    TOTAL_TEAMS?: number;
    TOTAL_WEBSOCKET_CONNECTIONS?: number;
    TOTAL_MASTER_DB_CONNECTIONS?: number;
    TOTAL_READ_DB_CONNECTIONS?: number;
    DAILY_ACTIVE_USERS?: number;
    MONTHLY_ACTIVE_USERS?: number;
    TOTAL_FILE_POSTS?: number;
    TOTAL_HASHTAG_POSTS?: number;
    TOTAL_IHOOKS?: number;
    TOTAL_OHOOKS?: number;
    TOTAL_COMMANDS?: number;
    TOTAL_SESSIONS?: number;
    REGISTERED_USERS?: number;
}

export type ClusterInfo = {
    id: string;
    version: string;
    config_hash: string;
    ipaddress: string;
    hostname: string;
    schema_version: string;
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
