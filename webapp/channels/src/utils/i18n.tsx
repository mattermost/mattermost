// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useIntl, type IntlShape, type MessageDescriptor} from 'react-intl';

export function isMessageDescriptor(descriptor: unknown): descriptor is MessageDescriptor {
    return Boolean(descriptor && (descriptor as MessageDescriptor).id);
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

let globalIntlManaged = false;
let globalIntl: IntlShape;

/**
 * Returns a global intl object which can be used to translate things outside of a React context.
 *
 * This should only be used when React Intl's FormattedMessage and useIntl cannot be used.
 */
export function getGlobalIntl() {
    return globalIntl;
}

/**
 * GlobalIntlManager is a component that ensures that the Intl singleton in utils/i18n is set and updated correctly.
 */
export default function GlobalIntlManager() {
    const intl = useIntl();

    useEffect(() => {
        if (globalIntlManaged) {
            throw new Error('Multiple instances of GlobalIntlManager are mounted when only one should be at a time');
        }

        globalIntlManaged = true;

        return () => {
            globalIntlManaged = false;
        };
    });

    useEffect(() => {
        setGlobalIntl(intl);
    }, [intl]);

    return null;
}

export function setGlobalIntl(intl: IntlShape) {
    globalIntl = intl;
}
