// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';
import {getCurrentChannel, isCurrentChannelFavorite} from 'mattermost-redux/selectors/entities/channels';

import WithTooltip from 'components/with_tooltip';

const ChannelHeaderTitleFavorite = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const isFavorite = useSelector(isCurrentChannelFavorite);
    const channel = useSelector(getCurrentChannel);
    const hasChannel = Boolean(channel);
    const channelId = channel?.id || '';

    const channelIsArchived = (channel?.delete_at ?? 0) > 0;

    const toggleFavoriteCallback = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (!hasChannel) {
            return;
        }
        if (isFavorite) {
            dispatch(unfavoriteChannel(channelId));
        } else {
            dispatch(favoriteChannel(channelId));
        }
    }, [hasChannel, isFavorite, dispatch, channelId]);

    const title = useMemo(() => (
        <>
            {!isFavorite &&
                <FormattedMessage
                    id='channelHeader.addToFavorites'
                    defaultMessage='Add to Favorites'
                />}
            {isFavorite &&
                <FormattedMessage
                    id='channelHeader.removeFromFavorites'
                    defaultMessage='Remove from Favorites'
                />}
        </>
    ), [isFavorite]);

    if (!channel || channelIsArchived) {
        return null;
    }

    let ariaLabel = intl.formatMessage({id: 'channelHeader.addToFavorites', defaultMessage: 'Add to Favorites'});
    if (isFavorite) {
        ariaLabel = intl.formatMessage({id: 'channelHeader.removeFromFavorites', defaultMessage: 'Remove from Favorites'});
    }
    ariaLabel = ariaLabel.toLowerCase();

    return (
        <WithTooltip
            key={`isFavorite-${isFavorite}`}
            id='favoriteTooltip'
            title={title}
            placement='bottom'
        >
            <button
                id='toggleFavorite'
                onClick={toggleFavoriteCallback}
                className={classNames('channel-header__favorites btn btn-icon btn-xs', {active: isFavorite, inactive: !isFavorite})}
                aria-label={ariaLabel}
            >
                <i className={classNames('icon', {'icon-star': isFavorite, 'icon-star-outline': !isFavorite})}/>
            </button>
        </WithTooltip>
    );
};

export default memo(ChannelHeaderTitleFavorite);
