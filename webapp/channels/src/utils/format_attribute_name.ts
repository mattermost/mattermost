// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Convert snake_case or camelCase attribute keys to Title Case with spaces
 * (e.g. "user_role" → "User Role").
 * trim() removes the leading space inserted when the input starts with an
 * uppercase letter (e.g. "Program" → " Program").
 */
export function formatAttributeName(name: string): string {
    return name.
        replace(/_/g, ' ').
        replace(/([A-Z])/g, ' $1').
        replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()).
        trim();
}
