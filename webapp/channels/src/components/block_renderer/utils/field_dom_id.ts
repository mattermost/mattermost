// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** DOM id for an mm_blocks field control; scoped by post so labels stay unique across the channel. */
export function mmBlocksFieldDomId(postId: string, fieldName: string): string {
    return `mm-blocks-${postId}-${fieldName}`;
}

/** DOM id for a field error region; scoped by post like {@link mmBlocksFieldDomId}. */
export function mmBlocksFieldErrorId(postId: string, fieldName: string): string {
    return `mm-blocks-${postId}-${fieldName}-error`;
}
