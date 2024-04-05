// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import type {MouseEvent} from 'react';
import {useIntl} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import Menu from 'components/widgets/menu/menu';

type Action = {
    favoriteChannel: (channelId: string) => void;
    unfavoriteChannel: (channelId: string) => void;
};

type Props = {
    show?: boolean;
    channel: Channel;
    isFavorite: boolean;
    actions: Action;
};

const ToggleFavoriteChannel = ({
    show = true,
    isFavorite,
    actions: {
        favoriteChannel,
        unfavoriteChannel,
    },
    channel,
}: Props) => {
    const intl = useIntl();

    const toggleFavoriteChannel = useCallback((channelId: string) => {
        return isFavorite ? unfavoriteChannel(channelId) : favoriteChannel(channelId);
    }, [isFavorite, favoriteChannel, unfavoriteChannel]);

    const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        toggleFavoriteChannel(channel.id);
    }, [channel.id, toggleFavoriteChannel]);

    let text;
    if (isFavorite) {
        text = intl.formatMessage({id: 'channelHeader.removeFromFavorites', defaultMessage: 'Remove from Favorites'});
    } else {
        text = intl.formatMessage({id: 'channelHeader.addToFavorites', defaultMessage: 'Add to Favorites'});
    }
    return (
        <Menu.ItemAction
            show={show}
            onClick={handleClick}
            text={text}
        />
    );
};

export default memo(ToggleFavoriteChannel);
