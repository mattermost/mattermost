// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GeneralTypes} from 'mattermost-redux/action_types';

import store from 'stores/redux_store.jsx';

import * as lineBreakHelpers from 'tests/helpers/line_break_helpers.js';
import * as ua from 'tests/helpers/user_agent_mocks';
import Constants, {ValidationErrors} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {UserProfile} from '@mattermost/types/users';
import type React from 'react';

describe('Utils.getDisplayNameByUser', () => {
    afterEach(() => {
        store.dispatch({
            type: GeneralTypes.CLIENT_CONFIG_RESET,
            data: {},
        });
    });

    const userA = {username: 'a_user', nickname: 'a_nickname', first_name: 'a_first_name', last_name: ''};
    const userB = {username: 'b_user', nickname: 'b_nickname', first_name: '', last_name: 'b_last_name'};
    const userC = {username: 'c_user', nickname: '', first_name: 'c_first_name', last_name: 'c_last_name'};
    const userD = {username: 'd_user', nickname: 'd_nickname', first_name: 'd_first_name', last_name: 'd_last_name'};
    const userE = {username: 'e_user', nickname: '', first_name: 'e_first_name', last_name: 'e_last_name'};
    const userF = {username: 'f_user', nickname: 'f_nickname', first_name: 'f_first_name', last_name: 'f_last_name'};
    const userG = {username: 'g_user', nickname: '', first_name: 'g_first_name', last_name: 'g_last_name'};
    const userH = {username: 'h_user', nickname: 'h_nickname', first_name: '', last_name: 'h_last_name'};
    const userI = {username: 'i_user', nickname: 'i_nickname', first_name: 'i_first_name', last_name: ''};
    const userJ = {username: 'j_user', nickname: '', first_name: 'j_first_name', last_name: ''};

    test('Show display name of user with TeammateNameDisplay set to username', () => {
        store.dispatch({
            type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
            data: {
                TeammateNameDisplay: 'username',
            },
        });

        [userA, userB, userC, userD, userE, userF, userG, userH, userI, userJ].forEach((user) => {
            expect(Utils.getDisplayNameByUser(store.getState(), user as UserProfile)).toEqual(user.username);
        });
    });

    test('Show display name of user with TeammateNameDisplay set to nickname_full_name', () => {
        store.dispatch({
            type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
            data: {
                TeammateNameDisplay: 'nickname_full_name',
            },
        });

        for (const data of [
            {user: userA, result: userA.nickname},
            {user: userB, result: userB.nickname},
            {user: userC, result: `${userC.first_name} ${userC.last_name}`},
            {user: userD, result: userD.nickname},
            {user: userE, result: `${userE.first_name} ${userE.last_name}`},
            {user: userF, result: userF.nickname},
            {user: userG, result: `${userG.first_name} ${userG.last_name}`},
            {user: userH, result: userH.nickname},
            {user: userI, result: userI.nickname},
            {user: userJ, result: userJ.first_name},
        ]) {
            expect(Utils.getDisplayNameByUser(store.getState(), data.user as UserProfile)).toEqual(data.result);
        }
    });

    test('Show display name of user with TeammateNameDisplay set to username', () => {
        store.dispatch({
            type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
            data: {
                TeammateNameDisplay: 'full_name',
            },
        });

        for (const data of [
            {user: userA, result: userA.first_name},
            {user: userB, result: userB.last_name},
            {user: userC, result: `${userC.first_name} ${userC.last_name}`},
            {user: userD, result: `${userD.first_name} ${userD.last_name}`},
            {user: userE, result: `${userE.first_name} ${userE.last_name}`},
            {user: userF, result: `${userF.first_name} ${userF.last_name}`},
            {user: userG, result: `${userG.first_name} ${userG.last_name}`},
            {user: userH, result: userH.last_name},
            {user: userI, result: userI.first_name},
            {user: userJ, result: userJ.first_name},
        ]) {
            expect(Utils.getDisplayNameByUser(store.getState(), data.user as UserProfile)).toEqual(data.result);
        }
    });
});

describe('Utils.isValidPassword', () => {
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
            const {valid} = Utils.isValidPassword(data.password, data.config);
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
            const {valid} = Utils.isValidPassword(data.password, data.config);
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
            const {valid} = Utils.isValidPassword(data.password, data.config);
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
            const {valid} = Utils.isValidPassword(data.password, data.config);
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
            const {valid} = Utils.isValidPassword(data.password, data.config);
            expect(data.valid).toEqual(valid);
        }
    });
});

