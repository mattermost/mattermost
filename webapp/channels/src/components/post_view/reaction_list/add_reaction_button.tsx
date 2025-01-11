// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';
import type {Post} from '@mattermost/types/posts';

import {Permissions} from 'mattermost-redux/constants';

import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import AddReactionIcon from 'components/widgets/icons/add_reaction_icon';
import WithTooltip from 'components/with_tooltip';

const DEFAULT_EMOJI_PICKER_RIGHT_OFFSET = 15;
const EMOJI_PICKER_WIDTH_OFFSET = 260;

type Props = {
    post: Post;
    teamId: string;

    handleEmojiClick: (emoji: Emoji) => void;
    hideEmojiPicker: () => void;
    showEmojiPicker: boolean;
    toggleEmojiPicker: () => void;
}

export default function AddReactionButton(props: Props) {
    const intl = useIntl();

    const target = useRef<HTMLElement>(null);
    const getTarget = useCallback(() => target.current, []);

    const addReactionButton = getTarget();
    let rightOffset = DEFAULT_EMOJI_PICKER_RIGHT_OFFSET;
    if (addReactionButton) {
        rightOffset = window.innerWidth - addReactionButton.getBoundingClientRect().right - EMOJI_PICKER_WIDTH_OFFSET;

        if (rightOffset < 0) {
            rightOffset = DEFAULT_EMOJI_PICKER_RIGHT_OFFSET;
        }
    }

    const ariaLabel = intl.formatMessage({id: 'reaction.add.ariaLabel', defaultMessage: 'Add a reaction'});

    return (
        <span className='emoji-picker__container'>
            <EmojiPickerOverlay
                show={props.showEmojiPicker}
                target={getTarget}
                onHide={props.hideEmojiPicker}
                onEmojiClick={props.handleEmojiClick}
                rightOffset={rightOffset}
                topOffset={-5}
            />
            <ChannelPermissionGate
                channelId={props.post.channel_id}
                teamId={props.teamId}
                permissions={[Permissions.ADD_REACTION]}
            >
                <WithTooltip title={ariaLabel}>
                    <button
                        aria-label={ariaLabel}
                        className='Reaction'
                        onClick={props.toggleEmojiPicker}
                    >
                        <span
                            id={`addReaction-${props.post.id}`}
                            className='Reaction__add'
                            ref={target}
                        >
                            <AddReactionIcon/>
                        </span>
                    </button>
                </WithTooltip>
            </ChannelPermissionGate>
        </span>
    );
}
