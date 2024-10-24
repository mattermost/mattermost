// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface TelemetryHandler {
    trackEvent: (userId: string, userRoles: string, category: string, event: string, props?: Record<string, unknown>) => void;
    trackFeatureEvent: (userId: string, userRoles: string, featureName: string, event: string, props?: Record<string, unknown>) => void;
    pageVisited: (userId: string, userRoles: string, category: string, name: string) => void;
}
