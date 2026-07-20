// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactElement} from 'react';
import {
    createIntl,
    IntlProvider,
} from 'react-intl';
import type {IntlShape} from 'react-intl';

import defaultMessages from 'i18n/en.json';

export const defaultIntl = createIntl({
    locale: 'en',
    defaultLocale: 'en',
    timeZone: 'Etc/UTC',
    messages: defaultMessages,
    textComponent: 'span',
});

// for non-mounted use cases like react-testing-library
export function withIntl(element: ReactElement) {
    return <IntlProvider {...defaultIntl}>{element}</IntlProvider>;
}

export interface MockIntl extends IntlShape {
    formatMessage: jest.Mock;
}
