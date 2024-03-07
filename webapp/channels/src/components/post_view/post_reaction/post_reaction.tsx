// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessages} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';

import Permissions from 'mattermost-redux/constants/permissions';
import {getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import WithTooltip from 'components/with_tooltip';

import {Locations} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

const TOP_OFFSET = -7;

const messages = defineMessages({
    addReaction: {
        id: 'post_info.tooltip.add_reactions',
        defaultMessage: 'Add Reaction',
    },
});

export type Props = {
    channelId?: string;
    postId: string;
    teamId: string;
    getDotMenuRef: () => HTMLDivElement | null;
    location: keyof typeof Locations;
    showEmojiPicker: boolean;
    toggleEmojiPicker: (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    actions: {
        toggleReaction: (postId: string, emojiName: string) => void;
    };
}

type State = {
    location: keyof typeof Locations;
    showEmojiPicker: boolean;
}

export default class PostReaction extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        location: Locations.CENTER as 'CENTER',
        showEmojiPicker: false,
    };

    handleToggleEmoji = (emoji: Emoji): void => {
        this.setState({showEmojiPicker: false});
        const emojiName = getEmojiName(emoji);
        this.props.actions.toggleReaction(this.props.postId, emojiName);
        this.props.toggleEmojiPicker();
    };

    render() {
        const {
            channelId,
            location,
            postId,
            showEmojiPicker,
            teamId,
        } = this.props;

        let spaceRequiredAbove;
        let spaceRequiredBelow;
        if (location === Locations.RHS_ROOT || location === Locations.RHS_COMMENT) {
            spaceRequiredAbove = EmojiPickerOverlay.RHS_SPACE_REQUIRED_ABOVE;
            spaceRequiredBelow = EmojiPickerOverlay.RHS_SPACE_REQUIRED_BELOW;
        }

        return (
            <ChannelPermissionGate
                channelId={channelId}
                teamId={teamId}
                permissions={[Permissions.ADD_REACTION]}
            >
                <React.Fragment>
                    <EmojiPickerOverlay
                        show={showEmojiPicker}
                        target={this.props.getDotMenuRef}
                        onHide={this.props.toggleEmojiPicker}
                        onEmojiClick={this.handleToggleEmoji}
                        topOffset={TOP_OFFSET}
                        spaceRequiredAbove={spaceRequiredAbove}
                        spaceRequiredBelow={spaceRequiredBelow}
                    />
                    <WithTooltip
                        id='reaction-icon-tooltip'
                        title={messages.addReaction}
                        placement='top'
                    >
                        <button
                            data-testid='post-reaction-emoji-icon'
                            id={`${location}_reaction_${postId}`}
                            aria-label={localizeMessage('post_info.tooltip.add_reactions', 'Add Reaction').toLowerCase()}
                            className={classNames('post-menu__item', 'post-menu__item--reactions', {
                                'post-menu__item--active': showEmojiPicker,
                            })}
                            onClick={this.props.toggleEmojiPicker}
                        >
                            <EmojiIcon className='icon icon--small'/>
                        </button>
                    </WithTooltip>
                </React.Fragment>
            </ChannelPermissionGate>
        );
    }
}
