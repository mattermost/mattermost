// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {setLocalizeFunction, localizeMessage} from 'mattermost-redux/utils/i18n_utils';

describe('i18n utils', () => {
    afterEach(() => {
        setLocalizeFunction(null as any);
    });

    it('should return default message', () => {
        expect(localizeMessage('someting.string', 'defaultString')).toBe('defaultString');
    });

    it('should return previously set Localized function return value', () => {
        function mockFunc() {
            return 'test';
        }

        setLocalizeFunction(mockFunc);
        expect(localizeMessage('someting.string', 'defaultString')).toBe('test');
    });
});
