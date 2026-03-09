// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { HandlerArgs } from "../lib/types";

export function ping({ res, meta }: HandlerArgs): void {
    res.json({
        message: "I'm alive!",
        services: meta.listServices?.() ?? [],
    });
}
