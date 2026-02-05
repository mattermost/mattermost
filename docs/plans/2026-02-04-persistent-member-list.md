# Persistent Member List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an always-visible RHS sidebar with tabbed navigation (Info/Members) and a Discord-style member list that groups users by online status and role.

**Architecture:** Feature flag `PersistentMemberList` controls the behavior. When enabled, the RHS sidebar is always visible with a tab bar at the top. The member list displays users grouped by Online (subdivided by role) then Offline, with status overlays on avatars and custom status text below names. Other RHS views (Files, Pinned, Thread, Search) replace the content with a back button to return.

**Tech Stack:** React, Redux, TypeScript, SCSS, react-window (virtualization)

---

## Task 1: Add Feature Flag

**Files:**
- Modify: `server/public/model/feature_flags.go:156` (after HideUpdateStatusButton)

**Step 1: Add feature flag to Go struct**

In `server/public/model/feature_flags.go`, add after line 158 (HideUpdateStatusButton):

```go
	// Enable persistent member list sidebar with Discord-style grouping
	PersistentMemberList bool
```

**Step 2: Commit**

```bash
git add server/public/model/feature_flags.go
git commit -m "feat: add PersistentMemberList feature flag"
```

---

## Task 2: Add Feature Flag to Admin Console

**Files:**
- Modify: `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx`
- Modify: `webapp/channels/src/components/admin_console/feature_flags.tsx`

**Step 1: Add to MATTERMOST_EXTENDED_FLAGS array**

In `mattermost_extended_features.tsx`, add to the `MATTERMOST_EXTENDED_FLAGS` array:

```typescript
'PersistentMemberList',
```

**Step 2: Add metadata**

In `feature_flags.tsx`, add to the `FLAG_METADATA` object:

```typescript
PersistentMemberList: {
    description: 'Always-visible RHS sidebar with Discord-style member list grouped by status and role',
    defaultValue: false,
},
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
git add webapp/channels/src/components/admin_console/feature_flags.tsx
git commit -m "feat: add PersistentMemberList to admin console"
```

---

## Task 3: Create RHS Tab Bar Component

**Files:**
- Create: `webapp/channels/src/components/rhs_tab_bar/index.tsx`
- Create: `webapp/channels/src/components/rhs_tab_bar/rhs_tab_bar.scss`

**Step 1: Create the tab bar component**

Create `webapp/channels/src/components/rhs_tab_bar/index.tsx`:

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './rhs_tab_bar.scss';

export type RhsTab = 'info' | 'members';

interface Props {
    activeTab: RhsTab;
    onTabChange: (tab: RhsTab) => void;
}

