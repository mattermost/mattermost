// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {
    AccountPlusOutlineIcon,
    BellOffOutlineIcon,
    BellOutlineIcon,
    CheckIcon,
    LinkVariantIcon,
    StarIcon,
    StarOutlineIcon,
} from '@mattermost/compass-icons/components';
import {ActionButton} from '@mattermost/compass-ui/components/action-button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import useCopyText from 'components/common/hooks/useCopyText';

import Constants from 'utils/constants';

const ChannelInfoRhsTopButtons = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    margin-top: 24px;
    padding: 0 18px;
`;

export interface Props {
    channelType: string;
    channelURL?: string;

    isFavorite: boolean;
    isMuted: boolean;
    isInvitingPeople: boolean;
    isArchived?: boolean;
    isInManagedCategory: boolean;

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
    isArchived = false,
    isInManagedCategory,
    canAddPeople: propsCanAddPeople,
    actions,
}: Props) {
    const {formatMessage} = useIntl();

    const copyLink = useCopyText({
        text: channelURL || '',
        successCopyTimeout: 1000,
    });

    const canAddPeople = !isArchived && (([Constants.OPEN_CHANNEL, Constants.PRIVATE_CHANNEL].includes(channelType) && propsCanAddPeople) || channelType === Constants.GM_CHANNEL);

    const canCopyLink = [Constants.OPEN_CHANNEL, Constants.PRIVATE_CHANNEL].includes(channelType);

    // Favorite Button State
    const favoriteIcon = isFavorite ? <StarIcon size={18}/> : <StarOutlineIcon size={18}/>;
    const favoriteText = isFavorite ? formatMessage({id: 'channel_info_rhs.top_buttons.favorited', defaultMessage: 'Favorited'}) : formatMessage({id: 'channel_info_rhs.top_buttons.favorite', defaultMessage: 'Favorite'});

    // Mute Button State
    const mutedIcon = isMuted ? <BellOffOutlineIcon size={18}/> : <BellOutlineIcon size={18}/>;
    const mutedText = isMuted ? formatMessage({id: 'channel_info_rhs.top_buttons.muted', defaultMessage: 'Muted'}) : formatMessage({id: 'channel_info_rhs.top_buttons.mute', defaultMessage: 'Mute'});

    // Copy Button State
    const copyIcon = copyLink.copiedRecently ? <CheckIcon size={18}/> : <LinkVariantIcon size={18}/>;
    const copyText = copyLink.copiedRecently ? formatMessage({id: 'channel_info_rhs.top_buttons.copied', defaultMessage: 'Copied'}) : formatMessage({id: 'channel_info_rhs.top_buttons.copy', defaultMessage: 'Copy Link'});

    return (
        <ChannelInfoRhsTopButtons>
            <WithTooltip
                title={
                    isInManagedCategory ? (
                        <FormattedMessage
                            id='channelHeader.managedCategoryFavoriteDisabled'
                            defaultMessage='Channels in managed categories cannot be favorited.'
                        />
                    ) : (
                        <FormattedMessage
                            id='channel_info_rhs.top_buttons.favorite.tooltip'
                            defaultMessage='Add this channel to favorites'
                        />
                    )
                }
            >
                <ActionButton
                    onClick={actions.toggleFavorite}
                    active={isFavorite}
                    disabled={isInManagedCategory}
                    aria-label={favoriteText}
                    id='channelInfoRHSAddFavoriteButton'
                    icon={<Icon glyph={favoriteIcon}/>}
                    label={favoriteText}
                />
            </WithTooltip>
            <WithTooltip
                title={
                    <FormattedMessage
                        id='channel_info_rhs.top_buttons.mute.tooltip'
                        defaultMessage='Mute notifications for this channel'
                    />
                }
            >
                <ActionButton
                    onClick={actions.toggleMute}
                    active={isMuted}
                    aria-label={mutedText}
                    id='channelInfoRHSMuteChannelButton'
                    icon={<Icon glyph={mutedIcon}/>}
                    label={mutedText}
                />
            </WithTooltip>
            {canAddPeople && (
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='channel_info_rhs.top_buttons.add_people.tooltip'
                            defaultMessage='Add team members to this channel'
                        />
                    }
                >
                    <ActionButton
                        onClick={actions.addPeople}
                        active={isInvitingPeople}
                        id='channelInfoRHSAddPeopleButton'
                        aria-label={formatMessage({id: 'channel_info_rhs.top_buttons.add_people', defaultMessage: 'Add People'})}
                        icon={<Icon glyph={<AccountPlusOutlineIcon size={18}/>}/>}
                        label={
                            <FormattedMessage
                                id='channel_info_rhs.top_buttons.add_people'
                                defaultMessage='Add People'
                            />
                        }
                    />
                </WithTooltip>
            )}
            {canCopyLink && (
                <WithTooltip
                    title={
                        <FormattedMessage
                            id='channel_info_rhs.top_buttons.copy_link.tooltip'
                            defaultMessage='Copy link to this channel'
                        />
                    }
                >
                    <ActionButton
                        onClick={copyLink.onClick}
                        aria-label={copyText}
                        icon={<Icon glyph={copyIcon}/>}
                        label={copyText}
                    />
                </WithTooltip>
            )}
        </ChannelInfoRhsTopButtons>
    );
}
