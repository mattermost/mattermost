# 02 - Team Sidebar Enhancements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the team sidebar (far left vertical bar) with DM button, favorited teams section, expand/collapse functionality, and unread DM avatars.

**Architecture:** Wrap or replace existing team sidebar with new `GuildedTeamSidebar` component. DM button triggers `isDmMode` state change. Expand/collapse shows overlay with team names and DM previews. Unread DM avatars appear below DM button when messages are unread.

**Tech Stack:** React, Redux, TypeScript, SCSS, styled-components

**Depends on:** 01-feature-flag-and-infrastructure.md

---

## Task 1: Create GuildedTeamSidebar Component Structure

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/index.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/guilded_team_sidebar.scss`

**Step 1: Create the main component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
    setTeamSidebarExpanded,
    setDmMode,
} from 'actions/views/guilded_layout';

import type {GlobalState} from 'types/store';

import DmButton from './dm_button';
import ExpandedOverlay from './expanded_overlay';
import FavoritedTeams from './favorited_teams';
import TeamList from './team_list';
import UnreadDmAvatars from './unread_dm_avatars';

import './guilded_team_sidebar.scss';

export default function GuildedTeamSidebar() {
    const dispatch = useDispatch();
    const containerRef = useRef<HTMLDivElement>(null);

    const isExpanded = useSelector((state: GlobalState) => state.views.guildedLayout.isTeamSidebarExpanded);
    const isDmMode = useSelector((state: GlobalState) => state.views.guildedLayout.isDmMode);

    // Close expanded overlay when clicking outside
    useEffect(() => {
        if (!isExpanded) {
            return;
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                dispatch(setTeamSidebarExpanded(false));
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded, dispatch]);

    const handleDmClick = useCallback(() => {
        dispatch(setDmMode(true));
    }, [dispatch]);

    const handleTeamClick = useCallback(() => {
        dispatch(setDmMode(false));
    }, [dispatch]);

    const handleExpandClick = useCallback(() => {
        dispatch(setTeamSidebarExpanded(true));
    }, [dispatch]);

    return (
        <div
            ref={containerRef}
            className={classNames('guilded-team-sidebar', {
                'guilded-team-sidebar--expanded': isExpanded,
            })}
        >
            {/* Collapsed view (icons only) */}
            <div className='guilded-team-sidebar__collapsed'>
                <DmButton
                    isActive={isDmMode}
                    onClick={handleDmClick}
                />
                <UnreadDmAvatars />
                <div className='guilded-team-sidebar__divider' />
                <FavoritedTeams
                    onTeamClick={handleTeamClick}
                    onExpandClick={handleExpandClick}
                />
                <div className='guilded-team-sidebar__divider' />
                <TeamList
                    onTeamClick={handleTeamClick}
                />
            </div>

            {/* Expanded overlay */}
            {isExpanded && (
                <ExpandedOverlay
                    onClose={() => dispatch(setTeamSidebarExpanded(false))}
                />
            )}
        </div>
    );
}
```

**Step 2: Create base styles**

```scss
// guilded_team_sidebar.scss

.guilded-team-sidebar {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 72px;
    height: 100%;
    background-color: var(--sidebar-teambar-bg);
    z-index: 20;

    &__collapsed {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 0;
        gap: 4px;
        height: 100%;
        overflow-y: auto;
        overflow-x: hidden;

        &::-webkit-scrollbar {
            width: 4px;
        }

        &::-webkit-scrollbar-thumb {
            background: rgba(var(--center-channel-color-rgb), 0.2);
            border-radius: 2px;
        }
    }

    &__divider {
        width: 32px;
        height: 2px;
        margin: 8px 0;
        background-color: rgba(var(--sidebar-text-rgb), 0.1);
        border-radius: 1px;
    }

    &--expanded {
        // When expanded, the overlay appears
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/
git commit -m "feat: create GuildedTeamSidebar component structure"
```

---

## Task 2: Create DM Button Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/dm_button.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/dm_button.scss`

**Step 1: Create the DM button**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getUnreadDmCount} from 'selectors/views/guilded_layout';
import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

import './dm_button.scss';

interface Props {
    isActive: boolean;
    onClick: () => void;
}

