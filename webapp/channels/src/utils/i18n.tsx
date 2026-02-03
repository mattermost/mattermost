// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, createIntl, createIntlCache, type IntlShape, type MessageDescriptor} from 'react-intl';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';
import store from 'stores/redux_store';

const cache = createIntlCache();

// Stores the intl instance from IntlProvider for reuse
let intlInstance: IntlShape | null = null;

/**
 * Sets the intl instance from IntlProvider.
 * This allows getIntl() to return the same instance that React components use.
 */
export function setIntl(intl: IntlShape): void {
    intlInstance = intl;
}

/**
 * Returns the IntlShape instance for the current locale.
 * Prefer `useIntl` and `FormattedMessage` and only use this selectively when
 * outside of React components.
 *
 * This returns the same instance that IntlProvider creates, ensuring consistency
 * and avoiding duplicate translation loading.
 */
export function getIntl(): IntlShape {
    // Return the IntlProvider's instance if available (normal case)
    if (intlInstance) {
        return intlInstance;
    }

    // Fallback: create an instance if IntlProvider hasn't mounted yet
    // This can happen during early initialization or in tests
    const state = store.getState();
    const locale = getCurrentLocale(state);

    return createIntl({
        locale,
        messages: getTranslations(state, locale),
    }, cache);
}

export function isMessageDescriptor(descriptor: unknown): descriptor is MessageDescriptor {
    return Boolean(descriptor && (descriptor as MessageDescriptor).id);
}

export function formatAsString(formatMessage: IntlShape['formatMessage'], messageOrDescriptor: string | MessageDescriptor | undefined): string | undefined {
    if (!messageOrDescriptor) {
        return undefined;
    }

    if (isMessageDescriptor(messageOrDescriptor)) {
        return formatMessage(messageOrDescriptor);
    }

    return messageOrDescriptor;
}

export function formatAsComponent(messageOrComponent: React.ReactNode | MessageDescriptor): React.ReactNode {
    if (isMessageDescriptor(messageOrComponent)) {
        return <FormattedMessage {...messageOrComponent}/>;
    }

    return messageOrComponent;
}

export function getMonthLong(locale: string): 'short' | 'long' {
    if (locale === 'ko') {
        // Long and short are equivalent in Korean except long has a bug on IE11/Windows 7
        return 'short';
    }

    return 'long';
}

export interface Message {
    id: string;
    defaultMessage: string;
    values?: Record<string, any>;
}
