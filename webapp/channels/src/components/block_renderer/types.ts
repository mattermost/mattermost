// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Optional 4th arg is legacy attachment `cookie` when the block was translated from `props.attachments`. */
export type ActionHandler = (
    actionId: string,
    selectedOption?: string,
    query?: Record<string, string>,
    attachmentCookie?: string,
) => Promise<void>;
