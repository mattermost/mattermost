// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MessageDescriptor} from 'react-intl';

export function getMonthLong(locale: string): 'short' | 'long' {
    if (locale === 'ko') {
        // Long and short are equivalent in Korean except long has a bug on IE11/Windows 7
        return 'short';
    }

    return 'long';
}

/**
 * @deprecated Use react-intl methods such as formatMessage, FormattedMessage, defineMessage, defineMessages.
 */
export function t(v: string): string {
    return v;
}

function toKeys(this: MessageDescriptor, id: string, defaultMessage: string, description = 'description') {
    return {[id]: this.id, [defaultMessage]: this.defaultMessage, ...this.description ? {[description]: this.description} : null};
}

export function defineMessage(msg: MessageDescriptor): MessageDescriptor & {toKeys: typeof toKeys} {
    return {
        ...msg,
        toKeys,
    };
}

export interface Message extends MessageDescriptor {
    values?: Record<string, any>;
}