describe('Utils.isValidUsername', () => {
    const tests = [
        {
            testUserName: 'sonic.the.hedgehog',
            expectedError: undefined,
        }, {
            testUserName: 'sanic.the.speedy.errored.hedgehog@10_10-10',
            expectedError: ValidationErrors.INVALID_LENGTH,
        }, {
            testUserName: 'sanic⭑',
            expectedError: ValidationErrors.INVALID_CHARACTERS,
        }, {
            testUserName: '.sanic',
            expectedError: ValidationErrors.INVALID_FIRST_CHARACTER,
        }, {
            testUserName: 'valet',
            expectedError: ValidationErrors.RESERVED_NAME,
        },
    ];
    test('Validate username', () => {
        for (const test of tests) {
            const testError = Utils.isValidUsername(test.testUserName);
            if (testError) {
                expect(testError.id).toEqual(test.expectedError);
            } else {
                expect(testError).toBe(undefined);
            }
        }
    });
    test('Validate bot username', () => {
        tests.push({
            testUserName: 'sanic.the.hedgehog.',
            expectedError: ValidationErrors.INVALID_LAST_CHARACTER,
        });
        for (const test of tests) {
            const testError = Utils.isValidUsername(test.testUserName);
            if (testError) {
                expect(testError.id).toEqual(test.expectedError);
            } else {
                expect(testError).toBe(undefined);
            }
        }
    });
});

describe('Utils.localizeMessage', () => {
    const originalGetState = store.getState;

    afterAll(() => {
        store.getState = originalGetState;
    });

    const entities = {
        general: {
            config: {},
        },
        users: {
            currentUserId: 'abcd',
            profiles: {
                abcd: {
                    locale: 'fr',
                },
            },
        },
    };

    describe('with translations', () => {
        beforeAll(() => {
            store.getState = () => ({
                entities,
                views: {
                    i18n: {
                        translations: {
                            fr: {
                                'test.hello_world': 'Bonjour tout le monde!',
                            },
                        },
                    },
                },
            });
        });

        test('with translations', () => {
            expect(Utils.localizeMessage('test.hello_world', 'Hello, World!')).toEqual('Bonjour tout le monde!');
        });

        test('with missing string in translations', () => {
            expect(Utils.localizeMessage('test.hello_world2', 'Hello, World 2!')).toEqual('Hello, World 2!');
        });

        test('with missing string in translations and no default', () => {
            expect(Utils.localizeMessage('test.hello_world2')).toEqual('test.hello_world2');
        });
    });

    describe('without translations', () => {
        beforeAll(() => {
            store.getState = () => ({
                entities,
                views: {
                    i18n: {
                        translations: {},
                    },
                },
            });
        });

        test('without translations', () => {
            expect(Utils.localizeMessage('test.hello_world', 'Hello, World!')).toEqual('Hello, World!');
        });

        test('without translations and no default', () => {
            expect(Utils.localizeMessage('test.hello_world')).toEqual('test.hello_world');
        });
    });
});

describe('Utils.imageURLForUser', () => {
    test('should return url when user id and last_picture_update is given', () => {
        const imageUrl = Utils.imageURLForUser('foobar-123', 123456);
        expect(imageUrl).toEqual('/api/v4/users/foobar-123/image?_=123456');
    });

    test('should return url when user id is given without last_picture_update', () => {
        const imageUrl = Utils.imageURLForUser('foobar-123');
        expect(imageUrl).toEqual('/api/v4/users/foobar-123/image?_=0');
    });
});

