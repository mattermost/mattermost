# 04 - DM Page

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated DM list that replaces the LHS channel list when DM mode is active, with full conversation list, search, and new DM button.

**Architecture:** `DmListPage` component replaces the sidebar content when `isDmMode` is true. Uses virtualization for performance with many DMs. Includes search filter and "New Message" button at top.

**Tech Stack:** React, Redux, TypeScript, SCSS, react-window (virtualization)

**Depends on:** 01, 02, 03

---

## Task 1: Create DmListPage Component Structure

**Files:**
- Create: `webapp/channels/src/components/dm_list_page/index.tsx`
- Create: `webapp/channels/src/components/dm_list_page/dm_list_page.scss`

**Step 1: Create the DM list page component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useMemo, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';
import AutoSizer from 'react-virtualized-auto-sizer';
import {FixedSizeList} from 'react-window';

import {setDmMode} from 'actions/views/guilded_layout';
import {openModal} from 'actions/views/modals';
import {getAllDmChannelsWithUsers} from 'selectors/views/guilded_layout';
import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';
import EnhancedDmRow from 'components/enhanced_dm_row';
import EnhancedGroupDmRow from 'components/enhanced_group_dm_row';
import MoreDirectChannels from 'components/more_direct_channels';
import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import DmListHeader from './dm_list_header';
import DmSearchInput from './dm_search_input';

import './dm_list_page.scss';

const ROW_HEIGHT = 64;

