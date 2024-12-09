// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import useCopyText from 'components/common/hooks/useCopyText';
import WithTooltip from 'components/with_tooltip';

import Constants from 'utils/constants';

const ChannelInfoRhsTopButtons = styled.div`
    display: flex;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    margin-top: 24px;
    padding: 0 18px;
`;

const Button = styled.button`
    flex: 1;
    padding: 12px 0 10px 0;
    border: 0;
    margin: 0 6px;
    background: rgba(var(--center-channel-color-rgb), 0.04);
    border-radius: 4px;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.8);

        & i {
            color: rgba(var(--center-channel-color-rgb), var(--icon-opacity-hover));
        }
    }

    &:active,
    &.active {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);

        & i {
            color: var(--button-bg-rgb);
        }
    }

    & i {
        color: rgba(var(--center-channel-color-rgb), var(--icon-opacity));
        font-size: 24px;
    }

    & span {
        font-size: 10px;
        font-weight: 600;
        line-height: 16px;
    }
`;

const CopyButton = styled(Button)`
    transition: background-color 0.5s ease;

    &:active,
    &.active {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.75);
        transition: none;
    }

    &.success {
        background: var(--denim-status-online);
        color: var(--button-color);
    }
`;

export interface Props {
    channelType: string;
    channelURL?: string;

    isFavorite: boolean;
    isMuted: boolean;
    isInvitingPeople: boolean;

    canAddPeople: boolean;

    actions: {
        toggleFavorite: () => void;
        toggleMute: () => void;
        addPeople: () => void;
    };
}

export default function TopButtons({
    channelType,
    channelURL,
    isFavorite,
    isMuted,
    isInvitingPeople,
    canAddPeople: propsCanAddPeople,
    actions,
}: Props) {
    const {formatMessage} = useIntl();

    const copyLink = useCopyText({
        text: channelURL || '',
        successCopyTimeout: 1000,
    });

    const canAddPeople = ([Constants.OPEN_CHANNEL, Constants.PRIVATE_CHANNEL].includes(channelType) && propsCanAddPeople) || channelType === Constants.GM_CHANNEL;

    const canCopyLink = [Constants.OPEN_CHANNEL, Constants.PRIVATE_CHANNEL].includes(channelType);

    // Favorite Button State
    const favoriteIcon = isFavorite ? 'icon-star' : 'icon-star-outline';
    const favoriteText = isFavorite ? formatMessage({id: 'channel_info_rhs.top_buttons.favorited', defaultMessage: 'Favorited'}) : formatMessage({id: 'channel_info_rhs.top_buttons.favorite', defaultMessage: 'Favorite'});

    // Mute Button State
    const mutedIcon = isMuted ? 'icon-bell-off-outline' : 'icon-bell-outline';
    const mutedText = isMuted ? formatMessage({id: 'channel_info_rhs.top_buttons.muted', defaultMessage: 'Muted'}) : formatMessage({id: 'channel_info_rhs.top_buttons.mute', defaultMessage: 'Mute'});

    // Copy Button State
    const copyIcon = copyLink.copiedRecently ? 'icon-check' : 'icon-link-variant';
    const copyText = copyLink.copiedRecently ? formatMessage({id: 'channel_info_rhs.top_buttons.copied', defaultMessage: 'Copied'}) : formatMessage({id: 'channel_info_rhs.top_buttons.copy', defaultMessage: 'Copy Link'});

    return (
        <ChannelInfoRhsTopButtons>
            <WithTooltip
                placement='top'
                id='favorite-tooltip'
                title={
                    <FormattedMessage
                        id='channel_info_rhs.top_buttons.favorite.tooltip'
                        defaultMessage='Add this channel to favorites'
                    />
                }
            >
                <Button
                    onClick={actions.toggleFavorite}
                    className={isFavorite ? 'active' : ''}
                >
                    <div>
                        <i className={'icon ' + favoriteIcon}/>
                    </div>
                    <span>{favoriteText}</span>
                </Button>
            </WithTooltip>
            <WithTooltip
                placement='top'
                id='mute-tooltip'
                title={
                    <FormattedMessage
                        id='channel_info_rhs.top_buttons.mute.tooltip'
                        defaultMessage='Mute notifications for this channel'
                    />
                }
            >
                <Button
                    onClick={actions.toggleMute}
                    className={isMuted ? 'active' : ''}
                >
                    <div>
                        <i className={'icon ' + mutedIcon}/>
                    </div>
                    <span>{mutedText}</span>
                </Button>
            </WithTooltip>
            {canAddPeople && (
                <WithTooltip
                    id='add-people-tooltip'
                    placement='top'
                    title={
                        <FormattedMessage
                            id='channel_info_rhs.top_buttons.add_people.tooltip'
                            defaultMessage='Add team members to this channel'
                        />
                    }
                >
                    <Button
                        onClick={actions.addPeople}
                        className={isInvitingPeople ? 'active' : ''}
                    >
                        <div>
                            <i className='icon icon-account-plus-outline'/>
                        </div>
                        <span>
                            <FormattedMessage
                                id='channel_info_rhs.top_buttons.add_people'
                                defaultMessage='Add People'
                            />
                        </span>
                    </Button>
                </WithTooltip>
            )}
            {canCopyLink && (
                <WithTooltip
                    id='copy-link-tooltip'
                    placement='top'
                    title={
                        <FormattedMessage
                            id='channel_info_rhs.top_buttons.copy_link.tooltip'
                            defaultMessage='Copy link to this channel'
                        />
                    }
                >
                    <CopyButton
                        onClick={copyLink.onClick}
                        className={copyLink.copiedRecently ? 'success' : ''}
                    >
                        <div>
                            <i className={'icon ' + copyIcon}/>
                        </div>
                        <span>{copyText}</span>
                    </CopyButton>
                </WithTooltip>
            )}
        </ChannelInfoRhsTopButtons>
    );
}
