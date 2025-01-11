// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';

import Permissions from 'mattermost-redux/constants/permissions';
import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import {RHS_SPACE_REQUIRED_ABOVE, RHS_SPACE_REQUIRED_BELOW} from 'components/emoji_picker/emoji_picker_overlay/emoji_picker_overlay';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import WithTooltip from 'components/with_tooltip';

import {Locations} from 'utils/constants';

const TOP_OFFSET = -7;

export type Props = {
    channelId?: string;
    postId: string;
    teamId: string;
    getDotMenuRef: () => HTMLDivElement | null;
    location?: keyof typeof Locations;
    showEmojiPicker: boolean;
    toggleEmojiPicker: (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    actions: {
        toggleReaction: (postId: string, emojiName: string) => void;
    };
}

export default function PostReaction({
    channelId,
    location = Locations.CENTER,
    postId,
    showEmojiPicker = false,
    teamId,
    toggleEmojiPicker,
    getDotMenuRef,
    actions: {
        toggleReaction,
    },
}: Props) {
    const intl = useIntl();

    const handleToggleEmoji = useCallback((emoji: Emoji) => {
        const emojiName = getEmojiName(emoji);
        toggleReaction(postId, emojiName);
        toggleEmojiPicker();
    }, [postId, toggleEmojiPicker, toggleReaction]);

    let spaceRequiredAbove;
    let spaceRequiredBelow;
    if (location === Locations.RHS_ROOT || location === Locations.RHS_COMMENT) {
        spaceRequiredAbove = RHS_SPACE_REQUIRED_ABOVE;
        spaceRequiredBelow = RHS_SPACE_REQUIRED_BELOW;
    }

    const ariaLabel = intl.formatMessage({id: 'post_info.tooltip.add_reactions', defaultMessage: 'Add Reaction'});

    return (
        <ChannelPermissionGate
            channelId={channelId}
            teamId={teamId}
            permissions={[Permissions.ADD_REACTION]}
        >
            <>
                <EmojiPickerOverlay
                    show={showEmojiPicker}
                    target={getDotMenuRef}
                    onHide={toggleEmojiPicker}
                    onEmojiClick={handleToggleEmoji}
                    topOffset={TOP_OFFSET}
                    spaceRequiredAbove={spaceRequiredAbove}
                    spaceRequiredBelow={spaceRequiredBelow}
                />
                <WithTooltip title={ariaLabel}>
                    <button
                        data-testid='post-reaction-emoji-icon'
                        id={`${location}_reaction_${postId}`}
                        aria-label={ariaLabel}
                        className={classNames('post-menu__item', 'post-menu__item--reactions', {
                            'post-menu__item--active': showEmojiPicker,
                        })}
                        onClick={toggleEmojiPicker}
                    >
                        <EmojiIcon className='icon icon--small'/>
                    </button>
                </WithTooltip>
            </>
        </ChannelPermissionGate>
    );
}