describe('Utils.isUnhandledLineBreakKeyCombo', () => {
    test('isUnhandledLineBreakKeyCombo returns true for alt + enter for Chrome UA', () => {
        ua.mockChrome();
        expect(Utils.isUnhandledLineBreakKeyCombo(lineBreakHelpers.getAltKeyEvent() as KeyboardEvent)).toBe(true);
    });

    test('isUnhandledLineBreakKeyCombo returns false for alt + enter for Safari UA', () => {
        ua.mockSafari();
        expect(Utils.isUnhandledLineBreakKeyCombo(lineBreakHelpers.getAltKeyEvent() as KeyboardEvent)).toBe(false);
    });

    test('isUnhandledLineBreakKeyCombo returns false for shift + enter', () => {
        expect(Utils.isUnhandledLineBreakKeyCombo(lineBreakHelpers.getShiftKeyEvent() as unknown as KeyboardEvent)).toBe(false);
    });

    test('isUnhandledLineBreakKeyCombo returns false for ctrl/command + enter', () => {
        expect(Utils.isUnhandledLineBreakKeyCombo(lineBreakHelpers.getCtrlKeyEvent() as unknown as KeyboardEvent)).toBe(false);
        expect(Utils.isUnhandledLineBreakKeyCombo(lineBreakHelpers.getMetaKeyEvent() as unknown as KeyboardEvent)).toBe(false);
    });

    test('isUnhandledLineBreakKeyCombo returns false for just enter', () => {
        expect(Utils.isUnhandledLineBreakKeyCombo(lineBreakHelpers.BASE_EVENT as unknown as KeyboardEvent)).toBe(false);
    });

    test('isUnhandledLineBreakKeyCombo returns false for f (random key)', () => {
        const e = {
            ...lineBreakHelpers.BASE_EVENT,
            key: Constants.KeyCodes.F[0],
            keyCode: Constants.KeyCodes.F[1],
        };
        expect(Utils.isUnhandledLineBreakKeyCombo(e as unknown as KeyboardEvent)).toBe(false);
    });

    // restore initial user agent
    afterEach(ua.reset);
});

describe('Utils.insertLineBreakFromKeyEvent', () => {
    test('insertLineBreakFromKeyEvent returns with line break appending (no selection range)', () => {
        expect(Utils.insertLineBreakFromKeyEvent(lineBreakHelpers.getAppendEvent() as React.KeyboardEvent<HTMLInputElement>)).toBe(lineBreakHelpers.OUTPUT_APPEND);
    });
    test('insertLineBreakFromKeyEvent returns with line break replacing (with selection range)', () => {
        expect(Utils.insertLineBreakFromKeyEvent(lineBreakHelpers.getReplaceEvent() as React.KeyboardEvent<HTMLInputElement>)).toBe(lineBreakHelpers.OUTPUT_REPLACE);
    });
});

describe('Utils.copyTextAreaToDiv', () => {
    const textArea = document.createElement('textarea');

    test('copyTextAreaToDiv actually creates a div element', () => {
        const copy = Utils.copyTextAreaToDiv(textArea);

        expect(copy!.nodeName).toEqual('DIV');
    });

    test('copyTextAreaToDiv copies the content into the div element', () => {
        textArea.value = 'the content';

        const copy = Utils.copyTextAreaToDiv(textArea);

        expect(copy!.innerHTML).toEqual('the content');
    });

    test('copyTextAreaToDiv correctly copies the styles of the textArea element', () => {
        textArea.style.fontFamily = 'Sans-serif';

        const copy = Utils.copyTextAreaToDiv(textArea);

        expect(copy!.style.fontFamily).toEqual('Sans-serif');
    });
});

describe('Utils.getCaretXYCoordinate', () => {
    const tmpCreateRange = document.createRange;
    const cleanUp = () => {
        document.createRange = tmpCreateRange;
    };

    afterAll(cleanUp);

    const textArea = document.createElement('textarea');
    document.createRange = () => {
        const range = new Range();

        range.getClientRects = () => {
            return [{
                top: 10,
                left: 15,
            }] as unknown as DOMRectList;
        };

        return range;
    };
    textArea.value = 'm'.repeat(10);

    test('getCaretXYCoordinate returns the coordinates of the caret', () => {
        const coordinates = Utils.getCaretXYCoordinate(textArea);

        expect(coordinates.x).toEqual(15);
        expect(coordinates.y).toEqual(10);
    });

    test('getCaretXYCoordinate returns the coordinates of the caret with a left scroll', () => {
        textArea.scrollLeft = 5;

        const coordinates = Utils.getCaretXYCoordinate(textArea);

        expect(coordinates.x).toEqual(10);
    });
});

describe('Utils.getViewportSize', () => {
    test('getViewportSize returns the right viewport using default jsDom window', () => {
        // the default values of the jsDom window are w: 1024, h: 768
        const viewportDimensions = Utils.getViewportSize();

        expect(viewportDimensions.w).toEqual(1024);
        expect(viewportDimensions.h).toEqual(768);
    });

    test('getViewportSize returns the right viewport width with custom parameter', () => {
        const mockWindow = {document: {body: {}, compatMode: undefined}};
        (mockWindow.document.body as any).clientWidth = 1025;
        (mockWindow.document.body as any).clientHeight = 860;

        const viewportDimensions = Utils.getViewportSize(mockWindow as unknown as Window);

        expect(viewportDimensions.w).toEqual(1025);
        expect(viewportDimensions.h).toEqual(860);
    });

    test('getViewportSize returns the right viewport width with custom parameter - innerWidth', () => {
        const mockWindow = {innerWidth: 1027, innerHeight: 767};

        const viewportDimensions = Utils.getViewportSize(mockWindow as unknown as Window);

        expect(viewportDimensions.w).toEqual(1027);
        expect(viewportDimensions.h).toEqual(767);
    });
});

