// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {General} from 'mattermost-redux/constants';

import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ListItem from './list_item';
import type {Props} from './list_item';
import type {OptionValue} from '../types';

describe('ListItem', () => {
    const baseProps: Props = {
        isMobileView: false,
        isSelected: false,
        add: jest.fn(),
        select: jest.fn(),
        option: {} as OptionValue,
    };

    test('should render user correctly', () => {
        const user = {
            id: 'user_id_1',
            username: 'username1',
            last_post_at: 0,
        } as OptionValue;

        render(
            <ListItem
                {...baseProps}
                option={user}
            />,
        );

        expect(screen.getByText('@username1')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /add/i})).toBeInTheDocument();
    });

    test('should render GroupChannel correctly', () => {
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

        render(
            <ListItem
                {...baseProps}
                option={channel}
            />,
        );

        expect(screen.getByText('@user1, @user2, @user3')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /add/i})).toBeInTheDocument();
    });

    test('should call add and select handlers', async () => {
        const user = {
            id: 'user_id_1', 
            username: 'username1',
            last_post_at: 0,
        } as OptionValue;

        render(
            <ListItem
                {...baseProps}
                option={user}
            />,
        );

        const row = screen.getByRole('button', {name: /add/i}).closest('div.more-modal__row')!;
        
        await userEvent.hover(row);
        expect(baseProps.select).toHaveBeenCalledWith(user);

        await userEvent.click(row);
        expect(baseProps.add).toHaveBeenCalledWith(user);
    });
});
