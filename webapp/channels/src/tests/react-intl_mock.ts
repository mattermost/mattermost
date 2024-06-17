// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createIntl} from 'react-intl';

import enMessages from 'i18n/en.json';
import {setGlobalIntl} from 'utils/i18n';

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
        useIntl: jest.fn(() => {
            return intl;
        }),
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

setGlobalIntl(createTestIntl());

export default {};
