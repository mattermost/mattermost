// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { ServerContext } from "./types";

export function createContext(): ServerContext {
    return {
        baseUrl: null,
        webhookBaseUrl: null,
        adminUsername: null,
        adminPassword: null,
    };
}
