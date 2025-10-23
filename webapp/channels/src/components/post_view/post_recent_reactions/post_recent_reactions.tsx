// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import WithTooltip from '@mattermost/design-system/src/components/primitives/with_tooltip';
import type {Emoji} from '@mattermost/types/emojis';

import Permissions from 'mattermost-redux/constants/permissions';
import {getEmojiImageUrl, getEmojiName} from 'mattermost-redux/utils/emoji_utils';

import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';

import EmojiItem from './recent_reactions_emoji_item';

type LocationTypes = 'CENTER' | 'RHS_ROOT' | 'RHS_COMMENT';

type Props = {
    channelId?: string;
    postId: string;
    teamId: string;
    location?: LocationTypes;
    locale: string;
    emojis: Emoji[];
    size?: number;
    defaultEmojis: Emoji[];
    actions: {
        toggleReaction: (postId: string, emojiName: string) => void;
    };
}

const PostRecentReactions = (({
    channelId,
    postId,
    teamId,
    locale,
    emojis,
    size = 3,
    defaultEmojis,
    actions,
}: Props) => {
    const handleToggleEmoji = useCallback((emoji: Emoji): void => {
        const emojiName = getEmojiName(emoji);
        actions.toggleReaction(postId, emojiName);
    }, []);

    const complementEmojis = (emojisToComplement: Emoji[]): Emoji[] => {
        const additional = defaultEmojis.filter((e) => {
            let ignore = false;
            for (const emoji of emojisToComplement) {
                if (e.name === emoji.name) {
                    ignore = true;
                    break;
                }
            }
            return !ignore;
        });
        const l = emojisToComplement.length;
        for (let i = 0; i < size - l; i++) {
            emojisToComplement.push(additional[i]);
        }

        return emojisToComplement;
    };

    const emojiName = (emoji: Emoji, emojiLocale: string): string => {
        function capitalizeFirstLetter(s: string) {
            return s[0].toLocaleUpperCase(emojiLocale) + s.slice(1);
        }
        const name = getEmojiName(emoji);
        return capitalizeFirstLetter(name.replace(/_/g, ' '));
    };

    let processedEmojis = [...emojis].slice(0, size);
    if (processedEmojis.length < size) {
        processedEmojis = complementEmojis(processedEmojis);
    }

    return processedEmojis.map((emoji, n) => (
        <ChannelPermissionGate
            key={emojiName(emoji, locale)} // emojis will be unique therefore no duplication expected.
            channelId={channelId}
            teamId={teamId}
            permissions={[Permissions.ADD_REACTION]}
        >
            <WithTooltip
                title={emojiName(emoji, locale)}
                emoji={getEmojiName(emoji)}
                emojiImageUrl={getEmojiImageUrl(emoji)}
                isEmojiLarge={true}
            >
                <li>
                    <EmojiItem
                        emoji={emoji}
                        onItemClick={handleToggleEmoji}
                        order={n}
                    />
                </li>
            </WithTooltip>
        </ChannelPermissionGate>
    ),
    );
});

export default PostRecentReactions;
