// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import enMessages from 'i18n/en.json';

jest.mock('react-intl', function() {
    const reactIntl = jest.requireActual('react-intl');

    const intl = reactIntl.createIntl({
        locale: 'en',
        messages: require('i18n/en.json'),
        defaultLocale: 'en',
        timeZone: 'Etc/UTC',
        textComponent: 'span',
    });

    return {
        ...reactIntl,
        useIntl() {
            return intl;
        },
    };
});

export function createTestIntl() {
    return createIntl({
        locale: 'en',
        messages: enMessages,
        defaultLocale: 'en',
        timeZone: 'Etc/UTC',
        textComponent: 'span',
    });
}

export default {};
