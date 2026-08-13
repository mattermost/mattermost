// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Convert snake_case or camelCase attribute keys to Title Case with spaces
 * (e.g. "user_role" → "User Role"). Splits camelCase on word boundaries only:
 * lowercase→uppercase and acronym runs followed by a capitalized word, so
 * acronyms like "ABACPolicy" or "userID" are not split per letter.
 * trim() removes accidental leading/trailing spaces from replacements.
 */
export function formatAttributeName(name: string): string {
    return name.
        replace(/_/g, ' ').
        replace(/([a-z])([A-Z])/g, '$1 $2').
        replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').
        replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()).
        trim();
}
