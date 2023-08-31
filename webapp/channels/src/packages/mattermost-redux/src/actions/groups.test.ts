// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {GetGroupsParams, SyncableType} from '@mattermost/types/groups';

import * as Actions from 'mattermost-redux/actions/groups';
import {Client4} from 'mattermost-redux/client';

import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.Groups', () => {
    let store = configureStore();

    beforeEach(() => {
        TestHelper.initBasic(Client4);
        store = configureStore();
    });

    afterEach(() => {
        TestHelper.tearDown();
    });

    it('getGroupSyncables', async () => {
        const groupID = '5rgoajywb3nfbdtyafbod47rya';

        const groupTeams = [
            {
                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                team_display_name: 'dolphins',
                team_type: 'O',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                auto_add: true,
                create_at: 1542643748412,
                delete_at: 0,
                update_at: 1542643748412,
            },
            {
                team_id: 'tdjrcr3hg7yazyos17a53jduna',
                team_display_name: 'developers',
                team_type: 'O',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                auto_add: true,
                create_at: 1542643825026,
                delete_at: 0,
                update_at: 1542643825026,
            },
        ];

        const groupChannels = [
            {
                channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
                channel_display_name: 'standup',
                channel_type: 'P',
                team_id: 'tdjrcr3hg7yazyos17a53jduna',
                team_display_name: 'developers',
                team_type: 'O',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                auto_add: true,
                create_at: 1542644105041,
                delete_at: 0,
                update_at: 1542644105041,
            },
            {
                channel_id: 's6oxu3embpdepyprx1fn5gjhea',
                channel_display_name: 'swimming',
                channel_type: 'P',
                team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
                team_display_name: 'dolphins',
                team_type: 'O',
                group_id: '5rgoajywb3nfbdtyafbod47rya',
                auto_add: true,
                create_at: 1542644105042,
                delete_at: 0,
                update_at: 1542644105042,
            },
        ];

        nock(Client4.getBaseRoute()).
            get(`/groups/${groupID}/teams`).
            reply(200, groupTeams);

        nock(Client4.getBaseRoute()).
            get(`/groups/${groupID}/channels`).
            reply(200, groupChannels);

        await Actions.getGroupSyncables(groupID, SyncableType.Team)(store.dispatch, store.getState);
        await Actions.getGroupSyncables(groupID, SyncableType.Channel)(store.dispatch, store.getState);

        const state = store.getState();

        const groupSyncables = state.entities.groups.syncables[groupID];
        expect(groupSyncables).toBeTruthy();

        for (let i = 0; i < 2; i++) {
            expect(JSON.stringify(groupSyncables.teams[i]) === JSON.stringify(groupTeams[i])).toBeTruthy();
            expect(JSON.stringify(groupSyncables.channels[i]) === JSON.stringify(groupChannels[i])).toBeTruthy();
        }
    });

    it('getGroup', async () => {
        const groupID = '5rgoajywb3nfbdtyafbod47rya';

        const response = {
            id: groupID,
            name: '8b7ks7ngqbgndqutka48gfzaqh',
            display_name: 'Test Group 0',
            description: '',
            type: 'ldap',
            remote_id: '\\eb\\80\\94\\cd\\d4\\32\\7c\\45\\87\\79\\1b\\fe\\45\\d9\\ac\\7b',
            create_at: 1542399032816,
            update_at: 1542399032816,
            delete_at: 0,
            has_syncables: false,
        };

        nock(Client4.getBaseRoute()).
            get(`/groups/${groupID}?include_member_count=false`).
            reply(200, response);

        await Actions.getGroup(groupID)(store.dispatch, store.getState);

        const state = store.getState();

        const groups = state.entities.groups.groups;
        expect(groups).toBeTruthy();
        expect(groups[groupID]).toBeTruthy();
        expect(JSON.stringify(response) === JSON.stringify(groups[groupID])).toBeTruthy();
    });

    it('linkGroupSyncable', async () => {
        const groupID = '5rgoajywb3nfbdtyafbod47rya';
        const teamID = 'ge63nq31sbfy3duzq5f7yqn1kh';
        const channelID = 'o3tdawqxot8kikzq8bk54zggbc';

        const groupTeamResponse = {
            team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
            group_id: '5rgoajywb3nfbdtyafbod47rya',
            auto_add: true,
            create_at: 1542643748412,
            delete_at: 0,
            update_at: 1542660566032,
        };

        const groupChannelResponse = {
            channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
            group_id: '5rgoajywb3nfbdtyafbod47rya',
            team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
            auto_add: true,
            create_at: 1542644105041,
            delete_at: 0,
            update_at: 1542662607342,
        };

        nock(Client4.getBaseRoute()).
            post(`/groups/${groupID}/teams/${teamID}/link`).
            reply(200, groupTeamResponse);

        nock(Client4.getBaseRoute()).
            post(`/groups/${groupID}/channels/${channelID}/link`).
            reply(200, groupChannelResponse);

        await (Actions.linkGroupSyncable as any)(groupID, teamID, SyncableType.Team)(store.dispatch, store.getState);
        await (Actions.linkGroupSyncable as any)(groupID, channelID, SyncableType.Channel)(store.dispatch, store.getState);

        const state = store.getState();
        const syncables = state.entities.groups.syncables;
        expect(syncables[groupID]).toBeTruthy();

        expect(JSON.stringify(syncables[groupID].teams[0]) === JSON.stringify(groupTeamResponse)).toBeTruthy();
        expect(JSON.stringify(syncables[groupID].channels[0]) === JSON.stringify(groupChannelResponse)).toBeTruthy();
    });

    it('unlinkGroupSyncable', async () => {
        const groupID = '5rgoajywb3nfbdtyafbod47rya';
        const teamID = 'ge63nq31sbfy3duzq5f7yqn1kh';
        const channelID = 'o3tdawqxot8kikzq8bk54zggbc';

        const groupTeamResponse = {
            team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
            group_id: '5rgoajywb3nfbdtyafbod47rya',
            auto_add: true,
            create_at: 1542643748412,
            delete_at: 0,
            update_at: 1542660566032,
        };

        const groupChannelResponse = {
            channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
            group_id: '5rgoajywb3nfbdtyafbod47rya',
            auto_add: true,
            create_at: 1542644105041,
            delete_at: 0,
            update_at: 1542662607342,
        };

        nock(Client4.getBaseRoute()).
            post(`/groups/${groupID}/teams/${teamID}/link`).
            reply(200, groupTeamResponse);

        nock(Client4.getBaseRoute()).
            post(`/groups/${groupID}/channels/${channelID}/link`).
            reply(200, groupChannelResponse);

        await (Actions.linkGroupSyncable as any)(groupID, teamID, SyncableType.Team)(store.dispatch, store.getState);
        await (Actions.linkGroupSyncable as any)(groupID, channelID, SyncableType.Channel)(store.dispatch, store.getState);

        let state = store.getState();
        let syncables = state.entities.groups.syncables;
        expect(syncables[groupID]).toBeTruthy();

        expect(JSON.stringify(syncables[groupID].teams[0]) === JSON.stringify(groupTeamResponse)).toBeTruthy();
        expect(JSON.stringify(syncables[groupID].channels[0]) === JSON.stringify(groupChannelResponse)).toBeTruthy();

        const beforeTeamsLength = syncables[groupID].teams.length;
        const beforeChannelsLength = syncables[groupID].channels.length;

        nock(Client4.getBaseRoute()).
            delete(`/groups/${groupID}/teams/${teamID}/link`).
            reply(204, {ok: true});

        nock(Client4.getBaseRoute()).
            delete(`/groups/${groupID}/channels/${channelID}/link`).
            reply(204, {ok: true});

        await Actions.unlinkGroupSyncable(groupID, teamID, SyncableType.Team)(store.dispatch, store.getState);
        await Actions.unlinkGroupSyncable(groupID, channelID, SyncableType.Channel)(store.dispatch, store.getState);

        state = store.getState();
        syncables = state.entities.groups.syncables;

        expect(syncables[groupID]).toBeTruthy();
        expect(syncables[groupID].teams.length === beforeTeamsLength - 1).toBeTruthy();
        expect(syncables[groupID].channels.length === beforeChannelsLength - 1).toBeTruthy();
    });

    it('getGroups', async () => {
        const response1 = {
            groups: [
                {
                    id: 'xh585kyz3tn55q6ipfo57btwnc',
                    name: 'abc',
                    display_name: 'abc',
                    description: '',
                    source: 'ldap',
                    remote_id: 'abc',
                    create_at: 1553808969975,
                    update_at: 1553808969975,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                    allow_reference: true,
                },
                {
                    id: 'qhdp6g7aubbpiyja7c4sgpe7tc',
                    name: 'qa',
                    display_name: 'qa',
                    description: '',
                    source: 'ldap',
                    remote_id: 'qa',
                    create_at: 1553808971548,
                    update_at: 1553808971548,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                    allow_reference: true,
                },
            ],
            total_group_count: 2,
        };

        nock(Client4.getBaseRoute()).
            get('/groups?filter_allow_reference=true&page=0&per_page=0').
            reply(200, response1.groups);

        const groupParams: GetGroupsParams = {
            filter_allow_reference: true,
            page: 0,
            per_page: 0,
        };
        await Actions.getGroups(groupParams)(store.dispatch, store.getState);

        const state = store.getState();

        const groups = state.entities.groups.groups;
        expect(groups).toBeTruthy();
        expect((response1 as any).length).toEqual(groups.length);
        for (const id of Object.keys(groups)) {
            const index = Object.keys(groups).indexOf(id);
            expect(JSON.stringify(groups[id]) === JSON.stringify(response1.groups[index])).toBeTruthy();
        }
    });

    it('getAllGroupsAssociatedToTeam', async () => {
        const teamID = '5rgoajywb3nfbdtyafbod47ryb';

        const response = {
            groups: [
                {
                    id: 'xh585kyz3tn55q6ipfo57btwnc',
                    name: 'abc',
                    display_name: 'abc',
                    description: '',
                    source: 'ldap',
                    remote_id: 'abc',
                    create_at: 1553808969975,
                    update_at: 1553808969975,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                    allow_reference: false,
                },
                {
                    id: 'tnd8zod9f3fdtqosxjmhwucbth',
                    name: 'software-engineering',
                    display_name: 'software engineering',
                    description: '',
                    source: 'ldap',
                    remote_id: 'engineering',
                    create_at: 1553808971099,
                    update_at: 1553808971099,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 8,
                    allow_reference: false,
                },
                {
                    id: 'qhdp6g7aubbpiyja7c4sgpe7tc',
                    name: 'qa',
                    display_name: 'qa',
                    description: '',
                    source: 'ldap',
                    remote_id: 'qa',
                    create_at: 1553808971548,
                    update_at: 1553808971548,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                    allow_reference: false,
                },
            ],
            total_group_count: 3,
        };

        nock(Client4.getBaseRoute()).
            get(`/teams/${teamID}/groups?paginate=false&filter_allow_reference=false&include_member_count=true`).
            reply(200, response);

        await Actions.getAllGroupsAssociatedToTeam(teamID, false, true)(store.dispatch, store.getState);

        const state = store.getState();

        const groupIDs = state.entities.teams.groupsAssociatedToTeam[teamID].ids;
        expect(groupIDs.length).toEqual(response.groups.length);
        groupIDs.forEach((id: string) => {
            expect(response.groups.map((group) => group.id).includes(id)).toBeTruthy();
        });
    });

    it('getGroupsAssociatedToTeam', async () => {
        const teamID = '5rgoajywb3nfbdtyafbod47ryb';

        const response = {
            groups: [
                {
                    id: 'tnd8zod9f3fdtqosxjmhwucbth',
                    name: 'software-engineering',
                    display_name: 'software engineering',
                    description: '',
                    source: 'ldap',
                    remote_id: 'engineering',
                    create_at: 1553808971099,
                    update_at: 1553808971099,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 8,
                    allow_reference: true,
                },
                {
                    id: 'qhdp6g7aubbpiyja7c4sgpe7tc',
                    name: 'qa',
                    display_name: 'qa',
                    description: '',
                    source: 'ldap',
                    remote_id: 'qa',
                    create_at: 1553808971548,
                    update_at: 1553808971548,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                    allow_reference: false,
                },
            ],
            total_group_count: 3,
        };

        nock(Client4.getBaseRoute()).
            get(`/teams/${teamID}/groups?page=100&per_page=60&q=0&include_member_count=true&filter_allow_reference=false`).
            reply(200, response);

        await Actions.getGroupsAssociatedToTeam(teamID, '0', 100)(store.dispatch, store.getState);

        const state = store.getState();

        const groupIDs = state.entities.teams.groupsAssociatedToTeam[teamID].ids;
        const expectedIDs = ['tnd8zod9f3fdtqosxjmhwucbth', 'qhdp6g7aubbpiyja7c4sgpe7tc'];
        expect(groupIDs.length).toEqual(expectedIDs.length);
        groupIDs.forEach((id: string) => {
            expect(expectedIDs.includes(id)).toBeTruthy();
            expect(state.entities.groups.groups[id]).toBeTruthy();
        });

        const count = state.entities.teams.groupsAssociatedToTeam[teamID].totalCount;
        expect(count).toEqual(response.total_group_count);
    });

    it('getGroupsNotAssociatedToTeam', async () => {
        const teamID = '5rgoajywb3nfbdtyafbod47ryb';

        store = configureStore({
            entities: {
                teams: {
                    groupsAssociatedToTeam: {
                        [teamID]: {ids: ['existing1', 'existing2']},
                    },
                },
            },
        });

        const response = [
            {
                id: 'existing1',
                name: 'software-engineering',
                display_name: 'software engineering',
                description: '',
                source: 'ldap',
                remote_id: 'engineering',
                create_at: 1553808971099,
                update_at: 1553808971099,
                delete_at: 0,
                has_syncables: false,
                member_count: 8,
            },
        ];

        nock(Client4.getBaseRoute()).
            get(`/groups?not_associated_to_team=${teamID}&page=100&per_page=60&q=0&include_member_count=true`).
            reply(200, response);

        await Actions.getGroupsNotAssociatedToTeam(teamID, '0', 100)(store.dispatch, store.getState);

        const state = store.getState();
        const groupIDs = state.entities.teams.groupsAssociatedToTeam[teamID].ids;
        const expectedIDs = ['existing2'].concat(response.map((group) => group.id));
        expect(groupIDs.length).toEqual(expectedIDs.length);
        groupIDs.forEach((id: string) => {
            expect(expectedIDs.includes(id)).toBeTruthy();
        });
    });

    it('getAllGroupsAssociatedToChannel', async () => {
        const channelID = '5rgoajywb3nfbdtyafbod47ryb';

        const response = {
            groups: [
                {
                    id: 'xh585kyz3tn55q6ipfo57btwnc',
                    name: 'abc',
                    display_name: 'abc',
                    description: '',
                    source: 'ldap',
                    remote_id: 'abc',
                    create_at: 1553808969975,
                    update_at: 1553808969975,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                },
                {
                    id: 'tnd8zod9f3fdtqosxjmhwucbth',
                    name: 'software-engineering',
                    display_name: 'software engineering',
                    description: '',
                    source: 'ldap',
                    remote_id: 'engineering',
                    create_at: 1553808971099,
                    update_at: 1553808971099,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 8,
                },
                {
                    id: 'qhdp6g7aubbpiyja7c4sgpe7tc',
                    name: 'qa',
                    display_name: 'qa',
                    description: '',
                    source: 'ldap',
                    remote_id: 'qa',
                    create_at: 1553808971548,
                    update_at: 1553808971548,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                },
            ],
            total_group_count: 3,
        };

        nock(Client4.getBaseRoute()).
            get(`/channels/${channelID}/groups?paginate=false&filter_allow_reference=false&include_member_count=true`).
            reply(200, response);

        await Actions.getAllGroupsAssociatedToChannel(channelID, false, true)(store.dispatch, store.getState);

        const state = store.getState();

        const groupIDs = state.entities.channels.groupsAssociatedToChannel[channelID].ids;
        expect(groupIDs.length).toEqual(response.groups.length);
        groupIDs.forEach((id: string) => {
            expect(response.groups.map((group) => group.id).includes(id)).toBeTruthy();
        });
    });

    it('getAllGroupsAssociatedToChannelsInTeam', async () => {
        const teamID = 'ge63nq31sbfy3duzq5f7yqn1kh';
        const channelID1 = '5rgoajywb3nfbdtyafbod47ryb';

        const response1 = {
            groups: {
                '5rgoajywb3nfbdtyafbod47ryb':
                [
                    {
                        id: 'xh585kyz3tn55q6ipfo57btwnc',
                        name: 'abc',
                        display_name: 'abc',
                        description: '',
                        source: 'ldap',
                        remote_id: 'abc',
                        create_at: 1553808969975,
                        update_at: 1553808969975,
                        delete_at: 0,
                        has_syncables: false,
                        member_count: 2,
                        allow_reference: true,
                    },
                    {
                        id: 'tnd8zod9f3fdtqosxjmhwucbth',
                        name: 'abc',
                        display_name: 'software engineering',
                        description: '',
                        source: 'ldap',
                        remote_id: 'engineering',
                        create_at: 1553808971099,
                        update_at: 1553808971099,
                        delete_at: 0,
                        has_syncables: false,
                        member_count: 8,
                        allow_reference: false,
                    },
                ],
                o3tdawqxot8kikzq8bk54zggbc:
                [
                    {
                        id: 'qhdp6g7aubbpiyja7c4sgpe7tc',
                        name: 'qa',
                        display_name: 'qa',
                        description: '',
                        source: 'ldap',
                        remote_id: 'qa',
                        create_at: 1553808971548,
                        update_at: 1553808971548,
                        delete_at: 0,
                        has_syncables: false,
                        member_count: 2,
                        allow_reference: false,
                    },
                ],
            },
            total_group_count: 3,
        };

        const response2 = {
            groups: {
                '5rgoajywb3nfbdtyafbod47ryb':
                [
                    {
                        id: 'xh585kyz3tn55q6ipfo57btwnc',
                        name: 'abc',
                        display_name: 'abc',
                        description: '',
                        source: 'ldap',
                        remote_id: 'abc',
                        create_at: 1553808969975,
                        update_at: 1553808969975,
                        delete_at: 0,
                        has_syncables: false,
                        member_count: 2,
                        allow_reference: true,
                    },
                ],
            },
            total_group_count: 1,
        };

        nock(Client4.getBaseRoute()).
            get(`/teams/${teamID}/groups_by_channels?paginate=false&filter_allow_reference=false`).
            reply(200, response1);

        nock(Client4.getBaseRoute()).
            get(`/teams/${teamID}/groups_by_channels?paginate=false&filter_allow_reference=true`).
            reply(200, response2);

        await Actions.getAllGroupsAssociatedToChannelsInTeam(teamID, false)(store.dispatch, store.getState);

        let state = store.getState();

        let groupIDs = state.entities.channels.groupsAssociatedToChannel[channelID1].ids;
        expect(groupIDs.length).toEqual(response1.groups[channelID1].length);
        groupIDs.forEach((id: string) => {
            expect(response1.groups[channelID1].map((group) => group.id).includes(id)).toBeTruthy();
        });

        await Actions.getAllGroupsAssociatedToChannelsInTeam(teamID, true)(store.dispatch, store.getState);

        state = store.getState();

        groupIDs = state.entities.channels.groupsAssociatedToChannel[channelID1].ids;
        expect(groupIDs.length).toEqual(response2.groups[channelID1].length);
        groupIDs.forEach((id: string) => {
            expect(response2.groups[channelID1].map((group) => group.id).includes(id)).toBeTruthy();
        });
    });

    it('getGroupsAssociatedToChannel', async () => {
        const channelID = '5rgoajywb3nfbdtyafbod47ryb';

        const response = {
            groups: [
                {
                    id: 'tnd8zod9f3fdtqosxjmhwucbth',
                    name: 'software-engineering',
                    display_name: 'software engineering',
                    description: '',
                    source: 'ldap',
                    remote_id: 'engineering',
                    create_at: 1553808971099,
                    update_at: 1553808971099,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 8,
                    allow_reference: false,
                },
                {
                    id: 'qhdp6g7aubbpiyja7c4sgpe7tc',
                    name: 'qa',
                    display_name: 'qa',
                    description: '',
                    source: 'ldap',
                    remote_id: 'qa',
                    create_at: 1553808971548,
                    update_at: 1553808971548,
                    delete_at: 0,
                    has_syncables: false,
                    member_count: 2,
                    allow_reference: true,
                },
            ],
            total_group_count: 3,
        };

        nock(Client4.getBaseRoute()).
            get(`/channels/${channelID}/groups?page=100&per_page=60&q=0&include_member_count=true&filter_allow_reference=false`).
            reply(200, response);

        await Actions.getGroupsAssociatedToChannel(channelID, '0', 100)(store.dispatch, store.getState);

        const state = store.getState();

        const groupIDs = state.entities.channels.groupsAssociatedToChannel[channelID].ids;
        const expectedIDs = ['tnd8zod9f3fdtqosxjmhwucbth', 'qhdp6g7aubbpiyja7c4sgpe7tc'];
        expect(groupIDs.length).toEqual(expectedIDs.length);
        groupIDs.forEach((id: string) => {
            expect(expectedIDs.includes(id)).toBeTruthy();
            expect(state.entities.groups.groups[id]).toBeTruthy();
        });

        const count = state.entities.channels.groupsAssociatedToChannel[channelID].totalCount;
        expect(count).toEqual(response.total_group_count);
    });

    it('getGroupsNotAssociatedToChannel', async () => {
        const channelID = '5rgoajywb3nfbdtyafbod47ryb';

        store = configureStore({
            entities: {
                channels: {
                    groupsAssociatedToChannel: {
                        [channelID]: {ids: ['existing1', 'existing2']},
                    },
                },
            },
        });

        const response = [
            {
                id: 'existing1',
                name: 'software-engineering',
                display_name: 'software engineering',
                description: '',
                source: 'ldap',
                remote_id: 'engineering',
                create_at: 1553808971099,
                update_at: 1553808971099,
                delete_at: 0,
                has_syncables: false,
                member_count: 8,
            },
        ];

        nock(Client4.getBaseRoute()).
            get(`/groups?not_associated_to_channel=${channelID}&page=100&per_page=60&q=0&include_member_count=true`).
            reply(200, response);

        await Actions.getGroupsNotAssociatedToChannel(channelID, '0', 100)(store.dispatch, store.getState);

        const state = store.getState();

        const groupIDs = state.entities.channels.groupsAssociatedToChannel[channelID].ids;
        const expectedIDs = ['existing2'].concat(response.map((group) => group.id));
        expect(groupIDs.length).toEqual(expectedIDs.length);
        groupIDs.forEach((id: string) => {
            expect(expectedIDs.includes(id)).toBeTruthy();
        });
    });

    it('patchGroupSyncable', async () => {
        const groupID = '5rgoajywb3nfbdtyafbod47rya';
        const teamID = 'ge63nq31sbfy3duzq5f7yqn1kh';
        const channelID = 'o3tdawqxot8kikzq8bk54zggbc';

        const groupSyncablePatch = {
            auto_add: true,
            scheme_admin: true,
        };

        const groupTeamResponse = {
            team_id: 'ge63nq31sbfy3duzq5f7yqn1kh',
            group_id: '5rgoajywb3nfbdtyafbod47rya',
            auto_add: true,
            scheme_admin: true,
            create_at: 1542643748412,
            delete_at: 0,
            update_at: 1542660566032,
        };

        const groupChannelResponse = {
            channel_id: 'o3tdawqxot8kikzq8bk54zggbc',
            group_id: '5rgoajywb3nfbdtyafbod47rya',
            auto_add: true,
            scheme_admin: true,
            create_at: 1542644105041,
            delete_at: 0,
            update_at: 1542662607342,
        };

        nock(Client4.getBaseRoute()).
            put(`/groups/${groupID}/teams/${teamID}/patch`).
            reply(200, groupTeamResponse);

        nock(Client4.getBaseRoute()).
            put(`/groups/${groupID}/channels/${channelID}/patch`).
            reply(200, groupChannelResponse);

        await Actions.patchGroupSyncable(groupID, teamID, SyncableType.Team, groupSyncablePatch)(store.dispatch, store.getState);
        await Actions.patchGroupSyncable(groupID, channelID, SyncableType.Channel, groupSyncablePatch)(store.dispatch, store.getState);

        const state = store.getState();
        const groupSyncables = state.entities.groups.syncables[groupID];
        expect(groupSyncables).toBeTruthy();

        expect(groupSyncables.teams[0].auto_add === groupSyncablePatch.auto_add).toBeTruthy();
        expect(groupSyncables.channels[0].auto_add === groupSyncablePatch.auto_add).toBeTruthy();

        expect(groupSyncables.teams[0].scheme_admin === groupSyncablePatch.scheme_admin).toBeTruthy();
        expect(groupSyncables.channels[0].scheme_admin === groupSyncablePatch.scheme_admin).toBeTruthy();
    });

    it('patchGroup', async () => {
        const groupID = '5rgoajywb3nfbdtyafbod47rya';

        const groupPatch = {
            allow_reference: true,
        };

        const response = {
            id: '5rgoajywb3nfbdtyafbod47rya',
            name: 'Test-Group-0',
            display_name: 'Test Group 0',
            description: '',
            type: 'ldap',
            remote_id: '\\eb\\80\\94\\cd\\d4\\32\\7c\\45\\87\\79\\1b\\fe\\45\\d9\\ac\\7b',
            create_at: 1542399032816,
            update_at: 1542399032816,
            delete_at: 0,
            has_syncables: false,
            allow_reference: true,
        };

        nock(Client4.getBaseRoute()).
            put(`/groups/${groupID}/patch`).
            reply(200, response);

        await Actions.patchGroup(groupID, groupPatch)(store.dispatch, store.getState);

        let state = store.getState();

        let groups = state.entities.groups.groups;
        expect(groups).toBeTruthy();
        expect(groups[groupID]).toBeTruthy();
        expect(groups[groupID].allow_reference === groupPatch.allow_reference).toBeTruthy();
        expect(JSON.stringify(response) === JSON.stringify(groups[groupID])).toBeTruthy();

        //with allow_reference=false
        groupPatch.allow_reference = false;
        response.allow_reference = false;

        nock(Client4.getBaseRoute()).
            put(`/groups/${groupID}/patch`).
            reply(200, response);

        await Actions.patchGroup(groupID, groupPatch)(store.dispatch, store.getState);

        state = store.getState();

        groups = state.entities.groups.groups;
        expect(groups).toBeTruthy();
        expect(groups[groupID]).toBeTruthy();
        expect(groups[groupID].allow_reference === groupPatch.allow_reference).toBeTruthy();
        expect(JSON.stringify(response) === JSON.stringify(groups[groupID])).toBeTruthy();

        //with name="newname"
        (groupPatch as any).name = 'newname';
        response.name = 'newname';

        nock(Client4.getBaseRoute()).
            put(`/groups/${groupID}/patch`).
            reply(200, response);

        await Actions.patchGroup(groupID, groupPatch)(store.dispatch, store.getState);

        state = store.getState();

        groups = state.entities.groups.groups;
        expect(groups).toBeTruthy();
        expect(groups[groupID]).toBeTruthy();
        expect(groups[groupID].name === (groupPatch as any).name).toBeTruthy();
        expect(JSON.stringify(response) === JSON.stringify(groups[groupID])).toBeTruthy();
    });

    it('getGroupStats', async () => {
        const groupID = '5rgoajywb3nfbdtyafbod47rya';

        const response = {
            group_id: '5rgoajywb3nfbdtyafbod47rya',
            total_member_count: 55,
        };

        nock(Client4.getBaseRoute()).
            get(`/groups/${groupID}/stats`).
            reply(200, response);

        await Actions.getGroupStats(groupID)(store.dispatch, store.getState);

        const state = store.getState();

        const stats = state.entities.groups.stats;
        expect(stats).toBeTruthy();
        expect(stats[groupID]).toBeTruthy();
        expect(JSON.stringify(response) === JSON.stringify(stats[groupID])).toBeTruthy();
    });
});
