// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import {generateMapValueFromInputValue, generateDisplayValueFromMapValue, generateRawValueFromInputValue, generateMapValueFromRawValue, generateRawValueFromMapValue, calculateMentionPositions, generateDisplayValueFromRawValue, convertDisplayPositionToRawPosition, convertRawPositionToDisplayPosition} from './util';

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

    it('should leave unknown users unchanged', () => {
        const rawValue = 'Hello @unknown_user';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @unknown_user');
    });

    it('should handle mixed existing and non-existing users', () => {
        mockDisplayUsername.mockReturnValue('John Doe');

        const rawValue = 'Hello @john_doe and @unknown_user';
        const users = {
            john_doe: {id: '1', username: 'john_doe'} as UserProfile,
        };

        const result = generateMapValueFromRawValue(rawValue, users);
        expect(result).toBe('Hello @john_doe<x-name>@John Doe</x-name> and @unknown_user');
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
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

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
        mockDisplayUsername.
            mockReturnValueOnce('John Doe').
            mockReturnValueOnce('Jane Smith');

        const rawPosition = 18; // Position within second mention
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
