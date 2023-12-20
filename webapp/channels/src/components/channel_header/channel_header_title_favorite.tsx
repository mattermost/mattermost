// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useRef, useCallback} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import {Constants } from 'utils/constants';
import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';
import {getCurrentChannel, isCurrentChannelFavorite} from 'mattermost-redux/selectors/entities/channels';

type Props = {}

const ChannelHeaderTitleFavorite = ({}: Props) => {
    const intl = useIntl();
    const dispatch = useDispatch()
    const isFavorite = useSelector(isCurrentChannelFavorite);
    const channel = useSelector(getCurrentChannel) || {};
    const channelIsArchived = channel.delete_at !== 0;

    const toggleFavoriteCallback = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (isFavorite) {
            dispatch(unfavoriteChannel(channel.id));
        } else {
            dispatch(favoriteChannel(channel.id));
        }
    }, [isFavorite, unfavoriteChannel, favoriteChannel, channel.id]);

    const toggleFavoriteRef = useRef<HTMLButtonElement>(null);

    const removeTooltipLink = useCallback(() => {
        // Bootstrap adds the attr dynamically, removing it to prevent a11y readout
        toggleFavoriteRef.current?.removeAttribute('aria-describedby');
    }, []);

    if (channelIsArchived) {
        return null
    }

    const formattedMessage = isFavorite ? {
        id: 'channelHeader.removeFromFavorites',
        defaultMessage: 'Remove from Favorites',
    } : {
        id: 'channelHeader.addToFavorites',
        defaultMessage: 'Add to Favorites',
    };

    const ariaLabel = intl.formatMessage(formattedMessage).toLowerCase();

    const toggleFavoriteTooltip = (
        <Tooltip id='favoriteTooltip' >
            <FormattedMessage
                {...formattedMessage}
            />
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
                className={'style--none color--link channel-header__favorites ' + (isFavorite ? 'active' : 'inactive')}
                aria-label={ariaLabel}
            >
                <i className={'icon ' + (isFavorite ? 'icon-star' : 'icon-star-outline')}/>
            </button>
        </OverlayTrigger>
    );
};

export default memo(ChannelHeaderTitleFavorite);
