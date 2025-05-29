// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientConfig, ClientLicense} from './config';
import type {UserPropertyField} from './properties';
import type {IDMappedObjects} from './utilities';

export type GeneralState = {
    config: Partial<ClientConfig>;
    firstAdminVisitMarketplaceStatus: boolean;
    firstAdminCompleteSetup: boolean;
    license: ClientLicense;
    serverVersion: string;
    customProfileAttributes: IDMappedObjects<UserPropertyField>;
};

export type SystemSetting = {
    name: string;
    value: string;
};