export default function RhsTabBar({activeTab, onTabChange}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='rhs-tab-bar'>
            <WithTooltip
                title={formatMessage({id: 'rhs_tab_bar.info', defaultMessage: 'Channel Info'})}
            >
                <button
                    className={classNames('rhs-tab-bar__tab', {active: activeTab === 'info'})}
                    onClick={() => onTabChange('info')}
                    aria-label={formatMessage({id: 'rhs_tab_bar.info', defaultMessage: 'Channel Info'})}
                >
                    <i className='icon icon-information-outline'/>
                </button>
            </WithTooltip>
            <WithTooltip
                title={formatMessage({id: 'rhs_tab_bar.members', defaultMessage: 'Members'})}
            >
                <button
                    className={classNames('rhs-tab-bar__tab', {active: activeTab === 'members'})}
                    onClick={() => onTabChange('members')}
                    aria-label={formatMessage({id: 'rhs_tab_bar.members', defaultMessage: 'Members'})}
                >
                    <i className='icon icon-account-multiple-outline'/>
                </button>
            </WithTooltip>
        </div>
    );
}
```

**Step 2: Create styles**

Create `webapp/channels/src/components/rhs_tab_bar/rhs_tab_bar.scss`:

```scss
.rhs-tab-bar {
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    background: var(--sidebar-bg);

    &__tab {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.88);
        }

        &.active {
            background: rgba(var(--button-bg-rgb), 0.16);
            color: var(--button-bg);
        }

        .icon {
            font-size: 20px;
        }
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/rhs_tab_bar/
git commit -m "feat: create RHS tab bar component"
```

---

## Task 4: Create Discord-Style Member Row Component

**Files:**
- Create: `webapp/channels/src/components/discord_member_list/discord_member_row.tsx`
- Create: `webapp/channels/src/components/discord_member_list/discord_member_row.scss`

**Step 1: Create the member row component**

Create `webapp/channels/src/components/discord_member_list/discord_member_row.tsx`:

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePopover from 'components/profile_popover';
import StatusIcon from 'components/status_icon';
import BotTag from 'components/widgets/tag/bot_tag';

import {makeGetCustomStatus} from 'selectors/views/custom_status';

import type {GlobalState} from 'types/store';

import './discord_member_row.scss';

interface Props {
    user: UserProfile;
    status: string;
    displayName: string;
    isOffline: boolean;
    onClick?: () => void;
}

export default function DiscordMemberRow({user, status, displayName, isOffline, onClick}: Props) {
    const getCustomStatus = makeGetCustomStatus();
    const customStatus = useSelector((state: GlobalState) => getCustomStatus(state, user.id));

    const userProfileSrc = Client4.getProfilePictureUrl(user.id, user.last_picture_update);

    return (
        <div
            className={classNames('discord-member-row', {offline: isOffline})}
            onClick={onClick}
            role='button'
            tabIndex={0}
        >
            <div className='discord-member-row__avatar-container'>
                <img
                    className='discord-member-row__avatar'
                    src={userProfileSrc}
                    alt={displayName}
                />
                <StatusIcon
                    className='discord-member-row__status-icon'
                    status={status}
                />
            </div>
            <ProfilePopover
                triggerComponentClass='discord-member-row__info'
                userId={user.id}
                src={userProfileSrc}
            >
                <div className='discord-member-row__name-row'>
                    <span className='discord-member-row__display-name'>
                        {displayName}
                    </span>
                    {user.is_bot && <BotTag/>}
                </div>
                {customStatus?.text && (
                    <div className='discord-member-row__custom-status'>
                        <CustomStatusEmoji
                            userID={user.id}
                            emojiSize={14}
                            showTooltip={false}
                        />
                        <span className='discord-member-row__custom-status-text'>
                            {customStatus.text}
                        </span>
                    </div>
                )}
            </ProfilePopover>
        </div>
    );
}
```

**Step 2: Create styles**

Create `webapp/channels/src/components/discord_member_list/discord_member_row.scss`:

```scss
.discord-member-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    &.offline {
        opacity: 0.5;

        .discord-member-row__avatar {
            filter: grayscale(100%);
        }
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
        right: -2px;
        bottom: -2px;
        width: 14px;
        height: 14px;
        border: 2px solid var(--sidebar-bg);
        border-radius: 50%;
    }

    &__info {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
        cursor: pointer;
    }

    &__name-row {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    &__display-name {
        overflow: hidden;
        font-size: 14px;
        font-weight: 500;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--center-channel-color);
    }

    &__custom-status {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 2px;
    }

    &__custom-status-text {
        overflow: hidden;
        font-size: 12px;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: rgba(var(--center-channel-color-rgb), 0.64);
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/discord_member_list/
git commit -m "feat: create Discord-style member row component"
```

---

## Task 5: Create Discord Member List Component with Status Grouping

**Files:**
- Create: `webapp/channels/src/components/discord_member_list/index.tsx`
- Create: `webapp/channels/src/components/discord_member_list/discord_member_list.scss`
- Create: `webapp/channels/src/components/discord_member_list/types.ts`

**Step 1: Create types**

Create `webapp/channels/src/components/discord_member_list/types.ts`:

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';
import type {ChannelMembership} from '@mattermost/types/channels';

export interface MemberWithStatus {
    user: UserProfile;
    membership?: ChannelMembership;
    status: string;
    displayName: string;
}

export interface GroupedMembers {
    online: {
        admins: MemberWithStatus[];
        members: MemberWithStatus[];
    };
    offline: MemberWithStatus[];
}

export enum ListItemType {
    GroupHeader = 'group-header',
    Member = 'member',
}

export interface GroupHeaderItem {
    type: ListItemType.GroupHeader;
    label: string;
    count: number;
}

export interface MemberItem {
    type: ListItemType.Member;
    data: MemberWithStatus;
    isOffline: boolean;
}

