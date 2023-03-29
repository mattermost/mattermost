// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const generateTelemetryTag = (category: string, name: string, suffix: string) => {
    return `${category}--${name}--${suffix}`;
};

export function getAnalyticsCategory(isAdmin: boolean) {
    return isAdmin ? 'admin_onboarding' : 'end_user_onboarding';
}
