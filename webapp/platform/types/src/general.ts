// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientConfig, ClientLicense} from './config';
import type {PropertyField} from './properties';

export type GeneralState = {
    config: Partial<ClientConfig>;
    firstAdminVisitMarketplaceStatus: boolean;
    firstAdminCompleteSetup: boolean;
    license: ClientLicense;
    serverVersion: string;
    customProfileAttributes: PropertyField[];
};

export type SystemSetting = {
    name: string;
    value: string;
};