export type ListItem = GroupHeaderItem | MemberItem;
```

**Step 2: Create the main list component**

Create `webapp/channels/src/components/discord_member_list/index.tsx`:

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import AutoSizer from 'react-virtualized-auto-sizer';
import {VariableSizeList} from 'react-window';

import type {Channel} from '@mattermost/types/channels';

import DiscordMemberRow from './discord_member_row';
import type {MemberWithStatus, ListItem, GroupHeaderItem, MemberItem} from './types';
import {ListItemType} from './types';

import './discord_member_list.scss';

interface Props {
    channel: Channel;
    members: MemberWithStatus[];
    onMemberClick?: (userId: string) => void;
    onInviteClick?: () => void;
}

const GROUP_HEADER_HEIGHT = 32;
const MEMBER_ROW_HEIGHT = 44;
const MEMBER_ROW_WITH_STATUS_HEIGHT = 58;

export default function DiscordMemberList({channel, members, onMemberClick, onInviteClick}: Props) {
    // Group members by online status, then by role
    const listItems = useMemo(() => {
        const items: ListItem[] = [];

        // Separate online and offline
        const onlineAdmins: MemberWithStatus[] = [];
        const onlineMembers: MemberWithStatus[] = [];
        const offlineMembers: MemberWithStatus[] = [];

        for (const member of members) {
            const isOffline = member.status === 'offline';
            const isAdmin = member.membership?.scheme_admin === true;

            if (isOffline) {
                offlineMembers.push(member);
            } else if (isAdmin) {
                onlineAdmins.push(member);
            } else {
                onlineMembers.push(member);
            }
        }

        // Add online admins
        if (onlineAdmins.length > 0) {
            items.push({
                type: ListItemType.GroupHeader,
                label: 'Admin',
                count: onlineAdmins.length,
            });
            for (const member of onlineAdmins) {
                items.push({
                    type: ListItemType.Member,
                    data: member,
                    isOffline: false,
                });
            }
        }

        // Add online members
        if (onlineMembers.length > 0) {
            items.push({
                type: ListItemType.GroupHeader,
                label: 'Member',
                count: onlineMembers.length,
            });
            for (const member of onlineMembers) {
                items.push({
                    type: ListItemType.Member,
                    data: member,
                    isOffline: false,
                });
            }
        }

        // Add offline members
        if (offlineMembers.length > 0) {
            items.push({
                type: ListItemType.GroupHeader,
                label: 'Offline',
                count: offlineMembers.length,
            });
            for (const member of offlineMembers) {
                items.push({
                    type: ListItemType.Member,
                    data: member,
                    isOffline: true,
                });
            }
        }

        return items;
    }, [members]);

    const getItemSize = useCallback((index: number) => {
        const item = listItems[index];
        if (item.type === ListItemType.GroupHeader) {
            return GROUP_HEADER_HEIGHT;
        }
        // Check if member has custom status text for variable height
        const memberItem = item as MemberItem;
        // For simplicity, use fixed height; custom status adds minimal height
        return MEMBER_ROW_HEIGHT;
    }, [listItems]);

    const renderItem = useCallback(({index, style}: {index: number; style: React.CSSProperties}) => {
        const item = listItems[index];

        if (item.type === ListItemType.GroupHeader) {
            const headerItem = item as GroupHeaderItem;
            return (
                <div className='discord-member-list__group-header' style={style}>
                    <span className='discord-member-list__group-label'>
                        {headerItem.count} {headerItem.label}
                    </span>
                </div>
            );
        }

        const memberItem = item as MemberItem;
        return (
            <div style={style}>
                <DiscordMemberRow
                    user={memberItem.data.user}
                    status={memberItem.data.status}
                    displayName={memberItem.data.displayName}
                    isOffline={memberItem.isOffline}
                    onClick={() => onMemberClick?.(memberItem.data.user.id)}
                />
            </div>
        );
    }, [listItems, onMemberClick]);

    return (
        <div className='discord-member-list'>
            <div className='discord-member-list__container'>
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
            {onInviteClick && (
                <button
                    className='discord-member-list__invite-button'
                    onClick={onInviteClick}
                >
                    <i className='icon icon-plus'/>
                    <FormattedMessage
                        id='discord_member_list.invite'
                        defaultMessage='Invite'
                    />
                </button>
            )}
        </div>
    );
}

export type {MemberWithStatus} from './types';
```

**Step 3: Create styles**

Create `webapp/channels/src/components/discord_member_list/discord_member_list.scss`:

```scss
.discord-member-list {
    display: flex;
    flex: 1;
    flex-direction: column;
    height: 100%;

    &__container {
        flex: 1;
        min-height: 0;
    }

    &__group-header {
        display: flex;
        align-items: center;
        padding: 16px 8px 4px;
    }

    &__group-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        color: rgba(var(--center-channel-color-rgb), 0.56);
    }

    &__invite-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin: 8px;
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        background: transparent;
        font-size: 14px;
        font-weight: 500;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: var(--center-channel-color);
        }

        .icon {
            font-size: 18px;
        }
    }
}
```

**Step 4: Commit**

```bash
git add webapp/channels/src/components/discord_member_list/
git commit -m "feat: create Discord member list with status grouping"
```

---

## Task 6: Create RHS Back Header Component

**Files:**
- Create: `webapp/channels/src/components/rhs_back_header/index.tsx`
- Create: `webapp/channels/src/components/rhs_back_header/rhs_back_header.scss`

**Step 1: Create the back header component**

Create `webapp/channels/src/components/rhs_back_header/index.tsx`:

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './rhs_back_header.scss';

interface Props {
    title: string;
    onBack: () => void;
}

export default function RhsBackHeader({title, onBack}: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='rhs-back-header'>
            <WithTooltip
                title={formatMessage({id: 'rhs_back_header.back', defaultMessage: 'Back'})}
            >
                <button
                    className='rhs-back-header__back-button'
                    onClick={onBack}
                    aria-label={formatMessage({id: 'rhs_back_header.back', defaultMessage: 'Back'})}
                >
                    <i className='icon icon-arrow-left'/>
                </button>
            </WithTooltip>
            <span className='rhs-back-header__title'>{title}</span>
        </div>
    );
}
```

**Step 2: Create styles**

Create `webapp/channels/src/components/rhs_back_header/rhs_back_header.scss`:

```scss
.rhs-back-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    background: var(--sidebar-bg);

    &__back-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: var(--center-channel-color);
        }

        .icon {
            font-size: 18px;
        }
    }

    &__title {
        font-size: 16px;
        font-weight: 600;
        color: var(--center-channel-color);
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/rhs_back_header/
git commit -m "feat: create RHS back header component"
```

---

## Task 7: Add Redux State for Persistent RHS Tab

**Files:**
- Modify: `webapp/channels/src/reducers/views/rhs.ts`
- Modify: `webapp/channels/src/utils/constants.tsx`

**Step 1: Add new action type constant**

In `webapp/channels/src/utils/constants.tsx`, find the `ActionTypes` object and add:

```typescript
SET_RHS_PERSISTENT_TAB: null,
```

**Step 2: Add new reducer for persistent tab state**

In `webapp/channels/src/reducers/views/rhs.ts`, add a new reducer after `threadFollowersThreadId`:

```typescript
// Track which tab is active in persistent member list mode
function persistentRhsTab(state: 'info' | 'members' = 'members', action: MMAction) {
    switch (action.type) {
    case ActionTypes.SET_RHS_PERSISTENT_TAB:
        return action.tab;
    case UserTypes.LOGOUT_SUCCESS:
        return 'members';
    default:
        return state;
    }
}
```

**Step 3: Add to combineReducers**

In the `combineReducers` call at the bottom, add:

```typescript
persistentRhsTab,
```

**Step 4: Commit**

```bash
git add webapp/channels/src/reducers/views/rhs.ts
git add webapp/channels/src/utils/constants.tsx
git commit -m "feat: add Redux state for persistent RHS tab"
```

---

## Task 8: Add Redux Action for Tab Switching

**Files:**
- Modify: `webapp/channels/src/actions/views/rhs.ts`

**Step 1: Add action creator**

In `webapp/channels/src/actions/views/rhs.ts`, add:

```typescript
export function setPersistentRhsTab(tab: 'info' | 'members') {
    return {
        type: ActionTypes.SET_RHS_PERSISTENT_TAB,
        tab,
    };
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/actions/views/rhs.ts
git commit -m "feat: add action for switching persistent RHS tab"
```

---

## Task 9: Add RHS Selector for Persistent Tab

**Files:**
- Modify: `webapp/channels/src/selectors/rhs.ts`

**Step 1: Add selector**

In `webapp/channels/src/selectors/rhs.ts`, add:

```typescript
export function getPersistentRhsTab(state: GlobalState): 'info' | 'members' {
    return state.views.rhs.persistentRhsTab || 'members';
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/selectors/rhs.ts
git commit -m "feat: add selector for persistent RHS tab"
```

---

## Task 10: Update RHS Type Definitions

**Files:**
- Modify: `webapp/channels/src/types/store/rhs.ts`

**Step 1: Add persistentRhsTab to type**

Find the RHS state type definition and add:

```typescript
persistentRhsTab: 'info' | 'members';
```

**Step 2: Commit**

```bash
git add webapp/channels/src/types/store/rhs.ts
git commit -m "feat: add persistentRhsTab to RHS type definitions"
```

---

## Task 11: Create Persistent Member List RHS Container

**Files:**
- Create: `webapp/channels/src/components/persistent_member_list_rhs/index.tsx`
- Create: `webapp/channels/src/components/persistent_member_list_rhs/persistent_member_list_rhs.scss`

**Step 1: Create the container component**

Create `webapp/channels/src/components/persistent_member_list_rhs/index.tsx`:

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {Channel} from '@mattermost/types/channels';

import {ProfilesInChannelSortBy} from 'mattermost-redux/actions/users';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import ChannelInfoRhs from 'components/channel_info_rhs';
import ChannelInviteModal from 'components/channel_invite_modal';
import DiscordMemberList from 'components/discord_member_list';
import type {MemberWithStatus} from 'components/discord_member_list';
import MoreDirectChannels from 'components/more_direct_channels';
import RhsTabBar from 'components/rhs_tab_bar';
import type {RhsTab} from 'components/rhs_tab_bar';

import {setPersistentRhsTab} from 'actions/views/rhs';
import {openModal} from 'actions/views/modals';
import {openDirectChannelToUserId} from 'actions/channel_actions';
import {loadProfilesAndReloadChannelMembers} from 'actions/user_actions';
import {getPersistentRhsTab} from 'selectors/rhs';
import {getChannelMembersForMembersList} from 'selectors/views/channel_members_rhs';
import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './persistent_member_list_rhs.scss';

const USERS_PER_PAGE = 100;

export default function PersistentMemberListRhs() {
    const dispatch = useDispatch();
    const history = useHistory();

    const channel = useSelector(getCurrentChannel);
    const activeTab = useSelector(getPersistentRhsTab);
    const teamUrl = useSelector(getCurrentTeamUrl);
    const channelMembers = useSelector((state: GlobalState) =>
        channel ? getChannelMembersForMembersList(state, channel.id) : []
    );

    // Map channel members to include status
    const membersWithStatus: MemberWithStatus[] = useSelector((state: GlobalState) => {
        return channelMembers.map((member) => ({
            ...member,
            status: getStatusForUserId(state, member.user.id) || 'offline',
        }));
    });

    const [page, setPage] = useState(0);

    useEffect(() => {
        if (channel && channel.type !== Constants.DM_CHANNEL) {
            setPage(0);
            dispatch(loadProfilesAndReloadChannelMembers(0, USERS_PER_PAGE, channel.id, ProfilesInChannelSortBy.Admin) as any);
        }
    }, [channel?.id, dispatch]);

    const handleTabChange = useCallback((tab: RhsTab) => {
        dispatch(setPersistentRhsTab(tab));
    }, [dispatch]);

    const handleMemberClick = useCallback(async (userId: string) => {
        await dispatch(openDirectChannelToUserId(userId) as any);
        const member = channelMembers.find((m) => m.user.id === userId);
        if (member) {
            history.push(teamUrl + '/messages/@' + member.user.username);
        }
    }, [dispatch, history, teamUrl, channelMembers]);

    const handleInviteClick = useCallback(() => {
        if (!channel) {
            return;
        }

        if (channel.type === Constants.GM_CHANNEL) {
            dispatch(openModal({
                modalId: ModalIdentifiers.CREATE_DM_CHANNEL,
                dialogType: MoreDirectChannels,
                dialogProps: {isExistingChannel: true},
            }));
        } else {
            dispatch(openModal({
                modalId: ModalIdentifiers.CHANNEL_INVITE,
                dialogType: ChannelInviteModal,
                dialogProps: {channel},
            }));
        }
    }, [dispatch, channel]);

    if (!channel) {
        return null;
    }

    return (
        <div className='persistent-member-list-rhs'>
            <RhsTabBar
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />
            <div className='persistent-member-list-rhs__content'>
                {activeTab === 'info' ? (
                    <ChannelInfoRhs/>
                ) : (
                    <DiscordMemberList
                        channel={channel}
                        members={membersWithStatus}
                        onMemberClick={handleMemberClick}
                        onInviteClick={handleInviteClick}
                    />
                )}
            </div>
        </div>
    );
}
```

**Step 2: Create styles**

Create `webapp/channels/src/components/persistent_member_list_rhs/persistent_member_list_rhs.scss`:

```scss
.persistent-member-list-rhs {
    display: flex;
    flex: 1;
    flex-direction: column;
    height: 100%;
    background: var(--sidebar-bg);

    &__content {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/persistent_member_list_rhs/
git commit -m "feat: create persistent member list RHS container"
```

---

## Task 12: Modify sidebar_right.tsx to Support Persistent Mode

**Files:**
- Modify: `webapp/channels/src/components/sidebar_right/sidebar_right.tsx`
- Modify: `webapp/channels/src/components/sidebar_right/index.ts`

**Step 1: Update Props interface**

In `sidebar_right.tsx`, add to Props:

```typescript
isPersistentMemberListEnabled: boolean;
persistentRhsTab: 'info' | 'members';
```

**Step 2: Import new components**

Add imports at the top:

```typescript
import PersistentMemberListRhs from 'components/persistent_member_list_rhs';
import RhsBackHeader from 'components/rhs_back_header';
```

**Step 3: Modify render method**

Update the render method to handle persistent mode. Replace the conditional rendering logic (around line 305-330) with:

```typescript
// Determine if we're in a "pushed" state (showing content other than tab bar views)
const isPushedState = postRightVisible || postCardVisible || isPluginView ||
    this.props.isPinnedPosts || this.props.isChannelFiles ||
    searchVisible || isPostEditHistory;

// Check if persistent member list is enabled
if (this.props.isPersistentMemberListEnabled) {
    if (isPushedState) {
        // Show pushed content with back header
        let pushedContent = null;
        let pushedTitle = '';

        if (postRightVisible) {
            selectedChannelNeeded = true;
            pushedTitle = 'Thread';
            pushedContent = (
                <div className='post-right__container'>
                    <FileUploadOverlay
                        overlayType='right'
                        id={DropOverlayIdRHS}
                    />
                    <RhsThread previousRhsState={previousRhsState}/>
                </div>
            );
        } else if (postCardVisible) {
            pushedTitle = 'Card';
            pushedContent = <RhsCard previousRhsState={previousRhsState}/>;
        } else if (isPluginView) {
            pushedTitle = 'Plugin';
            pushedContent = <RhsPlugin/>;
        } else if (this.props.isPinnedPosts) {
            pushedTitle = 'Pinned Posts';
            pushedContent = null; // Search component handles pinned posts
        } else if (this.props.isChannelFiles) {
            pushedTitle = 'Files';
            pushedContent = null; // Search component handles files
        } else if (isPostEditHistory) {
            pushedTitle = 'Edit History';
            pushedContent = <PostEditHistory/>;
        }

        content = (
            <>
                <RhsBackHeader
                    title={pushedTitle}
                    onBack={() => this.props.actions.goBack()}
                />
                {pushedContent}
            </>
        );
    } else {
        // Show persistent member list with tab bar
        content = <PersistentMemberListRhs/>;
    }
} else {
    // Original behavior when feature is disabled
    if (postRightVisible) {
        selectedChannelNeeded = true;
        content = (
            <div className='post-right__container'>
                <FileUploadOverlay
                    overlayType='right'
                    id={DropOverlayIdRHS}
                />
                <RhsThread previousRhsState={previousRhsState}/>
            </div>
        );
    } else if (postCardVisible) {
        content = <RhsCard previousRhsState={previousRhsState}/>;
    } else if (isPluginView) {
        content = <RhsPlugin/>;
    } else if (isChannelInfo) {
        currentChannelNeeded = true;
        content = <ChannelInfoRhs/>;
    } else if (isChannelMembers) {
        currentChannelNeeded = true;
        content = <ChannelMembersRhs/>;
    } else if (this.props.isThreadFollowers) {
        content = <ThreadFollowersRhs/>;
    } else if (isPostEditHistory) {
        content = <PostEditHistory/>;
    }
}
```

**Step 4: Update isOpen check for persistent mode**

Modify the early return at line ~296:

```typescript
if (!isOpen && !this.props.isPersistentMemberListEnabled) {
    return null;
}

// When persistent mode is enabled, always show RHS when there's a channel
if (this.props.isPersistentMemberListEnabled && !channel) {
    return null;
}
```

**Step 5: Update index.ts connector**

In `webapp/channels/src/components/sidebar_right/index.ts`, add to mapStateToProps:

```typescript
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getPersistentRhsTab} from 'selectors/rhs';

// In mapStateToProps:
const config = getConfig(state);
const isPersistentMemberListEnabled = config.FeatureFlagPersistentMemberList === 'true';
const persistentRhsTab = getPersistentRhsTab(state);

// Return:
isPersistentMemberListEnabled,
persistentRhsTab,
```

**Step 6: Commit**

```bash
git add webapp/channels/src/components/sidebar_right/
git commit -m "feat: integrate persistent member list mode into sidebar_right"
```

---

## Task 13: Update goBack Action for Persistent Mode

**Files:**
- Modify: `webapp/channels/src/actions/views/rhs.ts`

**Step 1: Update goBack to return to tab view**

Modify the `goBack` function to handle persistent mode:

```typescript
export function goBack(): ActionFuncAsync<boolean> {
    return async (dispatch, getState) => {
        const state = getState();
        const config = getConfig(state);
        const isPersistentMemberListEnabled = config.FeatureFlagPersistentMemberList === 'true';

        if (isPersistentMemberListEnabled) {
            // In persistent mode, goBack should return to the tab view
            // by clearing the current RHS state
            dispatch({
                type: ActionTypes.UPDATE_RHS_STATE,
                state: RHSStates.CHANNEL_MEMBERS, // Default to members tab view
            });
            return {data: true};
        }

        // Original behavior
        const prevState = getPreviousRhsState(state);
        const defaultTab = 'channel-info';

        dispatch({
            type: ActionTypes.RHS_GO_BACK,
            state: prevState || defaultTab,
        });

        return {data: true};
    };
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/actions/views/rhs.ts
git commit -m "feat: update goBack action for persistent member list mode"
```

---

## Task 14: Update Thread Followers RHS for Tab Bar

**Files:**
- Modify: `webapp/channels/src/components/thread_followers_rhs/thread_followers_rhs.tsx`

**Step 1: Import and use Discord member list styling**

The thread followers view should also use Discord-style member list when in persistent mode. Update the component to conditionally use the new styling:

```typescript
// Add import
import {useSelector} from 'react-redux';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

// In component, add:
const config = useSelector(getConfig);
const isPersistentMemberListEnabled = config.FeatureFlagPersistentMemberList === 'true';

// Update rendering to use Discord-style when enabled
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/thread_followers_rhs/
git commit -m "feat: update thread followers for persistent member list mode"
```

---

## Task 15: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add feature flag to documentation**

Add to the "Current Feature Flags" table:

```markdown
| `PersistentMemberList` | Always-visible RHS with Discord-style member list | `MM_FEATUREFLAGS_PERSISTENTMEMBERLIST=true` |
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add PersistentMemberList to CLAUDE.md"
```

---

## Task 16: Integration Testing

**Files:**
- Test manually or via GitHub Actions

**Step 1: Enable feature flag locally**

Set environment variable:
```bash
MM_FEATUREFLAGS_PERSISTENTMEMBERLIST=true
```

**Step 2: Test scenarios**

1. **Tab switching**: Click Info tab, then Members tab - verify content switches
2. **Member grouping**: Verify online users grouped by role, offline at bottom
3. **Status display**: Verify status icons on avatars, custom status text below names
4. **Offline styling**: Verify offline users appear grayed/transparent
5. **Navigation to Files/Pinned**: Click Files or Pinned - verify back button appears
6. **Back button**: Click back - verify returns to tab view
7. **Thread view**: Open a thread - verify back button works
8. **Invite button**: Click Invite - verify modal opens

**Step 3: Commit any fixes**

```bash
git add .
git commit -m "fix: address integration testing feedback"
```

---

## Summary

This plan creates a Discord-style persistent member list sidebar with:

1. **Feature flag**: `PersistentMemberList` controls the behavior
2. **Tab bar**: Switches between Info and Members views
3. **Discord-style member list**: Groups by Online (Admin/Member) then Offline
4. **Status display**: Avatar status overlay + custom status text below name
5. **Back navigation**: Other views (Files, Thread, etc.) show back button
6. **Invite button**: Quick invite at bottom of member list

---

**Plan complete and saved to `docs/plans/2026-02-04-persistent-member-list.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
