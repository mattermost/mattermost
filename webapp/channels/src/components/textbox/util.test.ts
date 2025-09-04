// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import {generateRawValueFromInputValue, calculateMentionPositions, generateDisplayValueFromRawValue, convertDisplayPositionToRawPosition, convertRawPositionToDisplayPosition} from './util';

const mockDisplayUsername = require('mattermost-redux/utils/user_utils').displayUsername;

// Mock displayUsername function
jest.mock('mattermost-redux/utils/user_utils', () => ({
    displayUsername: jest.fn(),
}));

// Mock utils
jest.mock('utils/utils', () => ({
    setCaretPosition: jest.fn(),
}));

// Mock helper functions used by updateStateWhenSuggestionSelected
jest.mock('./util', () => ({
    ...jest.requireActual('./util'),
    generateMapValue: jest.fn(),
}));

describe('generateRawValueFromInputValue', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should convert display name back to username in raw value', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe, how are you?';
        const inputValue = 'Hello @John Doe, how are you?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hello @john_doe, how are you?');
    });

    it('should handle multiple mentions conversion', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = 'Hello @john_doe and @jane_smith';
        const inputValue = 'Hello @John Doe and @Jane Smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hello @john_doe and @jane_smith');
    });

    it('should handle partial text changes', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe';
        const inputValue = 'Hello @John Doe, nice to see you!';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hello @john_doe, nice to see you!');
    });

    it('should handle when user is not found in usersByUsername', () => {
        const rawValue = 'Hello @unknown_user';
        const inputValue = 'Hello @Unknown User';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hello @Unknown User'); // Should return inputValue unchanged
    });

    it('should handle empty usersByUsername object', () => {
        const rawValue = 'Hello @john_doe';
        const inputValue = 'Hello @John Doe';
        const users = {};

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hello @John Doe'); // Should return inputValue unchanged
    });

    it('should handle same username mentioned multiple times', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hi @john_doe, @john_doe are you there?';
        const inputValue = 'Hi @John Doe, @John Doe are you there?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hi @john_doe, @john_doe are you there?');
    });

    it('should handle display names with special characters', () => {
        mockDisplayUsername.mockReturnValue('John O\'Connor-Smith');

        const rawValue = 'Hello @john.oconnor';
        const inputValue = 'Hello @John O\'Connor-Smith';
        const users = {
            'john.oconnor': {id: '1', username: 'john.oconnor'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hello @john.oconnor');
    });

    it('should handle Japanese display names', () => {
        mockDisplayUsername.mockReturnValue('田中 太郎');

        const rawValue = 'こんにちは @tanaka.taro';
        const inputValue = 'こんにちは @田中 太郎';
        const users = {
            'tanaka.taro': {id: '1', username: 'tanaka.taro'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('こんにちは @tanaka.taro');
    });

    it('should handle custom teammateNameDisplay preference', () => {
        mockDisplayUsername.mockReturnValue('John (john_doe)');

        const rawValue = 'Hello @john_doe';
        const inputValue = 'Hello @John (john_doe)';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users, Preferences.DISPLAY_PREFER_FULL_NAME);
        expect(result).toBe('Hello @john_doe');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_FULL_NAME, false);
    });

    it('should handle edge case with no mentions in rawValue', () => {
        const rawValue = 'Hello world';
        const inputValue = 'Hello world, nice day!';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('Hello world, nice day!');
    });

    it('should handle empty strings', () => {
        const rawValue = '';
        const inputValue = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('');
    });

    it('should handle mentions at beginning and end of text', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = '@john_doe hello @jane_smith';
        const inputValue = '@John Doe hello @Jane Smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateRawValueFromInputValue(rawValue, inputValue, users);
        expect(result).toBe('@john_doe hello @jane_smith');
    });
});

