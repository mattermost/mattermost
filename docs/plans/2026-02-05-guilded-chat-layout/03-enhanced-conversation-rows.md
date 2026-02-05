# 03 - Enhanced Conversation Rows

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create rich conversation rows for both channels and DMs with avatar, display name, message preview, timestamp, unread count, and typing indicator.

**Architecture:** Two new components `EnhancedChannelRow` and `EnhancedDmRow` that replace the existing compact sidebar items when Guilded layout is active. Both share common styling but differ in avatar source (channel icon vs user profile).

**Tech Stack:** React, Redux, TypeScript, SCSS

**Depends on:** 01-feature-flag-and-infrastructure.md

---

## Task 1: Create EnhancedChannelRow Component

**Files:**
- Create: `webapp/channels/src/components/enhanced_channel_row/index.tsx`
- Create: `webapp/channels/src/components/enhanced_channel_row/enhanced_channel_row.scss`

**Step 1: Create the enhanced channel row component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';

import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import ChannelIcon from 'components/channel_icon';
import {getLastPostInChannel} from 'selectors/views/guilded_layout';
import {getRelativeTimestamp} from 'utils/datetime';

import type {GlobalState} from 'types/store';

import TypingIndicator from './typing_indicator';

import './enhanced_channel_row.scss';

interface Props {
    channel: Channel;
    isActive: boolean;
    onChannelClick?: () => void;
}

