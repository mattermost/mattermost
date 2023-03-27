// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getMonthLong(locale: string): 'short' | 'long' {
    if (locale === 'ko') {
        // Long and short are equivalent in Korean except long has a bug on IE11/Windows 7
        return 'short';
    }

    return 'long';
}

export function t(v: string): string {
    return v;
}

export interface Message {
    id: string;
    defaultMessage: string;
    values?: Record<string, any>;
}
