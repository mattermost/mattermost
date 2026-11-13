// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl, FormattedMessage, defineMessage} from 'react-intl';
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
import {Icon} from '@mattermost/compass-ui/components/icon';
import {TileButton} from '@mattermost/compass-ui/components/tile-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import useCopyText from 'components/common/hooks/useCopyText';

import type {KindMessages} from 'utils/channel_kind';
import Constants from 'utils/constants';

import type {ChannelKind} from 'types/store/plugins';

const ChannelInfoRhsTopButtons = styled.div`
    display: flex;
    gap: var(--spacing-xs);
    color: rgba(var(--center-channel-color-rgb), 0.75);
    margin-top: 24px;
    padding: 0 18px;

    /* TileButton defaults to a fixed 108px width; share the RHS row evenly. */
    > button {
        flex: 1 1 0;
        width: auto;
        min-width: 0;
    }
`;

const messages = {
    favorite: {
        channel: defineMessage({id: 'channel_info_rhs.top_buttons.favorite.tooltip', defaultMessage: 'Add this channel to favorites'}),
        board: defineMessage({id: 'channel_info_rhs.top_buttons.favorite.tooltip.board', defaultMessage: 'Add this board to favorites'}),
    },
    mute: {
        channel: defineMessage({id: 'channel_info_rhs.top_buttons.mute.tooltip', defaultMessage: 'Mute notifications for this channel'}),
        board: defineMessage({id: 'channel_info_rhs.top_buttons.mute.tooltip.board', defaultMessage: 'Mute notifications for this board'}),
    },
    addPeople: {
        channel: defineMessage({id: 'channel_info_rhs.top_buttons.add_people.tooltip', defaultMessage: 'Add team members to this channel'}),
        board: defineMessage({id: 'channel_info_rhs.top_buttons.add_people.tooltip.board', defaultMessage: 'Add team members to this board'}),
    },
    copyLink: {
        channel: defineMessage({id: 'channel_info_rhs.top_buttons.copy_link.tooltip', defaultMessage: 'Copy link to this channel'}),
        board: defineMessage({id: 'channel_info_rhs.top_buttons.copy_link.tooltip.board', defaultMessage: 'Copy link to this board'}),
    },
} satisfies Record<string, KindMessages>;

export interface Props {
    channelKind?: ChannelKind;
    channelType: string;
    channelURL?: string;

    isFavorite: boolean;
    isMuted: boolean;
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
    channelKind = 'channel',
    channelType,
    channelURL,
    isFavorite,
    isMuted,
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

    // Toggle labels stay constant; state is conveyed by aria-pressed (via TileButton `toggled`).
    const favoriteIcon = isFavorite ? <StarIcon/> : <StarOutlineIcon/>;
    const favoriteText = formatMessage({id: 'channel_info_rhs.top_buttons.favorite', defaultMessage: 'Favorite'});

    const mutedIcon = isMuted ? <BellOffOutlineIcon/> : <BellOutlineIcon/>;
    const mutedText = formatMessage({id: 'channel_info_rhs.top_buttons.mute', defaultMessage: 'Mute'});

    // Copy Button State
    const copyIcon = copyLink.copiedRecently ? <CheckIcon/> : <LinkVariantIcon/>;
    const copyText = copyLink.copiedRecently ? formatMessage({id: 'channel_info_rhs.top_buttons.copied', defaultMessage: 'Copied'}) : formatMessage({id: 'channel_info_rhs.top_buttons.copy', defaultMessage: 'Copy Link'});

    let favoriteTooltip;
    if (isInManagedCategory) {
        favoriteTooltip = (
            <FormattedMessage
                id='channelHeader.managedCategoryFavoriteDisabled'
                defaultMessage='Channels in managed categories cannot be favorited.'
            />
        );
    } else {
        favoriteTooltip = <FormattedMessage {...messages.favorite[channelKind]}/>;
    }

    return (
        <ChannelInfoRhsTopButtons>
            <WithTooltip
                title={favoriteTooltip}
            >
                <TileButton
                    onClick={actions.toggleFavorite}
                    toggled={isFavorite}
                    disabled={isInManagedCategory}
                    aria-label={favoriteText}
                    id='channelInfoRHSAddFavoriteButton'
                    icon={<Icon glyph={favoriteIcon}/>}
                    label={favoriteText}
                />
            </WithTooltip>
            <WithTooltip
                title={<FormattedMessage {...messages.mute[channelKind]}/>}
            >
                <TileButton
                    onClick={actions.toggleMute}
                    toggled={isMuted}
                    aria-label={mutedText}
                    id='channelInfoRHSMuteChannelButton'
                    icon={<Icon glyph={mutedIcon}/>}
                    label={mutedText}
                />
            </WithTooltip>
            {canAddPeople && (
                <WithTooltip
                    title={<FormattedMessage {...messages.addPeople[channelKind]}/>}
                >
                    <TileButton
                        onClick={actions.addPeople}
                        id='channelInfoRHSAddPeopleButton'
                        aria-label={formatMessage({id: 'channel_info_rhs.top_buttons.add_people', defaultMessage: 'Add People'})}
                        aria-haspopup='dialog'
                        icon={<Icon glyph={<AccountPlusOutlineIcon/>}/>}
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
                    title={<FormattedMessage {...messages.copyLink[channelKind]}/>}
                >
                    <TileButton
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
