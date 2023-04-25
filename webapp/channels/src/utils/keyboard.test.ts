// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Keyboard from './keyboard';

describe('isKeyPressed', () => {
    test('Key match is used over keyCode if it exists', () => {
        for (const data of [
            {
                event: new KeyboardEvent('keydown', {key: '/', keyCode: 55}),
                key: ['/', 191],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'ù', keyCode: 191}),
                key: ['/', 191],
                valid: true,
            },
        ]) {
            expect(Keyboard.isKeyPressed(data.event, data.key as [string, number])).toEqual(data.valid);
        }
    });

    test('Key match works for both uppercase and lower case', () => {
        for (const data of [
            {
                event: new KeyboardEvent('keydown', {key: 'A', keyCode: 65, code: 'KeyA'}),
                key: ['a', 65],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'a', keyCode: 65, code: 'KeyA'}),
                key: ['a', 65],
                valid: true,
            },
        ]) {
            expect(Keyboard.isKeyPressed(data.event, data.key as [string, number])).toEqual(data.valid);
        }
    });

    test('KeyCode is used for dead letter keys', () => {
        for (const data of [
            {
                event: new KeyboardEvent('keydown', {key: 'Dead', keyCode: 222}),
                key: ['', 222],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'Dead', keyCode: 222}),
                key: ['not-used-field', 222],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'Dead', keyCode: 222}),
                key: [null, 222],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'Dead', keyCode: 222}),
                key: [null, 223],
                valid: false,
            },
        ]) {
            expect(Keyboard.isKeyPressed(data.event, data.key as [string, number])).toEqual(data.valid);
        }
    });

    test('KeyCode is used for unidentified keys', () => {
        for (const data of [
            {
                event: new KeyboardEvent('keydown', {key: 'Unidentified', keyCode: 2220, code: 'Unidentified'}),
                key: ['', 2220],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'Unidentified', keyCode: 2220, code: 'Unidentified'}),
                key: ['not-used-field', 2220],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'Unidentified', keyCode: 2220, code: 'Unidentified'}),
                key: [null, 2220],
                valid: true,
            },
            {
                event: new KeyboardEvent('keydown', {key: 'Unidentified', keyCode: 2220, code: 'Unidentified'}),
                key: [null, 2221],
                valid: false,
            },
        ]) {
            expect(Keyboard.isKeyPressed(data.event, data.key as [string, number])).toEqual(data.valid);
        }
    });

    test('KeyCode is used for undefined keys', () => {
        for (const data of [
            {
                event: {keyCode: 2221},
                key: ['', 2221],
                valid: true,
            },
            {
                event: {keyCode: 2221},
                key: ['not-used-field', 2221],
                valid: true,
            },
            {
                event: {keyCode: 2221},
                key: [null, 2221],
                valid: true,
            },
            {
                event: {keyCode: 2221},
                key: [null, 2222],
                valid: false,
            },
        ]) {
            expect(Keyboard.isKeyPressed(data.event as KeyboardEvent, data.key as [string, number])).toEqual(data.valid);
        }
    });

    test('keyCode is used for determining if it exists', () => {
        for (const data of [
            {
                event: {key: 'a', keyCode: 65},
                key: ['k', 65],
                valid: true,
            },
            {
                event: {key: 'b', keyCode: 66},
                key: ['y', 66],
                valid: true,
            },
        ]) {
            expect(Keyboard.isKeyPressed(data.event as KeyboardEvent, data.key as [string, number])).toEqual(data.valid);
        }
    });

    test('key should be tested as fallback for different layout of english keyboards', () => {
        //key will be k for keyboards like dvorak but code will be keyV as `v` is pressed
        const event = {key: 'k', code: 'KeyV'};
        const key: [string, number] = ['k', 2221];
        expect(Keyboard.isKeyPressed(event as KeyboardEvent, key)).toEqual(true);
    });
});
