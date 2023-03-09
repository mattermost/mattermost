// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface TelemetryHandler {
    trackEvent: (userId: string, userRoles: string, category: string, event: string, props?: any) => void;
    pageVisited: (userId: string, userRoles: string, category: string, name: string) => void;
}