export default function EnhancedChannelRow({channel, isActive, onChannelClick}: Props) {
    const teamUrl = useSelector(getCurrentTeamUrl);
    const memberships = useSelector(getMyChannelMemberships);
    const lastPost = useSelector((state: GlobalState) => getLastPostInChannel(state, channel.id));
    const lastPostUser = useSelector((state: GlobalState) =>
        lastPost ? getUser(state, lastPost.user_id) : null
    );

    const membership = memberships[channel.id];
    const unreadCount = membership?.mention_count || 0;
    const hasUnread = (membership?.msg_count || 0) > 0 || unreadCount > 0;

    // Format last message preview
    let lastMessagePreview = '';
    if (lastPost) {
        const username = lastPostUser?.username || 'Unknown';
        const message = lastPost.message || '[Attachment]';
        lastMessagePreview = `${username}: ${message}`;
    }

    // Format timestamp
    const timestamp = lastPost ? getRelativeTimestamp(lastPost.create_at) : '';

    return (
        <Link
            to={`${teamUrl}/channels/${channel.name}`}
            className={classNames('enhanced-channel-row', {
                'enhanced-channel-row--active': isActive,
                'enhanced-channel-row--unread': hasUnread,
            })}
            onClick={onChannelClick}
        >
            <div className='enhanced-channel-row__icon'>
                <ChannelIcon
                    channel={channel}
                    size={40}
                />
            </div>
            <div className='enhanced-channel-row__content'>
                <div className='enhanced-channel-row__header'>
                    <span className='enhanced-channel-row__name'>
                        {channel.display_name}
                    </span>
                    {timestamp && (
                        <span className='enhanced-channel-row__timestamp'>
                            {timestamp}
                        </span>
                    )}
                </div>
                <div className='enhanced-channel-row__preview'>
                    <TypingIndicator channelId={channel.id} />
                    {lastMessagePreview && (
                        <span className='enhanced-channel-row__message'>
                            {lastMessagePreview}
                        </span>
                    )}
                </div>
            </div>
            {unreadCount > 0 && (
                <span className='enhanced-channel-row__badge'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
```

**Step 2: Create styles**

```scss
// enhanced_channel_row.scss

.enhanced-channel-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    margin: 2px 8px;
    border-radius: 6px;
    text-decoration: none;
    color: var(--sidebar-text);
    transition: background-color 0.1s ease;

    &:hover {
        background-color: rgba(var(--sidebar-text-rgb), 0.08);
        text-decoration: none;
        color: var(--sidebar-text);
    }

    &--active {
        background-color: rgba(var(--sidebar-text-rgb), 0.16);
    }

    &--unread {
        .enhanced-channel-row__name {
            font-weight: 600;
            color: var(--sidebar-unread-text);
        }

        .enhanced-channel-row__message {
            color: rgba(var(--sidebar-text-rgb), 0.8);
        }
    }

    &__icon {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        overflow: hidden;
        background: rgba(var(--sidebar-text-rgb), 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    &__content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    &__name {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__timestamp {
        flex-shrink: 0;
        font-size: 11px;
        color: rgba(var(--sidebar-text-rgb), 0.56);
    }

    &__preview {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 18px;
    }

    &__message {
        font-size: 13px;
        color: rgba(var(--sidebar-text-rgb), 0.64);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__badge {
        flex-shrink: 0;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        background-color: var(--error-text);
        color: white;
        font-size: 11px;
        font-weight: 600;
        line-height: 20px;
        text-align: center;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/enhanced_channel_row/
git commit -m "feat: create EnhancedChannelRow component"
```

---

## Task 2: Create Typing Indicator Component

**Files:**
- Create: `webapp/channels/src/components/enhanced_channel_row/typing_indicator.tsx`
- Create: `webapp/channels/src/components/enhanced_channel_row/typing_indicator.scss`

**Step 1: Create typing indicator**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {makeGetUsersTypingByChannelAndPost} from 'mattermost-redux/selectors/entities/typing';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import './typing_indicator.scss';

interface Props {
    channelId: string;
}

const getUsersTyping = makeGetUsersTypingByChannelAndPost();

export default function TypingIndicator({channelId}: Props) {
    const typingUsers = useSelector((state: GlobalState) =>
        getUsersTyping(state, channelId, null)
    );

    const firstTypingUser = useSelector((state: GlobalState) => {
        const userIds = Object.keys(typingUsers || {});
        if (userIds.length === 0) {
            return null;
        }
        return getUser(state, userIds[0]);
    });

    if (!firstTypingUser) {
        return null;
    }

    const typingCount = Object.keys(typingUsers || {}).length;

    return (
        <span className='typing-indicator'>
            <span className='typing-indicator__dots'>
                <span className='typing-indicator__dot' />
                <span className='typing-indicator__dot' />
                <span className='typing-indicator__dot' />
            </span>
            <span className='typing-indicator__text'>
                {typingCount === 1
                    ? `${firstTypingUser.username} is typing...`
                    : `${typingCount} people typing...`
                }
            </span>
        </span>
    );
}
```

**Step 2: Create styles**

```scss
// typing_indicator.scss

.typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;

    &__dots {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    &__dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background-color: var(--sidebar-text-active-border);
        animation: typing-bounce 1.4s infinite ease-in-out both;

        &:nth-child(1) {
            animation-delay: -0.32s;
        }

        &:nth-child(2) {
            animation-delay: -0.16s;
        }

        &:nth-child(3) {
            animation-delay: 0s;
        }
    }

    &__text {
        font-size: 12px;
        font-style: italic;
        color: var(--sidebar-text-active-border);
    }
}

@keyframes typing-bounce {
    0%, 80%, 100% {
        transform: scale(0.6);
        opacity: 0.6;
    }
    40% {
        transform: scale(1);
        opacity: 1;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/enhanced_channel_row/typing_indicator.tsx
git add webapp/channels/src/components/enhanced_channel_row/typing_indicator.scss
git commit -m "feat: create typing indicator component"
```

---

## Task 3: Create EnhancedDmRow Component

**Files:**
- Create: `webapp/channels/src/components/enhanced_dm_row/index.tsx`
- Create: `webapp/channels/src/components/enhanced_dm_row/enhanced_dm_row.scss`

**Step 1: Create the enhanced DM row component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import StatusIcon from 'components/status_icon';
import TypingIndicator from 'components/enhanced_channel_row/typing_indicator';
import {getLastPostInChannel} from 'selectors/views/guilded_layout';
import {getRelativeTimestamp} from 'utils/datetime';

import type {GlobalState} from 'types/store';

import './enhanced_dm_row.scss';

interface Props {
    channel: Channel;
    user: UserProfile;
    isActive: boolean;
    onDmClick?: () => void;
}

export default function EnhancedDmRow({channel, user, isActive, onDmClick}: Props) {
    const teamUrl = useSelector(getCurrentTeamUrl);
    const memberships = useSelector(getMyChannelMemberships);
    const status = useSelector((state: GlobalState) => getStatusForUserId(state, user.id)) || 'offline';
    const lastPost = useSelector((state: GlobalState) => getLastPostInChannel(state, channel.id));

    const membership = memberships[channel.id];
    const unreadCount = membership?.mention_count || 0;
    const hasUnread = unreadCount > 0;

    // Format last message preview
    let lastMessagePreview = '';
    if (lastPost) {
        lastMessagePreview = lastPost.message || '[Attachment]';
    }

    // Format timestamp
    const timestamp = lastPost ? getRelativeTimestamp(lastPost.create_at) : '';

    // Display name (nickname > full name > username)
    const displayName = user.nickname ||
        (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '') ||
        user.username;

    return (
        <Link
            to={`${teamUrl}/messages/@${user.username}`}
            className={classNames('enhanced-dm-row', {
                'enhanced-dm-row--active': isActive,
                'enhanced-dm-row--unread': hasUnread,
                'enhanced-dm-row--offline': status === 'offline',
            })}
            onClick={onDmClick}
        >
            <div className='enhanced-dm-row__avatar-container'>
                <img
                    className='enhanced-dm-row__avatar'
                    src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                    alt={displayName}
                />
                <StatusIcon
                    className='enhanced-dm-row__status'
                    status={status}
                />
            </div>
            <div className='enhanced-dm-row__content'>
                <div className='enhanced-dm-row__header'>
                    <span className='enhanced-dm-row__name'>
                        {displayName}
                    </span>
                    {timestamp && (
                        <span className='enhanced-dm-row__timestamp'>
                            {timestamp}
                        </span>
                    )}
                </div>
                <div className='enhanced-dm-row__preview'>
                    <TypingIndicator channelId={channel.id} />
                    {!lastPost && status !== 'offline' && (
                        <span className='enhanced-dm-row__status-text'>
                            {status === 'online' && 'Online'}
                            {status === 'away' && 'Away'}
                            {status === 'dnd' && 'Do Not Disturb'}
                        </span>
                    )}
                    {lastMessagePreview && (
                        <span className='enhanced-dm-row__message'>
                            {lastMessagePreview}
                        </span>
                    )}
                </div>
            </div>
            {unreadCount > 0 && (
                <span className='enhanced-dm-row__badge'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
```

**Step 2: Create styles**

```scss
// enhanced_dm_row.scss

.enhanced-dm-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    margin: 2px 8px;
    border-radius: 6px;
    text-decoration: none;
    color: var(--sidebar-text);
    transition: background-color 0.1s ease;

    &:hover {
        background-color: rgba(var(--sidebar-text-rgb), 0.08);
        text-decoration: none;
        color: var(--sidebar-text);
    }

    &--active {
        background-color: rgba(var(--sidebar-text-rgb), 0.16);
    }

    &--unread {
        .enhanced-dm-row__name {
            font-weight: 600;
            color: var(--sidebar-unread-text);
        }

        .enhanced-dm-row__message {
            color: rgba(var(--sidebar-text-rgb), 0.8);
        }
    }

    &--offline {
        .enhanced-dm-row__avatar {
            filter: grayscale(50%);
            opacity: 0.7;
        }
    }

    &__avatar-container {
        position: relative;
        flex-shrink: 0;
        width: 40px;
        height: 40px;
    }

    &__avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
    }

    &__status {
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 14px;
        height: 14px;
        border: 2px solid var(--sidebar-bg);
        border-radius: 50%;
    }

    &__content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    &__name {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__timestamp {
        flex-shrink: 0;
        font-size: 11px;
        color: rgba(var(--sidebar-text-rgb), 0.56);
    }

    &__preview {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 18px;
    }

    &__message {
        font-size: 13px;
        color: rgba(var(--sidebar-text-rgb), 0.64);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__status-text {
        font-size: 13px;
        color: rgba(var(--sidebar-text-rgb), 0.56);
    }

    &__badge {
        flex-shrink: 0;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        background-color: var(--error-text);
        color: white;
        font-size: 11px;
        font-weight: 600;
        line-height: 20px;
        text-align: center;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/enhanced_dm_row/
git commit -m "feat: create EnhancedDmRow component"
```

---

## Task 4: Create Last Post Selector

**Files:**
- Modify: `webapp/channels/src/selectors/views/guilded_layout.ts`

**Step 1: Add last post selector**

```typescript
// Add to existing guilded_layout.ts selectors

import {getPostsInChannel} from 'mattermost-redux/selectors/entities/posts';

/**
 * Get the last post in a channel for preview purposes
 */
export function getLastPostInChannel(state: GlobalState, channelId: string) {
    const posts = getPostsInChannel(state, channelId) || [];
    if (posts.length === 0) {
        return null;
    }
    // Posts are ordered newest first
    return posts[0];
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/selectors/views/guilded_layout.ts
git commit -m "feat: add getLastPostInChannel selector"
```

---

## Task 5: Create Relative Timestamp Utility

**Files:**
- Create: `webapp/channels/src/utils/datetime.ts` (or modify existing)

**Step 1: Add relative timestamp function**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Get a relative timestamp string like "2m ago", "1h", "Yesterday", etc.
 */
export function getRelativeTimestamp(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return 'Now';
    }

    if (minutes < 60) {
        return `${minutes}m`;
    }

    if (hours < 24) {
        return `${hours}h`;
    }

    if (days === 1) {
        return 'Yesterday';
    }

    if (days < 7) {
        return `${days}d`;
    }

    // Format as date for older messages
    const date = new Date(timestamp);
    const month = date.toLocaleString('default', {month: 'short'});
    const day = date.getDate();
    return `${month} ${day}`;
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/utils/datetime.ts
git commit -m "feat: add getRelativeTimestamp utility"
```

---

## Task 6: Create EnhancedGroupDmRow Component

**Files:**
- Create: `webapp/channels/src/components/enhanced_group_dm_row/index.tsx`
- Create: `webapp/channels/src/components/enhanced_group_dm_row/enhanced_group_dm_row.scss`

**Step 1: Create the enhanced group DM row component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import TypingIndicator from 'components/enhanced_channel_row/typing_indicator';
import {getLastPostInChannel} from 'selectors/views/guilded_layout';
import {getRelativeTimestamp} from 'utils/datetime';

import type {GlobalState} from 'types/store';

import './enhanced_group_dm_row.scss';

interface Props {
    channel: Channel;
    users: UserProfile[];
    isActive: boolean;
    onDmClick?: () => void;
}

const MAX_AVATARS = 3;

export default function EnhancedGroupDmRow({channel, users, isActive, onDmClick}: Props) {
    const teamUrl = useSelector(getCurrentTeamUrl);
    const memberships = useSelector(getMyChannelMemberships);
    const lastPost = useSelector((state: GlobalState) => getLastPostInChannel(state, channel.id));

    const membership = memberships[channel.id];
    const unreadCount = membership?.mention_count || 0;
    const hasUnread = unreadCount > 0;

    // Format last message preview
    let lastMessagePreview = '';
    if (lastPost) {
        const sender = users.find((u) => u.id === lastPost.user_id);
        const senderName = sender?.username || 'Unknown';
        lastMessagePreview = `${senderName}: ${lastPost.message || '[Attachment]'}`;
    }

    // Format timestamp
    const timestamp = lastPost ? getRelativeTimestamp(lastPost.create_at) : '';

    // Display name
    const displayName = channel.display_name || users.map((u) => u.username).join(', ');

    // Avatars to show (max 3)
    const visibleUsers = users.slice(0, MAX_AVATARS);
    const extraCount = users.length - MAX_AVATARS;

    return (
        <Link
            to={`${teamUrl}/messages/${channel.name}`}
            className={classNames('enhanced-group-dm-row', {
                'enhanced-group-dm-row--active': isActive,
                'enhanced-group-dm-row--unread': hasUnread,
            })}
            onClick={onDmClick}
        >
            <div className='enhanced-group-dm-row__avatars'>
                {visibleUsers.map((user, index) => (
                    <img
                        key={user.id}
                        className='enhanced-group-dm-row__avatar'
                        style={{zIndex: MAX_AVATARS - index}}
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        alt={user.username}
                    />
                ))}
                {extraCount > 0 && (
                    <span className='enhanced-group-dm-row__extra'>
                        +{extraCount}
                    </span>
                )}
            </div>
            <div className='enhanced-group-dm-row__content'>
                <div className='enhanced-group-dm-row__header'>
                    <span className='enhanced-group-dm-row__name'>
                        {displayName}
                    </span>
                    {timestamp && (
                        <span className='enhanced-group-dm-row__timestamp'>
                            {timestamp}
                        </span>
                    )}
                </div>
                <div className='enhanced-group-dm-row__preview'>
                    <TypingIndicator channelId={channel.id} />
                    {lastMessagePreview && (
                        <span className='enhanced-group-dm-row__message'>
                            {lastMessagePreview}
                        </span>
                    )}
                </div>
            </div>
            {unreadCount > 0 && (
                <span className='enhanced-group-dm-row__badge'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
```

**Step 2: Create styles**

```scss
// enhanced_group_dm_row.scss

.enhanced-group-dm-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    margin: 2px 8px;
    border-radius: 6px;
    text-decoration: none;
    color: var(--sidebar-text);
    transition: background-color 0.1s ease;

    &:hover {
        background-color: rgba(var(--sidebar-text-rgb), 0.08);
        text-decoration: none;
        color: var(--sidebar-text);
    }

    &--active {
        background-color: rgba(var(--sidebar-text-rgb), 0.16);
    }

    &--unread {
        .enhanced-group-dm-row__name {
            font-weight: 600;
            color: var(--sidebar-unread-text);
        }
    }

    &__avatars {
        position: relative;
        display: flex;
        flex-shrink: 0;
        width: 40px;
        height: 40px;
    }

    &__avatar {
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid var(--sidebar-bg);
        object-fit: cover;

        &:nth-child(1) {
            top: 0;
            left: 0;
        }

        &:nth-child(2) {
            top: 0;
            right: 0;
        }

        &:nth-child(3) {
            bottom: 0;
            left: 8px;
        }
    }

    &__extra {
        position: absolute;
        bottom: 0;
        right: 0;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        background-color: rgba(var(--sidebar-text-rgb), 0.2);
        color: var(--sidebar-text);
        font-size: 10px;
        font-weight: 600;
        line-height: 18px;
        text-align: center;
    }

    &__content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    &__name {
        font-size: 14px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__timestamp {
        flex-shrink: 0;
        font-size: 11px;
        color: rgba(var(--sidebar-text-rgb), 0.56);
    }

    &__preview {
        display: flex;
        align-items: center;
        gap: 4px;
        min-height: 18px;
    }

    &__message {
        font-size: 13px;
        color: rgba(var(--sidebar-text-rgb), 0.64);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__badge {
        flex-shrink: 0;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        background-color: var(--error-text);
        color: white;
        font-size: 11px;
        font-weight: 600;
        line-height: 20px;
        text-align: center;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/enhanced_group_dm_row/
git commit -m "feat: create EnhancedGroupDmRow component"
```

---

## Task 7: Export Components

**Files:**
- Create: `webapp/channels/src/components/enhanced_channel_row/index.ts`
- Create: `webapp/channels/src/components/enhanced_dm_row/index.ts`
- Create: `webapp/channels/src/components/enhanced_group_dm_row/index.ts`

**Step 1: Create index exports**

Each component folder should have a clean export:

```typescript
// Already handled by the main index.tsx files with default exports
// These are optional re-exports if needed
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: ensure clean component exports"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | enhanced_channel_row/ | Enhanced channel row with preview |
| 2 | typing_indicator.tsx | Typing indicator dots + text |
| 3 | enhanced_dm_row/ | Enhanced DM row with avatar, status |
| 4 | guilded_layout.ts | Last post selector |
| 5 | datetime.ts | Relative timestamp utility |
| 6 | enhanced_group_dm_row/ | Group DM with stacked avatars |
| 7 | Various | Export cleanup |

**Next:** [04-dm-page.md](./04-dm-page.md)
