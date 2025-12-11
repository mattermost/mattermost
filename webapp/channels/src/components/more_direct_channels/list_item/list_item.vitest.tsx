// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {General} from 'mattermost-redux/constants';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import ListItem from './list_item';
import type {Props} from './list_item';

import type {OptionValue} from '../types';

describe('ListItem', () => {
    const baseProps: Props = {
        isMobileView: false,
        isSelected: false,
        add: vi.fn(),
        select: vi.fn(),
        option: {} as OptionValue,
    };

    test('should match snapshot when rendering user', () => {
        const user = {
            id: 'user_id_1',
            username: 'username1',
            last_post_at: 0,
        } as OptionValue;

        const {container} = renderWithContext(
            <ListItem
                {...baseProps}
                option={user}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when rendering GroupChannel', () => {
        const channel = {
            id: 'channel_id_1',
            type: General.GM_CHANNEL,
            display_name: 'user1, user2, user3',
            last_post_at: 0,
            profiles: [
                {
                    id: 'user_id_1',
                    username: 'user1',
                },
                {
                    id: 'user_id_2',
                    username: 'user2',
                },
                {
                    id: 'user_id_3',
                    username: 'user3',
                },
            ],
        } as OptionValue;

        const {container} = renderWithContext(
            <ListItem
                {...baseProps}
                option={channel}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