describe('Utils.offsetTopLeft', () => {
    test('offsetTopLeft returns the right offset values', () => {
        const textArea = document.createElement('textArea');

        textArea.getBoundingClientRect = jest.fn(() => ({
            top: 967,
            left: 851,
        } as DOMRect));

        const offsetTopLeft = Utils.offsetTopLeft(textArea);
        expect(offsetTopLeft.top).toEqual(967);
        expect(offsetTopLeft.left).toEqual(851);
    });
});

describe('Utils.getSuggestionBoxAlgn', () => {
    const tmpCreateRange = document.createRange;
    const cleanUp = () => {
        document.createRange = tmpCreateRange;
    };

    afterAll(cleanUp);

    const textArea: HTMLTextAreaElement = document.createElement('textArea') as HTMLTextAreaElement;

    textArea.value = 'a'.repeat(30);

    jest.spyOn(textArea, 'offsetWidth', 'get').
        mockImplementation(() => 950);

    textArea.getBoundingClientRect = jest.fn(() => ({
        left: 50,
    } as DOMRect));

    const createRange = (size: number) => {
        document.createRange = () => {
            const range = new Range();
            range.getClientRects = () => {
                return [{
                    top: 100,
                    left: size,
                }] as unknown as DOMRectList;
            };
            return range;
        };
    };

    const fixedToTheRight = textArea.offsetWidth - Constants.SUGGESTION_LIST_MODAL_WIDTH;

    test('getSuggestionBoxAlgn returns 0 (box stuck to left) when the length of the text is small', () => {
        const smallSizeText = 15;
        createRange(smallSizeText);
        const suggestionBoxAlgn = Utils.getSuggestionBoxAlgn(textArea, Utils.getPxToSubstract());
        expect(suggestionBoxAlgn.pixelsToMoveX).toEqual(0);
    });

    test('getSuggestionBoxAlgn returns pixels to move when text is medium size', () => {
        const mediumSizeText = 155;
        createRange(mediumSizeText);
        const suggestionBoxAlgn = Utils.getSuggestionBoxAlgn(textArea, Utils.getPxToSubstract());
        expect(suggestionBoxAlgn.pixelsToMoveX).toBeGreaterThan(0);
        expect(suggestionBoxAlgn.pixelsToMoveX).not.toBe(fixedToTheRight);
    });

    test('getSuggestionBoxAlgn align box to the righ when text is large size', () => {
        const largeSizeText = 700;
        createRange(largeSizeText);
        const suggestionBoxAlgn = Utils.getSuggestionBoxAlgn(textArea, Utils.getPxToSubstract());
        expect(fixedToTheRight).toEqual(suggestionBoxAlgn.pixelsToMoveX);
    });
});

describe('Utils.numberToFixedDynamic', () => {
    const tests = [
        {
            label: 'Removes period when no decimals needed',
            num: 123.001,
            places: 2,
            expected: '123',
        },
        {
            label: 'Extra places are ignored',
            num: 123.45,
            places: 3,
            expected: '123.45',
        },
        {
            label: 'rounds positives',
            num: 123.45,
            places: 1,
            expected: '123.5',
        },
        {
            label: 'rounds negatives',
            num: -123.45,
            places: 1,
            expected: '-123.5',
        },
        {
            label: 'negative places interpreted as 0 places',
            num: 123,
            places: -1,
            expected: '123',
        },
        {
            label: 'handles integers',
            num: 123,
            places: 4,
            expected: '123',
        },
        {
            label: 'handles integers with 0 places',
            num: 123,
            places: 4,
            expected: '123',
        },
        {
            label: 'correctly excludes decimal when rounding exlcudes number',
            num: 0.004,
            places: 2,
            expected: '0',
        },
    ];
    tests.forEach((testCase) => {
        test(testCase.label, () => {
            const actual = Utils.numberToFixedDynamic(testCase.num, testCase.places);
            expect(actual).toBe(testCase.expected);
        });
    });
});
