// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {vi} from 'vitest';

vi.mock('react-intl', async () => {
    const reactIntl = await vi.importActual<typeof import('react-intl')>('react-intl');
    const enMessages = await import('i18n/en.json');

    const intl = reactIntl.createIntl({
        locale: 'en',
        messages: enMessages.default || enMessages,
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
