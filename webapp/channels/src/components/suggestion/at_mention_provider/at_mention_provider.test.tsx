// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import AtMentionProvider, {groupsGroup, membersGroup, nonMembersGroup, otherMembersGroup, specialMentionsGroup, type Props} from 'components/suggestion/at_mention_provider/at_mention_provider';

import {TestHelper} from 'utils/test_helper';

jest.useFakeTimers();

describe('components/suggestion/at_mention_provider/AtMentionProvider', () => {
    const userid10 = TestHelper.getUserMock({id: 'userid10', username: 'nicknamer', first_name: '', last_name: '', nickname: 'Z'});
    const userid3 = TestHelper.getUserMock({id: 'userid3', username: 'other', first_name: 'X', last_name: 'Y', nickname: 'Z'});
    const userid1 = {...TestHelper.getUserMock({id: 'userid1', username: 'user', first_name: 'a', last_name: 'b', nickname: 'c'}), isCurrentUser: true};
    const userid2 = TestHelper.getUserMock({id: 'userid2', username: 'user2', first_name: 'd', last_name: 'e', nickname: 'f'});
    const userid4 = TestHelper.getUserMock({id: 'userid4', username: 'user4', first_name: 'X', last_name: 'Y', nickname: 'Z'});
    const userid5 = TestHelper.getUserMock({id: 'userid5', username: 'user5', first_name: 'out', last_name: 'out', nickname: 'out'});
    const userid6 = TestHelper.getUserMock({id: 'userid6', username: 'user6.six-split', first_name: 'out Junior', last_name: 'out', nickname: 'out'});
    const userid7 = TestHelper.getUserMock({id: 'userid7', username: 'xuser7', first_name: '', last_name: '', nickname: 'x'});
    const userid8 = TestHelper.getUserMock({id: 'userid8', username: 'xuser8', first_name: 'Robert', last_name: 'Ward', nickname: 'nickname'});

    const groupid1 = TestHelper.getGroupMock({id: 'groupid1', name: 'board', display_name: 'board'});
    const groupid2 = TestHelper.getGroupMock({id: 'groupid2', name: 'developers', display_name: 'developers'});
    const groupid3 = TestHelper.getGroupMock({id: 'groupid3', name: 'software-engineers', display_name: 'software engineers'});

    const baseParams: Props = {
        currentUserId: 'userid1',
        channelId: 'channelid1',
        autocompleteUsersInChannel: jest.fn().mockResolvedValue(false),
        autocompleteGroups: [groupid1, groupid2, groupid3],
        useChannelMentions: true,
        searchAssociatedGroupsForReference: jest.fn().mockResolvedValue(false),
        priorityProfiles: [],
    };

    it('should ignore pretexts that are not at-mentions', () => {
        const provider = new AtMentionProvider(baseParams);
        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged('', resultCallback)).toEqual(false);
        expect(provider.handlePretextChanged('user', resultCallback)).toEqual(false);
        expect(provider.handlePretextChanged('this is a sentence', resultCallback)).toEqual(false);
        expect(baseParams.autocompleteUsersInChannel).not.toHaveBeenCalled();
        expect(baseParams.searchAssociatedGroupsForReference).not.toHaveBeenCalled();
    });

    it('should suggest for "@"', async () => {
        const pretext = '@';
        const matchedPretext = '@';
        const itemsCall3 = [
            membersGroup([
                userid10,
                userid3,
                userid1,
                userid2,
                userid4,
            ]),
            groupsGroup([
                groupid1,
                groupid2,
                groupid3,
            ]),
            specialMentionsGroup([
                {username: 'here'},
                {username: 'channel'},
                {username: 'all'},
            ]),
            nonMembersGroup([
                userid5,
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [groupid1, groupid2, groupid3],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid10,
                    userid3,
                    userid1,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid10,
                    userid3,
                    userid1,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should have priorityProfiles at the top', async () => {
        const userid11 = TestHelper.getUserMock({id: 'userid11', username: 'user11', first_name: 'firstname11', last_name: 'lastname11', nickname: 'nickname11'});
        const userid12 = TestHelper.getUserMock({id: 'userid12', username: 'user12', first_name: 'firstname12', last_name: 'lastname12', nickname: 'nickname12'});

        const pretext = '@';
        const matchedPretext = '@';
        const itemsCall3 = [
            membersGroup([
                userid11,
                userid12,
                userid10,
                userid3,
                userid1,
                userid2,
                userid4,
            ]),
            groupsGroup([
                groupid1,
                groupid2,
                groupid3,
            ]),
            specialMentionsGroup([
                {username: 'here'},
                {username: 'channel'},
                {username: 'all'},
            ]),
            nonMembersGroup([
                userid5,
                userid6,
            ]),
        ];

        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [groupid1, groupid2, groupid3],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
            priorityProfiles: [
                userid11,
                userid12,
            ],
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid11,
                    userid12,
                    userid10,
                    userid3,
                    userid1,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid11,
                    userid12,
                    userid10,
                    userid3,
                    userid1,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should remove duplicates from results', async () => {
        const userid11 = TestHelper.getUserMock({id: 'userid11', username: 'user11', first_name: 'firstname11', last_name: 'lastname11', nickname: 'nickname11'});
        const userid12 = TestHelper.getUserMock({id: 'userid12', username: 'user12', first_name: 'firstname12', last_name: 'lastname12', nickname: 'nickname12'});

        const pretext = '@';
        const matchedPretext = '@';
        const itemsCall3 = [
            membersGroup([
                userid11,
                userid12,
                userid10,
                userid3,
                userid1,
                userid2,
                userid4,
            ]),
            groupsGroup([
                groupid1,
                groupid2,
                groupid3,
            ]),
            specialMentionsGroup([
                {username: 'here'},
                {username: 'channel'},
                {username: 'all'},
            ]),
            nonMembersGroup([
                userid5,
                userid6,
            ]),
        ];

        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4, userid11],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [groupid1, groupid2, groupid3],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
            priorityProfiles: [
                userid11,
                userid12,
            ],
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2, userid12]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid11,
                    userid12,
                    userid10,
                    userid3,
                    userid1,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid11,
                    userid12,
                    userid10,
                    userid3,
                    userid1,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should sort results based on last_viewed_at', async () => {
        const userid11 = TestHelper.getUserMock({id: 'userid11', username: 'user11', first_name: 'firstname11', last_name: 'lastname11', nickname: 'nickname11'});
        const userid12 = TestHelper.getUserMock({id: 'userid12', username: 'user12', first_name: 'firstname12', last_name: 'lastname12', nickname: 'nickname12'});

        const pretext = '@';
        const matchedPretext = '@';
        const itemsCall3 = [
            membersGroup([
                userid11,
                userid12,
                userid10,
                userid3,
                userid1,
                userid2,
                userid4,
            ]),
            groupsGroup([
                groupid1,
                groupid2,
                groupid3,
            ]),
            specialMentionsGroup([
                {username: 'here'},
                {username: 'channel'},
                {username: 'all'},
            ]),
            nonMembersGroup([
                userid5,
                userid6,
            ]),
        ];

        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4, userid11],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [groupid1, groupid2, groupid3],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
            priorityProfiles: [
                userid11,
                userid12,
            ],
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, {...userid3, last_viewed_at: 10}, {...userid1, last_viewed_at: 11}, userid2, userid12]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid11,
                    userid12,
                    {...userid1, last_viewed_at: 11},
                    {...userid3, last_viewed_at: 10},
                    userid10,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid11,
                    userid12,
                    {...userid1, last_viewed_at: 11},
                    {...userid3, last_viewed_at: 10},
                    userid10,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
                otherMembersGroup(),
            ],
        });
    });

    it('should suggest for "@", skipping the loading indicator if results load quickly', async () => {
        const pretext = '@';
        const matchedPretext = '@';
        const itemsCall2 = [
            membersGroup([
                userid10,
                userid3,
                userid1,
                userid2,
                userid4,
            ]),
            groupsGroup([
                groupid1,
                groupid2,
                groupid3,
            ]),
            specialMentionsGroup([
                {username: 'here'},
                {username: 'channel'},
                {username: 'all'},
            ]),
            nonMembersGroup([
                userid5,
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [groupid1, groupid2, groupid3],
                });
                provider.updateMatches(resultCallback, itemsCall2, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid10,
                    userid3,
                    userid1,
                    userid2,
                ]),
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
                specialMentionsGroup([
                    {username: 'here'},
                    {username: 'channel'},
                    {username: 'all'},
                ]),
            ],
        });

        await Promise.resolve().then(() => {
            jest.runOnlyPendingTimers();

            expect(resultCallback).toHaveBeenNthCalledWith(2, {
                matchedPretext,
                groups: itemsCall2,
            });
        });
    });

    it('should suggest for "@h"', async () => {
        const pretext = '@h';
        const matchedPretext = '@h';
        const itemsCall3 = [
            specialMentionsGroup([
                {username: 'here'},
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [],
                    out_of_channel: [],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                specialMentionsGroup([
                    {username: 'here'},
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                specialMentionsGroup([
                    {username: 'here'},
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for username match "@user"', async () => {
        const pretext = '@user';
        const matchedPretext = '@user';
        const itemsCall3 = [
            membersGroup([
                userid1,
                userid2,
                userid4,
            ]),
            nonMembersGroup([
                userid5,
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid1,
                    userid2,
                ]),
            ],
        });

        jest.runOnlyPendingTimers();
        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid1,
                    userid2,
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for username match "@six"', async () => {
        const pretext = '@six';
        const matchedPretext = '@six';
        const itemsCall3 = [
            nonMembersGroup([
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for username match "@split"', async () => {
        const pretext = '@split';
        const matchedPretext = '@split';
        const itemsCall3 = [
            nonMembersGroup([
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for username match "@-split"', async () => {
        const pretext = '@-split';
        const matchedPretext = '@-split';
        const itemsCall3 = [
            nonMembersGroup([
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [],
                    out_of_channel: [userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [],
        });

        jest.runOnlyPendingTimers();
        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for username match "@junior"', async () => {
        const pretext = '@junior';
        const matchedPretext = '@junior';
        const itemsCall3 = [
            nonMembersGroup([
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [],
                    out_of_channel: [userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for first_name match "@X"', async () => {
        const pretext = '@X';
        const matchedPretext = '@x';
        const itemsCall3 = [
            membersGroup([
                userid3,
                userid4,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for last_name match "@Y"', async () => {
        const pretext = '@Y';
        const matchedPretext = '@y';
        const itemsCall3 = [
            membersGroup([
                userid3,
                userid4,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for nickname match "@Z"', async () => {
        const pretext = '@Z';
        const matchedPretext = '@z';
        const itemsCall3 = [
            membersGroup([
                userid10,
                userid3,
                userid4,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid10,
                    userid3,
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid10,
                    userid3,
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest ignore out_of_channel if found locally', async () => {
        const pretext = '@user';
        const matchedPretext = '@user';
        const itemsCall3 = [
            membersGroup([
                userid1,
                userid2,
                userid4,
            ]),
            nonMembersGroup([
                userid5,
                userid6,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4],
                    out_of_channel: [userid1, userid2, userid5, userid6],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid1,
                    userid2,
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid1,
                    userid2,
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should prioritise username match over other matches for in channel users', async () => {
        const pretext = '@x';
        const matchedPretext = '@x';
        const itemsCall3 = [
            membersGroup([
                userid7,
                userid3,
                userid4,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [userid4, userid7],
                    out_of_channel: [],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should prioritise username match over other matches for out of channel users', async () => {
        const pretext = '@x';
        const matchedPretext = '@x';
        const itemsCall3 = [
            membersGroup([
                userid3,
            ]),
            nonMembersGroup([
                userid7,
                userid4,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [],
                    out_of_channel: [userid4, userid7],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
            ],
        });

        jest.runOnlyPendingTimers();

        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                membersGroup([
                    userid3,
                ]),
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should suggest for full name match "robert ward"', async () => {
        const pretext = '@robert ward';
        const matchedPretext = '@robert ward';
        const itemsCall3 = [
            nonMembersGroup([
                userid8,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [],
                    out_of_channel: [userid8],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [],
        });

        jest.runOnlyPendingTimers();
        expect(resultCallback).toHaveBeenNthCalledWith(2, {
            matchedPretext,
            groups: [
                otherMembersGroup(),
            ],
        });

        await Promise.resolve().then(() => {
            expect(resultCallback).toHaveBeenNthCalledWith(3, {
                matchedPretext,
                groups: itemsCall3,
            });
        });
    });

    it('should ignore channel mentions - @here, @channel and @all when useChannelMentions is false', () => {
        const pretext = '@';
        const matchedPretext = '@';
        const params = {
            ...baseParams,
            useChannelMentions: false,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [],
                    out_of_channel: [],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [groupid1, groupid2, groupid3],
                });
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => []);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                groupsGroup([
                    groupid1,
                    groupid2,
                    groupid3,
                ]),
            ],
        });
    });

    it('should suggest for full group display name match "software engineers"', async () => {
        const pretext = '@software engineers';
        const matchedPretext = '@software engineers';
        const itemsCall3 = [
            groupsGroup([
                groupid3,
            ]),
        ];
        const params = {
            ...baseParams,
            autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({data: {
                    users: [],
                    out_of_channel: [],
                }});
            })),
            searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                resolve({
                    data: [groupid3],
                });
                provider.updateMatches(resultCallback, itemsCall3, matchedPretext);
            })),
        };

        const provider = new AtMentionProvider(params);
        jest.spyOn(provider, 'getProfilesWithLastViewAtInChannel').mockImplementation(() => [userid10, userid3, userid1, userid2]);

        const resultCallback = jest.fn();
        expect(provider.handlePretextChanged(pretext, resultCallback)).toEqual(true);

        expect(resultCallback).toHaveBeenNthCalledWith(1, {
            matchedPretext,
            groups: [
                groupsGroup([
                    groupid3,
                ]),
            ],
        });
    });

    describe('full-width at symbol (＠) support', () => {
        describe('basic full-width suggestions', () => {
            it('should handle full-width ＠ character for autocomplete', async () => {
                const inputText = '＠';
                const expectedMatched = '＠';
                const finalGroups = [
                    membersGroup([userid10, userid3, userid1, userid2, userid4]),
                    groupsGroup([groupid1, groupid2, groupid3]),
                    specialMentionsGroup([{username: 'here'}, {username: 'channel'}, {username: 'all'}]),
                    nonMembersGroup([userid5, userid6]),
                ];

                const callback = jest.fn();

                const testParams = {
                    ...baseParams,
                    autocompleteUsersInChannel: jest.fn().mockImplementation(() => new Promise((resolve) => {
                        resolve({data: {
                            users: [userid4],
                            out_of_channel: [userid5, userid6],
                        }});
                    })),
                    searchAssociatedGroupsForReference: jest.fn().mockImplementation(() => new Promise((resolve) => {
                        resolve({
                            data: [groupid1, groupid2, groupid3],
                        });
                        mentionProvider.updateMatches(callback, finalGroups, expectedMatched);
                    })),
                };

                const mentionProvider = new AtMentionProvider(testParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid10, userid3, userid1, userid2]);
                const handled = mentionProvider.handlePretextChanged(inputText, callback);

                expect(handled).toBe(true);

                // First call: local profiles, groups and special mentions
                expect(callback).toHaveBeenNthCalledWith(1, {
                    matchedPretext: expectedMatched,
                    groups: [
                        membersGroup([userid10, userid3, userid1, userid2]),
                        groupsGroup([groupid1, groupid2, groupid3]),
                        specialMentionsGroup([{username: 'here'}, {username: 'channel'}, {username: 'all'}]),
                    ],
                });

                jest.runOnlyPendingTimers();

                // Second call: with loading indicator
                expect(callback).toHaveBeenNthCalledWith(2, {
                    matchedPretext: expectedMatched,
                    groups: expect.arrayContaining([
                        expect.objectContaining({key: 'members'}),
                        expect.objectContaining({key: 'groups'}),
                        expect.objectContaining({key: 'specialMentions'}),
                        expect.objectContaining({key: 'otherMembers'}),
                    ]),
                });

                // Wait for async operations to complete
                await Promise.resolve();

                // Third call: complete results including non-members
                expect(callback).toHaveBeenNthCalledWith(3, {
                    matchedPretext: expectedMatched,
                    groups: finalGroups,
                });
            });

            it('should extract username prefix correctly with full-width ＠', async () => {
                const inputText = '＠us';

                const testParams = {
                    ...baseParams,
                    autocompleteUsersInChannel: jest.fn().mockResolvedValue({
                        data: {users: [userid4], out_of_channel: [userid5, userid6]},
                    }),
                    searchAssociatedGroupsForReference: jest.fn().mockResolvedValue({data: []}),
                };

                const mentionProvider = new AtMentionProvider(testParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid10, userid3, userid1, userid2]);

                const callback = jest.fn();
                mentionProvider.handlePretextChanged(inputText, callback);

                expect(testParams.autocompleteUsersInChannel).toHaveBeenCalledWith('us');
            });
        });

        describe('matchedPretext consistency', () => {
            it('should preserve full-width ＠ in matchedPretext', async () => {
                const inputText = '＠user';
                const testParams = {
                    ...baseParams,
                    autocompleteUsersInChannel: jest.fn().mockResolvedValue({
                        data: {users: [userid1], out_of_channel: []},
                    }),
                    searchAssociatedGroupsForReference: jest.fn().mockResolvedValue({data: []}),
                };

                const mentionProvider = new AtMentionProvider(testParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid1, userid2]);

                const callback = jest.fn();
                mentionProvider.handlePretextChanged(inputText, callback);

                await Promise.resolve();

                callback.mock.calls.forEach((call) => {
                    expect(call[0].matchedPretext).toBe('＠user');
                });
            });

            it('should preserve half-width @ in matchedPretext', async () => {
                const inputText = '@user';
                const testParams = {
                    ...baseParams,
                    autocompleteUsersInChannel: jest.fn().mockResolvedValue({
                        data: {users: [userid1], out_of_channel: []},
                    }),
                    searchAssociatedGroupsForReference: jest.fn().mockResolvedValue({data: []}),
                };

                const mentionProvider = new AtMentionProvider(testParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid1, userid2]);

                const callback = jest.fn();
                mentionProvider.handlePretextChanged(inputText, callback);

                await Promise.resolve();

                callback.mock.calls.forEach((call) => {
                    expect(call[0].matchedPretext).toBe('@user');
                });
            });
        });

        describe('edge cases', () => {
            it('should handle empty string after full-width ＠', () => {
                const mentionProvider = new AtMentionProvider(baseParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid1, userid2]);

                const callback = jest.fn();
                const handled = mentionProvider.handlePretextChanged('＠', callback);

                expect(handled).toBe(true);
                expect(callback).toHaveBeenCalled();
            });

            it('should handle whitespace before full-width ＠', () => {
                const mentionProvider = new AtMentionProvider(baseParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid1]);

                const callback = jest.fn();
                const handled = mentionProvider.handlePretextChanged('hello ＠user', callback);

                expect(handled).toBe(true);
            });

            it('should not trigger when ＠ is within a word', () => {
                const mentionProvider = new AtMentionProvider(baseParams);

                const callback = jest.fn();
                const handled = mentionProvider.handlePretextChanged('email＠example.com', callback);

                expect(handled).toBe(false);
                expect(callback).not.toHaveBeenCalled();
            });

            it('should handle special characters in username with ＠', () => {
                const mentionProvider = new AtMentionProvider(baseParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid6]);

                const callback = jest.fn();
                const handled = mentionProvider.handlePretextChanged('＠user-name', callback);

                expect(handled).toBe(true);
            });
        });

        describe('complete workflow integration', () => {
            it('should maintain consistency through type → suggest → select', async () => {
                const testParams = {
                    ...baseParams,
                    autocompleteUsersInChannel: jest.fn().mockResolvedValue({
                        data: {users: [userid1], out_of_channel: []},
                    }),
                    searchAssociatedGroupsForReference: jest.fn().mockResolvedValue({data: []}),
                };

                const mentionProvider = new AtMentionProvider(testParams);
                jest.spyOn(mentionProvider, 'getProfilesWithLastViewAtInChannel').mockReturnValue([userid1]);

                const callback = jest.fn();

                // User types full-width
                mentionProvider.handlePretextChanged('＠use', callback);

                await Promise.resolve();

                // Verify suggestion maintains full-width
                const firstCall = callback.mock.calls[0][0];
                expect(firstCall.matchedPretext).toBe('＠use');

                // User selects completion
                mentionProvider.handleCompleteWord('＠user');

                // Verify completion was recorded (without the @ symbol)
                expect(mentionProvider.lastCompletedWord).toBe('user');
            });
        });
    });
});

for (const [name, func] of [
    ['membersGroup', membersGroup],
    ['specialMentionsGroup', specialMentionsGroup],
    ['nonMembersGroup', nonMembersGroup],
] as const) {
    describe(name, () => {
        const user1 = TestHelper.getUserMock({id: 'userid1', username: 'user1'});
        const user2 = TestHelper.getUserMock({id: 'userid1', username: 'user.two'});
        const user3 = TestHelper.getUserMock({id: 'userid1', username: 'user-three'});

        test('should set terms matching the usernames of each user', () => {
            expect(func([user1, user2, user3]).terms).toEqual(['@user1', '@user.two', '@user-three']);
        });
    });
}

describe('groupsGroup', () => {
    const group1 = TestHelper.getGroupMock({id: 'groupid1', name: 'board', display_name: 'board'});
    const group2 = TestHelper.getGroupMock({id: 'groupid2', name: 'developers', display_name: 'developers'});
    const group3 = TestHelper.getGroupMock({id: 'groupid3', name: 'software-engineers', display_name: 'software engineers'});

    test('should set terms matching the name of each group', () => {
        expect(groupsGroup([group1, group2, group3]).terms).toEqual(['@board', '@developers', '@software-engineers']);
    });
});
