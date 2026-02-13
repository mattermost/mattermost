// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Emoji as EmojiType} from '@mattermost/types/emojis';
import type {Post} from '@mattermost/types/posts';
import type {Reaction} from '@mattermost/types/reactions';

import {GenericModal} from '@mattermost/components';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getCustomEmojisByName} from 'mattermost-redux/selectors/entities/emojis';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getEmojiImageUrl} from 'mattermost-redux/utils/emoji_utils';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import Avatar from 'components/widgets/users/avatar';

import * as Emoji from 'utils/emoji';

import type {GlobalState} from 'types/store';

import './view_reactions_modal.scss';

const EMPTY_REACTIONS: Record<string, Reaction> = {};

type Props = {
    post: Post;
    onExited: () => void;
};

type EmojiGroup = {
    emojiName: string;
    emojiImageUrl: string;
    reactions: Reaction[];
};

function getEmojiUrl(emojiName: string, customEmojisByName: Map<string, any>): string {
    let emoji: EmojiType | undefined;
    if (Emoji.EmojiIndicesByAlias.has(emojiName)) {
        emoji = Emoji.Emojis[Emoji.EmojiIndicesByAlias.get(emojiName) as number] as unknown as EmojiType;
    } else {
        emoji = customEmojisByName.get(emojiName) as EmojiType | undefined;
    }
    if (emoji) {
        return getEmojiImageUrl(emoji);
    }
    return '';
}

function UserRow({userId}: {userId: string}) {
    const user = useSelector((state: GlobalState) => getUser(state, userId));
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);

    if (!user) {
        return null;
    }

    const name = displayUsername(user, teammateNameDisplay);
    const avatarUrl = Client4.getProfilePictureUrl(userId, user.last_picture_update);

    return (
        <div className='view-reactions-modal__user-row'>
            <Avatar
                url={avatarUrl}
                size='sm'
                username={user.username}
            />
            <div className='view-reactions-modal__user-info'>
                <span className='view-reactions-modal__display-name'>{name}</span>
                <span className='view-reactions-modal__username'>{'@'}{user.username}</span>
            </div>
        </div>
    );
}

export default function ViewReactionsModal({post, onExited}: Props) {
    const dispatch = useDispatch();
    const reactions: Record<string, Reaction> = useSelector(
        (state: GlobalState) => state.entities.posts.reactions[post.id] || EMPTY_REACTIONS,
    );
    const customEmojisByName = useSelector(getCustomEmojisByName);

    const emojiGroups: EmojiGroup[] = useMemo(() => {
        const grouped: Record<string, Reaction[]> = {};
        for (const reaction of Object.values(reactions)) {
            if (!grouped[reaction.emoji_name]) {
                grouped[reaction.emoji_name] = [];
            }
            grouped[reaction.emoji_name].push(reaction);
        }

        return Object.entries(grouped).map(([emojiName, reacts]) => ({
            emojiName,
            emojiImageUrl: getEmojiUrl(emojiName, customEmojisByName),
            reactions: reacts,
        }));
    }, [reactions, customEmojisByName]);

    const [selectedEmoji, setSelectedEmoji] = useState<string>('');

    // Default to first emoji when groups change
    useEffect(() => {
        if (emojiGroups.length > 0 && (!selectedEmoji || !emojiGroups.some((g) => g.emojiName === selectedEmoji))) {
            setSelectedEmoji(emojiGroups[0].emojiName);
        }
    }, [emojiGroups, selectedEmoji]);

    // Fetch missing user profiles
    useEffect(() => {
        const userIds = [...new Set(Object.values(reactions).map((r) => r.user_id))];
        if (userIds.length > 0) {
            dispatch(getMissingProfilesByIds(userIds));
        }
    }, [dispatch, reactions]);

    const handleEmojiClick = useCallback((emojiName: string) => {
        setSelectedEmoji(emojiName);
    }, []);

    const selectedGroup = emojiGroups.find((g) => g.emojiName === selectedEmoji);

    return (
        <GenericModal
            id='viewReactionsModal'
            className='view-reactions-modal'
            modalHeaderText={
                <FormattedMessage
                    id='post_info.view_reactions'
                    defaultMessage='View Reactions'
                />
            }
            compassDesign={true}
            onExited={onExited}
            bodyPadding={false}
        >
            <div className='view-reactions-modal__content'>
                <div className='view-reactions-modal__emoji-list'>
                    {emojiGroups.map((group) => (
                        <button
                            key={group.emojiName}
                            className={`view-reactions-modal__emoji-item${group.emojiName === selectedEmoji ? ' view-reactions-modal__emoji-item--selected' : ''}`}
                            onClick={() => handleEmojiClick(group.emojiName)}
                        >
                            {group.emojiImageUrl ? (
                                <img
                                    className='view-reactions-modal__emoji-img'
                                    src={group.emojiImageUrl}
                                    alt={group.emojiName}
                                />
                            ) : (
                                <span className='view-reactions-modal__emoji-placeholder'>{`:${group.emojiName}:`}</span>
                            )}
                            <span className='view-reactions-modal__emoji-count'>{group.reactions.length}</span>
                        </button>
                    ))}
                </div>
                <div className='view-reactions-modal__user-list'>
                    {selectedGroup?.reactions.map((reaction) => (
                        <UserRow
                            key={reaction.user_id}
                            userId={reaction.user_id}
                        />
                    ))}
                </div>
            </div>
        </GenericModal>
    );
}
