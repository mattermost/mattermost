// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BurnOnReadReadReceipt} from '@mattermost/types/burn_on_read_read_receipts';

import type {GlobalState} from 'types/store';

/**
 * Returns the read receipt data for a specific burn-on-read post.
 * Contains total recipients and how many have revealed the message.
 */
export function getBurnOnReadReadReceipt(state: GlobalState, postId: string): BurnOnReadReadReceipt | null {
    return state.entities.burnOnReadReadReceipts[postId] || null;
}

/**
 * Returns the number of recipients who have revealed a burn-on-read post.
 * Returns 0 if no read receipt data exists.
 */
export function getBurnOnReadRevealedCount(state: GlobalState, postId: string): number {
    const receipt = getBurnOnReadReadReceipt(state, postId);
    return receipt?.revealedCount || 0;
}

/**
 * Returns the total number of recipients for a burn-on-read post.
 * Returns 0 if no read receipt data exists.
 */
export function getBurnOnReadTotalRecipients(state: GlobalState, postId: string): number {
    const receipt = getBurnOnReadReadReceipt(state, postId);
    return receipt?.totalRecipients || 0;
}
