// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { HandlerArgs } from "../lib/types";

export function messageMenu({ body, res }: HandlerArgs): void {
    let responseData = {};

    if (body?.context?.action === "do_something") {
        responseData = {
            ephemeral_text: `Ephemeral | ${body.type} ${body.data_source} option: ${body.context.selected_option}`,
        };
    }

    res.json(responseData);
}
