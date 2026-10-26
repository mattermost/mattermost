// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BotCreateWarnings} from './bot_create_warnings';
import {
    BOT_CREATE_WARNINGS_PARAM,
    hasBotCreateWarnings,
    parseBotCreateWarnings,
    serializeBotCreateWarnings,
    stripBotCreateWarningsParam,
} from './bot_create_warnings';

const CONFIRM_SEARCH = '?type=bots&id=abc123&token=tok456';

describe('bot_create_warnings', () => {
    test('uses bot_warnings as the query param name', () => {
        expect(BOT_CREATE_WARNINGS_PARAM).toBe('bot_warnings');
    });

    describe('serializeBotCreateWarnings', () => {
        test('returns undefined when no warnings are set', () => {
            expect(serializeBotCreateWarnings({})).toBeUndefined();
            expect(serializeBotCreateWarnings({tokenFailed: false, rolesFailed: false, attributesFailed: false})).toBeUndefined();
        });

        test.each([
            [{tokenFailed: true}, 'token'],
            [{rolesFailed: true}, 'roles'],
            [{attributesFailed: true}, 'attributes'],
            [{imageFailed: true}, 'image'],
            [{attributesFailed: true, tokenFailed: true}, 'token,attributes'],
            [{attributesFailed: true, rolesFailed: true, imageFailed: true, tokenFailed: true}, 'token,image,roles,attributes'],
            [{attributesFailed: true, rolesFailed: true}, 'roles,attributes'],
            [{attributesFailed: true, rolesFailed: true, tokenFailed: true}, 'token,roles,attributes'],
            [{tokenFailed: true, rolesFailed: false, attributesFailed: true}, 'token,attributes'],
        ])('serializes %p as %p in fixed order', (warnings: BotCreateWarnings, expected: string) => {
            expect(serializeBotCreateWarnings(warnings)).toBe(expected);
        });
    });

    describe('hasBotCreateWarnings', () => {
        test.each([
            [undefined],
            [{}],
            [{tokenFailed: false, rolesFailed: false, attributesFailed: false}],
        ])('returns false for %p', (warnings?: BotCreateWarnings) => {
            expect(hasBotCreateWarnings(warnings)).toBe(false);
        });

        test.each([
            [{tokenFailed: true}],
            [{rolesFailed: true}],
            [{attributesFailed: true}],
            [{imageFailed: true}],
            [{tokenFailed: false, rolesFailed: false, attributesFailed: true}],
        ])('returns true for %p', (warnings: BotCreateWarnings) => {
            expect(hasBotCreateWarnings(warnings)).toBe(true);
        });
    });

    describe('parseBotCreateWarnings', () => {
        test.each([
            [''],
            ['?'],
            ['?bot_warnings='],
            ['?bot_warnings'],
            ['?bot_warnings=,,'],
        ])('returns undefined for empty input %p', (search: string) => {
            expect(parseBotCreateWarnings(search)).toBeUndefined();
        });

        test('returns undefined when the param is absent, including on the confirm page', () => {
            expect(parseBotCreateWarnings('?a=1&b=2')).toBeUndefined();
            expect(parseBotCreateWarnings(CONFIRM_SEARCH)).toBeUndefined();
        });

        test('ignores unknown tokens', () => {
            expect(parseBotCreateWarnings('?bot_warnings=foo,bar')).toBeUndefined();
            expect(parseBotCreateWarnings('?bot_warnings=foo,roles,bar')).toEqual({rolesFailed: true});
        });

        test('is case-sensitive', () => {
            expect(parseBotCreateWarnings('?bot_warnings=TOKEN,Roles')).toBeUndefined();
        });

        test('collapses duplicate tokens', () => {
            expect(parseBotCreateWarnings('?bot_warnings=roles,roles,roles')).toEqual({rolesFailed: true});
        });

        test('unions repeated params', () => {
            expect(parseBotCreateWarnings('?bot_warnings=token&bot_warnings=attributes')).toEqual({tokenFailed: true, attributesFailed: true});
        });

        test('decodes URL-encoded commas', () => {
            expect(parseBotCreateWarnings('?bot_warnings=token%2Croles')).toEqual({tokenFailed: true, rolesFailed: true});
            expect(parseBotCreateWarnings('?bot_warnings=token%2croles')).toEqual({tokenFailed: true, rolesFailed: true});
        });

        test('trims whitespace and skips empty tokens', () => {
            expect(parseBotCreateWarnings('?bot_warnings=%20roles%20,,attributes')).toEqual({rolesFailed: true, attributesFailed: true});
            expect(parseBotCreateWarnings('?bot_warnings=roles+')).toEqual({rolesFailed: true});
        });

        test('accepts input without a leading question mark', () => {
            expect(parseBotCreateWarnings('bot_warnings=roles')).toEqual({rolesFailed: true});
        });

        test('matches a percent-encoded param name', () => {
            expect(parseBotCreateWarnings('?bot%5Fwarnings=roles')).toEqual({rolesFailed: true});
        });

        test('parses warnings alongside the confirm page params', () => {
            expect(parseBotCreateWarnings(`${CONFIRM_SEARCH}&bot_warnings=attributes,roles,token`)).toEqual({tokenFailed: true, rolesFailed: true, attributesFailed: true});
        });
    });

    describe('round trip', () => {
        test.each([
            [{tokenFailed: true}],
            [{rolesFailed: true}],
            [{attributesFailed: true}],
            [{tokenFailed: true, rolesFailed: true}],
            [{tokenFailed: true, attributesFailed: true}],
            [{rolesFailed: true, attributesFailed: true}],
            [{tokenFailed: true, rolesFailed: true, attributesFailed: true}],
            [{tokenFailed: true, imageFailed: true, rolesFailed: true, attributesFailed: true}],
        ])('parse(serialize(%p)) returns the same warnings', (warnings: BotCreateWarnings) => {
            const value = serializeBotCreateWarnings(warnings)!;

            expect(parseBotCreateWarnings(`?${BOT_CREATE_WARNINGS_PARAM}=${value}`)).toEqual(warnings);
            expect(parseBotCreateWarnings(`?${BOT_CREATE_WARNINGS_PARAM}=${encodeURIComponent(value)}`)).toEqual(warnings);
            expect(parseBotCreateWarnings(`${CONFIRM_SEARCH}&${BOT_CREATE_WARNINGS_PARAM}=${value}`)).toEqual(warnings);
        });

        test('removing the param after appending restores the original search', () => {
            const value = serializeBotCreateWarnings({tokenFailed: true, attributesFailed: true});

            expect(stripBotCreateWarningsParam(`${CONFIRM_SEARCH}&${BOT_CREATE_WARNINGS_PARAM}=${value}`)).toBe(CONFIRM_SEARCH);
        });
    });

    describe('stripBotCreateWarningsParam', () => {
        test.each([
            [''],
            ['?'],
            [CONFIRM_SEARCH],
            ['?bot_warnings_extra=1&xbot_warnings=2'],
        ])('returns undefined when the param is absent from %p', (search: string) => {
            expect(stripBotCreateWarningsParam(search)).toBeUndefined();
        });

        test.each([
            ['?bot_warnings=roles'],
            ['bot_warnings=roles'],
            ['?bot_warnings'],
        ])('returns an empty search for %p', (search: string) => {
            expect(stripBotCreateWarningsParam(search)).toBe('');
        });

        test('keeps the confirm page params and their order', () => {
            expect(stripBotCreateWarningsParam(`${CONFIRM_SEARCH}&bot_warnings=token,roles`)).toBe(CONFIRM_SEARCH);
            expect(stripBotCreateWarningsParam('?bot_warnings=roles&type=bots&id=abc123&token=tok456')).toBe(CONFIRM_SEARCH);
        });

        test('removes every occurrence, including a percent-encoded name', () => {
            expect(stripBotCreateWarningsParam('?bot_warnings=token&a=1&bot%5Fwarnings=roles')).toBe('?a=1');
        });

        test('keeps encoded values of other params', () => {
            expect(stripBotCreateWarningsParam('?next=%2Fteam%2Fchannels%3Fx%3D1&q=a+b&bot_warnings=roles')).toBe('?next=%2Fteam%2Fchannels%3Fx%3D1&q=a+b');
        });

        test('does not throw on malformed percent encoding', () => {
            expect(() => stripBotCreateWarningsParam('?%E0%A4%A=1&bot_warnings=roles')).not.toThrow();
        });
    });
});
