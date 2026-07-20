// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as i18nSelectors from 'selectors/i18n';

import {getIntl} from './i18n';

describe('i18n', () => {
    jest.spyOn(i18nSelectors, 'getTranslations').mockReturnValue({
        test_key: 'expected value',
    });
    jest.spyOn(i18nSelectors, 'getCurrentLocale').mockReturnValue('en');

    it('getIntl.formatMessage should resolve translated string', () => {
        const intl = getIntl();
        const fm = intl.formatMessage; // avoid triggering mmjstool

        const actual = fm({id: 'test_key', defaultMessage: 'not found'});
        expect(actual).toBe('expected value');
    });

    it('getIntl.formatMessage should resolve unknown string to default message', () => {
        const intl = getIntl();
        const fm = intl.formatMessage; // avoid triggering mmjstool

        const actual = fm({id: 'unknown_key', defaultMessage: 'not found'});
        expect(actual).toBe('not found');
    });
});
