// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

jest.mock('react-intl', function() {
    const reactIntl = jest.requireActual('react-intl');

    const intl = reactIntl.createIntl({
        locale: 'en',
        messages: {},
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

export default {};
