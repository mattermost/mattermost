// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientConfig, ClientLicense, WarnMetricStatus} from './config';

export type GeneralState = {
    config: Partial<ClientConfig>;
    dataRetentionPolicy: any;
    firstAdminVisitMarketplaceStatus: boolean;
    firstAdminCompleteSetup: boolean;
    license: ClientLicense;
    serverVersion: string;
    warnMetricsStatus: Record<string, WarnMetricStatus>;
};

export type SystemSetting = {
    name: string;
    value: string;
};
