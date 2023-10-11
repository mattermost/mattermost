// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Emoji} from '@mattermost/types/emojis';

import Permissions from 'mattermost-redux/constants/permissions';

import OverlayTrigger from 'components/overlay_trigger';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import Tooltip from 'components/tooltip';

import {Locations} from 'utils/constants';

import EmojiItem from './recent_reactions_emoji_item';

type LocationTypes = 'CENTER' | 'RHS_ROOT' | 'RHS_COMMENT';

type Props = {
    channelId?: string;
    postId: string;
    teamId: string;
    location?: LocationTypes;
    locale: string;
    emojis: Emoji[];
    size: number;
    defaultEmojis: Emoji[];
    actions: {
        addReaction: (postId: string, emojiName: string) => void;
    };
}

type State = {
    location: LocationTypes;
}

export default class PostRecentReactions extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        location: Locations.CENTER as 'CENTER',
        size: 3,
    };

    handleAddEmoji = (emoji: Emoji): void => {
        const emojiName = 'short_name' in emoji ? emoji.short_name : emoji.name;
        this.props.actions.addReaction(this.props.postId, emojiName);
    };

    complementEmojis = (emojis: Emoji[]): (Emoji[]) => {
        const additional = this.props.defaultEmojis.filter((e) => {
            let ignore = false;
            for (const emoji of emojis) {
                if (e.name === emoji.name) {
                    ignore = true;
                    break;
                }
            }
            return !ignore;
        });
        const l = emojis.length;
        for (let i = 0; i < this.props.size - l; i++) {
            emojis.push(additional[i]);
        }

        return emojis;
    };

    emojiName = (emoji: Emoji, locale: string): string => {
        function capitalizeFirstLetter(s: string) {
            return s[0].toLocaleUpperCase(locale) + s.slice(1);
        }
        const name = 'short_name' in emoji ? emoji.short_name : emoji.name;
        return capitalizeFirstLetter(name.replace(/_/g, ' '));
    };

    render() {
        const {
            channelId,
            teamId,
        } = this.props;

        let emojis = [...this.props.emojis].slice(0, this.props.size);
        if (emojis.length < this.props.size) {
            emojis = this.complementEmojis(emojis);
        }

        return emojis.map((emoji, n) => (
            <ChannelPermissionGate
                key={this.emojiName(emoji, this.props.locale)} // emojis will be unique therefore no duplication expected.
                channelId={channelId}
                teamId={teamId}
                permissions={[Permissions.ADD_REACTION]}
            >
                <OverlayTrigger
                    className='hidden-xs'
                    delayShow={500}
                    placement='top'
                    overlay={
                        <Tooltip
                            id='post_info.emoji.tooltip'
                            className='hidden-xs'
                        >
                            {this.emojiName(emoji, this.props.locale)}
                        </Tooltip>
                    }
                >
                    <div>
                        <React.Fragment>
                            <EmojiItem
                                emoji={emoji}
                                onItemClick={this.handleAddEmoji}
                                order={n}
                            />
                        </React.Fragment>
                    </div>
                </OverlayTrigger>
            </ChannelPermissionGate>
        ),
        );
    }
}
