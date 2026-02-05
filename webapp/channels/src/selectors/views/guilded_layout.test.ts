// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import * as Selectors from './guilded_layout';

describe('selectors/views/guilded_layout', () => {
    describe('isGuildedLayoutEnabled', () => {
        it('should return false when flag is disabled', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            FeatureFlagGuildedChatLayout: 'false',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isGuildedLayoutEnabled(state)).toBe(false);
        });

        it('should return true when flag is enabled', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            FeatureFlagGuildedChatLayout: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isGuildedLayoutEnabled(state)).toBe(true);
        });

        it('should return false when flag is undefined', () => {
            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isGuildedLayoutEnabled(state)).toBe(false);
        });
    });

    describe('isThreadsInSidebarActive', () => {
        it('should return false when both flags are disabled', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            FeatureFlagThreadsInSidebar: 'false',
                            FeatureFlagGuildedChatLayout: 'false',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isThreadsInSidebarActive(state)).toBe(false);
        });

        it('should return true when ThreadsInSidebar flag is enabled', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            FeatureFlagThreadsInSidebar: 'true',
                            FeatureFlagGuildedChatLayout: 'false',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isThreadsInSidebarActive(state)).toBe(true);
        });

        it('should return true when GuildedChatLayout flag is enabled (auto-enables ThreadsInSidebar)', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            FeatureFlagThreadsInSidebar: 'false',
                            FeatureFlagGuildedChatLayout: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isThreadsInSidebarActive(state)).toBe(true);
        });

        it('should return true when both flags are enabled', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            FeatureFlagThreadsInSidebar: 'true',
                            FeatureFlagGuildedChatLayout: 'true',
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isThreadsInSidebarActive(state)).toBe(true);
        });
    });

    describe('getGuildedLayoutState', () => {
        it('should return the guildedLayout state', () => {
            const guildedLayoutState = {
                isTeamSidebarExpanded: true,
                isDmMode: false,
                rhsActiveTab: 'members' as const,
                activeModal: null,
                modalData: {},
            };
            const state = {
                views: {
                    guildedLayout: guildedLayoutState,
                },
            } as unknown as GlobalState;

            expect(Selectors.getGuildedLayoutState(state)).toEqual(guildedLayoutState);
        });
    });

    describe('isTeamSidebarExpanded', () => {
        it('should return true when expanded', () => {
            const state = {
                views: {
                    guildedLayout: {
                        isTeamSidebarExpanded: true,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isTeamSidebarExpanded(state)).toBe(true);
        });

        it('should return false when collapsed', () => {
            const state = {
                views: {
                    guildedLayout: {
                        isTeamSidebarExpanded: false,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isTeamSidebarExpanded(state)).toBe(false);
        });

        it('should return false when state is undefined', () => {
            const state = {
                views: {
                    guildedLayout: undefined,
                },
            } as unknown as GlobalState;

            expect(Selectors.isTeamSidebarExpanded(state)).toBe(false);
        });
    });

    describe('isDmMode', () => {
        it('should return true when in DM mode', () => {
            const state = {
                views: {
                    guildedLayout: {
                        isDmMode: true,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isDmMode(state)).toBe(true);
        });

        it('should return false when not in DM mode', () => {
            const state = {
                views: {
                    guildedLayout: {
                        isDmMode: false,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isDmMode(state)).toBe(false);
        });

        it('should return false when state is undefined', () => {
            const state = {
                views: {
                    guildedLayout: undefined,
                },
            } as unknown as GlobalState;

            expect(Selectors.isDmMode(state)).toBe(false);
        });
    });

    describe('getRhsActiveTab', () => {
        it('should return members when tab is members', () => {
            const state = {
                views: {
                    guildedLayout: {
                        rhsActiveTab: 'members',
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getRhsActiveTab(state)).toBe('members');
        });

        it('should return threads when tab is threads', () => {
            const state = {
                views: {
                    guildedLayout: {
                        rhsActiveTab: 'threads',
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getRhsActiveTab(state)).toBe('threads');
        });

        it('should default to members when state is undefined', () => {
            const state = {
                views: {
                    guildedLayout: undefined,
                },
            } as unknown as GlobalState;

            expect(Selectors.getRhsActiveTab(state)).toBe('members');
        });
    });

    describe('getActiveModal', () => {
        it('should return the active modal', () => {
            const state = {
                views: {
                    guildedLayout: {
                        activeModal: 'info',
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getActiveModal(state)).toBe('info');
        });

        it('should return null when no modal is active', () => {
            const state = {
                views: {
                    guildedLayout: {
                        activeModal: null,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getActiveModal(state)).toBe(null);
        });

        it('should return null when state is undefined', () => {
            const state = {
                views: {
                    guildedLayout: undefined,
                },
            } as unknown as GlobalState;

            expect(Selectors.getActiveModal(state)).toBe(null);
        });
    });

    describe('getModalData', () => {
        it('should return modal data', () => {
            const modalData = {channelId: 'channel1', postId: 'post1'};
            const state = {
                views: {
                    guildedLayout: {
                        modalData,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getModalData(state)).toEqual(modalData);
        });

        it('should return empty object when no modal data', () => {
            const state = {
                views: {
                    guildedLayout: {
                        modalData: {},
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getModalData(state)).toEqual({});
        });

        it('should return empty object when state is undefined', () => {
            const state = {
                views: {
                    guildedLayout: undefined,
                },
            } as unknown as GlobalState;

            expect(Selectors.getModalData(state)).toEqual({});
        });
    });

    describe('getFavoritedTeamIds', () => {
        it('should return favorited team IDs from state', () => {
            const state = {
                views: {
                    guildedLayout: {
                        favoritedTeamIds: ['team1', 'team2'],
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getFavoritedTeamIds(state)).toEqual(['team1', 'team2']);
        });

        it('should return empty array when no favorites', () => {
            const state = {
                views: {
                    guildedLayout: {
                        favoritedTeamIds: [],
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getFavoritedTeamIds(state)).toEqual([]);
        });

        it('should return empty array when state is undefined', () => {
            const state = {
                views: {
                    guildedLayout: undefined,
                },
            } as unknown as GlobalState;

            expect(Selectors.getFavoritedTeamIds(state)).toEqual([]);
        });
    });

    describe('getUnreadDmCount', () => {
        it('should return 0 when no DM channels', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {},
                        myMembers: {},
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getUnreadDmCount(state)).toBe(0);
        });

        it('should count unread mentions in DM channels only', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                            dm2: {id: 'dm2', type: 'D', name: 'user1__user3'},
                            channel1: {id: 'channel1', type: 'O', name: 'town-square'},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 3},
                            dm2: {channel_id: 'dm2', mention_count: 2},
                            channel1: {channel_id: 'channel1', mention_count: 10},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getUnreadDmCount(state)).toBe(5); // 3 + 2, excludes channel mentions
        });

        it('should return 0 when DM channels have no mentions', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 0},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getUnreadDmCount(state)).toBe(0);
        });

        it('should handle GM channels (type G) as well', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'user1__user2'},
                            gm1: {id: 'gm1', type: 'G', name: 'group-message'},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 2},
                            gm1: {channel_id: 'gm1', mention_count: 3},
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getUnreadDmCount(state)).toBe(5); // 2 + 3
        });
    });

    describe('getUnreadDmChannelsWithUsers', () => {
        it('should return empty array when no unread DMs', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {},
                        myMembers: {},
                    },
                    users: {
                        profiles: {},
                        statuses: {},
                        currentUserId: 'currentUser',
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getUnreadDmChannelsWithUsers(state)).toEqual([]);
        });

        it('should return unread DMs with user info sorted by last_post_at descending', () => {
            const state = {
                entities: {
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
                            currentUser: {id: 'currentUser', username: 'currentuser'},
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

            const result = Selectors.getUnreadDmChannelsWithUsers(state);

            expect(result).toHaveLength(2);
            // Should be sorted by last_post_at descending (most recent first)
            expect(result[0].channel.id).toBe('dm2');
            expect(result[1].channel.id).toBe('dm1');
            expect(result[0].user.username).toBe('user3');
            expect(result[0].unreadCount).toBe(1);
            expect(result[0].status).toBe('away');
        });

        it('should skip DMs with no unread messages', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                            dm2: {id: 'dm2', type: 'D', name: 'currentUser__user3', last_post_at: 2000},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 0, user_id: 'currentUser'},
                            dm2: {channel_id: 'dm2', mention_count: 5, user_id: 'currentUser'},
                        },
                    },
                    users: {
                        profiles: {
                            currentUser: {id: 'currentUser', username: 'currentuser'},
                            user2: {id: 'user2', username: 'user2'},
                            user3: {id: 'user3', username: 'user3'},
                        },
                        statuses: {},
                        currentUserId: 'currentUser',
                    },
                },
            } as unknown as GlobalState;

            const result = Selectors.getUnreadDmChannelsWithUsers(state);

            expect(result).toHaveLength(1);
            expect(result[0].channel.id).toBe('dm2');
        });

        it('should default status to offline when not found', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'currentUser__user2', last_post_at: 1000},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 1, user_id: 'currentUser'},
                        },
                    },
                    users: {
                        profiles: {
                            currentUser: {id: 'currentUser', username: 'currentuser'},
                            user2: {id: 'user2', username: 'user2'},
                        },
                        statuses: {}, // No status for user2
                        currentUserId: 'currentUser',
                    },
                },
            } as unknown as GlobalState;

            const result = Selectors.getUnreadDmChannelsWithUsers(state);

            expect(result).toHaveLength(1);
            expect(result[0].status).toBe('offline');
        });
    });
});