export default function DmListPage() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const [searchTerm, setSearchTerm] = useState('');
    const currentChannelId = useSelector(getCurrentChannelId);
    const allDms = useSelector((state: GlobalState) => getAllDmChannelsWithUsers(state));

    // Filter DMs by search term
    const filteredDms = useMemo(() => {
        if (!searchTerm.trim()) {
            return allDms;
        }

        const term = searchTerm.toLowerCase();
        return allDms.filter((dm) => {
            if (dm.type === 'dm') {
                return dm.user.username.toLowerCase().includes(term) ||
                    (dm.user.nickname || '').toLowerCase().includes(term) ||
                    (dm.user.first_name || '').toLowerCase().includes(term) ||
                    (dm.user.last_name || '').toLowerCase().includes(term);
            }
            // Group DM
            return dm.users.some((u) =>
                u.username.toLowerCase().includes(term) ||
                (u.nickname || '').toLowerCase().includes(term)
            ) || dm.channel.display_name.toLowerCase().includes(term);
        });
    }, [allDms, searchTerm]);

    const handleBackClick = useCallback(() => {
        dispatch(setDmMode(false));
    }, [dispatch]);

    const handleNewMessage = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
            dialogType: MoreDirectChannels,
            dialogProps: {},
        }));
    }, [dispatch]);

    const renderRow = useCallback(({index, style}: {index: number; style: React.CSSProperties}) => {
        const dm = filteredDms[index];

        if (dm.type === 'dm') {
            return (
                <div style={style}>
                    <EnhancedDmRow
                        channel={dm.channel}
                        user={dm.user}
                        isActive={dm.channel.id === currentChannelId}
                    />
                </div>
            );
        }

        // Group DM
        return (
            <div style={style}>
                <EnhancedGroupDmRow
                    channel={dm.channel}
                    users={dm.users}
                    isActive={dm.channel.id === currentChannelId}
                />
            </div>
        );
    }, [filteredDms, currentChannelId]);

    return (
        <div className='dm-list-page'>
            <DmListHeader
                onBackClick={handleBackClick}
                onNewMessageClick={handleNewMessage}
            />
            <DmSearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder={formatMessage({
                    id: 'dm_list_page.search_placeholder',
                    defaultMessage: 'Search conversations...',
                })}
            />
            <div className='dm-list-page__list'>
                {filteredDms.length === 0 ? (
                    <div className='dm-list-page__empty'>
                        {searchTerm ? (
                            formatMessage({
                                id: 'dm_list_page.no_results',
                                defaultMessage: 'No conversations found',
                            })
                        ) : (
                            formatMessage({
                                id: 'dm_list_page.no_dms',
                                defaultMessage: 'No direct messages yet',
                            })
                        )}
                    </div>
                ) : (
                    <AutoSizer>
                        {({height, width}) => (
                            <FixedSizeList
                                height={height}
                                width={width}
                                itemCount={filteredDms.length}
                                itemSize={ROW_HEIGHT}
                            >
                                {renderRow}
                            </FixedSizeList>
                        )}
                    </AutoSizer>
                )}
            </div>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// dm_list_page.scss

.dm-list-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--sidebar-bg);

    &__list {
        flex: 1;
        min-height: 0;
    }

    &__empty {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 24px;
        font-size: 14px;
        color: rgba(var(--sidebar-text-rgb), 0.56);
        text-align: center;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/dm_list_page/
git commit -m "feat: create DmListPage component structure"
```

---

## Task 2: Create DmListHeader Component

**Files:**
- Create: `webapp/channels/src/components/dm_list_page/dm_list_header.tsx`
- Create: `webapp/channels/src/components/dm_list_page/dm_list_header.scss`

**Step 1: Create the header component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './dm_list_header.scss';

interface Props {
    onBackClick: () => void;
    onNewMessageClick: () => void;
}

export default function DmListHeader({onBackClick, onNewMessageClick}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='dm-list-header'>
            <WithTooltip
                title={formatMessage({id: 'dm_list_header.back', defaultMessage: 'Back to Channels'})}
            >
                <button
                    className='dm-list-header__back'
                    onClick={onBackClick}
                    aria-label={formatMessage({id: 'dm_list_header.back', defaultMessage: 'Back to Channels'})}
                >
                    <i className='icon icon-arrow-left' />
                </button>
            </WithTooltip>
            <h2 className='dm-list-header__title'>
                {formatMessage({id: 'dm_list_header.title', defaultMessage: 'Direct Messages'})}
            </h2>
            <WithTooltip
                title={formatMessage({id: 'dm_list_header.new', defaultMessage: 'New Message'})}
            >
                <button
                    className='dm-list-header__new'
                    onClick={onNewMessageClick}
                    aria-label={formatMessage({id: 'dm_list_header.new', defaultMessage: 'New Message'})}
                >
                    <i className='icon icon-plus' />
                </button>
            </WithTooltip>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// dm_list_header.scss

.dm-list-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--sidebar-text-rgb), 0.08);

    &__back,
    &__new {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--sidebar-text);
        cursor: pointer;
        transition: background-color 0.1s ease;

        &:hover {
            background-color: rgba(var(--sidebar-text-rgb), 0.08);
        }

        .icon {
            font-size: 18px;
        }
    }

    &__title {
        flex: 1;
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--sidebar-header-text-color);
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/dm_list_page/dm_list_header.tsx
git add webapp/channels/src/components/dm_list_page/dm_list_header.scss
git commit -m "feat: create DmListHeader component"
```

---

## Task 3: Create DmSearchInput Component

**Files:**
- Create: `webapp/channels/src/components/dm_list_page/dm_search_input.tsx`
- Create: `webapp/channels/src/components/dm_list_page/dm_search_input.scss`

**Step 1: Create the search input component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import './dm_search_input.scss';

interface Props {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}

export default function DmSearchInput({value, onChange, placeholder}: Props) {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    }, [onChange]);

    const handleClear = useCallback(() => {
        onChange('');
    }, [onChange]);

    return (
        <div className='dm-search-input'>
            <i className='dm-search-input__icon icon icon-magnify' />
            <input
                type='text'
                className='dm-search-input__field'
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
            />
            {value && (
                <button
                    className='dm-search-input__clear'
                    onClick={handleClear}
                    type='button'
                >
                    <i className='icon icon-close' />
                </button>
            )}
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// dm_search_input.scss

.dm-search-input {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 16px;
    padding: 8px 12px;
    border-radius: 4px;
    background-color: rgba(var(--sidebar-text-rgb), 0.08);

    &__icon {
        color: rgba(var(--sidebar-text-rgb), 0.56);
        font-size: 18px;
    }

    &__field {
        flex: 1;
        border: none;
        background: transparent;
        color: var(--sidebar-text);
        font-size: 14px;
        outline: none;

        &::placeholder {
            color: rgba(var(--sidebar-text-rgb), 0.56);
        }
    }

    &__clear {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: rgba(var(--sidebar-text-rgb), 0.16);
        color: var(--sidebar-text);
        cursor: pointer;

        &:hover {
            background: rgba(var(--sidebar-text-rgb), 0.24);
        }

        .icon {
            font-size: 14px;
        }
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/dm_list_page/dm_search_input.tsx
git add webapp/channels/src/components/dm_list_page/dm_search_input.scss
git commit -m "feat: create DmSearchInput component"
```

---

## Task 4: Create DM Channels Selector

**Files:**
- Modify: `webapp/channels/src/selectors/views/guilded_layout.ts`

**Step 1: Add selector for all DM channels with user info**

```typescript
// Add to existing guilded_layout.ts

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

interface DmInfo {
    type: 'dm';
    channel: Channel;
    user: UserProfile;
}

interface GroupDmInfo {
    type: 'group';
    channel: Channel;
    users: UserProfile[];
}

type DmOrGroupDm = DmInfo | GroupDmInfo;

/**
 * Get all DM and Group DM channels with user info, sorted by last activity
 */
export const getAllDmChannelsWithUsers = createSelector(
    'getAllDmChannelsWithUsers',
    getAllChannels,
    getMyChannelMemberships,
    getUsers,
    getCurrentUserId,
    (channels, memberships, users, currentUserId): DmOrGroupDm[] => {
        const dms: DmOrGroupDm[] = [];

        for (const channel of Object.values(channels)) {
            // Only include channels user is a member of
            if (!memberships[channel.id]) {
                continue;
            }

            if (channel.type === Constants.DM_CHANNEL) {
                // Extract other user's ID from DM channel name
                const userIds = channel.name.split('__');
                const otherUserId = userIds.find((id) => id !== currentUserId);

                if (!otherUserId || !users[otherUserId]) {
                    continue;
                }

                dms.push({
                    type: 'dm',
                    channel,
                    user: users[otherUserId],
                });
            } else if (channel.type === Constants.GM_CHANNEL) {
                // Group message - get all users except current
                // GM channel has member_count but we need to get users differently
                // For now, parse from channel header or use a separate selector
                const gmUsers: UserProfile[] = [];

                // GM channels store user IDs in the name (comma separated)
                // Actually, GM channel names are generated IDs, we need to use channel members
                // This will require fetching channel members - for now use display_name parsing
                const displayNames = channel.display_name.split(', ');
                for (const displayName of displayNames) {
                    const user = Object.values(users).find(
                        (u) => u.username === displayName ||
                               u.nickname === displayName ||
                               `${u.first_name} ${u.last_name}` === displayName
                    );
                    if (user && user.id !== currentUserId) {
                        gmUsers.push(user);
                    }
                }

                if (gmUsers.length > 0) {
                    dms.push({
                        type: 'group',
                        channel,
                        users: gmUsers,
                    });
                }
            }
        }

        // Sort by last post time (most recent first)
        return dms.sort((a, b) => b.channel.last_post_at - a.channel.last_post_at);
    },
);
```

**Step 2: Commit**

```bash
git add webapp/channels/src/selectors/views/guilded_layout.ts
git commit -m "feat: add getAllDmChannelsWithUsers selector"
```

---

## Task 5: Integrate DmListPage into Sidebar

**Files:**
- Modify: `webapp/channels/src/components/sidebar/sidebar.tsx`

**Step 1: Conditionally render DmListPage when in DM mode**

```typescript
import {useGuildedLayout} from 'hooks/use_guilded_layout';
import DmListPage from 'components/dm_list_page';

// In the component:
const isGuildedLayout = useGuildedLayout();
const isDmMode = useSelector((state: GlobalState) => state.views.guildedLayout.isDmMode);

// In render:
if (isGuildedLayout && isDmMode) {
    return (
        <div id='SidebarContainer' className='sidebar--left'>
            <DmListPage />
        </div>
    );
}

// ... existing channel sidebar render
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/sidebar/sidebar.tsx
git commit -m "feat: integrate DmListPage into sidebar"
```

---

## Task 6: Update Routing for DM Navigation

**Files:**
- Modify: `webapp/channels/src/components/channel_layout/channel_controller.tsx` (or routing file)

**Step 1: Ensure DM routes set DM mode**

When navigating to a DM route (`/messages/@username`), automatically set DM mode:

```typescript
import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useLocation} from 'react-router-dom';

import {setDmMode} from 'actions/views/guilded_layout';
import {isGuildedLayoutEnabled} from 'selectors/views/guilded_layout';

// In the component:
const dispatch = useDispatch();
const location = useLocation();
const isGuilded = useSelector(isGuildedLayoutEnabled);

useEffect(() => {
    if (!isGuilded) {
        return;
    }

    // Check if we're on a DM route
    const isDmRoute = location.pathname.includes('/messages/@') ||
                      location.pathname.includes('/messages/');

    dispatch(setDmMode(isDmRoute));
}, [location.pathname, isGuilded, dispatch]);
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/channel_layout/channel_controller.tsx
git commit -m "feat: auto-set DM mode based on route"
```

---

## Task 7: Add Enhanced Channel Row Integration

**Files:**
- Modify: `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_channel.tsx`

**Step 1: Use enhanced rows when Guilded layout is active**

```typescript
import {useGuildedLayout} from 'hooks/use_guilded_layout';
import EnhancedChannelRow from 'components/enhanced_channel_row';

// In the component:
const isGuildedLayout = useGuildedLayout();

// In render, for non-DM channels:
if (isGuildedLayout && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL) {
    return (
        <EnhancedChannelRow
            channel={channel}
            isActive={isActive}
        />
    );
}

// ... existing render for compact mode
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/sidebar/sidebar_channel/sidebar_channel.tsx
git commit -m "feat: use EnhancedChannelRow in Guilded layout"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | dm_list_page/ | Main DM list page component |
| 2 | dm_list_header.tsx | Header with back and new message buttons |
| 3 | dm_search_input.tsx | Search/filter input |
| 4 | guilded_layout.ts | DM channels selector |
| 5 | sidebar.tsx | Integration into sidebar |
| 6 | channel_controller.tsx | Route-based DM mode |
| 7 | sidebar_channel.tsx | Enhanced row integration |

**Next:** [05-persistent-rhs.md](./05-persistent-rhs.md)
