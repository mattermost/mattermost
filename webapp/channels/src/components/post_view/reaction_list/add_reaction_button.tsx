// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';
import type {Post} from '@mattermost/types/posts';

import {Permissions} from 'mattermost-redux/constants';

import useEmojiPicker from 'components/emoji_picker/use_emoji_picker';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import AddReactionIcon from 'components/widgets/icons/add_reaction_icon';
import WithTooltip from 'components/with_tooltip';

type Props = {
    post: Post;
    teamId: string;

    onEmojiClick: (emoji: Emoji) => void;
}

export default function AddReactionButton({
    post,
    teamId,

    onEmojiClick,
}: Props) {
    const intl = useIntl();

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const handleEmojiClick = useCallback((emoji: Emoji) => {
        onEmojiClick(emoji);
        setShowEmojiPicker(false);
    }, [onEmojiClick]);

    const {
        emojiPicker,
        getReferenceProps,
        setReference,
    } = useEmojiPicker({
        showEmojiPicker,
        setShowEmojiPicker,

        onEmojiClick: handleEmojiClick,
    });

    const ariaLabel = intl.formatMessage({id: 'reaction.add.ariaLabel', defaultMessage: 'Add a reaction'});

    return (
        <span className='emoji-picker__container'>
            <ChannelPermissionGate
                channelId={post.channel_id}
                teamId={teamId}
                permissions={[Permissions.ADD_REACTION]}
            >
                <WithTooltip title={ariaLabel}>
                    <button
                        id={`addReaction-${post.id}`}
                        ref={setReference}
                        aria-label={ariaLabel}
                        className={classNames('Reaction Reaction__add', {
                            'Reaction__add--open': showEmojiPicker,
                        })}
                        {...getReferenceProps()}
                    >
                        <AddReactionIcon/>
                    </button>
                </WithTooltip>
            </ChannelPermissionGate>
            {emojiPicker}
        </span>
    );
}
