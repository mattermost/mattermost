// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import * as ChannelUtils from 'mattermost-redux/utils/channel_utils';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import TestHelper from 'packages/mattermost-redux/test/test_helper';
import type {GlobalState} from 'types/store';

import type {OptionValue} from '../types';

import {makeGetOptions} from './index';

describe('makeGetOptions', () => {
    const currentUserId = 'currentUserId';

    const baseState = {
        entities: {
            channels: {
                channels: {},
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId,
            },
        },
        views: {
            search: {
                modalSearch: '',
            },
        },
    } as unknown as GlobalState;

    test('should return the same result when called with the same arguments', () => {
        const getOptions = makeGetOptions();

        const users = [
            TestHelper.fakeUserWithId(),
            TestHelper.fakeUserWithId(),
            TestHelper.fakeUserWithId(),
        ];
        const values = [
            TestHelper.fakeUserWithId(),
        ] as OptionValue[];

        expect(getOptions(baseState, users, values)).toBe(getOptions(baseState, users, values));
    });

    test('should return recent DMs, even with deleted users', () => {
        const getOptions = makeGetOptions();

        const user1 = TestHelper.fakeUserWithId();
        const user2 = TestHelper.fakeUserWithId();
        const deletedUser = {
            ...TestHelper.fakeUserWithId(),
            delete_at: 1000,
        };

        const dm1 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.DM_CHANNEL,
            name: ChannelUtils.getDirectChannelName(currentUserId, user1.id),
            last_post_at: 2000,
        };
        const dm2 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.DM_CHANNEL,
            name: ChannelUtils.getDirectChannelName(currentUserId, user2.id),
            last_post_at: 3000,
        };
        const deletedDM = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.DM_CHANNEL,
            name: ChannelUtils.getDirectChannelName(currentUserId, deletedUser.id),
            last_post_at: 4000,
        };

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        [dm1.id]: dm1,
                        [dm2.id]: dm2,
                        [deletedDM.id]: deletedDM,
                    },
                },
            },
        });

        const users = [
            user1,
            user2,
            deletedUser,
        ];
        const values: OptionValue[] = [];

        // Results are sorted by last_post_at descending
        expect(getOptions(state, users, values)).toEqual([
            {...deletedUser, last_post_at: deletedDM.last_post_at},
            {...user2, last_post_at: dm2.last_post_at},
            {...user1, last_post_at: dm1.last_post_at},
        ]);
    });

    test('should only return DMs with users matching the search term', () => {
        const getOptions = makeGetOptions();

        const user1 = TestHelper.fakeUserWithId();
        const user2 = TestHelper.fakeUserWithId();
        const deletedUser = {
            ...TestHelper.fakeUserWithId(),
            delete_at: 1000,
        };

        const dm1 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.DM_CHANNEL,
            name: ChannelUtils.getDirectChannelName(currentUserId, user1.id),
            last_post_at: 2000,
        };
        const dm2 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.DM_CHANNEL,
            name: ChannelUtils.getDirectChannelName(currentUserId, user2.id),
            last_post_at: 3000,
        };
        const deletedDM = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.DM_CHANNEL,
            name: ChannelUtils.getDirectChannelName(currentUserId, deletedUser.id),
            last_post_at: 4000,
        };

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        [dm1.id]: dm1,
                        [dm2.id]: dm2,
                        [deletedDM.id]: deletedDM,
                    },
                },
            },
            views: {
                search: {
                    searchTerm: 'asdf',
                },
            },
        });

        const users = [
            user1,
            user2,
            deletedUser,
        ];
        const values: OptionValue[] = [];

        // Results are sorted by last_post_at descending
        expect(getOptions(state, users, values)).toEqual([
            {...deletedUser, last_post_at: deletedDM.last_post_at},
            {...user2, last_post_at: dm2.last_post_at},
            {...user1, last_post_at: dm1.last_post_at},
        ]);
    });

    test('should return recent GMs', () => {
        const getOptions = makeGetOptions();

        const user1 = {
            ...TestHelper.fakeUserWithId(),
            username: 'apple',
        };
        const user2 = {
            ...TestHelper.fakeUserWithId(),
            username: 'banana',
        };
        const user3 = {
            ...TestHelper.fakeUserWithId(),
            username: 'carrot',
        };

        const gmChannel1 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            display_name: 'apple, carrot',
            last_post_at: 1000,
        };
        const gmChannel2 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            display_name: 'banana, carrot',
            last_post_at: 2000,
        };
        const gmChannel3 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            display_name: 'apple, banana',
            last_post_at: 3000,
        };

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        [gmChannel1.id]: gmChannel1,
                        [gmChannel2.id]: gmChannel2,
                        [gmChannel3.id]: gmChannel3,
                    },
                    channelsInTeam: {
                        '': [gmChannel1.id, gmChannel2.id, gmChannel3.id],
                    },
                },
                users: {
                    profiles: {
                        [user1.id]: user1,
                        [user2.id]: user2,
                        [user3.id]: user3,
                    },
                    profilesInChannel: {
                        [gmChannel1.id]: [user1.id, user3.id],
                        [gmChannel2.id]: [user2.id, user3.id],
                        [gmChannel3.id]: [user1.id, user2.id],
                    },
                },
            },
        });

        const users: UserProfile[] = [];
        const values: OptionValue[] = [];

        // Results are sorted by last_post_at descending
        expect(getOptions(state, users, values)).toEqual([
            {
                ...gmChannel3,
                profiles: [user1, user2],
            },
            {
                ...gmChannel2,
                profiles: [user2, user3],
            },
            {
                ...gmChannel1,
                profiles: [user1, user3],
            },
        ]);
    });

    test('should not return GMs without any posts', () => {
        const getOptions = makeGetOptions();

        const user1 = {
            ...TestHelper.fakeUserWithId(),
            username: 'apple',
        };
        const user2 = {
            ...TestHelper.fakeUserWithId(),
            username: 'banana',
        };
        const user3 = {
            ...TestHelper.fakeUserWithId(),
            username: 'carrot',
        };

        const gmChannel1 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            display_name: 'apple, carrot',
            last_post_at: 1000,
        };
        const gmChannel2 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            display_name: 'banana, carrot',
            last_post_at: 0,
        };

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        [gmChannel1.id]: gmChannel1,
                        [gmChannel2.id]: gmChannel2,
                    },
                    channelsInTeam: {
                        '': [gmChannel1.id, gmChannel2.id],
                    },
                },
                users: {
                    profiles: {
                        [user1.id]: user1,
                        [user2.id]: user2,
                        [user3.id]: user3,
                    },
                    profilesInChannel: {
                        [gmChannel1.id]: [user1.id, user3.id],
                        [gmChannel2.id]: [user2.id, user3.id],
                    },
                },
            },
        });

        const users: UserProfile[] = [];
        const values: OptionValue[] = [];

        // Results are sorted by last_post_at descending
        expect(getOptions(state, users, values)).toEqual([
            {
                ...gmChannel1,
                profiles: [user1, user3],
            },
        ]);
    });

    test('should only return GMs with users matching the search term', () => {
        const getOptions = makeGetOptions();

        const user1 = {
            ...TestHelper.fakeUserWithId(),
            username: 'test_user',
        };
        const user2 = {
            ...TestHelper.fakeUserWithId(),
            username: 'some_user',
            first_name: 'Some',
            last_name: 'Test',
        };
        const user3 = {
            ...TestHelper.fakeUserWithId(),
            username: 'another_user',
        };

        const gmChannel1 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            last_post_at: 1000,
        };
        const gmChannel1WithProfiles = {
            ...gmChannel1,
            display_name: 'test_user',
            profiles: [user1],
        };
        const gmChannel2 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            last_post_at: 2000,
        };
        const gmChannel2WithProfiles = {
            ...gmChannel2,
            display_name: 'some_user',
            profiles: [user2],
        };
        const gmChannel3 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            last_post_at: 3000,
        };
        const gmChannel3WithProfiles = {
            ...gmChannel3,
            display_name: 'another_user',
            profiles: [user3],
        };

        let state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        [gmChannel1.id]: gmChannel1,
                        [gmChannel2.id]: gmChannel2,
                        [gmChannel3.id]: gmChannel3,
                    },
                    channelsInTeam: {
                        '': [gmChannel1.id, gmChannel2.id, gmChannel3.id],
                    },
                },
                users: {
                    profiles: {
                        [user1.id]: user1,
                        [user2.id]: user2,
                        [user3.id]: user3,
                    },
                    profilesInChannel: {
                        [gmChannel1.id]: [user1.id],
                        [gmChannel2.id]: [user2.id],
                        [gmChannel3.id]: [user3.id],
                    },
                },
            },
            views: {
                search: {
                    modalSearch: 'test',
                },
            },
        });

        const users: UserProfile[] = [];
        const values: OptionValue[] = [];

        // Results are sorted by last_post_at descending
        expect(getOptions(state, users, values)).toEqual([
            gmChannel2WithProfiles,
            gmChannel1WithProfiles,
        ]);

        state = mergeObjects(state, {
            views: {
                search: {
                    modalSearch: 'user',
                },
            },
        });

        expect(getOptions(state, users, values)).toEqual([
            gmChannel3WithProfiles,
            gmChannel2WithProfiles,
            gmChannel1WithProfiles,
        ]);

        state = mergeObjects(state, {
            views: {
                search: {
                    modalSearch: 'qwertyasdf',
                },
            },
        });

        expect(getOptions(state, users, values)).toEqual([]);
    });

    test('should only return GMs with users matching the selected items', () => {
        const getOptions = makeGetOptions();

        const user1 = {
            ...TestHelper.fakeUserWithId(),
            username: 'apple',
        };
        const user2 = {
            ...TestHelper.fakeUserWithId(),
            username: 'banana',
        };
        const user3 = {
            ...TestHelper.fakeUserWithId(),
            username: 'carrot',
        };

        const gmChannel1 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            last_post_at: 1000,
        };
        const gmChannel1WithProfiles = {
            ...gmChannel1,
            display_name: 'apple, carrot',
            profiles: [user1, user3],
        };
        const gmChannel2 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.GM_CHANNEL,
            last_post_at: 2000,
        };
        const gmChannel2WithProfiles = {
            ...gmChannel2,
            display_name: 'banana, carrot',
            profiles: [user2, user3],
        };

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        [gmChannel1.id]: gmChannel1,
                        [gmChannel2.id]: gmChannel2,
                    },
                    channelsInTeam: {
                        '': [gmChannel1.id, gmChannel2.id],
                    },
                },
                users: {
                    profiles: {
                        [user1.id]: user1,
                        [user2.id]: user2,
                        [user3.id]: user3,
                    },
                    profilesInChannel: {
                        [gmChannel1.id]: [user1.id, user3.id],
                        [gmChannel2.id]: [user2.id, user3.id],
                    },
                },
            },
        });

        const users = [
            user1,
            user2,
            user3,
        ];

        let values: OptionValue[] = [];

        // Results are sorted by last_post_at descending followed by DMs matching users
        expect(getOptions(state, users, values)).toEqual([
            gmChannel2WithProfiles,
            gmChannel1WithProfiles,
        ]);

        values = [user1] as OptionValue[];

        expect(getOptions(state, users, values)).toEqual([
            gmChannel1WithProfiles,
        ]);

        values = [user2] as OptionValue[];

        expect(getOptions(state, users, values)).toEqual([
            gmChannel2WithProfiles,
        ]);

        values = [user3] as OptionValue[];

        expect(getOptions(state, users, values)).toEqual([
            gmChannel2WithProfiles,
            gmChannel1WithProfiles,
        ]);

        values = [user3, user2] as OptionValue[];

        expect(getOptions(state, users, values)).toEqual([
            gmChannel2WithProfiles,
        ]);
    });

    test('should return users without DMs as long as either there are no recents or a search term is being used', () => {
        const getOptions = makeGetOptions();

        const user1 = {
            ...TestHelper.fakeUserWithId(),
            username: 'apple',
        };
        const user2 = {
            ...TestHelper.fakeUserWithId(),
            username: 'banana',
        };
        const user3 = {
            ...TestHelper.fakeUserWithId(),
            username: 'carrot',
        };

        const dm1 = {
            ...TestHelper.fakeChannelWithId(''),
            type: General.DM_CHANNEL,
            name: ChannelUtils.getDirectChannelName(currentUserId, user1.id),
            last_post_at: 2000,
        };

        const users = [
            user1,
            user2,
            user3,
        ];
        const values: OptionValue[] = [];

        let state = mergeObjects(baseState, {
            users: {
                profiles: {
                    [user1.id]: user1,
                    [user2.id]: user2,
                    [user3.id]: user3,
                },
            },
        });

        // No recent DMs exist, so show all the users
        expect(getOptions(state, users, values)).toEqual([
            {...user1, last_post_at: 0},
            {...user2, last_post_at: 0},
            {...user3, last_post_at: 0},
        ]);

        state = mergeObjects(state, {
            entities: {
                channels: {
                    channels: {
                        [dm1.id]: dm1,
                    },
                    channelsInTeam: {
                        '': [dm1.id],
                    },
                },
                users: {
                    profilesInChannel: {
                        [dm1.id]: [user1.id],
                    },
                },
            },
        });

        // Now a recent DM exists, so only show that
        expect(getOptions(state, users, values)).toEqual([
            {...user1, last_post_at: 2000},
        ]);

        state = mergeObjects(state, {
            views: {
                search: {
                    modalSearch: 'asdfasdfasdf',
                },
            },
        });

        // And now a search term has been entered, so show other users again. Note that users is expected to have been
        // filtered by the search term already even if it doesn't match at this point
        expect(getOptions(state, users, values)).toEqual([
            {...user1, last_post_at: 2000},
            {...user2, last_post_at: 0},
            {...user3, last_post_at: 0},
        ]);
    });
});
