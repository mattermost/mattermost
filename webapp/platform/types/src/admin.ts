// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlPolicy} from './access_control';
import type {Audit} from './audits';
import type {Compliance} from './compliance';
import type {AdminConfig, ClientLicense, EnvironmentConfig} from './config';
import type {DataRetentionCustomPolicies} from './data_retention';
import type {MixedUnlinkedGroupRedux} from './groups';
import type {PluginRedux, PluginStatusRedux} from './plugins';
import type {SamlCertificateStatus, SamlMetadataResponse} from './saml';
import type {Team} from './teams';
import type {UserAccessToken, UserProfile} from './users';
import type {RelationOneToOne, IDMappedObjects} from './utilities';

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
};

// The node an entry came from. A symbol, so it can't clash with a field the server logged
// and is left out of JSON.stringify and Object.entries
export const LogNodeKey: unique symbol = Symbol('node');

export type LogObjectWithNode = LogObject & {
    [LogNodeKey]: string;
};

// The POST /logs/query response: each node's entries, keyed by node name
export type LogsByNode = Record<string, LogObject[]>;

export type LogFilter = {
    serverNames: LogServerNames;
    logLevels: LogLevels;
    dateFrom: LogDateFrom;
    dateTo: LogDateTo;

    // Matched case-insensitively against every field except level and timestamp
    search?: string;
};

export type LogFilterQuery = {
    server_names: LogServerNames;
    log_levels: LogLevels;
    date_from: LogDateFrom;
    date_to: LogDateTo;
    search?: string;
};

export type AdminState = {
    logs: LogsByNode;
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
    accessControlPolicies: IDMappedObjects<AccessControlPolicy>;
    channelsForAccessControlPolicy: Record<string, string[]>;
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
    TOTAL_IHOOKS?: number;
    TOTAL_OHOOKS?: number;
    TOTAL_COMMANDS?: number;
    TOTAL_SESSIONS?: number;
    REGISTERED_USERS?: number;
    TOTAL_FILE_COUNT?: number;
    TOTAL_FILE_SIZE?: number;
    SINGLE_CHANNEL_GUESTS?: number;
};

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
};

export enum AnalyticsVisualizationType {
    Count = 'count',
    LineChart = 'line_chart',
    DoughnutChart = 'doughnut_chart',
}

export type PluginAnalyticsRow = {
    id: string;
    name: React.ReactNode;
    icon?: string;
    value: any;
    visualizationType?: AnalyticsVisualizationType;
};

export type SchemaMigration = {
    version: number;
    name: string;
};

export type SupportPacketContent = {
    id: string;
    translation_id?: string;
    label: string;
    selected: boolean;
    mandatory: boolean;
};

export type LdapSampleEntry = {
    dn: string;
    username?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    id?: string;
    display_name?: string;
    available_attributes?: Record<string, string>;
};

export type LdapDiagnosticResult = {
    test_name: string;
    test_value: string;
    total_count: number;
    entries_with_value: number;
    message?: string;
    error?: string;
    sample_results: LdapSampleEntry[];
};

export type TestLdapFiltersResponse = LdapDiagnosticResult[];
