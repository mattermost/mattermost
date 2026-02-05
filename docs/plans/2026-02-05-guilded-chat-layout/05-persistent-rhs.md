# 05 - Persistent RHS

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a persistent right sidebar with Members/Threads tabs that stays visible in channels, hides for 1:1 DMs, and shows participants for Group DMs.

**Architecture:** `PersistentRhs` component replaces the existing RHS when Guilded layout is active. Contains tab bar with Members and Threads tabs. Members tab uses Discord-style grouping by status/role. Threads tab shows active threads in the channel.

**Tech Stack:** React, Redux, TypeScript, SCSS, react-window (virtualization)

**Depends on:** 01-feature-flag-and-infrastructure.md

---

## Task 1: Create PersistentRhs Component Structure

**Files:**
- Create: `webapp/channels/src/components/persistent_rhs/index.tsx`
- Create: `webapp/channels/src/components/persistent_rhs/persistent_rhs.scss`

**Step 1: Create the persistent RHS component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {setRhsTab} from 'actions/views/guilded_layout';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import RhsTabBar from './rhs_tab_bar';
import MembersTab from './members_tab';
import ThreadsTab from './threads_tab';
import GroupDmParticipants from './group_dm_participants';

import './persistent_rhs.scss';

export default function PersistentRhs() {
    const dispatch = useDispatch();

    const channel = useSelector(getCurrentChannel);
    const activeTab = useSelector((state: GlobalState) => state.views.guildedLayout.rhsActiveTab);

    const handleTabChange = useCallback((tab: 'members' | 'threads') => {
        dispatch(setRhsTab(tab));
    }, [dispatch]);

    // Hide for 1:1 DMs
    if (channel?.type === Constants.DM_CHANNEL) {
        return null;
    }

    // Show participants list for Group DMs
    if (channel?.type === Constants.GM_CHANNEL) {
        return (
            <div className='persistent-rhs persistent-rhs--group-dm'>
                <div className='persistent-rhs__header'>
                    <h3 className='persistent-rhs__title'>Participants</h3>
                </div>
                <GroupDmParticipants channelId={channel.id} />
            </div>
        );
    }

    // Regular channel - show Members/Threads tabs
    return (
        <div className='persistent-rhs'>
            <RhsTabBar
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />
            <div className='persistent-rhs__content'>
                {activeTab === 'members' ? (
                    <MembersTab />
                ) : (
                    <ThreadsTab />
                )}
            </div>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// persistent_rhs.scss

.persistent-rhs {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--sidebar-bg);
    border-left: 1px solid rgba(var(--center-channel-color-rgb), 0.08);

    &--group-dm {
        // Slightly different styling for group DM view
    }

    &__header {
        display: flex;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    }

    &__title {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--center-channel-color);
    }

    &__content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_rhs/
git commit -m "feat: create PersistentRhs component structure"
```

---

## Task 2: Create RhsTabBar Component

**Files:**
- Create: `webapp/channels/src/components/persistent_rhs/rhs_tab_bar.tsx`
- Create: `webapp/channels/src/components/persistent_rhs/rhs_tab_bar.scss`

**Step 1: Create the tab bar**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './rhs_tab_bar.scss';

interface Props {
    activeTab: 'members' | 'threads';
    onTabChange: (tab: 'members' | 'threads') => void;
}

export default function RhsTabBar({activeTab, onTabChange}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='rhs-tab-bar'>
            <WithTooltip
                title={formatMessage({id: 'rhs_tab_bar.members', defaultMessage: 'Members'})}
            >
                <button
                    className={classNames('rhs-tab-bar__tab', {
                        'rhs-tab-bar__tab--active': activeTab === 'members',
                    })}
                    onClick={() => onTabChange('members')}
                    aria-label={formatMessage({id: 'rhs_tab_bar.members', defaultMessage: 'Members'})}
                >
                    <i className='icon icon-account-multiple-outline' />
                </button>
            </WithTooltip>
            <WithTooltip
                title={formatMessage({id: 'rhs_tab_bar.threads', defaultMessage: 'Threads'})}
            >
                <button
                    className={classNames('rhs-tab-bar__tab', {
                        'rhs-tab-bar__tab--active': activeTab === 'threads',
                    })}
                    onClick={() => onTabChange('threads')}
                    aria-label={formatMessage({id: 'rhs_tab_bar.threads', defaultMessage: 'Threads'})}
                >
                    <i className='icon icon-message-text-outline' />
                </button>
            </WithTooltip>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// rhs_tab_bar.scss

.rhs-tab-bar {
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);

    &__tab {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        cursor: pointer;
        transition: background-color 0.1s ease, color 0.1s ease;

        &:hover {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
            color: var(--center-channel-color);
        }

        &--active {
            background-color: rgba(var(--button-bg-rgb), 0.12);
            color: var(--button-bg);

            &:hover {
                background-color: rgba(var(--button-bg-rgb), 0.16);
                color: var(--button-bg);
            }
        }

        .icon {
            font-size: 22px;
        }
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_rhs/rhs_tab_bar.tsx
git add webapp/channels/src/components/persistent_rhs/rhs_tab_bar.scss
git commit -m "feat: create RhsTabBar component"
```

---

## Task 3: Create MembersTab Component (Discord-style)

**Files:**
- Create: `webapp/channels/src/components/persistent_rhs/members_tab.tsx`
- Create: `webapp/channels/src/components/persistent_rhs/members_tab.scss`

**Step 1: Create the members tab with status grouping**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import {getChannelMembersGroupedByStatus} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import MemberRow from './member_row';

import './members_tab.scss';

const GROUP_HEADER_HEIGHT = 32;
const MEMBER_ROW_HEIGHT = 44;

interface ListItem {
    type: 'header' | 'member';
    label?: string;
    count?: number;
    user?: any;
    status?: string;
    isAdmin?: boolean;
}

export default function MembersTab() {
    const channel = useSelector(getCurrentChannel);
    const groupedMembers = useSelector((state: GlobalState) =>
        channel ? getChannelMembersGroupedByStatus(state, channel.id) : null
    );

    // Flatten grouped members into list items
    const listItems: ListItem[] = useMemo(() => {
        if (!groupedMembers) {
            return [];
        }

        const items: ListItem[] = [];

        // Online Admins
        if (groupedMembers.onlineAdmins.length > 0) {
            items.push({
                type: 'header',
                label: 'Admin',
                count: groupedMembers.onlineAdmins.length,
            });
            for (const member of groupedMembers.onlineAdmins) {
                items.push({
                    type: 'member',
                    user: member.user,
                    status: member.status,
                    isAdmin: true,
                });
            }
        }

        // Online Members
        if (groupedMembers.onlineMembers.length > 0) {
            items.push({
                type: 'header',
                label: 'Member',
                count: groupedMembers.onlineMembers.length,
            });
            for (const member of groupedMembers.onlineMembers) {
                items.push({
                    type: 'member',
                    user: member.user,
                    status: member.status,
                    isAdmin: false,
                });
            }
        }

        // Offline
        if (groupedMembers.offline.length > 0) {
            items.push({
                type: 'header',
                label: 'Offline',
                count: groupedMembers.offline.length,
            });
            for (const member of groupedMembers.offline) {
                items.push({
                    type: 'member',
                    user: member.user,
                    status: 'offline',
                    isAdmin: member.isAdmin,
                });
            }
        }

        return items;
    }, [groupedMembers]);

    const getItemSize = useCallback((index: number) => {
        const item = listItems[index];
        return item.type === 'header' ? GROUP_HEADER_HEIGHT : MEMBER_ROW_HEIGHT;
    }, [listItems]);

    const renderItem = useCallback(({index, style}: {index: number; style: React.CSSProperties}) => {
        const item = listItems[index];

        if (item.type === 'header') {
            return (
                <div className='members-tab__group-header' style={style}>
                    <span className='members-tab__group-label'>
                        {item.label} — {item.count}
                    </span>
                </div>
            );
        }

        return (
            <div style={style}>
                <MemberRow
                    user={item.user}
                    status={item.status || 'offline'}
                    isAdmin={item.isAdmin || false}
                />
            </div>
        );
    }, [listItems]);

    if (listItems.length === 0) {
        return (
            <div className='members-tab members-tab--empty'>
                <span>No members</span>
            </div>
        );
    }

    return (
        <div className='members-tab'>
            <AutoSizer>
                {({height, width}) => (
                    <VariableSizeList
                        height={height}
                        width={width}
                        itemCount={listItems.length}
                        itemSize={getItemSize}
                    >
                        {renderItem}
                    </VariableSizeList>
                )}
            </AutoSizer>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// members_tab.scss

.members-tab {
    height: 100%;

    &--empty {
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        font-size: 14px;
    }

    &__group-header {
        display: flex;
        align-items: center;
        padding: 16px 16px 4px;
    }

    &__group-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_rhs/members_tab.tsx
git add webapp/channels/src/components/persistent_rhs/members_tab.scss
git commit -m "feat: create MembersTab component with Discord-style grouping"
```

---

## Task 4: Create MemberRow Component

**Files:**
- Create: `webapp/channels/src/components/persistent_rhs/member_row.tsx`
- Create: `webapp/channels/src/components/persistent_rhs/member_row.scss`

**Step 1: Create the member row**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import StatusIcon from 'components/status_icon';
import ProfilePopover from 'components/profile_popover';
import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import {makeGetCustomStatus} from 'selectors/views/custom_status';

import type {GlobalState} from 'types/store';

import './member_row.scss';

interface Props {
    user: UserProfile;
    status: string;
    isAdmin: boolean;
}

export default function MemberRow({user, status, isAdmin}: Props) {
    const getCustomStatus = makeGetCustomStatus();
    const customStatus = useSelector((state: GlobalState) => getCustomStatus(state, user.id));

    const displayName = user.nickname ||
        (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : '') ||
        user.username;

    const isOffline = status === 'offline';

    return (
        <ProfilePopover
            triggerComponentClass='member-row__trigger'
            userId={user.id}
            src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
        >
            <div className={classNames('member-row', {'member-row--offline': isOffline})}>
                <div className='member-row__avatar-container'>
                    <img
                        className='member-row__avatar'
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        alt={displayName}
                    />
                    <StatusIcon
                        className='member-row__status-icon'
                        status={status}
                    />
                </div>
                <div className='member-row__info'>
                    <div className='member-row__name-row'>
                        <span className='member-row__name'>{displayName}</span>
                        {user.is_bot && (
                            <span className='member-row__bot-tag'>BOT</span>
                        )}
                    </div>
                    {customStatus?.text && (
                        <div className='member-row__custom-status'>
                            <CustomStatusEmoji
                                userID={user.id}
                                emojiSize={14}
                                showTooltip={false}
                            />
                            <span className='member-row__custom-status-text'>
                                {customStatus.text}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </ProfilePopover>
    );
}
```

**Step 2: Create styles**

```scss
// member_row.scss

.member-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.1s ease;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &--offline {
        opacity: 0.5;

        .member-row__avatar {
            filter: grayscale(100%);
        }
    }

    &__trigger {
        display: contents;
    }

    &__avatar-container {
        position: relative;
        flex-shrink: 0;
        width: 32px;
        height: 32px;
    }

    &__avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
    }

    &__status-icon {
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 12px;
        height: 12px;
        border: 2px solid var(--sidebar-bg);
        border-radius: 50%;
    }

    &__info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    &__name-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    &__name {
        font-size: 14px;
        font-weight: 500;
        color: var(--center-channel-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__bot-tag {
        padding: 1px 4px;
        border-radius: 3px;
        background-color: var(--button-bg);
        color: white;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
    }

    &__custom-status {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 2px;
    }

    &__custom-status-text {
        font-size: 12px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_rhs/member_row.tsx
git add webapp/channels/src/components/persistent_rhs/member_row.scss
git commit -m "feat: create MemberRow component"
```

---

## Task 5: Create Channel Members Selector

**Files:**
- Modify: `webapp/channels/src/selectors/views/guilded_layout.ts`

**Step 1: Add selector for grouped channel members**

```typescript
// Add to existing guilded_layout.ts

import {getChannelMembersInChannels, getProfilesInChannel} from 'mattermost-redux/selectors/entities/channels';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

interface MemberWithStatus {
    user: UserProfile;
    status: string;
    isAdmin: boolean;
}

interface GroupedMembers {
    onlineAdmins: MemberWithStatus[];
    onlineMembers: MemberWithStatus[];
    offline: MemberWithStatus[];
}

/**
 * Get channel members grouped by status (online admins, online members, offline)
 */
export const getChannelMembersGroupedByStatus = createSelector(
    'getChannelMembersGroupedByStatus',
    (state: GlobalState, channelId: string) => getProfilesInChannel(state, channelId),
    (state: GlobalState, channelId: string) => getChannelMembersInChannels(state)?.[channelId],
    (state: GlobalState) => state,
    (profiles, memberships, state): GroupedMembers | null => {
        if (!profiles || !memberships) {
            return null;
        }

        const result: GroupedMembers = {
            onlineAdmins: [],
            onlineMembers: [],
            offline: [],
        };

        for (const user of profiles) {
            const membership = memberships[user.id];
            const status = getStatusForUserId(state, user.id) || 'offline';
            const isAdmin = membership?.scheme_admin === true;
            const isOnline = status !== 'offline';

            const memberInfo: MemberWithStatus = {
                user,
                status,
                isAdmin,
            };

            if (!isOnline) {
                result.offline.push(memberInfo);
            } else if (isAdmin) {
                result.onlineAdmins.push(memberInfo);
            } else {
                result.onlineMembers.push(memberInfo);
            }
        }

        // Sort each group alphabetically by display name
        const sortByName = (a: MemberWithStatus, b: MemberWithStatus) => {
            const nameA = a.user.nickname || a.user.username;
            const nameB = b.user.nickname || b.user.username;
            return nameA.localeCompare(nameB);
        };

        result.onlineAdmins.sort(sortByName);
        result.onlineMembers.sort(sortByName);
        result.offline.sort(sortByName);

        return result;
    },
);
```

**Step 2: Commit**

```bash
git add webapp/channels/src/selectors/views/guilded_layout.ts
git commit -m "feat: add getChannelMembersGroupedByStatus selector"
```

---

## Task 6: Create ThreadsTab Component

**Files:**
- Create: `webapp/channels/src/components/persistent_rhs/threads_tab.tsx`
- Create: `webapp/channels/src/components/persistent_rhs/threads_tab.scss`

**Step 1: Create the threads tab**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import AutoSizer from 'react-virtualized-auto-sizer';
import {FixedSizeList} from 'react-window';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {getThreadsInChannel} from 'selectors/views/guilded_layout';

import type {GlobalState} from 'types/store';

import ThreadRow from './thread_row';

import './threads_tab.scss';

const ROW_HEIGHT = 72;

export default function ThreadsTab() {
    const history = useHistory();

    const channel = useSelector(getCurrentChannel);
    const teamUrl = useSelector(getCurrentTeamUrl);
    const threads = useSelector((state: GlobalState) =>
        channel ? getThreadsInChannel(state, channel.id) : []
    );

    const handleThreadClick = useCallback((threadId: string) => {
        history.push(`${teamUrl}/pl/${threadId}`);
    }, [history, teamUrl]);

    const renderRow = useCallback(({index, style}: {index: number; style: React.CSSProperties}) => {
        const thread = threads[index];

        return (
            <div style={style}>
                <ThreadRow
                    thread={thread}
                    onClick={() => handleThreadClick(thread.id)}
                />
            </div>
        );
    }, [threads, handleThreadClick]);

    if (threads.length === 0) {
        return (
            <div className='threads-tab threads-tab--empty'>
                <i className='icon icon-message-text-outline threads-tab__empty-icon' />
                <span className='threads-tab__empty-text'>No threads yet</span>
                <span className='threads-tab__empty-hint'>
                    Threads will appear here when someone replies to a message
                </span>
            </div>
        );
    }

    return (
        <div className='threads-tab'>
            <AutoSizer>
                {({height, width}) => (
                    <FixedSizeList
                        height={height}
                        width={width}
                        itemCount={threads.length}
                        itemSize={ROW_HEIGHT}
                    >
                        {renderRow}
                    </FixedSizeList>
                )}
            </AutoSizer>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// threads_tab.scss

.threads-tab {
    height: 100%;

    &--empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 32px;
        text-align: center;
    }

    &__empty-icon {
        font-size: 48px;
        color: rgba(var(--center-channel-color-rgb), 0.24);
        margin-bottom: 8px;
    }

    &__empty-text {
        font-size: 16px;
        font-weight: 600;
        color: var(--center-channel-color);
    }

    &__empty-hint {
        font-size: 14px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        max-width: 200px;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_rhs/threads_tab.tsx
git add webapp/channels/src/components/persistent_rhs/threads_tab.scss
git commit -m "feat: create ThreadsTab component"
```

---

## Task 7: Create ThreadRow Component

**Files:**
- Create: `webapp/channels/src/components/persistent_rhs/thread_row.tsx`
- Create: `webapp/channels/src/components/persistent_rhs/thread_row.scss`

**Step 1: Create the thread row**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {getThread} from 'mattermost-redux/selectors/entities/threads';

import type {GlobalState} from 'types/store';

import './thread_row.scss';

interface ThreadInfo {
    id: string;
    rootPost: Post;
    replyCount: number;
    participants: string[];
    hasUnread: boolean;
}

interface Props {
    thread: ThreadInfo;
    onClick: () => void;
}

const MAX_AVATARS = 4;

export default function ThreadRow({thread, onClick}: Props) {
    const participants = useSelector((state: GlobalState) => {
        return thread.participants
            .slice(0, MAX_AVATARS)
            .map((userId) => getUser(state, userId))
            .filter(Boolean);
    });

    // Truncate message preview
    const messagePreview = thread.rootPost.message.slice(0, 100) +
        (thread.rootPost.message.length > 100 ? '...' : '');

    return (
        <div
            className={classNames('thread-row', {'thread-row--unread': thread.hasUnread})}
            onClick={onClick}
            role='button'
            tabIndex={0}
        >
            <div className='thread-row__content'>
                <span className='thread-row__preview'>
                    {messagePreview || '[Attachment]'}
                </span>
                <div className='thread-row__meta'>
                    <span className='thread-row__reply-count'>
                        {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                    {thread.hasUnread && (
                        <span className='thread-row__unread-dot' />
                    )}
                </div>
            </div>
            <div className='thread-row__participants'>
                {participants.map((user) => (
                    <img
                        key={user.id}
                        className='thread-row__avatar'
                        src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                        alt={user.username}
                    />
                ))}
            </div>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// thread_row.scss

.thread-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background-color 0.1s ease;

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &--unread {
        background-color: rgba(var(--button-bg-rgb), 0.08);

        .thread-row__preview {
            font-weight: 600;
        }
    }

    &__content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    &__preview {
        font-size: 14px;
        color: var(--center-channel-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    &__meta {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    &__reply-count {
        font-size: 12px;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }

    &__unread-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--button-bg);
    }

    &__participants {
        display: flex;
        flex-shrink: 0;
    }

    &__avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid var(--sidebar-bg);
        object-fit: cover;
        margin-left: -8px;

        &:first-child {
            margin-left: 0;
        }
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_rhs/thread_row.tsx
git add webapp/channels/src/components/persistent_rhs/thread_row.scss
git commit -m "feat: create ThreadRow component"
```

---

## Task 8: Create Threads Selector

**Files:**
- Modify: `webapp/channels/src/selectors/views/guilded_layout.ts`

**Step 1: Add selector for threads in channel**

```typescript
// Add to existing guilded_layout.ts

import {getPostsInChannel, getPost} from 'mattermost-redux/selectors/entities/posts';
import {getThreads, getThread} from 'mattermost-redux/selectors/entities/threads';

interface ThreadInfo {
    id: string;
    rootPost: Post;
    replyCount: number;
    participants: string[];
    hasUnread: boolean;
}

/**
 * Get threads in a channel with metadata
 */
export const getThreadsInChannel = createSelector(
    'getThreadsInChannel',
    (state: GlobalState) => getThreads(state),
    (state: GlobalState, channelId: string) => channelId,
    (state: GlobalState) => state,
    (threads, channelId, state): ThreadInfo[] => {
        const channelThreads: ThreadInfo[] = [];

        for (const [threadId, thread] of Object.entries(threads?.threads || {})) {
            if (!thread) {
                continue;
            }

            const rootPost = getPost(state, threadId);
            if (!rootPost || rootPost.channel_id !== channelId) {
                continue;
            }

            channelThreads.push({
                id: threadId,
                rootPost,
                replyCount: thread.reply_count || 0,
                participants: thread.participants?.map((p) => p.id) || [],
                hasUnread: (thread.unread_replies || 0) > 0,
            });
        }

        // Sort by last reply time (most recent first)
        return channelThreads.sort((a, b) =>
            (b.rootPost.last_reply_at || 0) - (a.rootPost.last_reply_at || 0)
        );
    },
);
```

**Step 2: Commit**

```bash
git add webapp/channels/src/selectors/views/guilded_layout.ts
git commit -m "feat: add getThreadsInChannel selector"
```

---

## Task 9: Create GroupDmParticipants Component

**Files:**
- Create: `webapp/channels/src/components/persistent_rhs/group_dm_participants.tsx`
- Create: `webapp/channels/src/components/persistent_rhs/group_dm_participants.scss`

**Step 1: Create the group DM participants component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getProfilesInChannel} from 'mattermost-redux/selectors/entities/channels';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import MemberRow from './member_row';

import './group_dm_participants.scss';

interface Props {
    channelId: string;
}

export default function GroupDmParticipants({channelId}: Props) {
    const profiles = useSelector((state: GlobalState) =>
        getProfilesInChannel(state, channelId) || []
    );

    const membersWithStatus = useSelector((state: GlobalState) => {
        return profiles.map((user) => ({
            user,
            status: getStatusForUserId(state, user.id) || 'offline',
        }));
    });

    // Sort: online first, then alphabetically
    const sortedMembers = [...membersWithStatus].sort((a, b) => {
        const aOnline = a.status !== 'offline' ? 0 : 1;
        const bOnline = b.status !== 'offline' ? 0 : 1;
        if (aOnline !== bOnline) {
            return aOnline - bOnline;
        }
        return (a.user.username || '').localeCompare(b.user.username || '');
    });

    return (
        <div className='group-dm-participants'>
            {sortedMembers.map(({user, status}) => (
                <MemberRow
                    key={user.id}
                    user={user}
                    status={status}
                    isAdmin={false}
                />
            ))}
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// group_dm_participants.scss

.group-dm-participants {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    overflow-y: auto;
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_rhs/group_dm_participants.tsx
git add webapp/channels/src/components/persistent_rhs/group_dm_participants.scss
git commit -m "feat: create GroupDmParticipants component"
```

---

## Task 10: Integrate PersistentRhs into Layout

**Files:**
- Modify: `webapp/channels/src/components/sidebar_right/sidebar_right.tsx`

**Step 1: Conditionally render PersistentRhs**

```typescript
import {useGuildedLayout} from 'hooks/use_guilded_layout';
import PersistentRhs from 'components/persistent_rhs';

// In the component:
const isGuildedLayout = useGuildedLayout();

// In render, replace RHS content:
if (isGuildedLayout) {
    // Guilded layout: always show persistent RHS (except for DMs, handled inside component)
    return (
        <div className='sidebar--right'>
            <PersistentRhs />
        </div>
    );
}

// ... existing RHS render logic for non-Guilded mode
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/sidebar_right/sidebar_right.tsx
git commit -m "feat: integrate PersistentRhs into layout"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | persistent_rhs/ | Main persistent RHS component |
| 2 | rhs_tab_bar.tsx | Members/Threads tab bar |
| 3 | members_tab.tsx | Discord-style grouped members |
| 4 | member_row.tsx | Individual member row |
| 5 | guilded_layout.ts | Grouped members selector |
| 6 | threads_tab.tsx | Channel threads list |
| 7 | thread_row.tsx | Individual thread row |
| 8 | guilded_layout.ts | Threads selector |
| 9 | group_dm_participants.tsx | Group DM participants |
| 10 | sidebar_right.tsx | Integration into layout |

**Next:** [06-modal-popouts.md](./06-modal-popouts.md)
