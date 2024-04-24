// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import type {AnalyticsState} from '@mattermost/types/admin';
import type {Channel} from '@mattermost/types/channels';

export type Notice = {
    name: string;
    adminOnly?: boolean;
    title: React.ReactNode;
    icon?: React.ReactNode;
    body: React.ReactNode;
    allowForget: boolean;
    show?(
        serverVersion: string,
        config: any,
        license: any,
        analytics?: AnalyticsState,
        currentChannel?: Channel,
    ): boolean;
}
