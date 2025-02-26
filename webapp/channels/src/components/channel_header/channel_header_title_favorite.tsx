// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';
import {getCurrentChannel, isCurrentChannelFavorite} from 'mattermost-redux/selectors/entities/channels';

import WithTooltip from 'components/with_tooltip';

import type {A11yFocusEventDetail} from 'utils/constants';
import {A11yCustomEventTypes} from 'utils/constants';

const ChannelHeaderTitleFavorite = () => {
    const intl = useIntl();
    const dispatch = useDispatch();
    const isFavorite = useSelector(isCurrentChannelFavorite);
    const channel = useSelector(getCurrentChannel);
    const channelIsArchived = (channel?.delete_at ?? 0) > 0;
    const favIconRef = useRef<HTMLButtonElement>(null);

    const toggleFavoriteCallback = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (!channel) {
            return;
        }
        if (isFavorite) {
            dispatch(unfavoriteChannel(channel.id));
        } else {
            dispatch(favoriteChannel(channel.id));
        }
        requestAnimationFrame(() => {
            if (favIconRef.current) {
                document.dispatchEvent(
                    new CustomEvent<A11yFocusEventDetail>(A11yCustomEventTypes.FOCUS, {
                        detail: {
                            target: favIconRef.current,
                            keyboardOnly: false,
                        },
                    }),
                );
            }
        });
    }, [isFavorite, channel, dispatch]);

    if (!channel || channelIsArchived) {
        return null;
    }

    let ariaLabel = intl.formatMessage({id: 'channelHeader.addToFavorites', defaultMessage: 'Add to Favorites'});
    if (isFavorite) {
        ariaLabel = intl.formatMessage({id: 'channelHeader.removeFromFavorites', defaultMessage: 'Remove from Favorites'});
    }
    ariaLabel = ariaLabel.toLowerCase();

    const title = (
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
    );

    return (
        <WithTooltip
            title={title}
        >
            <button
                id='toggleFavorite'
                onClick={toggleFavoriteCallback}
                className={classNames('channel-header__favorites btn btn-icon btn-xs', {active: isFavorite, inactive: !isFavorite})}
                aria-label={ariaLabel}
                ref={favIconRef}
            >
                <i className={classNames('icon', {'icon-star': isFavorite, 'icon-star-outline': !isFavorite})}/>
            </button>
        </WithTooltip>
    );
};

export default memo(ChannelHeaderTitleFavorite);
