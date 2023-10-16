// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Audit} from './audits';
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
