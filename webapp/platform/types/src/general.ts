// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {CustomAttribute} from './admin';
import type {ClientConfig, ClientLicense} from './config';

export type GeneralState = {
    config: Partial<ClientConfig>;
    firstAdminVisitMarketplaceStatus: boolean;
    firstAdminCompleteSetup: boolean;
    license: ClientLicense;
    serverVersion: string;
    customProfileAttributes: CustomAttribute[];
};

export type SystemSetting = {
    name: string;
    value: string;
};
