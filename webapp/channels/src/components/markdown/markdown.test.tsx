// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {TeamType} from '@mattermost/types/teams';

import Markdown from 'components/markdown';

import {renderWithContext} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';
import {TestHelper} from 'utils/test_helper';

describe('components/Markdown', () => {
    const baseProps = {
        channelNamesMap: {},
        enableFormatting: true,
        mentionKeys: [],
        message: 'This _is_ some **Markdown**',
        siteURL: 'https://markdown.example.com',
        team: TestHelper.getTeamMock({
            id: 'id123',
            invite_id: 'invite_id123',
            name: 'yourteamhere',
            create_at: 1,
            update_at: 2,
            delete_at: 3,
            display_name: 'test',
            description: 'test',
            email: 'test@test.com',
            type: 'T' as TeamType,
            company_name: 'test',
            allowed_domains: 'test',
            allow_open_invite: false,
            scheme_id: 'test',
            group_constrained: false,
        }),
        hasImageProxy: false,
        minimumHashtagLength: 3,
        emojiMap: new EmojiMap(new Map()),
        metadata: {},
    };

    test('should render properly', () => {
        const {container} = renderWithContext(<Markdown {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should not render markdown when formatting is disabled', () => {
        const props = {
            ...baseProps,
            enableFormatting: false,
        };

        const {container} = renderWithContext(<Markdown {...props}/>);
        expect(container).toMatchSnapshot();
    });

    describe('ordered lists', () => {
        test('should start lists at the correct number and set padding based on the final number', () => {
            const {rerender} = renderWithContext(<Markdown {...baseProps}/>);

            for (const [startIndex, endIndex, expectedPadding] of [
                [0, 3, '2.5ch'],
                [1, 9, '2.5ch'],
                [5, 10, '3.5ch'],
                [10, 99, '3.5ch'],
                [50, 150, '4.5ch'],
                [1, 1000, '5.5ch'],
                [999999, 1000000, '8.5ch'],
            ] as const) {
                let message = '';
                for (let i = startIndex; i <= endIndex; i++) {
                    message += `${i}. item\n`;
                }

                rerender(
                    <Markdown
                        {...baseProps}
                        message={message}
                    />,
                );

                const list = document.querySelector('ol.markdown__list');
                expect(list).toBeDefined();

                expect(getComputedStyle(list!)).toMatchObject({

                    // This value starts at one less than what's displayed to users
                    'counter-reset': `list ${startIndex - 1}`,
                    'padding-left': expectedPadding,
                });
            }
        });
    });
});
