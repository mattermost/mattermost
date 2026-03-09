// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { HandlerArgs } from "../lib/types";

export function setup({ body, context, res }: HandlerArgs): void {
    context.baseUrl = body?.baseUrl;
    context.webhookBaseUrl = body?.webhookBaseUrl;
    context.adminUsername = body?.adminUsername;
    context.adminPassword = body?.adminPassword;

    res.status(201).send("Successfully setup the new base URLs and credential.");
}
