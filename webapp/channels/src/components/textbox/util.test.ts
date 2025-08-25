// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import {generateMapValueFromInputValue, generateDisplayValueFromMapValue, generateRawValueFromInputValue, generateMapValueFromRawValue, generateRawValueFromMapValue, calculateMentionPositions} from './util';

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

describe('generateMapValueFromInputValue', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should return input unchanged when usersByUsername is undefined', () => {
        const input = 'Hello @john_doe';
        const result = generateMapValueFromInputValue(input, undefined);
        expect(result).toBe(input);
    });

    it('should return input unchanged when usersByUsername is empty', () => {
        const input = 'Hello @john_doe';
        const result = generateMapValueFromInputValue(input, {});
        expect(result).toBe(input);
    });

    it('should convert single mention to map format', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const input = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Hello @john_doe<x-name>@John Doe</x-name>');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_USERNAME, false);
    });

    it('should convert multiple mentions to map format', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const input = 'Hello @john_doe and @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Hello @john_doe<x-name>@John Doe</x-name> and @jane_smith<x-name>@Jane Smith</x-name>');
    });

    it('should leave non-existent mentions unchanged', () => {
        const input = 'Hello @unknown_user';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Hello @unknown_user');
    });

    it('should handle mixed content with existing and non-existing mentions', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const input = 'Hello @john_doe and @unknown_user';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Hello @john_doe<x-name>@John Doe</x-name> and @unknown_user');
    });

    it('should handle usernames with special characters', () => {
        mockDisplayUsername.mockReturnValue('Test User');

        const input = 'Hello @test.user-name_123';
        const users = {
            'test.user-name_123': {id: '1', username: 'test.user-name_123'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Hello @test.user-name_123<x-name>@Test User</x-name>');
    });

    it('should respect teammateNameDisplay parameter', () => {
        mockDisplayUsername.mockReturnValue('Full Name Display');

        const input = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users, Preferences.DISPLAY_PREFER_FULL_NAME);
        expect(result).toBe('Hello @john_doe<x-name>@Full Name Display</x-name>');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_FULL_NAME, false);
    });

    it('should handle empty input', () => {
        const input = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('');
    });

    it('should handle text without mentions', () => {
        const input = 'Hello world, no mentions here';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Hello world, no mentions here');
    });

    it('should handle same username mentioned multiple times', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const input = 'Hello @john_doe, how are you @john_doe?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Hello @john_doe<x-name>@John Doe</x-name>, how are you @john_doe<x-name>@John Doe</x-name>?');
    });

    it('should handle @ symbol without valid username', () => {
        const input = 'Email: test@example.com and @';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromInputValue(input, users);
        expect(result).toBe('Email: test@example.com and @');
    });
});

describe('generateDisplayValueFromMapValue', () => {
    it('should convert single mention from map format to display format', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>';
        const result = generateDisplayValueFromMapValue(mapValue);
        expect(result).toBe('Hello @John Doe');
    });

    it('should convert multiple mentions from map format to display format', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name> and @jane_smith<x-name>@Jane Smith</x-name>';
        const result = generateDisplayValueFromMapValue(mapValue);
        expect(result).toBe('Hello @John Doe and @Jane Smith');
    });

    it('should handle display names with special characters', () => {
        const mapValue = 'Hello @user.name<x-name>@John O\'Connor-Smith</x-name>';
        const result = generateDisplayValueFromMapValue(mapValue);
        expect(result).toBe('Hello @John O\'Connor-Smith');
    });

    it('should handle display names with spaces and unicode characters', () => {
        const mapValue = 'Hello @user123<x-name>@田中 太郎</x-name>';
        const result = generateDisplayValueFromMapValue(mapValue);
        expect(result).toBe('Hello @田中 太郎');
    });

    it('should handle same mention appearing multiple times', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>, how are you @john_doe<x-name>@John Doe</x-name>?';
        const result = generateDisplayValueFromMapValue(mapValue);
        expect(result).toBe('Hello @John Doe, how are you @John Doe?');
    });

    it('should handle mentions at the beginning and end of text', () => {
        const mapValue = '@john_doe<x-name>@John Doe</x-name> hello @jane_smith<x-name>@Jane Smith</x-name>';
        const result = generateDisplayValueFromMapValue(mapValue);
        expect(result).toBe('@John Doe hello @Jane Smith');
    });

    it('should handle consecutive mentions without spaces', () => {
        const mapValue = '@john_doe<x-name>@John Doe</x-name>@jane_smith<x-name>@Jane Smith</x-name>';
        const result = generateDisplayValueFromMapValue(mapValue);
        expect(result).toBe('@John Doe@Jane Smith');
    });
});

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

