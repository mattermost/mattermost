// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';

import * as Menu from 'components/menu';

type Props = {
    channelID: string;
    isFavorite: boolean;
};

const ToggleFavoriteChannel = ({
    isFavorite,
    channelID,
}: Props) => {
    const dispatch = useDispatch();
    const toggleFavorite = () => {
        if (isFavorite) {
            dispatch(unfavoriteChannel(channelID));
        } else {
            dispatch(favoriteChannel(channelID));
        }
    };

    let text = (
        <FormattedMessage
            id='channelHeader.addToFavorites'
            defaultMessage='Add to Favorites'
        />);
    if (isFavorite) {
        text = (
            <FormattedMessage
                id='channelHeader.removeFromFavorites'
                defaultMessage='Remove from Favorites'
            />);
    }
    return (
        <Menu.Item
            onClick={toggleFavorite}
            labels={text}
        />
    );
};

export default memo(ToggleFavoriteChannel);
