// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {AnalyticsRow} from '@mattermost/types/admin';
import {Channel} from '@mattermost/types/channels';

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
        analytics?: Record<string, number | AnalyticsRow[]>,
        currentChannel?: Channel,
    ): boolean;
}