describe('generateMapValueFromRawValue', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should convert raw username to map format', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @john_doe<x-name>@John Doe</x-name>');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_USERNAME, false);
    });

    it('should convert multiple mentions from raw to map format', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawValue = 'Hello @john_doe and @jane_smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @john_doe<x-name>@John Doe</x-name> and @jane_smith<x-name>@Jane Smith</x-name>');
    });

    it('should handle usernames with special characters', () => {
        mockDisplayUsername.mockReturnValue('Test User');

        const rawValue = 'Hello @test.user-name_123';
        const users = {
            'test.user-name_123': {id: '1', username: 'test.user-name_123'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @test.user-name_123<x-name>@Test User</x-name>');
    });

    it('should handle same username mentioned multiple times', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hi @john_doe, @john_doe are you there?';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hi @john_doe<x-name>@John Doe</x-name>, @john_doe<x-name>@John Doe</x-name> are you there?');
    });

    it('should handle display names with special characters', () => {
        mockDisplayUsername.mockReturnValue('John O\'Connor-Smith');

        const rawValue = 'Hello @john.oconnor';
        const users = {
            'john.oconnor': {id: '1', username: 'john.oconnor'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @john.oconnor<x-name>@John O\'Connor-Smith</x-name>');
    });

    it('should handle Japanese display names', () => {
        mockDisplayUsername.mockReturnValue('田中 太郎');

        const rawValue = 'こんにちは @tanaka.taro';
        const users = {
            'tanaka.taro': {id: '1', username: 'tanaka.taro'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('こんにちは @tanaka.taro<x-name>@田中 太郎</x-name>');
    });

    it('should respect custom teammateNameDisplay preference', () => {
        mockDisplayUsername.mockReturnValue('John (john_doe)');

        const rawValue = 'Hello @john_doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users, Preferences.DISPLAY_PREFER_FULL_NAME);
        expect(result).toBe('Hello @john_doe<x-name>@John (john_doe)</x-name>');
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

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('@john_doe<x-name>@John Doe</x-name> hello @jane_smith<x-name>@Jane Smith</x-name>');
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

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('@john_doe<x-name>@John Doe</x-name>@jane_smith<x-name>@Jane Smith</x-name>');
    });

    it('should handle empty string input', () => {
        const rawValue = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('');
    });

    it('should handle text without mentions', () => {
        const rawValue = 'Hello world, no mentions here';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello world, no mentions here');
    });
});

describe('generateRawValueFromMapValue', () => {
    beforeEach(() => {
        mockDisplayUsername.mockClear();
    });

    it('should convert map value back to raw format with username replacements', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>';
        const inputValue = 'Hello @John Doe';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hello @john_doe');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_USERNAME, false);
    });

    it('should handle multiple mentions conversion from map to raw', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name> and @jane_smith<x-name>@Jane Smith</x-name>';
        const inputValue = 'Hello @John Doe and @Jane Smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hello @john_doe and @jane_smith');
    });

    it('should skip replacement when user is not found in usersByUsername', () => {
        const mapValue = 'Hello @unknown_user<x-name>@Unknown User</x-name>';
        const inputValue = 'Hello @Unknown User';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hello @Unknown User'); // Should remain unchanged
    });

    it('should handle empty usersByUsername object', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>';
        const inputValue = 'Hello @John Doe';
        const users = {};

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hello @John Doe'); // Should remain unchanged
    });

    it('should handle mentions with boundary validation (Japanese text)', () => {
        mockDisplayUsername.mockReturnValue('田中 太郎');

        const mapValue = 'こんにちは@tanaka.taro<x-name>@田中 太郎</x-name>です';
        const inputValue = 'こんにちは@田中 太郎です';
        const users = {
            'tanaka.taro': {id: '1', username: 'tanaka.taro'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('こんにちは@tanaka.taroです');
    });

    it('should handle mentions at word boundaries with spaces', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const mapValue = 'Hi @john_doe<x-name>@John Doe</x-name> there';
        const inputValue = 'Hi @John Doe there';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hi @john_doe there');
    });

    it('should not replace mentions that are part of other words', () => {
        mockDisplayUsername.mockReturnValue('John');

        const mapValue = 'Email @john<x-name>@John</x-name>son@company.com';
        const inputValue = 'Email @Johnson@company.com';
        const users = {
            john: {id: '1', username: 'john'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Email @Johnson@company.com'); // Should not replace since "John" is part of "Johnson"
    });

    it('should handle display names with special characters', () => {
        mockDisplayUsername.mockReturnValue('John O\'Connor-Smith');

        const mapValue = 'Hello @john.oconnor<x-name>@John O\'Connor-Smith</x-name>';
        const inputValue = 'Hello @John O\'Connor-Smith';
        const users = {
            'john.oconnor': {id: '1', username: 'john.oconnor'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hello @john.oconnor');
    });

    it('should respect custom teammateNameDisplay preference', () => {
        mockDisplayUsername.mockReturnValue('John (john_doe)');

        const mapValue = 'Hello @john_doe<x-name>@John (john_doe)</x-name>';
        const inputValue = 'Hello @John (john_doe)';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users, Preferences.DISPLAY_PREFER_FULL_NAME);
        expect(result).toBe('Hello @john_doe');
        expect(mockDisplayUsername).toHaveBeenCalledWith(users.john_doe, Preferences.DISPLAY_PREFER_FULL_NAME, false);
    });

    it('should handle mentions at beginning and end of text', () => {
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const mapValue = '@john_doe<x-name>@John Doe</x-name> hello @jane_smith<x-name>@Jane Smith</x-name>';
        const inputValue = '@John Doe hello @Jane Smith';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
            jane_smith: {id: '2', username: 'jane_smith'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('@john_doe hello @jane_smith');
    });

    it('should handle empty strings', () => {
        const mapValue = '';
        const inputValue = '';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('');
    });

    it('should handle inputValue without mentions but mapValue with mentions', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>';
        const inputValue = 'Hello world';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hello world'); // inputValue should be returned as-is
    });

    it('should handle mixed existing and non-existing users', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name> and @unknown_user<x-name>@Unknown User</x-name>';
        const inputValue = 'Hello @John Doe and @Unknown User';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateRawValueFromMapValue(mapValue, inputValue, users);
        expect(result).toBe('Hello @john_doe and @Unknown User');
    });
});

describe('calculateMentionPositions', () => {
    it('should return empty array when no mentions are found', () => {
        const mapValue = 'Hello world, no mentions here';
        const displayValue = 'Hello world, no mentions here';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([]);
    });

    it('should calculate position for single mention', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>';
        const displayValue = 'Hello @John Doe';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 6,
            end: 15,
            username: 'john_doe',
        }]);
    });

    it('should calculate positions for multiple mentions', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name> and @jane_smith<x-name>@Jane Smith</x-name>';
        const displayValue = 'Hello @John Doe and @Jane Smith';
        const result = calculateMentionPositions(mapValue, displayValue);
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
        const mapValue = '@john_doe<x-name>@John Doe</x-name> hello';
        const displayValue = '@John Doe hello';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 0,
            end: 9,
            username: 'john_doe',
        }]);
    });

    it('should handle mentions at the end of text', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>';
        const displayValue = 'Hello @John Doe';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 6,
            end: 15,
            username: 'john_doe',
        }]);
    });

    it('should handle consecutive mentions without spaces', () => {
        const mapValue = '@john_doe<x-name>@John Doe</x-name>@jane_smith<x-name>@Jane Smith</x-name>';
        const displayValue = '@John Doe@Jane Smith';
        const result = calculateMentionPositions(mapValue, displayValue);
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
        const mapValue = 'Hello @test.user-name_123<x-name>@Test User</x-name>';
        const displayValue = 'Hello @Test User';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 6,
            end: 16,
            username: 'test.user-name_123',
        }]);
    });

    it('should handle display names with special characters and unicode', () => {
        const mapValue = 'Hello @user123<x-name>@田中 太郎</x-name>';
        const displayValue = 'Hello @田中 太郎';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 6,
            end: 12, // Unicode characters count correctly
            username: 'user123',
        }]);
    });

    it('should handle same username mentioned multiple times', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>, how are you @john_doe<x-name>@John Doe</x-name>?';
        const displayValue = 'Hello @John Doe, how are you @John Doe?';
        const result = calculateMentionPositions(mapValue, displayValue);
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

    it('should handle display names with apostrophes and hyphens', () => {
        const mapValue = 'Hello @user.name<x-name>@John O\'Connor-Smith</x-name>';
        const displayValue = 'Hello @John O\'Connor-Smith';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 6,
            end: 26,
            username: 'user.name',
        }]);
    });

    it('should handle mentions with identical display names correctly', () => {
        const mapValue = 'Hello @john1<x-name>@John Doe</x-name> and @john2<x-name>@John Doe</x-name>';
        const displayValue = 'Hello @John Doe and @John Doe';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([
            {
                start: 6,
                end: 15,
                username: 'john1',
            },
            {
                start: 20,
                end: 29,
                username: 'john2',
            },
        ]);
    });

    it('should handle empty strings', () => {
        const mapValue = '';
        const displayValue = '';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([]);
    });

    it('should handle malformed mention tags gracefully', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name> and @broken<x-name>incomplete';
        const displayValue = 'Hello @John Doe and @broken<x-name>incomplete';
        const result = calculateMentionPositions(mapValue, displayValue);

        // The malformed mention (@broken<x-name>incomplete) won't match the regex,
        // so only the properly formed mention should be found
        expect(result).toEqual([{
            start: 6,
            end: 15,
            username: 'john_doe',
        }]);
    });

    it('should skip already processed positions when mentions overlap', () => {
        const mapValue = 'Test @user1<x-name>@John</x-name> @user2<x-name>@John Doe</x-name>';
        const displayValue = 'Test @John @John Doe';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([
            {
                start: 5,
                end: 10,
                username: 'user1',
            },
            {
                start: 11,
                end: 20,
                username: 'user2',
            },
        ]);
    });

    it('should handle mentions with spaces in display names', () => {
        const mapValue = 'Hello @user<x-name>@John Smith Jr.</x-name> there';
        const displayValue = 'Hello @John Smith Jr. there';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 6,
            end: 21,
            username: 'user',
        }]);
    });

    it('should handle mentions with punctuation following them', () => {
        const mapValue = 'Hello @john_doe<x-name>@John Doe</x-name>, how are you?';
        const displayValue = 'Hello @John Doe, how are you?';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([{
            start: 6,
            end: 15,
            username: 'john_doe',
        }]);
    });

    it('should handle long text with multiple mentions scattered throughout', () => {
        const mapValue = 'This is a long message with @user1<x-name>@User One</x-name> and some more text and then @user2<x-name>@User Two</x-name> at the end.';
        const displayValue = 'This is a long message with @User One and some more text and then @User Two at the end.';
        const result = calculateMentionPositions(mapValue, displayValue);
        expect(result).toEqual([
            {
                start: 28,
                end: 37,
                username: 'user1',
            },
            {
                start: 66,
                end: 75,
                username: 'user2',
            },
        ]);
    });
});