describe('calculateMentionPositions', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should calculate position for single mention', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe';
        const displayValue = 'Hello @John Doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([{
            start: 6,
            end: 15,
            username: 'john_doe',
        }]);
    });

    it('should calculate positions for multiple mentions', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = 'Hello @john_doe and @jane_smith';
        const displayValue = 'Hello @John Doe and @Jane Smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([
            {
                start: 6,
                end: 15,
                username: 'john_doe',
            },
            {
                start: 20,
                end: 31,
                username: 'jane_smith',
            },
        ]);
    });

    it('should handle mentions at the beginning of text', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = '@john_doe hello';
        const displayValue = '@John Doe hello';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([{
            start: 0,
            end: 9,
            username: 'john_doe',
        }]);
    });

    it('should handle mentions at the end of text', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe';
        const displayValue = 'Hello @John Doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([{
            start: 6,
            end: 15,
            username: 'john_doe',
        }]);
    });

    it('should handle consecutive mentions without spaces', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = '@john_doe@jane_smith';
        const displayValue = '@John Doe@Jane Smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([
            {
                start: 0,
                end: 9,
                username: 'john_doe',
            },
            {
                start: 9,
                end: 20,
                username: 'jane_smith',
            },
        ]);
    });

    it('should handle usernames with special characters', () => {
        mockDisplayUsername.mockReturnValue('Test User');

        const rawValue = 'Hello @test.user-name_123';
        const displayValue = 'Hello @Test User';
        const users = {
            'test.user-name_123': {id: '1', username: 'test.user-name_123'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([{
            start: 6,
            end: 16,
            username: 'test.user-name_123',
        }]);
    });

    it('should handle display names with special characters and unicode', () => {
        mockDisplayUsername.mockReturnValue('田中 太郎');

        const rawValue = 'Hello @user123';
        const displayValue = 'Hello @田中 太郎';
        const users = {
            user123: {id: '1', username: 'user123'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([{
            start: 6,
            end: 12, // Unicode characters count correctly
            username: 'user123',
        }]);
    });

    it('should handle same username mentioned multiple times', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe, how are you @john_doe?';
        const displayValue = 'Hello @John Doe, how are you @John Doe?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([
            {
                start: 6,
                end: 15,
                username: 'john_doe',
            },
            {
                start: 29,
                end: 38,
                username: 'john_doe',
            },
        ]);
    });

    it('should skip mentions for users not found in usersByUsername', () => {
        const rawValue = 'Hello @unknown_user';
        const displayValue = 'Hello @unknown_user';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([]);
    });

    it('should handle empty strings', () => {
        const rawValue = '';
        const displayValue = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = calculateMentionPositions(rawValue, displayValue, users);
        expect(result).toEqual([]);
    });
});
describe('generateDisplayValueFromRawValue', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should convert raw username to display format', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @John Doe');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_USERNAME, false);
    });

    it('should convert multiple mentions from raw to display format', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = 'Hello @john_doe and @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @John Doe and @Jane Smith');
    });

    it('should handle usernames with special characters', () => {
        mockDisplayUsername.mockReturnValue('Test User');

        const rawValue = 'Hello @test.user-name_123';
        const users = {
            'test.user-name_123': {id: '1', username: 'test.user-name_123'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @Test User');
    });

    it('should handle same username mentioned multiple times', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hi @john_doe, @john_doe are you there?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hi @John Doe, @John Doe are you there?');
    });

    it('should handle display names with special characters', () => {
        mockDisplayUsername.mockReturnValue('John O\'Connor-Smith');

        const rawValue = 'Hello @john.oconnor';
        const users = {
            'john.oconnor': {id: '1', username: 'john.oconnor'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @John O\'Connor-Smith');
    });

    it('should handle Japanese display names', () => {
        mockDisplayUsername.mockReturnValue('田中 太郎');

        const rawValue = 'こんにちは @tanaka.taro';
        const users = {
            'tanaka.taro': {id: '1', username: 'tanaka.taro'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('こんにちは @田中 太郎');
    });

    it('should respect custom teammateNameDisplay preference', () => {
        mockDisplayUsername.mockReturnValue('John (john_doe)');

        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users, Preferences.DISPLAY_PREFER_FULL_NAME);
        expect(result).toBe('Hello @John (john_doe)');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_FULL_NAME, false);
    });

    it('should handle mentions at beginning and end of text', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = '@john_doe hello @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('@John Doe hello @Jane Smith');
    });

    it('should handle consecutive mentions without spaces', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = '@john_doe@jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('@John Doe@Jane Smith');
    });

    it('should handle empty string input', () => {
        const rawValue = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('');
    });

    it('should handle text without mentions', () => {
        const rawValue = 'Hello world, no mentions here';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello world, no mentions here');
    });

    it('should leave unknown users unchanged', () => {
        const rawValue = 'Hello @unknown_user';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @unknown_user');
    });

    it('should handle mixed existing and non-existing users', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe and @unknown_user';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @John Doe and @unknown_user');
    });

    it('should handle empty usersByUsername object', () => {
        const rawValue = 'Hello @john_doe';
        const users = {};

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @john_doe');
    });

    it('should handle display names with spaces and punctuation', () => {
        mockDisplayUsername.mockReturnValue('Dr. John Smith Jr.');

        const rawValue = 'Meeting with @john.smith tomorrow';
        const users = {
            'john.smith': {id: '1', username: 'john.smith'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Meeting with @Dr. John Smith Jr. tomorrow');
    });

    it('should handle @ symbol without valid username', () => {
        const rawValue = 'Email: test@example.com and @';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Email: test@example.com and @');
    });

    it('should handle mentions with identical display names correctly', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Smith').
            mockReturnValueOnce('John Smith');

        const rawValue = 'Both @john.smith1 and @john.smith2 are here';
        const users = {
            'john.smith1': {id: '1', username: 'john.smith1'} as UserProfile,
            'john.smith2': {id: '2', username: 'john.smith2'} as UserProfile,
        };

        const result = generateDisplayValueFromRawValue(rawValue, users);
        expect(result).toBe('Both @John Smith and @John Smith are here');
    });
});

