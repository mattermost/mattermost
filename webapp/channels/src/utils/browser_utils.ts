// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Wrapper for window.location.reload to make it mockable in tests.
 */
export function reloadPage(): void {
    window.location.reload();
}
