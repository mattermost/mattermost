// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type CompleteOnboardingRequest = {
    organization: string;
    role?: string;
    install_plugins: string[];
}
