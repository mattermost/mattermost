// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useRef, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';
import {getCurrentChannel, isCurrentChannelFavorite} from 'mattermost-redux/selectors/entities/channels';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import {Constants} from 'utils/constants';

const ChannelHeaderTitleFavorite = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const isFavorite = useSelector(isCurrentChannelFavorite);
    const channel = useSelector(getCurrentChannel);
    const channelIsArchived = channel.delete_at !== 0;
    const toggleFavoriteRef = useRef<HTMLButtonElement>(null);

    const toggleFavoriteCallback = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (isFavorite) {
            dispatch(unfavoriteChannel(channel.id));
        } else {
            dispatch(favoriteChannel(channel.id));
        }
    }, [isFavorite, channel.id]);

    const removeTooltipLink = useCallback(() => {
        // Bootstrap adds the attr dynamically, removing it to prevent a11y readout
        toggleFavoriteRef.current?.removeAttribute('aria-describedby');
    }, []);

    if (!channel || channelIsArchived) {
        return null;
    }

    let ariaLabel = intl.formatMessage({id: 'channelHeader.addToFavorites', defaultMessage: 'Add to Favorites'});
    if (isFavorite) {
        ariaLabel = intl.formatMessage({id: 'channelHeader.removeFromFavorites', defaultMessage: 'Remove from Favorites'});
    }
    ariaLabel = ariaLabel.toLowerCase();

    const toggleFavoriteTooltip = (
        <Tooltip id='favoriteTooltip' >
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
        </Tooltip>
    );

    return (
        <OverlayTrigger
            key={`isFavorite-${isFavorite}`}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='bottom'
            overlay={toggleFavoriteTooltip}
            onEntering={removeTooltipLink}
        >
            <button
                id='toggleFavorite'
                ref={toggleFavoriteRef}
                onClick={toggleFavoriteCallback}
                className={classNames('style--none color--link channel-header__favorites', {active: isFavorite, inactive: !isFavorite})}
                aria-label={ariaLabel}
            >
                <i className={classNames('icon', {'icon-star': isFavorite, 'icon-star-outline': !isFavorite})}/>
            </button>
        </OverlayTrigger>
    );
};

export default memo(ChannelHeaderTitleFavorite);
