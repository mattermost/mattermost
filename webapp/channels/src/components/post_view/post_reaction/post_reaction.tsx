// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';

import Permissions from 'mattermost-redux/constants/permissions';
import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import useEmojiPicker from 'components/emoji_picker/use_emoji_picker';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import WithTooltip from 'components/with_tooltip';

import {Locations} from 'utils/constants';

export type Props = {
    channelId?: string;
    postId: string;
    teamId: string;
    location?: keyof typeof Locations;
    setShowEmojiPicker: (showEmojiPicker: boolean) => void;
    showEmojiPicker: boolean;
    actions: {
        toggleReaction: (postId: string, emojiName: string) => void;
    };
}

export default function PostReaction({
    channelId,
    location = Locations.CENTER,
    postId,
    teamId,
    showEmojiPicker,
    setShowEmojiPicker,
    actions: {
        toggleReaction,
    },
}: Props) {
    const intl = useIntl();

    const handleEmojiClick = useCallback((emoji: Emoji) => {
        const emojiName = getEmojiName(emoji);
        toggleReaction(postId, emojiName);

        setShowEmojiPicker(false);
    }, [postId, setShowEmojiPicker, toggleReaction]);

    const {
        emojiPicker,
        getReferenceProps,
        setReference,
    } = useEmojiPicker({
        showEmojiPicker,
        setShowEmojiPicker,

        onEmojiClick: handleEmojiClick,
    });

    const ariaLabel = intl.formatMessage({id: 'post_info.tooltip.add_reactions', defaultMessage: 'Add Reaction'});

    return (
        <ChannelPermissionGate
            channelId={channelId}
            teamId={teamId}
            permissions={[Permissions.ADD_REACTION]}
        >
            <WithTooltip title={ariaLabel}>
                <button
                    ref={setReference}
                    data-testid='post-reaction-emoji-icon'
                    id={`${location}_reaction_${postId}`}
                    aria-label={ariaLabel}
                    className={classNames('post-menu__item', 'post-menu__item--reactions', {
                        'post-menu__item--active': showEmojiPicker,
                    })}
                    {...getReferenceProps()}
                >
                    <EmojiIcon className='icon icon--small'/>
                </button>
            </WithTooltip>
            {emojiPicker}
        </ChannelPermissionGate>
    );
}
