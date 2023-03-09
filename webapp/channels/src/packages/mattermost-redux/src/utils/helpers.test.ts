// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isMinimumServerVersion, isEmail} from 'mattermost-redux/utils/helpers';

describe('Helpers', () => {
    it('isMinimumServerVersion', () => {
        expect(isMinimumServerVersion('1.0.0', 1, 0, 0)).toBeTruthy();
        expect(isMinimumServerVersion('1.1.1', 1, 1, 1)).toBeTruthy();
        expect(!isMinimumServerVersion('1.0.0', 2, 0, 0)).toBeTruthy();
        expect(isMinimumServerVersion('4.6', 2, 0, 0)).toBeTruthy();
        expect(!isMinimumServerVersion('4.6', 4, 7, 0)).toBeTruthy();
        expect(isMinimumServerVersion('4.6.1', 2, 0, 0)).toBeTruthy();
        expect(isMinimumServerVersion('4.7.1', 4, 6, 2)).toBeTruthy();
        expect(!isMinimumServerVersion('4.6.1', 4, 6, 2)).toBeTruthy();
        expect(!isMinimumServerVersion('3.6.1', 4, 6, 2)).toBeTruthy();
        expect(isMinimumServerVersion('4.6.1', 3, 7, 2)).toBeTruthy();
        expect(isMinimumServerVersion('5', 4, 6, 2)).toBeTruthy();
        expect(isMinimumServerVersion('5', 5)).toBeTruthy();
        expect(isMinimumServerVersion('5.1', 5)).toBeTruthy();
        expect(isMinimumServerVersion('5.1', 5, 1)).toBeTruthy();
        expect(!isMinimumServerVersion('5.1', 5, 2)).toBeTruthy();
        expect(isMinimumServerVersion('5.1.0', 5)).toBeTruthy();
        expect(isMinimumServerVersion('5.1.1', 5, 1, 1)).toBeTruthy();
        expect(!isMinimumServerVersion('5.1.1', 5, 1, 2)).toBeTruthy();
        expect(isMinimumServerVersion('4.6.2.sakjdgaksfg', 4, 6, 2)).toBeTruthy();
        expect(!isMinimumServerVersion('')).toBeTruthy();
    });
});

describe('Utils.isEmail', () => {
    it('', () => {
        for (const data of [
            {
                email: 'prettyandsimple@example.com',
                valid: true,
            },
            {
                email: 'very.common@example.com',
                valid: true,
            },
            {
                email: 'disposable.style.email.with+symbol@example.com',
                valid: true,
            },
            {
                email: 'other.email-with-dash@example.com',
                valid: true,
            },
            {
                email: 'fully-qualified-domain@example.com',
                valid: true,
            },
            {
                email: 'user.name+tag+sorting@example.com',
                valid: true,
            },
            {
                email: 'x@example.com',
                valid: true,
            },
            {
                email: 'example-indeed@strange-example.com',
                valid: true,
            },
            {
                email: 'admin@mailserver1',
                valid: true,
            },
            {
                email: '#!$%&\'*+-/=?^_`{}|~@example.org',
                valid: true,
            },
            {
                email: 'example@s.solutions',
                valid: true,
            },
            {
                email: 'Abc.example.com',
                valid: false,
            },
            {
                email: 'A@b@c@example.com',
                valid: false,
            },
            {
                email: '<testing> test.email@example.com',
                valid: false,
            },
            {
                email: 'test <test@address.do>',
                valid: false,
            },
            {
                email: 'comma@domain.com, separated@domain.com',
                valid: false,
            },
            {
                email: 'comma@domain.com,separated@domain.com',
                valid: false,
            },
        ]) {
            expect(isEmail(data.email)).toBe(data.valid);
        }
    });
});
