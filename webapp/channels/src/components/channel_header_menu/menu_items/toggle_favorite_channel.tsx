// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';
import {isChannelInManagedCategory} from 'mattermost-redux/selectors/entities/channel_categories';

import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';

type Props = {
    channelID: string;
    isFavorite: boolean;
};

const ToggleFavoriteChannel = ({
    isFavorite,
    channelID,
}: Props) => {
    const dispatch = useDispatch();
    const isInManagedCategory = useSelector((state: GlobalState) => isChannelInManagedCategory(state, channelID));

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

    if (isInManagedCategory) {
        return (
            <WithTooltip
                title={
                    <FormattedMessage
                        id='channelHeader.managedCategoryFavoriteDisabled'
                        defaultMessage='Channels in managed categories cannot be favorited.'
                    />
                }
            >
                <div>
                    <Menu.Item
                        onClick={toggleFavorite}
                        labels={text}
                        disabled={true}
                    />
                </div>
            </WithTooltip>
        );
    }

    return (
        <Menu.Item
            onClick={toggleFavorite}
            labels={text}
        />
    );
};

export default memo(ToggleFavoriteChannel);