describe('convertDisplayPositionToRawPosition', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should return displayPosition when usersByUsername is undefined', () => {
        const displayPosition = 10;
        const rawValue = 'Hello @john_doe';

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, undefined);
        expect(result).toBe(displayPosition);
    });

    it('should return displayPosition when displayPosition is 0 or negative', () => {
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        expect(convertDisplayPositionToRawPosition(0, rawValue, users)).toBe(0);
        expect(convertDisplayPositionToRawPosition(-5, rawValue, users)).toBe(-5);
    });

    it('should convert position correctly when no mentions exist', () => {
        const displayPosition = 10;
        const rawValue = 'Hello world!';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(displayPosition);
    });

    it('should convert position before a mention correctly', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const displayPosition = 6; // Position before '@' in "Hello @John Doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(6); // Same position in raw value
    });

    it('should convert position within a mention to end of username', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const displayPosition = 10; // Position within "@John Doe" in "Hello @John Doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(15); // End of "@john_doe"
    });

    it('should convert position after a mention correctly', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const displayPosition = 17; // Position after "Hello @John Doe "
        const rawValue = 'Hello @john_doe how are you?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(17); // Position after "Hello @john_doe "
    });

    it('should handle multiple mentions correctly', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const displayPosition = 25; // Position after "Hello @John Doe and @Jane Smith"
        const rawValue = 'Hello @john_doe and @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(31); // End of raw value
    });

    it('should handle position between multiple mentions', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const displayPosition = 15; // Position in " and " between mentions
        const rawValue = 'Hello @john_doe and @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(15); // Position in " and " in raw value
    });

    it('should handle display names longer than usernames', () => {
        mockDisplayUsername.mockReturnValue('Dr. John Smith Jr.');

        const displayPosition = 25; // Position after "Hello @Dr. John Smith Jr."
        const rawValue = 'Hello @john_smith';
        const users = {
            john_smith: {id: '1', username: 'john_smith'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(17); // End of raw value
    });

    it('should handle display names shorter than usernames', () => {
        mockDisplayUsername.mockReturnValue('John');

        const displayPosition = 12; // Position after "Hello @John "
        const rawValue = 'Hello @john_doe_long how are you?';
        const users = {
            john_doe_long: {id: '1', username: 'john_doe_long'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(21); // Position after "Hello @john_doe_long "
    });

    it('should handle mentions with special characters', () => {
        mockDisplayUsername.mockReturnValue('John-Doe');

        const displayPosition = 13; // Position after "Hello @John-Doe"
        const rawValue = 'Hello @john.doe';
        const users = {
            'john.doe': {id: '1', username: 'john.doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(15); // End of "@john.doe"
    });

    it('should respect custom teammateNameDisplay preference', () => {
        mockDisplayUsername.mockReturnValue('j.doe');

        const displayPosition = 12; // Position after "Hello @j.doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users, Preferences.DISPLAY_PREFER_NICKNAME);
        expect(result).toBe(15); // End of "@john_doe"
    });

    it('should handle position at the exact start of a mention', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const displayPosition = 6; // Position at '@' in "Hello @John Doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(6); // Same position at '@' in raw value
    });

    it('should handle position at the exact end of a mention', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const displayPosition = 15; // Position right after "Hello @John Doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(15); // End of raw value
    });

    it('should handle empty rawValue', () => {
        const displayPosition = 0;
        const rawValue = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(0);
    });

    it('should clamp position to rawValue length when displayPosition exceeds boundaries', () => {
        mockDisplayUsername.mockReturnValue('John');

        const displayPosition = 100; // Position way beyond the text
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(15); // Clamped to rawValue length
    });

    it('should handle Japanese text with mentions', () => {
        mockDisplayUsername.mockReturnValue('田中太郎');

        const displayPosition = 8; // Position after "こんにちは @田中太郎"
        const rawValue = 'こんにちは @tanaka';
        const users = {
            tanaka: {id: '1', username: 'tanaka'} as UserProfile,
        };

        const result = convertDisplayPositionToRawPosition(displayPosition, rawValue, users);
        expect(result).toBe(13); // End of raw value
    });
});

describe('convertRawPositionToDisplayPosition', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should return rawPosition when usersByUsername is undefined', () => {
        const rawPosition = 10;
        const rawValue = 'Hello @john_doe';

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, undefined);
        expect(result).toBe(rawPosition);
    });

    it('should return rawPosition when rawPosition is 0 or negative', () => {
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        expect(convertRawPositionToDisplayPosition(0, rawValue, users)).toBe(0);
        expect(convertRawPositionToDisplayPosition(-5, rawValue, users)).toBe(-5);
    });

    it('should convert position correctly when no mentions exist', () => {
        const rawPosition = 5;
        const rawValue = 'Hello world';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(5); // Should remain unchanged
    });

    it('should convert position before a mention correctly', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawPosition = 6; // Position at "Hello @" (before username)
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(6); // Should remain the same before the mention
    });

    it('should convert position within a mention to end of display name', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawPosition = 10; // Position within "@john_doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(15); // End of "Hello @John Doe"
    });

    it('should convert position after a mention correctly', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawPosition = 20; // Position after "@john_doe, how are you?"
        const rawValue = 'Hello @john_doe, how are you?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "Hello @john_doe, how are you?" (position 20 = "are y")
        // Display: "Hello @John Doe, how are you?" (position 20 = "are y")
        // The difference is "John Doe" (8 chars) vs "john_doe" (8 chars) = no difference
        expect(result).toBe(20);
    });

    it('should handle multiple mentions correctly', () => {
        mockDisplayUsername.mockClear();
        mockDisplayUsername.mockImplementation((user: UserProfile) => {
            if (user.username === 'john_doe') {
                return 'John Doe';
            }
            if (user.username === 'jane_smith') {
                return 'Jane Smith';
            }
            return user.username;
        });

        const rawPosition = 25; // Position after "Hello @john_doe and @jane_smith"
        const rawValue = 'Hello @john_doe and @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "Hello @john_doe and @jane_smith" (31 chars)
        // Display: "Hello @John Doe and @Jane Smith" (31 chars)
        // Both have same length, so position should be same
        expect(result).toBe(31);
    });

    it('should handle position between multiple mentions', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawPosition = 18; // Position at " and " between mentions
        const rawValue = 'Hello @john_doe and @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "Hello @john_doe and" (position 18 = "d")
        // Display: "Hello @John Doe and" (position 18 = "d")
        // Both mentions have same length, so position should be same
        expect(result).toBe(18);
    });

    it('should handle display names longer than usernames', () => {
        mockDisplayUsername.mockReturnValue('John Michael Doe');

        const rawPosition = 15; // End of raw value
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "Hello @john_doe" (15 chars)
        // Display: "Hello @John Michael Doe" (23 chars)
        expect(result).toBe(23);
    });

    it('should handle display names shorter than usernames', () => {
        mockDisplayUsername.mockReturnValue('John');

        const rawPosition = 15; // End of raw value
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "Hello @john_doe" (15 chars)
        // Display: "Hello @John" (11 chars)
        expect(result).toBe(11);
    });

    it('should handle mentions with special characters', () => {
        mockDisplayUsername.mockReturnValue('Test User');

        const rawPosition = 22; // End of raw value
        const rawValue = 'Hello @test.user-name_123';
        const users = {
            'test.user-name_123': {id: '1', username: 'test.user-name_123'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "Hello @test.user-name_123" (22 chars)
        // Display: "Hello @Test User" (16 chars)
        expect(result).toBe(16);
    });

    it('should respect custom teammateNameDisplay preference', () => {
        mockDisplayUsername.mockReturnValue('John (john_doe)');

        const rawPosition = 15; // End of raw value
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users, Preferences.DISPLAY_PREFER_FULL_NAME);

        // Raw: "Hello @john_doe" (15 chars)
        // Display: "Hello @John (john_doe)" (22 chars)
        expect(result).toBe(22);
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_FULL_NAME, false);
    });

    it('should handle position at the exact start of a mention', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawPosition = 6; // Position at "@" in "@john_doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(6); // Should remain at the start of the mention
    });

    it('should handle position at the exact end of a mention', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawPosition = 15; // End of "@john_doe"
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(15); // End of "Hello @John Doe"
    });

    it('should handle empty rawValue', () => {
        const rawPosition = 0;
        const rawValue = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(0);
    });

    it('should clamp position to display value length when rawPosition exceeds boundaries', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawPosition = 100; // Position way beyond the text
        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(15); // Clamped to display value length "Hello @John Doe"
    });

    it('should handle Japanese text with mentions', () => {
        mockDisplayUsername.mockReturnValue('田中太郎');

        const rawPosition = 13; // End of raw value "こんにちは @tanaka"
        const rawValue = 'こんにちは @tanaka';
        const users = {
            tanaka: {id: '1', username: 'tanaka'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "こんにちは @tanaka" (13 chars)
        // Display: "こんにちは @田中太郎" (11 chars)
        expect(result).toBe(11);
    });

    it('should handle same username mentioned multiple times', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawPosition = 30; // Position after first mention and within second
        const rawValue = 'Hi @john_doe, @john_doe there';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "Hi @john_doe, @john_doe there" (29 chars)
        // Display: "Hi @John Doe, @John Doe there" (29 chars)
        expect(result).toBe(29); // End of display value
    });

    it('should handle consecutive mentions without spaces', () => {
        mockDisplayUsername.mockClear();
        mockDisplayUsername.mockImplementation((user: UserProfile) => {
            if (user.username === 'john_doe') {
                return 'John Doe';
            }
            if (user.username === 'jane_smith') {
                return 'Jane Smith';
            }
            return user.username;
        });

        const rawPosition = 18;
        const rawValue = '@john_doe@jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);

        // Raw: "@john_doe@jane_smith" (20 chars)
        // Display: "@John Doe@Jane Smith" (20 chars)
        expect(result).toBe(20); // End of display value
    });

    it('should handle position within first mention of consecutive mentions', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawPosition = 5; // Position within first mention
        const rawValue = '@john_doe@jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = convertRawPositionToDisplayPosition(rawPosition, rawValue, users);
        expect(result).toBe(9); // End of first display mention "@John Doe"
    });
});
