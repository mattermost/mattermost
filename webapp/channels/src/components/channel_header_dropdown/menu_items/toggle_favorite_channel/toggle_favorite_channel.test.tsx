// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import Menu from 'components/widgets/menu/menu';

import ToggleFavoriteChannel from './toggle_favorite_channel';

describe('components/ChannelHeaderDropdown/MenuItem.ToggleFavoriteChannel', () => {
    const baseProps = {
        channel: {
            id: 'channel_id',
            display_name: 'channel_display_name',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: '',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
        },
        actions: {
            favoriteChannel: jest.fn(),
            unfavoriteChannel: jest.fn(),
        },
    };

    const propsForFavorite = {
        ...baseProps,
        isFavorite: true,
        actions: {
            favoriteChannel: jest.fn(),
            unfavoriteChannel: jest.fn(),
        },
    };

    const propsForNotFavorite = {
        ...baseProps,
        isFavorite: false,
        actions: {
            favoriteChannel: jest.fn(),
            unfavoriteChannel: jest.fn(),
        },
    };

    it('should match snapshot for favorite channel', () => {
        const wrapper = shallow(<ToggleFavoriteChannel {...propsForFavorite}/>);
        expect(wrapper).toMatchSnapshot();
    });

    it('should runs unfavoriteChannel function for favorite channel', () => {
        const wrapper = shallow(<ToggleFavoriteChannel {...propsForFavorite}/>);

        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });

        expect(propsForFavorite.actions.unfavoriteChannel).toHaveBeenCalledWith(propsForFavorite.channel.id);
        expect(propsForFavorite.actions.favoriteChannel).not.toHaveBeenCalled();
    });

    it('should match snapshot for not favorite channel', () => {
        const wrapper = shallow(<ToggleFavoriteChannel {...propsForNotFavorite}/>);

        expect(wrapper).toMatchSnapshot();
    });

    it('should runs favoriteChannel function for not favorite channel', () => {
        const wrapper = shallow(<ToggleFavoriteChannel {...propsForNotFavorite}/>);

        wrapper.find(Menu.ItemAction).simulate('click', {
            preventDefault: jest.fn(),
        });

        expect(propsForNotFavorite.actions.favoriteChannel).toHaveBeenCalledWith(propsForFavorite.channel.id);
        expect(propsForNotFavorite.actions.unfavoriteChannel).not.toHaveBeenCalled();
    });
});