export default function DmButton({isActive, onClick}: Props) {
    const {formatMessage} = useIntl();
    const unreadCount = useSelector((state: GlobalState) => getUnreadDmCount(state));

    return (
        <WithTooltip
            title={formatMessage({id: 'guilded_team_sidebar.dm_button', defaultMessage: 'Direct Messages'})}
            placement='right'
        >
            <button
                className={classNames('dm-button', {
                    'dm-button--active': isActive,
                })}
                onClick={onClick}
                aria-label={formatMessage({id: 'guilded_team_sidebar.dm_button', defaultMessage: 'Direct Messages'})}
            >
                <i className='icon icon-message-text-outline' />
                {unreadCount > 0 && (
                    <span className='dm-button__badge'>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                {isActive && <span className='dm-button__active-indicator' />}
            </button>
        </WithTooltip>
    );
}
```

**Step 2: Create styles**

```scss
// dm_button.scss

.dm-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    background-color: rgba(var(--sidebar-text-rgb), 0.1);
    color: var(--sidebar-text);
    cursor: pointer;
    transition: background-color 0.15s ease, border-radius 0.15s ease;

    &:hover {
        background-color: var(--sidebar-text-active-border);
        border-radius: 16px;
    }

    &--active {
        background-color: var(--sidebar-text-active-border);
        border-radius: 16px;
    }

    .icon {
        font-size: 24px;
    }

    &__badge {
        position: absolute;
        bottom: -2px;
        right: -2px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        background-color: var(--error-text);
        color: white;
        font-size: 11px;
        font-weight: 600;
        line-height: 18px;
        text-align: center;
    }

    &__active-indicator {
        position: absolute;
        left: -8px;
        width: 4px;
        height: 40px;
        background-color: var(--sidebar-text);
        border-radius: 0 4px 4px 0;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/dm_button.tsx
git add webapp/channels/src/components/guilded_team_sidebar/dm_button.scss
git commit -m "feat: create DM button component for team sidebar"
```

---

## Task 3: Create Unread DM Avatars Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/unread_dm_avatars.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/unread_dm_avatars.scss`

**Step 1: Create the unread avatars component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {Client4} from 'mattermost-redux/client';
import {getCurrentTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {setDmMode} from 'actions/views/guilded_layout';
import {getUnreadDmChannelsWithUsers} from 'selectors/views/guilded_layout';
import StatusIcon from 'components/status_icon';
import WithTooltip from 'components/with_tooltip';

import type {GlobalState} from 'types/store';

import './unread_dm_avatars.scss';

const MAX_VISIBLE_AVATARS = 5;

export default function UnreadDmAvatars() {
    const dispatch = useDispatch();
    const history = useHistory();

    const teamUrl = useSelector(getCurrentTeamUrl);
    const unreadDms = useSelector((state: GlobalState) => getUnreadDmChannelsWithUsers(state));

    // Only show first N unread DMs
    const visibleDms = unreadDms.slice(0, MAX_VISIBLE_AVATARS);

    const handleDmClick = (username: string) => {
        dispatch(setDmMode(true));
        history.push(`${teamUrl}/messages/@${username}`);
    };

    if (visibleDms.length === 0) {
        return null;
    }

    return (
        <div className='unread-dm-avatars'>
            {visibleDms.map(({channel, user, unreadCount, status}) => (
                <WithTooltip
                    key={channel.id}
                    title={`${user.username} (${unreadCount} unread)`}
                    placement='right'
                >
                    <button
                        className='unread-dm-avatars__item'
                        onClick={() => handleDmClick(user.username)}
                    >
                        <img
                            className='unread-dm-avatars__avatar'
                            src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                            alt={user.username}
                        />
                        <StatusIcon
                            className='unread-dm-avatars__status'
                            status={status}
                        />
                        {unreadCount > 0 && (
                            <span className='unread-dm-avatars__badge'>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                </WithTooltip>
            ))}
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// unread_dm_avatars.scss

.unread-dm-avatars {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;

    &__item {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        cursor: pointer;
        transition: border-radius 0.15s ease;

        &:hover {
            border-radius: 16px;

            .unread-dm-avatars__avatar {
                border-radius: 16px;
            }
        }
    }

    &__avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
        transition: border-radius 0.15s ease;
    }

    &__status {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 16px;
        height: 16px;
        border: 3px solid var(--sidebar-teambar-bg);
        border-radius: 50%;
    }

    &__badge {
        position: absolute;
        bottom: -2px;
        right: -2px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        background-color: var(--error-text);
        color: white;
        font-size: 11px;
        font-weight: 600;
        line-height: 18px;
        text-align: center;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/unread_dm_avatars.tsx
git add webapp/channels/src/components/guilded_team_sidebar/unread_dm_avatars.scss
git commit -m "feat: create unread DM avatars component"
```

---

## Task 4: Create Selectors for Unread DMs

**Files:**
- Modify: `webapp/channels/src/selectors/views/guilded_layout.ts`

**Step 1: Add unread DM selectors**

```typescript
// Add to existing guilded_layout.ts selectors file

import {createSelector} from 'reselect';

import {
    getAllChannels,
    getMyChannelMemberships,
    makeGetChannel,
} from 'mattermost-redux/selectors/entities/channels';
import {getUsers, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

interface UnreadDmInfo {
    channel: Channel;
    user: UserProfile;
    unreadCount: number;
    status: string;
}

/**
 * Get total count of unread DM messages
 */
export const getUnreadDmCount = createSelector(
    'getUnreadDmCount',
    getAllChannels,
    getMyChannelMemberships,
    (channels, memberships): number => {
        let count = 0;
        for (const channel of Object.values(channels)) {
            if (channel.type !== Constants.DM_CHANNEL) {
                continue;
            }
            const membership = memberships[channel.id];
            if (membership) {
                count += membership.msg_count - (membership.last_viewed_at > 0 ? 0 : membership.msg_count);
                // Simplified: use mention_count for unread indicator
                count += membership.mention_count || 0;
            }
        }
        return count;
    },
);

/**
 * Get unread DM channels with user info, sorted by most recent
 */
export const getUnreadDmChannelsWithUsers = createSelector(
    'getUnreadDmChannelsWithUsers',
    getAllChannels,
    getMyChannelMemberships,
    getUsers,
    (state: GlobalState) => state,
    (channels, memberships, users, state): UnreadDmInfo[] => {
        const unreadDms: UnreadDmInfo[] = [];

        for (const channel of Object.values(channels)) {
            if (channel.type !== Constants.DM_CHANNEL) {
                continue;
            }

            const membership = memberships[channel.id];
            if (!membership || membership.mention_count === 0) {
                continue;
            }

            // Extract other user's ID from DM channel name
            // DM channel names are formatted as "{oderId}__{currentUserId}" or vice versa
            const userIds = channel.name.split('__');
            const otherUserId = userIds.find((id) => users[id] && id !== membership.user_id);

            if (!otherUserId || !users[otherUserId]) {
                continue;
            }

            const user = users[otherUserId];
            const status = getStatusForUserId(state, otherUserId) || 'offline';

            unreadDms.push({
                channel,
                user,
                unreadCount: membership.mention_count,
                status,
            });
        }

        // Sort by last post time (most recent first)
        return unreadDms.sort((a, b) => b.channel.last_post_at - a.channel.last_post_at);
    },
);
```

**Step 2: Commit**

```bash
git add webapp/channels/src/selectors/views/guilded_layout.ts
git commit -m "feat: add selectors for unread DM count and channels"
```

---

## Task 5: Create Favorited Teams Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/favorited_teams.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/favorited_teams.scss`

**Step 1: Create the favorited teams component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getMyTeams, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';
import TeamButton from 'components/team_sidebar/components/team_button';

import type {GlobalState} from 'types/store';

import './favorited_teams.scss';

interface Props {
    onTeamClick: () => void;
    onExpandClick: () => void;
}

export default function FavoritedTeams({onTeamClick, onExpandClick}: Props) {
    const teams = useSelector(getMyTeams);
    const currentTeamId = useSelector(getCurrentTeamId);
    const favoritedIds = useSelector((state: GlobalState) => getFavoritedTeamIds(state));

    const favoritedTeams = teams.filter((team) => favoritedIds.includes(team.id));

    if (favoritedTeams.length === 0) {
        return null;
    }

    return (
        <div className='favorited-teams'>
            {favoritedTeams.map((team) => (
                <TeamButton
                    key={team.id}
                    team={team}
                    isActive={team.id === currentTeamId}
                    onClick={onTeamClick}
                />
            ))}
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// favorited_teams.scss

.favorited-teams {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/favorited_teams.tsx
git add webapp/channels/src/components/guilded_team_sidebar/favorited_teams.scss
git commit -m "feat: create favorited teams component"
```

---

## Task 6: Create Team List Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/team_list.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/team_list.scss`

**Step 1: Create the team list component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getMyTeams, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getFavoritedTeamIds} from 'selectors/views/guilded_layout';
import TeamButton from 'components/team_sidebar/components/team_button';
import AddTeamButton from './add_team_button';

import type {GlobalState} from 'types/store';

import './team_list.scss';

interface Props {
    onTeamClick: () => void;
}

export default function TeamList({onTeamClick}: Props) {
    const teams = useSelector(getMyTeams);
    const currentTeamId = useSelector(getCurrentTeamId);
    const favoritedIds = useSelector((state: GlobalState) => getFavoritedTeamIds(state));

    // Show non-favorited teams
    const nonFavoritedTeams = teams.filter((team) => !favoritedIds.includes(team.id));

    return (
        <div className='team-list'>
            {nonFavoritedTeams.map((team) => (
                <TeamButton
                    key={team.id}
                    team={team}
                    isActive={team.id === currentTeamId}
                    onClick={onTeamClick}
                />
            ))}
            <AddTeamButton />
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// team_list.scss

.team-list {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 12px;
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/team_list.tsx
git add webapp/channels/src/components/guilded_team_sidebar/team_list.scss
git commit -m "feat: create team list component"
```

---

## Task 7: Create Add Team Button Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/add_team_button.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/add_team_button.scss`

**Step 1: Create the add team button**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';
import WithTooltip from 'components/with_tooltip';
import TeamSelectorModal from 'components/team_selector_modal';
import {ModalIdentifiers} from 'utils/constants';

import './add_team_button.scss';

export default function AddTeamButton() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const handleClick = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.TEAM_SELECTOR,
            dialogType: TeamSelectorModal,
            dialogProps: {},
        }));
    };

    return (
        <WithTooltip
            title={formatMessage({id: 'guilded_team_sidebar.add_team', defaultMessage: 'Add a Team'})}
            placement='right'
        >
            <button
                className='add-team-button'
                onClick={handleClick}
                aria-label={formatMessage({id: 'guilded_team_sidebar.add_team', defaultMessage: 'Add a Team'})}
            >
                <i className='icon icon-plus' />
            </button>
        </WithTooltip>
    );
}
```

**Step 2: Create styles**

```scss
// add_team_button.scss

.add-team-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    background-color: rgba(var(--sidebar-text-rgb), 0.1);
    color: var(--sidebar-text);
    cursor: pointer;
    transition: background-color 0.15s ease, border-radius 0.15s ease, color 0.15s ease;

    &:hover {
        background-color: var(--online-indicator);
        border-radius: 16px;
        color: white;
    }

    .icon {
        font-size: 24px;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/add_team_button.tsx
git add webapp/channels/src/components/guilded_team_sidebar/add_team_button.scss
git commit -m "feat: create add team button component"
```

---

## Task 8: Create Expanded Overlay Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/expanded_overlay.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/expanded_overlay.scss`

**Step 1: Create the expanded overlay**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getMyTeams, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getUnreadsInTeam} from 'mattermost-redux/selectors/entities/channels';

import {getUnreadDmChannelsWithUsers, getFavoritedTeamIds} from 'selectors/views/guilded_layout';
import {Client4} from 'mattermost-redux/client';

import type {GlobalState} from 'types/store';

import './expanded_overlay.scss';

interface Props {
    onClose: () => void;
}

export default function ExpandedOverlay({onClose}: Props) {
    const teams = useSelector(getMyTeams);
    const currentTeamId = useSelector(getCurrentTeamId);
    const favoritedIds = useSelector((state: GlobalState) => getFavoritedTeamIds(state));
    const unreadDms = useSelector((state: GlobalState) => getUnreadDmChannelsWithUsers(state));

    const favoritedTeams = teams.filter((team) => favoritedIds.includes(team.id));
    const otherTeams = teams.filter((team) => !favoritedIds.includes(team.id));

    return (
        <div className='expanded-overlay'>
            <div className='expanded-overlay__header'>
                <h3>Your Servers</h3>
                <button className='expanded-overlay__close' onClick={onClose}>
                    <i className='icon icon-close' />
                </button>
            </div>

            {/* Unread DMs section */}
            {unreadDms.length > 0 && (
                <div className='expanded-overlay__section'>
                    <h4 className='expanded-overlay__section-title'>Unread Messages</h4>
                    {unreadDms.slice(0, 5).map(({channel, user, unreadCount}) => (
                        <div key={channel.id} className='expanded-overlay__dm-row'>
                            <img
                                className='expanded-overlay__dm-avatar'
                                src={Client4.getProfilePictureUrl(user.id, user.last_picture_update)}
                                alt={user.username}
                            />
                            <div className='expanded-overlay__dm-info'>
                                <span className='expanded-overlay__dm-name'>{user.username}</span>
                                <span className='expanded-overlay__dm-preview'>
                                    {unreadCount} new message{unreadCount > 1 ? 's' : ''}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Favorited teams */}
            {favoritedTeams.length > 0 && (
                <div className='expanded-overlay__section'>
                    <h4 className='expanded-overlay__section-title'>Favorites</h4>
                    {favoritedTeams.map((team) => (
                        <ExpandedTeamRow
                            key={team.id}
                            team={team}
                            isActive={team.id === currentTeamId}
                        />
                    ))}
                </div>
            )}

            {/* Other teams */}
            <div className='expanded-overlay__section'>
                <h4 className='expanded-overlay__section-title'>All Servers</h4>
                {otherTeams.map((team) => (
                    <ExpandedTeamRow
                        key={team.id}
                        team={team}
                        isActive={team.id === currentTeamId}
                    />
                ))}
            </div>
        </div>
    );
}

interface ExpandedTeamRowProps {
    team: {id: string; display_name: string; name: string};
    isActive: boolean;
}

function ExpandedTeamRow({team, isActive}: ExpandedTeamRowProps) {
    return (
        <div className={`expanded-overlay__team-row ${isActive ? 'active' : ''}`}>
            <div className='expanded-overlay__team-icon'>
                {team.display_name.charAt(0).toUpperCase()}
            </div>
            <span className='expanded-overlay__team-name'>{team.display_name}</span>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// expanded_overlay.scss

.expanded-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 240px;
    height: 100%;
    background-color: var(--sidebar-teambar-bg);
    border-right: 1px solid rgba(var(--center-channel-color-rgb), 0.12);
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
    z-index: 100;
    overflow-y: auto;

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid rgba(var(--sidebar-text-rgb), 0.1);

        h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--sidebar-text);
        }
    }

    &__close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--sidebar-text);
        cursor: pointer;

        &:hover {
            background: rgba(var(--sidebar-text-rgb), 0.1);
        }
    }

    &__section {
        padding: 12px 8px;

        &:not(:last-child) {
            border-bottom: 1px solid rgba(var(--sidebar-text-rgb), 0.1);
        }
    }

    &__section-title {
        margin: 0 0 8px 8px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: rgba(var(--sidebar-text-rgb), 0.56);
    }

    &__team-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;

        &:hover {
            background: rgba(var(--sidebar-text-rgb), 0.08);
        }

        &.active {
            background: rgba(var(--sidebar-text-rgb), 0.16);
        }
    }

    &__team-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(var(--sidebar-text-rgb), 0.2);
        color: var(--sidebar-text);
        font-size: 14px;
        font-weight: 600;
    }

    &__team-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--sidebar-text);
    }

    &__dm-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;

        &:hover {
            background: rgba(var(--sidebar-text-rgb), 0.08);
        }
    }

    &__dm-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
    }

    &__dm-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    &__dm-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--sidebar-text);
    }

    &__dm-preview {
        font-size: 12px;
        color: rgba(var(--sidebar-text-rgb), 0.64);
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/expanded_overlay.tsx
git add webapp/channels/src/components/guilded_team_sidebar/expanded_overlay.scss
git commit -m "feat: create expanded overlay for team sidebar"
```

---

## Task 9: Add Favorited Teams Selector and Persistence

**Files:**
- Modify: `webapp/channels/src/selectors/views/guilded_layout.ts`
- Modify: `webapp/channels/src/reducers/views/guilded_layout.ts`

**Step 1: Add favorited teams state to reducer**

In `guilded_layout.ts` reducer, add:

```typescript
// Favorited team IDs (persisted via localStorage)
function favoritedTeamIds(state: string[] = [], action: MMAction): string[] {
    switch (action.type) {
    case ActionTypes.GUILDED_SET_FAVORITED_TEAMS:
        return action.teamIds;
    case ActionTypes.GUILDED_ADD_FAVORITED_TEAM:
        if (state.includes(action.teamId)) {
            return state;
        }
        return [...state, action.teamId];
    case ActionTypes.GUILDED_REMOVE_FAVORITED_TEAM:
        return state.filter((id) => id !== action.teamId);
    case UserTypes.LOGOUT_SUCCESS:
        return [];
    default:
        return state;
    }
}
```

Add to combineReducers.

**Step 2: Add selector**

In selectors file:

```typescript
export function getFavoritedTeamIds(state: GlobalState): string[] {
    return state.views.guildedLayout.favoritedTeamIds || [];
}
```

**Step 3: Add action types to constants.tsx**

```typescript
GUILDED_SET_FAVORITED_TEAMS: null,
GUILDED_ADD_FAVORITED_TEAM: null,
GUILDED_REMOVE_FAVORITED_TEAM: null,
```

**Step 4: Add action creators**

```typescript
export function setFavoritedTeams(teamIds: string[]) {
    return {
        type: ActionTypes.GUILDED_SET_FAVORITED_TEAMS,
        teamIds,
    };
}

export function addFavoritedTeam(teamId: string) {
    return {
        type: ActionTypes.GUILDED_ADD_FAVORITED_TEAM,
        teamId,
    };
}

export function removeFavoritedTeam(teamId: string) {
    return {
        type: ActionTypes.GUILDED_REMOVE_FAVORITED_TEAM,
        teamId,
    };
}
```

**Step 5: Commit**

```bash
git add webapp/channels/src/selectors/views/guilded_layout.ts
git add webapp/channels/src/reducers/views/guilded_layout.ts
git add webapp/channels/src/actions/views/guilded_layout.ts
git add webapp/channels/src/utils/constants.tsx
git commit -m "feat: add favorited teams state, selector, and actions"
```

---

## Task 10: Integrate GuildedTeamSidebar into Layout

**Files:**
- Modify: `webapp/channels/src/components/team_sidebar/team_sidebar.tsx`

**Step 1: Conditionally render GuildedTeamSidebar**

Wrap or replace the existing team sidebar with conditional rendering:

```typescript
import {useGuildedLayout} from 'hooks/use_guilded_layout';
import GuildedTeamSidebar from 'components/guilded_team_sidebar';

// In the component:
const isGuildedLayout = useGuildedLayout();

if (isGuildedLayout) {
    return <GuildedTeamSidebar />;
}

// ... existing team sidebar render
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/team_sidebar/team_sidebar.tsx
git commit -m "feat: integrate GuildedTeamSidebar into layout"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | guilded_team_sidebar/ | Main component structure |
| 2 | dm_button.tsx | DM button with unread badge |
| 3 | unread_dm_avatars.tsx | Unread DM user avatars |
| 4 | guilded_layout.ts (selectors) | Unread DM selectors |
| 5 | favorited_teams.tsx | Favorited teams section |
| 6 | team_list.tsx | Non-favorited teams list |
| 7 | add_team_button.tsx | Add team button |
| 8 | expanded_overlay.tsx | Expanded overlay (240px) |
| 9 | Various | Favorited teams persistence |
| 10 | team_sidebar.tsx | Integration into layout |

**Next:** [03-enhanced-conversation-rows.md](./03-enhanced-conversation-rows.md)
