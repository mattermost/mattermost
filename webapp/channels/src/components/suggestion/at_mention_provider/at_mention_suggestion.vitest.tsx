// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AtMentionSuggestion from './at_mention_suggestion';
import type {Item} from './at_mention_suggestion';

vi.mock('components/custom_status/custom_status_emoji', () => ({default: () => <div/>}));

describe('at mention suggestion', () => {
    const userid1 = {
        id: 'userid1',
        username: 'user',
        first_name: 'a',
        last_name: 'b',
        nickname: 'c',
        isCurrentUser: true,
    } as Item;

    const userid2 = {
        id: 'userid2',
        username: 'user2',
        first_name: 'a',
        last_name: 'b',
        nickname: 'c',
    } as Item;

    const baseProps = {
        id: 'test-suggestion-1',
        matchedPretext: '@',
        term: '@user',
        isSelection: false,
        onClick: vi.fn(),
        onMouseMove: vi.fn(),
    };

    test('should not display nick name of the signed in user', () => {
        const {container} = renderWithContext(
            <AtMentionSuggestion
                {...baseProps}
                item={userid1}
            />,
        );

        expect(container).toMatchSnapshot();

        const ellipsis = container.querySelector('.suggestion-list__ellipsis');
        expect(ellipsis?.textContent).toContain('a b');
        expect(ellipsis?.textContent).not.toContain('a b (c)');
    });

    test('should display nick name of non signed in user', () => {
        const {container} = renderWithContext(
            <AtMentionSuggestion
                {...baseProps}
                item={userid2}
            />,
        );

        expect(container).toMatchSnapshot();

        const ellipsis = container.querySelector('.suggestion-list__ellipsis');
        expect(ellipsis?.textContent).toContain('a b (c)');
    });

    describe('accessible text', () => {
        const testCases = [
            {
                name: 'at-mention suggestions should be labeled with the user\'s username and described with other names',
                term: '@test-user',
                item: {...TestHelper.getUserMock({username: 'test-user', first_name: 'First', last_name: 'Last', nickname: 'Nickname'})},
                expectedLabel: '@test-user',
                expectedDescription: 'First Last (Nickname)',
            },
            {
                name: 'at-mention suggestions should include status in the description',
                term: '@test-user',
                item: {...TestHelper.getUserMock({username: 'test-user', first_name: 'First', last_name: 'Last'}), status: 'online'},
                expectedLabel: '@test-user',
                expectedDescription: 'First Last Online',
            },
            {
                name: 'at-mention suggestions should include if the user is the current user',
                term: '@test-user',
                item: {...TestHelper.getUserMock({username: 'test-user', first_name: 'First', last_name: 'Last'}), isCurrentUser: true},
                expectedLabel: '@test-user',
                expectedDescription: 'First Last (you)',
            },
            {
                name: 'at-mention suggestions should include if the user is a bot',
                term: '@test-user',
                item: {...TestHelper.getUserMock({username: 'test-user', first_name: '', last_name: '', nickname: 'Nickname', is_bot: true})},
                expectedLabel: '@test-user',
                expectedDescription: '(Nickname) BOT',
            },
            {
                name: 'at-mention suggestions should include if the user is a remote user',
                term: '@test-user:remote',
                item: {...TestHelper.getUserMock({username: 'test-user:remote', first_name: '', last_name: '', remote_id: 'remote1'})},
                expectedLabel: '@test-user:remote',
                expectedDescription: 'shared user',
            },
            {
                name: 'group suggestions should be labeled with the group slug and described with the group name',
                term: '@test-group',
                item: TestHelper.getGroupMock({name: 'test-group', display_name: 'Test Group', member_count: 5}),
                expectedLabel: '@test-group',
                expectedDescription: '- Test Group 5 members',
            },
            {
                name: 'special mention suggestions should be labeled with the at-mention and described properly',
                term: '@channel',
                item: {username: 'channel'},
                expectedLabel: '@channel',
                expectedDescription: 'Notifies everyone in this channel',
            },
        ];

        for (const testCase of testCases) {
            test(testCase.name, () => {
                renderWithContext(
                    <AtMentionSuggestion
                        {...baseProps}
                        term={testCase.term}
                        item={testCase.item as Item}
                    />,
                );

                const suggestion = document.getElementById(baseProps.id);
                expect(suggestion).toBe(screen.getByLabelText(testCase.expectedLabel));
                expect(suggestion).toHaveAccessibleName(testCase.expectedLabel);
                expect(suggestion).toHaveAccessibleDescription(testCase.expectedDescription);
            });
        }
    });
});
