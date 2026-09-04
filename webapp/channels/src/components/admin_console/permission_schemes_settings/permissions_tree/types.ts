// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientConfig, ClientLicense} from '@mattermost/types/config';

export type Permissions = Array<string | Group | Permission>;

export type Permission = {
    id: string;
    combined?: boolean;
    permissions: string[];
};
export type Group = {
    id: string;
    permissions: Array<Permission | string>;
    isVisible?: (license?: ClientLicense, config?: Partial<ClientConfig>) => boolean;
};

export type AdditionalValues = Record<string, Record<string, any>>;
