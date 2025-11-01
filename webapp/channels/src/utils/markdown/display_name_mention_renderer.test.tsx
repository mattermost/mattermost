// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {formatWithRenderer} from 'utils/markdown';

import DisplayNameMentionRenderer from './display_name_mention_renderer';

describe('DisplayNameMentionRenderer', () => {
    const mockState = {
        entities: {
            users: {
                profiles: {
                    user1: {
                        id: 'user1',
                        username: 'john.doe',
                        first_name: 'John',
                        last_name: 'Doe',
                        nickname: 'Johnny',
                    },
                    user2: {
                        id: 'user2',
                        username: 'jane.smith',
                        first_name: 'Jane',
                        last_name: 'Smith',
                        nickname: '',
                    },
                },
                profilesInChannel: {},
                profilesNotInChannel: {},
                profilesWithoutTeam: {},
                profilesInTeam: {},
            },
            preferences: {
                myPreferences: {
                    'display_settings--name_format': {
                        category: 'display_settings',
                        name: 'name_format',
                        user_id: 'current_user_id',
                        value: 'nickname_full_name',
                    },
                },
            },
        },
    };

    const testCases = [
        {
            description: 'replaces mention with display name in plain text',
            inputText: 'Hey @john.doe how are you?',
            outputText: 'Hey @Johnny how are you?',
        },
        {
            description: 'replaces multiple mentions',
            inputText: 'Meeting with @john.doe and @jane.smith',
            outputText: 'Meeting with @Johnny and @Jane Smith',
        },
        {
            description: 'preserves special mention @channel',
            inputText: 'Hello @channel and @john.doe',
            outputText: 'Hello @channel and @Johnny',
        },
        {
            description: 'preserves special mention @all',
            inputText: 'Attention @all and @john.doe',
            outputText: 'Attention @all and @Johnny',
        },
        {
            description: 'preserves special mention @here',
            inputText: 'Hello @here and @john.doe',
            outputText: 'Hello @here and @Johnny',
        },
        {
            description: 'does not replace mentions in inline code',
            inputText: 'Check `@john.doe` variable',
            outputText: 'Check @john.doe variable',
        },
        {
            description: 'does not replace mentions in code blocks',
            inputText: 'Example:\n```\n@john.doe\n```',
            outputText: 'Example: @john.doe',
        },
        {
            description: 'replaces mention in text but not in code',
            inputText: 'Hey @john.doe, use `@john.doe` in code',
            outputText: 'Hey @Johnny, use @john.doe in code',
        },
        {
            description: 'preserves unknown user mentions',
            inputText: 'Hey @unknown.user',
            outputText: 'Hey @unknown.user',
        },
        {
            description: 'replaces mention in bold text and strips markdown',
            inputText: '**@john.doe** is here',
            outputText: '@Johnny is here',
        },
        {
            description: 'replaces mention in italic text and strips markdown',
            inputText: '*@john.doe* is here',
            outputText: '@Johnny is here',
        },
        {
            description: 'strips markdown after replacing mentions',
            inputText: '**Hi** @john.doe',
            outputText: 'Hi @Johnny',
        },
    ];

    testCases.forEach((testCase) => {
        it(testCase.description, () => {
            const renderer = new DisplayNameMentionRenderer(mockState as any, 'nickname_full_name');
            const result = formatWithRenderer(testCase.inputText, renderer);
            expect(result).toBe(testCase.outputText);
        });
    });

    it('handles empty text', () => {
        const renderer = new DisplayNameMentionRenderer(mockState as any, 'nickname_full_name');
        const result = formatWithRenderer('', renderer);
        expect(result).toBe('');
    });

    it('handles text without mentions', () => {
        const renderer = new DisplayNameMentionRenderer(mockState as any, 'nickname_full_name');
        const result = formatWithRenderer('Hello world', renderer);
        expect(result).toBe('Hello world');
    });
});
