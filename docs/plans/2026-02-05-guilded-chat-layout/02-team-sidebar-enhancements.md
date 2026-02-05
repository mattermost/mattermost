# 02 - Team Sidebar Enhancements (TDD)

> **For Claude:** REQUIRED: Write tests FIRST, push to GitHub to verify they fail, then implement.

**Goal:** Enhance the team sidebar (far left vertical bar) with DM button, favorited teams section, expand/collapse functionality, and unread DM avatars.

**Architecture:** Wrap or replace existing team sidebar with new `GuildedTeamSidebar` component. DM button triggers `isDmMode` state change. Expand/collapse shows overlay with team names and DM previews. Unread DM avatars appear below DM button when messages are unread.

**Tech Stack:** React, Redux, TypeScript, SCSS, @testing-library/react, jest

**Depends on:** 01-feature-flag-and-infrastructure.md

---

## TDD Workflow Reminder

```
1. Write Test → 2. Push → 3. Verify Fail → 4. Implement → 5. Push → 6. Verify Pass → 7. Commit
```

---

## Task 1: Write Tests for GuildedTeamSidebar Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/__tests__/index.test.tsx`

**Step 1: Create test file**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import GuildedTeamSidebar from '../index';

const mockStore = configureStore([]);

describe('GuildedTeamSidebar', () => {
    const defaultState = {
        views: {
            guildedLayout: {
                isTeamSidebarExpanded: false,
                isDmMode: false,
                favoritedTeamIds: [],
            },
        },
        entities: {
            teams: {
                teams: {},
                myMembers: {},
                currentTeamId: 'team1',
            },
            channels: {
                channels: {},
                myMembers: {},
            },
            users: {
                profiles: {},
                statuses: {},
            },
            general: {
                config: {},
            },
        },
    };

    it('renders the collapsed sidebar container', () => {
        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(container.querySelector('.guilded-team-sidebar')).toBeInTheDocument();
        expect(container.querySelector('.guilded-team-sidebar__collapsed')).toBeInTheDocument();
    });

    it('renders DM button', () => {
        const store = mockStore(defaultState);

        render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(screen.getByRole('button', {name: /direct messages/i})).toBeInTheDocument();
    });

    it('renders dividers', () => {
        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        const dividers = container.querySelectorAll('.guilded-team-sidebar__divider');
        expect(dividers.length).toBeGreaterThanOrEqual(2);
    });

    it('shows expanded overlay when isTeamSidebarExpanded is true', () => {
        const expandedState = {
            ...defaultState,
            views: {
                ...defaultState.views,
                guildedLayout: {
                    ...defaultState.views.guildedLayout,
                    isTeamSidebarExpanded: true,
                },
            },
        };
        const store = mockStore(expandedState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(container.querySelector('.expanded-overlay')).toBeInTheDocument();
    });

    it('does not show expanded overlay when collapsed', () => {
        const store = mockStore(defaultState);

        const {container} = render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(container.querySelector('.expanded-overlay')).not.toBeInTheDocument();
    });

    it('dispatches setDmMode when DM button clicked', () => {
        const store = mockStore(defaultState);

        render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        const dmButton = screen.getByRole('button', {name: /direct messages/i});
        fireEvent.click(dmButton);

        const actions = store.getActions();
        expect(actions).toContainEqual(expect.objectContaining({
            type: 'GUILDED_SET_DM_MODE',
            isDmMode: true,
        }));
    });
});
```

**Step 2: Push to GitHub and verify tests fail**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/__tests__/
git commit -m "test: add GuildedTeamSidebar component tests"
git push origin feature/guilded-layout
# Verify in GitHub Actions that tests fail with "Cannot find module '../index'"
```

---

## Task 2: Write Tests for DM Button Component

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/__tests__/dm_button.test.tsx`

**Step 1: Create test file**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import {IntlProvider} from 'react-intl';
import configureStore from 'redux-mock-store';

import DmButton from '../dm_button';

const mockStore = configureStore([]);

const renderWithProviders = (component: React.ReactElement, storeState = {}) => {
    const defaultState = {
        entities: {
            channels: {channels: {}, myMembers: {}},
            users: {profiles: {}},
        },
        ...storeState,
    };
    const store = mockStore(defaultState);

    return render(
        <Provider store={store}>
            <IntlProvider locale='en'>
                {component}
            </IntlProvider>
        </Provider>
    );
};

describe('DmButton', () => {
    const defaultProps = {
        isActive: false,
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the DM button', () => {
        renderWithProviders(<DmButton {...defaultProps} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).toBeInTheDocument();
    });

    it('has dm-button class', () => {
        renderWithProviders(<DmButton {...defaultProps} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).toHaveClass('dm-button');
    });

    it('has active class when isActive is true', () => {
        renderWithProviders(<DmButton {...defaultProps} isActive={true} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).toHaveClass('dm-button--active');
    });

    it('does not have active class when isActive is false', () => {
        renderWithProviders(<DmButton {...defaultProps} isActive={false} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        expect(button).not.toHaveClass('dm-button--active');
    });

    it('calls onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithProviders(<DmButton {...defaultProps} onClick={onClick} />);

        const button = screen.getByRole('button', {name: /direct messages/i});
        fireEvent.click(button);

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('shows active indicator when isActive', () => {
        const {container} = renderWithProviders(<DmButton {...defaultProps} isActive={true} />);

        expect(container.querySelector('.dm-button__active-indicator')).toBeInTheDocument();
    });

    it('does not show active indicator when not active', () => {
        const {container} = renderWithProviders(<DmButton {...defaultProps} isActive={false} />);

        expect(container.querySelector('.dm-button__active-indicator')).not.toBeInTheDocument();
    });

    it('shows unread badge when unreadCount > 0', () => {
        // This requires the selector to return unread count
        // For now, test that badge element exists conditionally
        const stateWithUnreads = {
            entities: {
                channels: {
                    channels: {
                        dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                    },
                    myMembers: {
                        dm1: {channel_id: 'dm1', mention_count: 5},
                    },
                },
                users: {profiles: {}},
            },
        };
        const {container} = renderWithProviders(
            <DmButton {...defaultProps} />,
            stateWithUnreads,
        );

        expect(container.querySelector('.dm-button__badge')).toBeInTheDocument();
    });

    it('shows 99+ when unread count exceeds 99', () => {
        const stateWithManyUnreads = {
            entities: {
                channels: {
                    channels: {
                        dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                    },
                    myMembers: {
                        dm1: {channel_id: 'dm1', mention_count: 150},
                    },
                },
                users: {profiles: {}},
            },
        };
        renderWithProviders(<DmButton {...defaultProps} />, stateWithManyUnreads);

        expect(screen.getByText('99+')).toBeInTheDocument();
    });
});
```

**Step 2: Push and verify failure**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/__tests__/dm_button.test.tsx
git commit -m "test: add DM button component tests"
git push
```

---

## Task 3: Write Tests for Unread DM Selectors

**Files:**
- Create: `webapp/channels/src/selectors/__tests__/guilded_layout.test.ts`

**Step 1: Create test file**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getUnreadDmCount,
    getUnreadDmChannelsWithUsers,
    getFavoritedTeamIds,
    isThreadsInSidebarActive,
    isGuildedLayoutEnabled,
} from '../views/guilded_layout';

import type {GlobalState} from 'types/store';

describe('guilded_layout selectors', () => {
    const baseState = {
        entities: {
            general: {
                config: {
                    FeatureFlagGuildedChatLayout: 'false',
                    FeatureFlagThreadsInSidebar: 'false',
                },
            },
            channels: {
                channels: {},
                myMembers: {},
            },
            users: {
                profiles: {},
                statuses: {},
                currentUserId: 'currentUser',
            },
            teams: {
                currentTeamId: 'team1',
            },
        },
        views: {
            guildedLayout: {
                isTeamSidebarExpanded: false,
                isDmMode: false,
                favoritedTeamIds: ['team1', 'team2'],
                rhsActiveTab: 'members',
                activeModal: null,
                modalData: {},
            },
        },
    } as unknown as GlobalState;

    describe('isGuildedLayoutEnabled', () => {
        it('returns false when flag is disabled', () => {
            expect(isGuildedLayoutEnabled(baseState)).toBe(false);
        });

        it('returns true when flag is enabled', () => {
            const state = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    general: {
                        config: {
                            FeatureFlagGuildedChatLayout: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(isGuildedLayoutEnabled(state)).toBe(true);
        });
    });

    describe('isThreadsInSidebarActive', () => {
        it('returns false when both flags disabled', () => {
            expect(isThreadsInSidebarActive(baseState)).toBe(false);
        });

        it('returns true when ThreadsInSidebar flag enabled', () => {
            const state = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    general: {
                        config: {
                            FeatureFlagThreadsInSidebar: 'true',
                            FeatureFlagGuildedChatLayout: 'false',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(isThreadsInSidebarActive(state)).toBe(true);
        });

        it('returns true when GuildedChatLayout flag enabled (auto-enables)', () => {
            const state = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    general: {
                        config: {
                            FeatureFlagThreadsInSidebar: 'false',
                            FeatureFlagGuildedChatLayout: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(isThreadsInSidebarActive(state)).toBe(true);
        });
    });

    describe('getFavoritedTeamIds', () => {
        it('returns favorited team IDs from state', () => {
            expect(getFavoritedTeamIds(baseState)).toEqual(['team1', 'team2']);
        });

        it('returns empty array when no favorites', () => {
            const state = {
                ...baseState,
                views: {
                    ...baseState.views,
                    guildedLayout: {
                        ...baseState.views.guildedLayout,
                        favoritedTeamIds: [],
                    },
                },
            } as unknown as GlobalState;

            expect(getFavoritedTeamIds(state)).toEqual([]);
        });
    });

    describe('getUnreadDmCount', () => {
        it('returns 0 when no DM channels', () => {
            expect(getUnreadDmCount(baseState)).toBe(0);
        });

        it('counts unread mentions in DM channels', () => {
            const state = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                            dm2: {id: 'dm2', type: 'D', name: 'user1__user3'},
                            channel1: {id: 'channel1', type: 'O', name: 'town-square'},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 3, user_id: 'currentUser'},
                            dm2: {channel_id: 'dm2', mention_count: 2, user_id: 'currentUser'},
                            channel1: {channel_id: 'channel1', mention_count: 10, user_id: 'currentUser'},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(getUnreadDmCount(state)).toBe(5); // 3 + 2, excludes channel mentions
        });
    });

    describe('getUnreadDmChannelsWithUsers', () => {
        it('returns empty array when no unread DMs', () => {
            expect(getUnreadDmChannelsWithUsers(baseState)).toEqual([]);
        });

        it('returns unread DMs with user info sorted by last_post_at', () => {
            const state = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                            dm2: {id: 'dm2', type: 'D', name: 'currentUser__user3', last_post_at: 2000},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 3, user_id: 'currentUser'},
                            dm2: {channel_id: 'dm2', mention_count: 1, user_id: 'currentUser'},
                        },
                    },
                    users: {
                        profiles: {
                            user2: {id: 'user2', username: 'user2', last_picture_update: 0},
                            user3: {id: 'user3', username: 'user3', last_picture_update: 0},
                        },
                        statuses: {
                            user2: 'online',
                            user3: 'away',
                        },
                        currentUserId: 'currentUser',
                    },
                },
            } as unknown as GlobalState;

            const result = getUnreadDmChannelsWithUsers(state);

            expect(result).toHaveLength(2);
            // Should be sorted by last_post_at descending
            expect(result[0].channel.id).toBe('dm2');
            expect(result[1].channel.id).toBe('dm1');
            expect(result[0].user.username).toBe('user3');
            expect(result[0].unreadCount).toBe(1);
            expect(result[0].status).toBe('away');
        });
    });
});
```

**Step 2: Push and verify failure**

```bash
git add webapp/channels/src/selectors/__tests__/guilded_layout.test.ts
git commit -m "test: add guilded_layout selector tests"
git push
```

---

## Task 4: Implement GuildedTeamSidebar Component (Make Tests Pass)

After tests are pushed and confirmed failing, implement the component:

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
}
```

**Step 3: Push and verify tests pass**

```bash
git add webapp/channels/src/components/guilded_team_sidebar/
git commit -m "feat: implement GuildedTeamSidebar component"
git push
# Verify tests pass in GitHub Actions
```

---

## Task 5: Implement DM Button Component (Make Tests Pass)

**Files:**
- Create: `webapp/channels/src/components/guilded_team_sidebar/dm_button.tsx`
- Create: `webapp/channels/src/components/guilded_team_sidebar/dm_button.scss`

(Implementation code as in original plan)

---

## Task 6: Implement Unread DM Selectors (Make Tests Pass)

**Files:**
- Modify: `webapp/channels/src/selectors/views/guilded_layout.ts`

Add selectors:
- `getUnreadDmCount`
- `getUnreadDmChannelsWithUsers`
- `getFavoritedTeamIds`

**IMPORTANT:** Use `createSelector` from `mattermost-redux/selectors/create_selector`, NOT from `reselect`.

---

## Task 7-10: Continue TDD Pattern

For remaining components (UnreadDmAvatars, FavoritedTeams, TeamList, AddTeamButton, ExpandedOverlay):

1. Write tests first
2. Push to verify failure
3. Implement component
4. Push to verify pass
5. Commit

---

## Summary

| Task | Type | Files | Description |
|------|------|-------|-------------|
| 1 | Test | `__tests__/index.test.tsx` | GuildedTeamSidebar tests |
| 2 | Test | `__tests__/dm_button.test.tsx` | DmButton tests |
| 3 | Test | `selectors/__tests__/guilded_layout.test.ts` | Selector tests |
| 4 | Impl | `index.tsx`, `*.scss` | GuildedTeamSidebar implementation |
| 5 | Impl | `dm_button.tsx`, `*.scss` | DmButton implementation |
| 6 | Impl | `guilded_layout.ts` | Selector implementation |
| 7-10 | TDD | Various | Remaining components with tests |

**Next:** [03-enhanced-conversation-rows.md](./03-enhanced-conversation-rows.md)
