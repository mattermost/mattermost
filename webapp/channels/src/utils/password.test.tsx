// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isValidPassword} from './password';

describe('isValidPassword', () => {
    test('Minimum length enforced', () => {
        for (const data of [
            {
                password: 'tooshort',
                config: {
                    minimumLength: 10,
                    requireLowercase: false,
                    requireUppercase: false,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: false,
            },
            {
                password: 'longenoughpassword',
                config: {
                    minimumLength: 10,
                    requireLowercase: false,
                    requireUppercase: false,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: true,
            },
        ]) {
            const {valid} = isValidPassword(data.password, data.config);
            expect(data.valid).toEqual(valid);
        }
    });

    test('Maximum length enforced', () => {
        for (const data of [
            {
                password: 'justright',
                config: {
                    minimumLength: 8,
                    requireLowercase: false,
                    requireUppercase: false,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: true,
            },
            {
                password: 'iamaverylongstringthathas72charactersandwillpasswithoutanyissuesthiscall',
                config: {
                    minimumLength: 8,
                    requireLowercase: false,
                    requireUppercase: false,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: true,
            },
            {
                password: 'iamaverylongstringthathas73charactersandwontpassthisvalidationatall!!!:-(',
                config: {
                    minimumLength: 8,
                    requireLowercase: false,
                    requireUppercase: false,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: false,
            },
        ]) {
            const {valid} = isValidPassword(data.password, data.config);
            expect(data.valid).toEqual(valid);
        }
    });

    test('Require lowercase enforced', () => {
        for (const data of [
            {
                password: 'UPPERCASE',
                config: {
                    minimumLength: 5,
                    requireLowercase: true,
                    requireUppercase: false,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: false,
            },
            {
                password: 'SOMELowercase',
                config: {
                    minimumLength: 5,
                    requireLowercase: true,
                    requireUppercase: false,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: true,
            },
        ]) {
            const {valid} = isValidPassword(data.password, data.config);
            expect(data.valid).toEqual(valid);
        }
    });

    test('Require uppercase enforced', () => {
        for (const data of [
            {
                password: 'lowercase',
                config: {
                    minimumLength: 5,
                    requireLowercase: false,
                    requireUppercase: true,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: false,
            },
            {
                password: 'SOMEUppercase',
                config: {
                    minimumLength: 5,
                    requireLowercase: false,
                    requireUppercase: true,
                    requireNumber: false,
                    requireSymbol: false,
                },
                valid: true,
            },
        ]) {
            const {valid} = isValidPassword(data.password, data.config);
            expect(data.valid).toEqual(valid);
        }
    });

    test('Require number enforced', () => {
        for (const data of [
            {
                password: 'NoNumbers',
                config: {
                    minimumLength: 5,
                    requireLowercase: true,
                    requireUppercase: true,
                    requireNumber: true,
                    requireSymbol: false,
                },
                valid: false,
            },
            {
                password: 'S0m3Numb3rs',
                config: {
                    minimumLength: 5,
                    requireLowercase: true,
                    requireUppercase: true,
                    requireNumber: true,
                    requireSymbol: false,
                },
                valid: true,
            },
        ]) {
            const {valid} = isValidPassword(data.password, data.config);
            expect(data.valid).toEqual(valid);
        }
    });

    test('Require symbol enforced', () => {
        for (const data of [
            {
                password: 'N0Symb0ls',
                config: {
                    minimumLength: 5,
                    requireLowercase: true,
                    requireUppercase: true,
                    requireNumber: true,
                    requireSymbol: true,
                },
                valid: false,
            },
            {
                password: 'S0m3Symb0!s',
                config: {
                    minimumLength: 5,
                    requireLowercase: true,
                    requireUppercase: true,
                    requireNumber: true,
                    requireSymbol: true,
                },
                valid: true,
            },
        ]) {
            const {valid} = isValidPassword(data.password, data.config);
            expect(data.valid).toEqual(valid);
        }
    });
});
