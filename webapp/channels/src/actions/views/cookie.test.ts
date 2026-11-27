// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {clearUserCookie} from './cookie';

describe('clearUserCookie', () => {
    const names = ['MMUSERID', 'MMCSRF', 'MMLOGINMETHOD'];

    afterEach(() => {
        for (const name of names) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
        }
    });

    test.each(names)('removes the %s cookie', (name) => {
        document.cookie = `${name}=value;path=/`;
        expect(document.cookie).toContain(`${name}=value`);

        clearUserCookie();

        expect(document.cookie).not.toContain(`${name}=`);
    });
});
