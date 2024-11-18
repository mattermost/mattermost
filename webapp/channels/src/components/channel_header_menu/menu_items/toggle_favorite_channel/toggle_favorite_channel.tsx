// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

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
    const toggleFavoriteChannel = () => {
        return isFavorite ? unfavoriteChannel(channelID) : favoriteChannel(channelID);
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
            onClick={toggleFavoriteChannel}
            labels={text}
        />
    );
};

export default memo(ToggleFavoriteChannel);
