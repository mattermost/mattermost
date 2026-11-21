// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Result of a gate that could not run. A blocked gate is never a pass. */
export function blocked(blockedReason, evidence) {
    return {result: 'blocked', blocked_reason: blockedReason, evidence};
}
