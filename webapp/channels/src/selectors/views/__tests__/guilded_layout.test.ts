// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

import * as Selectors from '../guilded_layout';

describe('guilded_layout selectors', () => {
    describe('isGuildedLayoutEnabled', () => {
        it('returns true when FeatureFlagGuildedChatLayout is enabled', () => {
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

        it('returns false when FeatureFlagGuildedChatLayout is disabled', () => {
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
    });

    describe('isThreadsInSidebarActive', () => {
        it('returns true when ThreadsInSidebar flag is enabled', () => {
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

        it('returns true when GuildedChatLayout flag is enabled (auto-enables ThreadsInSidebar)', () => {
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

        it('returns false when both flags are disabled', () => {
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
    });

    describe('getLastPostInChannel', () => {
        it('returns the last post in channel when posts exist', () => {
            const state = {
                entities: {
                    posts: {
                        posts: {
                            post1: {id: 'post1', channel_id: 'channel1', message: 'Hello'},
                            post2: {id: 'post2', channel_id: 'channel1', message: 'World'},
                        },
                        postsInChannel: {
                            channel1: [{order: ['post2', 'post1'], recent: true}],
                        },
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
            } as unknown as GlobalState;

            const result = Selectors.getLastPostInChannel(state, 'channel1');
            expect(result).toBeDefined();
            expect(result?.id).toBe('post2');
        });

        it('returns null when channel has no posts', () => {
            const state = {
                entities: {
                    posts: {
                        posts: {},
                        postsInChannel: {},
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
            } as unknown as GlobalState;

            const result = Selectors.getLastPostInChannel(state, 'channel1');
            expect(result).toBeNull();
        });
    });

    describe('getChannelMembersGroupedByStatus', () => {
        it('returns null when no profiles available', () => {
            const state = {
                entities: {
                    channels: {
                        membersInChannel: {},
                    },
                    users: {
                        profiles: {},
                        profilesInChannel: {},
                        statuses: {},
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                },
            } as unknown as GlobalState;

            const result = Selectors.getChannelMembersGroupedByStatus(state, 'channel1');
            expect(result).toBeNull();
        });

        it('groups members by status correctly', () => {
            const state = {
                entities: {
                    channels: {
                        membersInChannel: {
                            channel1: {
                                user1: {channel_id: 'channel1', user_id: 'user1', scheme_admin: true},
                                user2: {channel_id: 'channel1', user_id: 'user2', scheme_admin: false},
                                user3: {channel_id: 'channel1', user_id: 'user3', scheme_admin: false},
                            },
                        },
                    },
                    users: {
                        profiles: {
                            user1: {id: 'user1', username: 'admin1', nickname: 'Admin'},
                            user2: {id: 'user2', username: 'member1', nickname: 'Member'},
                            user3: {id: 'user3', username: 'offline1', nickname: 'Offline'},
                        },
                        profilesInChannel: {
                            channel1: new Set(['user1', 'user2', 'user3']),
                        },
                        statuses: {
                            user1: 'online',
                            user2: 'online',
                            user3: 'offline',
                        },
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                },
            } as unknown as GlobalState;

            const result = Selectors.getChannelMembersGroupedByStatus(state, 'channel1');

            expect(result).not.toBeNull();
            expect(result!.onlineAdmins).toHaveLength(1);
            expect(result!.onlineAdmins[0].user.username).toBe('admin1');
            expect(result!.onlineMembers).toHaveLength(1);
            expect(result!.onlineMembers[0].user.username).toBe('member1');
            expect(result!.offline).toHaveLength(1);
            expect(result!.offline[0].user.username).toBe('offline1');
        });
    });

    describe('getThreadsInChannel', () => {
        it('returns empty array when no threads exist', () => {
            const state = {
                entities: {
                    threads: {
                        threads: {},
                    },
                    posts: {
                        posts: {},
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
            } as unknown as GlobalState;

            const result = Selectors.getThreadsInChannel(state, 'channel1');
            expect(result).toHaveLength(0);
        });

        it('returns threads for the specified channel', () => {
            const state = {
                entities: {
                    threads: {
                        threads: {
                            post1: {
                                id: 'post1',
                                reply_count: 5,
                                participants: [{id: 'user1'}, {id: 'user2'}],
                                unread_replies: 2,
                            },
                            post2: {
                                id: 'post2',
                                reply_count: 3,
                                participants: [{id: 'user1'}],
                                unread_replies: 0,
                            },
                        },
                    },
                    posts: {
                        posts: {
                            post1: {
                                id: 'post1',
                                channel_id: 'channel1',
                                message: 'Root post 1',
                                last_reply_at: 2000,
                            },
                            post2: {
                                id: 'post2',
                                channel_id: 'channel1',
                                message: 'Root post 2',
                                last_reply_at: 1000,
                            },
                        },
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
            } as unknown as GlobalState;

            const result = Selectors.getThreadsInChannel(state, 'channel1');
            expect(result).toHaveLength(2);
            // Should be sorted by last_reply_at descending
            expect(result[0].id).toBe('post1');
            expect(result[0].replyCount).toBe(5);
            expect(result[0].hasUnread).toBe(true);
            expect(result[1].id).toBe('post2');
            expect(result[1].hasUnread).toBe(false);
        });

        it('filters out threads from other channels', () => {
            const state = {
                entities: {
                    threads: {
                        threads: {
                            post1: {
                                id: 'post1',
                                reply_count: 5,
                                participants: [{id: 'user1'}],
                                unread_replies: 0,
                            },
                        },
                    },
                    posts: {
                        posts: {
                            post1: {
                                id: 'post1',
                                channel_id: 'channel2', // Different channel
                                message: 'Root post',
                                last_reply_at: 1000,
                            },
                        },
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                    users: {currentUserId: 'user1'},
                },
            } as unknown as GlobalState;

            const result = Selectors.getThreadsInChannel(state, 'channel1');
            expect(result).toHaveLength(0);
        });
    });

    describe('getUnreadDmChannelsWithUsers', () => {
        it('returns empty array when no unread DMs', () => {
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
                    users: {
                        profiles: {
                            user1: {id: 'user1', username: 'user1'},
                            user2: {id: 'user2', username: 'user2'},
                        },
                        currentUserId: 'user1',
                        statuses: {},
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                },
            } as unknown as GlobalState;

            const result = Selectors.getUnreadDmChannelsWithUsers(state);
            expect(result).toHaveLength(0);
        });

        it('returns unread DM channels sorted by last post time', () => {
            const state = {
                entities: {
                    channels: {
                        channels: {
                            dm1: {id: 'dm1', type: 'D', name: 'user1__user2', last_post_at: 1000},
                            dm2: {id: 'dm2', type: 'D', name: 'user1__user3', last_post_at: 2000},
                        },
                        myMembers: {
                            dm1: {channel_id: 'dm1', mention_count: 3},
                            dm2: {channel_id: 'dm2', mention_count: 1},
                        },
                    },
                    users: {
                        profiles: {
                            user1: {id: 'user1', username: 'user1'},
                            user2: {id: 'user2', username: 'user2'},
                            user3: {id: 'user3', username: 'user3'},
                        },
                        currentUserId: 'user1',
                        statuses: {
                            user2: 'online',
                            user3: 'away',
                        },
                    },
                    general: {config: {}},
                    preferences: {myPreferences: {}},
                },
            } as unknown as GlobalState;

            const result = Selectors.getUnreadDmChannelsWithUsers(state);
            expect(result).toHaveLength(2);
            // Most recent first (dm2 has last_post_at: 2000)
            expect(result[0].channel.id).toBe('dm2');
            expect(result[0].unreadCount).toBe(1);
            expect(result[1].channel.id).toBe('dm1');
            expect(result[1].unreadCount).toBe(3);
        });
    });

    describe('getFavoritedTeamIds', () => {
        it('returns favorited team IDs from state', () => {
            const state = {
                views: {
                    guildedLayout: {
                        favoritedTeamIds: ['team1', 'team2'],
                    },
                },
            } as unknown as GlobalState;

            const result = Selectors.getFavoritedTeamIds(state);
            expect(result).toEqual(['team1', 'team2']);
        });

        it('returns empty array when no favorites', () => {
            const state = {
                views: {
                    guildedLayout: {
                        favoritedTeamIds: [],
                    },
                },
            } as unknown as GlobalState;

            const result = Selectors.getFavoritedTeamIds(state);
            expect(result).toEqual([]);
        });

        it('returns empty array when guildedLayout is undefined', () => {
            const state = {
                views: {},
            } as unknown as GlobalState;

            const result = Selectors.getFavoritedTeamIds(state);
            expect(result).toEqual([]);
        });
    });

    describe('isDmMode', () => {
        it('returns true when in DM mode', () => {
            const state = {
                views: {
                    guildedLayout: {
                        isDmMode: true,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isDmMode(state)).toBe(true);
        });

        it('returns false when not in DM mode', () => {
            const state = {
                views: {
                    guildedLayout: {
                        isDmMode: false,
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.isDmMode(state)).toBe(false);
        });
    });

    describe('getRhsActiveTab', () => {
        it('returns the active RHS tab', () => {
            const state = {
                views: {
                    guildedLayout: {
                        rhsActiveTab: 'threads',
                    },
                },
            } as unknown as GlobalState;

            expect(Selectors.getRhsActiveTab(state)).toBe('threads');
        });

        it('defaults to members when not set', () => {
            const state = {
                views: {
                    guildedLayout: {},
                },
            } as unknown as GlobalState;

            expect(Selectors.getRhsActiveTab(state)).toBe('members');
        });
    });
});
