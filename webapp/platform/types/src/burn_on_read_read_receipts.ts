// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface BurnOnReadReadReceipt {
    postId: string;
    totalRecipients: number;
    revealedCount: number;
    lastUpdated: number;
}

export type BurnOnReadReadReceiptsState = Record<string, BurnOnReadReadReceipt>;
