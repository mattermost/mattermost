// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {Props} from 'components/browse_channels/browse_channels';
import BrowseChannels, {Filter, Sort} from 'components/browse_channels/browse_channels';
import SearchableChannelList from 'components/searchable_channel_list';

import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

jest.useFakeTimers({legacyFakeTimers: true});

describe('components/BrowseChannels', () => {
    const searchResults = {
        data: [{
            id: 'channel-id-1',
            name: 'channel-name-1',
            team_id: 'team_1',
            display_name: 'Channel 1',
            delete_at: 0,
            type: 'O',
        }, {
            id: 'channel-id-2',
            name: 'archived-channel',
            team_id: 'team_1',
            display_name: 'Archived',
            delete_at: 123,
            type: 'O',
        }, {
            id: 'channel-id-3',
            name: 'private-channel',
            team_id: 'team_1',
            display_name: 'Private',
            delete_at: 0,
            type: 'P',
        }, {
            id: 'channel-id-4',
            name: 'private-channel-not-member',
            team_id: 'team_1',
            display_name: 'Private Not Member',
            delete_at: 0,
            type: 'P',
        }],
    };

    const archivedChannel = TestHelper.getChannelMock({
        id: 'channel_id_2',
        team_id: 'team_1',
        display_name: 'channel-2',
        name: 'channel-2',
        header: 'channel-2-header',
        purpose: 'channel-2-purpose',
    });

    const privateChannel = TestHelper.getChannelMock({
        id: 'channel_id_3',
        team_id: 'team_1',
        display_name: 'channel-3',
        name: 'channel-3',
        header: 'channel-3-header',
        purpose: 'channel-3-purpose',
        type: 'P',
    });

    const channelActions = {
        joinChannelAction: (userId: string, teamId: string, channelId: string): Promise<ActionResult> => {
            return new Promise((resolve) => {
                if (channelId !== 'channel-1') {
                    return resolve({
                        error: {
                            message: 'error',
                        },
                    });
                }

                return resolve({data: true});
            });
        },
        searchAllChannels: (term: string): Promise<ActionResult> => {
            return new Promise((resolve) => {
                if (term === 'fail') {
                    return resolve({
                        error: {
                            message: 'error',
                        },
                    });
                }

                return resolve(searchResults);
            });
        },
        getChannels: (): Promise<ActionResult<Channel[], Error>> => {
            return new Promise((resolve) => {
                return resolve({
                    data: [TestHelper.getChannelMock({})],
                });
            });
        },
        getArchivedChannels: (): Promise<ActionResult<Channel[], Error>> => {
            return new Promise((resolve) => {
                return resolve({
                    data: [archivedChannel],
                });
            });
        },
    };

    const baseProps: Props = {
        channels: [TestHelper.getChannelMock({})],
        archivedChannels: [archivedChannel],
        privateChannels: [privateChannel],
        directMessageChannels: [],
        currentUserId: 'user-1',
        teamId: 'team_1',
        teamName: 'team_name',
        channelsRequestStarted: false,
        shouldHideJoinedChannels: false,
        myChannelMemberships: {
            'channel-id-3': TestHelper.getChannelMembershipMock({
                channel_id: 'channel-id-3',
                user_id: 'user-1',
            }),
        },
        channelMembers: {},
        actions: {
            getChannels: jest.fn(channelActions.getChannels),
            getArchivedChannels: jest.fn(channelActions.getArchivedChannels),
            joinChannel: jest.fn(channelActions.joinChannelAction),
            searchAllChannels: jest.fn(channelActions.searchAllChannels),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            closeRightHandSide: jest.fn(),
            setGlobalItem: jest.fn(),
            getChannelsMemberCount: jest.fn(),
            getChannelMembers: jest.fn(),
        },
    };

    test('should match snapshot and state', () => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.state('searchedChannels')).toEqual([]);
        expect(wrapper.state('search')).toEqual(false);
        expect(wrapper.state('serverError')).toBeNull();
        expect(wrapper.state('searching')).toEqual(false);
        expect(wrapper.state('sort')).toEqual(Sort.Recommended);
        expect(wrapper.state('filter')).toEqual(Filter.All);

        // on componentDidMount
        expect(wrapper.instance().props.actions.getChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.getChannels).toHaveBeenCalledWith(wrapper.instance().props.teamId, 0, 100);
    });

    test('should call closeModal on handleExit', () => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().handleExit();
        expect(baseProps.actions.closeModal).toHaveBeenCalledTimes(1);
    });

    test('should match state on onChange', () => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );
        wrapper.setState({searchedChannels: [TestHelper.getChannelMock({id: 'other_channel_id'})]});

        wrapper.instance().onChange(true);
        expect(wrapper.state('searchedChannels')).toEqual([]);

        // on search
        wrapper.setState({search: true});

        expect(wrapper.instance().onChange(false)).toEqual(undefined);
    });

    test('should call props.getChannels on nextPage', () => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().nextPage(1);

        expect(wrapper.instance().props.actions.getChannels).toHaveBeenCalledTimes(2);
        expect(wrapper.instance().props.actions.getChannels).toHaveBeenCalledWith(wrapper.instance().props.teamId, 2, 50);
    });

    test('should have loading prop true when searching state is true', () => {
        const wrapper = shallow(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.setState({search: true, searching: true});
        const searchList = wrapper.find(SearchableChannelList);
        expect(searchList.props().loading).toEqual(true);
    });

    test('should attempt to join the channel and fail', (done) => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                joinChannel: jest.fn().mockImplementation(() => {
                    const error = {
                        message: 'error message',
                    };

                    return Promise.resolve({error});
                }),
            },
        };

        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...props}/>,
        );

        const callback = jest.fn();
        wrapper.instance().handleJoin(baseProps.channels[0], callback);
        expect(wrapper.instance().props.actions.joinChannel).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.joinChannel).toHaveBeenCalledWith(wrapper.instance().props.currentUserId, wrapper.instance().props.teamId, baseProps.channels[0].id);
        process.nextTick(() => {
            expect(wrapper.state('serverError')).toEqual('error message');
            expect(callback).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('should join the channel', (done) => {
        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                joinChannel: jest.fn().mockImplementation(() => {
                    const data = true;

                    return Promise.resolve({data});
                }),
            },
        };

        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...props}/>,
        );

        const callback = jest.fn();
        wrapper.instance().handleJoin(baseProps.channels[0], callback);
        expect(wrapper.instance().props.actions.joinChannel).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.joinChannel).toHaveBeenCalledWith(wrapper.instance().props.currentUserId, wrapper.instance().props.teamId, baseProps.channels[0].id);
        process.nextTick(() => {
            expect(getHistory().push).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('should not perform a search if term is empty', () => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).toHaveBeenCalledWith(true);
        expect(wrapper.state('search')).toEqual(false);
        expect(wrapper.state('searching')).toEqual(false);
        expect(wrapper.instance().searchTimeoutId).toEqual(0);
    });

    test('should handle a failed search', (done) => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().setSearchResults = jest.fn();
        wrapper.instance().search('fail');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).not.toHaveBeenCalled();
        expect(wrapper.state('search')).toEqual(true);
        expect(wrapper.state('searching')).toEqual(true);
        expect(wrapper.instance().searchTimeoutId).not.toEqual('');
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);

        jest.runOnlyPendingTimers();
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledWith('fail', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});
        process.nextTick(() => {
            expect(wrapper.state('search')).toEqual(true);
            expect(wrapper.state('searching')).toEqual(false);
            expect(wrapper.state('searchedChannels')).toEqual([]);
            expect(wrapper.instance().setSearchResults).not.toHaveBeenCalled();
            done();
        });
    });

    test('should perform search and set the correct state', (done) => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('channel');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).not.toHaveBeenCalled();
        expect(wrapper.state('search')).toEqual(true);
        expect(wrapper.state('searching')).toEqual(true);
        expect(wrapper.instance().searchTimeoutId).not.toEqual('');
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);

        jest.runOnlyPendingTimers();
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});
        process.nextTick(() => {
            expect(wrapper.state('search')).toEqual(true);
            expect(wrapper.state('searching')).toEqual(false);
            expect(wrapper.state('searchedChannels')).toEqual([searchResults.data[0], searchResults.data[1], searchResults.data[2]]);
            done();
        });
    });

    test('should perform search on archived channels and set the correct state', (done) => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('channel');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).not.toHaveBeenCalled();
        expect(wrapper.state('search')).toEqual(true);
        expect(wrapper.state('searching')).toEqual(true);
        expect(wrapper.instance().searchTimeoutId).not.toEqual('');
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);
        wrapper.instance().changeFilter(Filter.Archived);

        jest.runOnlyPendingTimers();
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});
        process.nextTick(() => {
            expect(wrapper.state('search')).toEqual(true);
            expect(wrapper.state('searching')).toEqual(false);
            expect(wrapper.state('searchedChannels')).toEqual([searchResults.data[1]]);
            done();
        });
    });

    test('should perform search on private channels and set the correct state', (done) => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('channel');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).not.toHaveBeenCalled();
        expect(wrapper.state('search')).toEqual(true);
        expect(wrapper.state('searching')).toEqual(true);
        expect(wrapper.instance().searchTimeoutId).not.toEqual('');
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);
        wrapper.instance().changeFilter(Filter.Private);

        jest.runOnlyPendingTimers();
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});
        process.nextTick(() => {
            expect(wrapper.state('search')).toEqual(true);
            expect(wrapper.state('searching')).toEqual(false);
            expect(wrapper.state('searchedChannels')).toEqual([searchResults.data[2]]);
            done();
        });
    });

    test('should perform search on public channels and set the correct state', (done) => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('channel');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).not.toHaveBeenCalled();
        expect(wrapper.state('search')).toEqual(true);
        expect(wrapper.state('searching')).toEqual(true);
        expect(wrapper.instance().searchTimeoutId).not.toEqual('');
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);
        wrapper.instance().changeFilter(Filter.Public);

        jest.runOnlyPendingTimers();
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});
        process.nextTick(() => {
            expect(wrapper.state('search')).toEqual(true);
            expect(wrapper.state('searching')).toEqual(false);
            expect(wrapper.state('searchedChannels')).toEqual([searchResults.data[0]]);
            done();
        });
    });

    test('should perform search on all channels and set the correct state when shouldHideJoinedChannels is true', (done) => {
        const props = {
            ...baseProps,
            shouldHideJoinedChannels: true,
        };

        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...props}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('channel');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).not.toHaveBeenCalled();
        expect(wrapper.state('search')).toEqual(true);
        expect(wrapper.state('searching')).toEqual(true);
        expect(wrapper.instance().searchTimeoutId).not.toEqual('');
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);
        wrapper.instance().changeFilter(Filter.All);

        jest.runOnlyPendingTimers();
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});
        process.nextTick(() => {
            expect(wrapper.state('search')).toEqual(true);
            expect(wrapper.state('searching')).toEqual(false);
            expect(wrapper.state('searchedChannels')).toEqual([searchResults.data[0], searchResults.data[1]]);
            done();
        });
    });

    test('should perform search on all channels and set the correct state when shouldHideJoinedChannels is true and filter is private', (done) => {
        const props = {
            ...baseProps,
            shouldHideJoinedChannels: true,
        };

        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...props}/>,
        );

        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('channel');
        expect(clearTimeout).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().onChange).not.toHaveBeenCalled();
        expect(wrapper.state('search')).toEqual(true);
        expect(wrapper.state('searching')).toEqual(true);
        expect(wrapper.instance().searchTimeoutId).not.toEqual('');
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 100);
        wrapper.instance().changeFilter(Filter.Private);

        jest.runOnlyPendingTimers();
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledTimes(1);
        expect(wrapper.instance().props.actions.searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});
        process.nextTick(() => {
            expect(wrapper.state('search')).toEqual(true);
            expect(wrapper.state('searching')).toEqual(false);
            expect(wrapper.state('searchedChannels')).toEqual([]);
            done();
        });
    });

    it('should perform search on all channels and should not show private channels that user is not a member of', (done) => {
        const wrapper = shallow<BrowseChannels>(
            <BrowseChannels {...baseProps}/>,
        );

        wrapper.setState({search: true, searching: true});
        wrapper.instance().onChange = jest.fn();
        wrapper.instance().search('channel');

        jest.runOnlyPendingTimers();
        process.nextTick(() => {
            expect(wrapper.state('searchedChannels')).toEqual([searchResults.data[0], searchResults.data[1], searchResults.data[2]]);
            done();
        });
    });

    describe('Sorting functionality', () => {
        test('should change sort state when changeSort is called', () => {
            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...baseProps}/>,
            );

            expect(wrapper.state('sort')).toEqual(Sort.Recommended);

            wrapper.instance().changeSort(Sort.AtoZ);
            expect(wrapper.state('sort')).toEqual(Sort.AtoZ);

            wrapper.instance().changeSort(Sort.Newest);
            expect(wrapper.state('sort')).toEqual(Sort.Newest);
        });

        test('should extract DM user IDs from directMessageChannels', () => {
            const dmChannels = [
                TestHelper.getChannelMock({
                    id: 'dm-1',
                    type: 'D',
                    name: 'user1__user2',
                    teammate_id: 'user-dm-1',
                }),
                TestHelper.getChannelMock({
                    id: 'dm-2',
                    type: 'D',
                    name: 'user1__user3',
                    teammate_id: 'user-dm-2',
                }),
            ];

            const props = {
                ...baseProps,
                directMessageChannels: dmChannels,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const dmUserIds = wrapper.instance().getDMUserIds();
            expect(dmUserIds.size).toBe(2);
            expect(dmUserIds.has('user-dm-1')).toBe(true);
            expect(dmUserIds.has('user-dm-2')).toBe(true);
        });

        test('should count DM contacts in a channel', () => {
            const channelMembers = {
                'channel-1': {
                    'user-dm-1': {user_id: 'user-dm-1'},
                    'user-dm-2': {user_id: 'user-dm-2'},
                    'user-other': {user_id: 'user-other'},
                },
                'channel-2': {
                    'user-dm-1': {user_id: 'user-dm-1'},
                    'user-other': {user_id: 'user-other'},
                },
            };

            const props = {
                ...baseProps,
                channelMembers,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const dmUserIds = new Set(['user-dm-1', 'user-dm-2']);
            const count1 = wrapper.instance().countDMContactsInChannel('channel-1', dmUserIds);
            const count2 = wrapper.instance().countDMContactsInChannel('channel-2', dmUserIds);

            expect(count1).toBe(2);
            expect(count2).toBe(1);
        });

        test('should sort channels A to Z', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Zebra Channel'}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Alpha Channel'}),
                TestHelper.getChannelMock({id: 'c3', display_name: 'Beta Channel'}),
            ];

            const props = {
                ...baseProps,
                channels,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.AtoZ);
            expect(sorted[0].display_name).toBe('Alpha Channel');
            expect(sorted[1].display_name).toBe('Beta Channel');
            expect(sorted[2].display_name).toBe('Zebra Channel');
        });

        test('should sort channels Z to A', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Alpha Channel'}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Zebra Channel'}),
                TestHelper.getChannelMock({id: 'c3', display_name: 'Beta Channel'}),
            ];

            const props = {
                ...baseProps,
                channels,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.ZtoA);
            expect(sorted[0].display_name).toBe('Zebra Channel');
            expect(sorted[1].display_name).toBe('Beta Channel');
            expect(sorted[2].display_name).toBe('Alpha Channel');
        });

        test('should sort channels by newest first', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Old Channel', create_at: 1000}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'New Channel', create_at: 3000}),
                TestHelper.getChannelMock({id: 'c3', display_name: 'Medium Channel', create_at: 2000}),
            ];

            const props = {
                ...baseProps,
                channels,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.Newest);
            expect(sorted[0].display_name).toBe('New Channel');
            expect(sorted[1].display_name).toBe('Medium Channel');
            expect(sorted[2].display_name).toBe('Old Channel');
        });

        test('should sort channels by newest with alphabetical tie-breaker', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Zebra Channel', create_at: 1000}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Alpha Channel', create_at: 1000}),
            ];

            const props = {
                ...baseProps,
                channels,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.Newest);
            expect(sorted[0].display_name).toBe('Alpha Channel');
            expect(sorted[1].display_name).toBe('Zebra Channel');
        });

        test('should sort channels by most members', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Small Channel'}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Large Channel'}),
                TestHelper.getChannelMock({id: 'c3', display_name: 'Medium Channel'}),
            ];

            const channelsMemberCount = {
                'c1': 10,
                'c2': 100,
                'c3': 50,
            };

            const props = {
                ...baseProps,
                channels,
                channelsMemberCount,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.MostMembers);
            expect(sorted[0].display_name).toBe('Large Channel');
            expect(sorted[1].display_name).toBe('Medium Channel');
            expect(sorted[2].display_name).toBe('Small Channel');
        });

        test('should sort channels by most members with alphabetical tie-breaker', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Zebra Channel'}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Alpha Channel'}),
            ];

            const channelsMemberCount = {
                'c1': 50,
                'c2': 50,
            };

            const props = {
                ...baseProps,
                channels,
                channelsMemberCount,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.MostMembers);
            expect(sorted[0].display_name).toBe('Alpha Channel');
            expect(sorted[1].display_name).toBe('Zebra Channel');
        });

        test('should sort channels by recommendation (DM contacts)', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'No DM Contacts', last_post_at: 3000}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Two DM Contacts', last_post_at: 2000}),
                TestHelper.getChannelMock({id: 'c3', display_name: 'One DM Contact', last_post_at: 1000}),
            ];

            const dmChannels = [
                TestHelper.getChannelMock({id: 'dm-1', type: 'D', teammate_id: 'user-dm-1'}),
                TestHelper.getChannelMock({id: 'dm-2', type: 'D', teammate_id: 'user-dm-2'}),
            ];

            const channelMembers = {
                'c1': {},
                'c2': {
                    'user-dm-1': {user_id: 'user-dm-1'},
                    'user-dm-2': {user_id: 'user-dm-2'},
                },
                'c3': {
                    'user-dm-1': {user_id: 'user-dm-1'},
                },
            };

            const props = {
                ...baseProps,
                channels,
                directMessageChannels: dmChannels,
                channelMembers,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.Recommended);
            expect(sorted[0].display_name).toBe('Two DM Contacts');
            expect(sorted[1].display_name).toBe('One DM Contact');
            expect(sorted[2].display_name).toBe('No DM Contacts');
        });

        test('should sort channels by recommendation with recent activity tie-breaker', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Old Activity', last_post_at: 1000}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Recent Activity', last_post_at: 3000}),
            ];

            const dmChannels = [
                TestHelper.getChannelMock({id: 'dm-1', type: 'D', teammate_id: 'user-dm-1'}),
            ];

            const channelMembers = {
                'c1': {'user-dm-1': {user_id: 'user-dm-1'}},
                'c2': {'user-dm-1': {user_id: 'user-dm-1'}},
            };

            const props = {
                ...baseProps,
                channels,
                directMessageChannels: dmChannels,
                channelMembers,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            const sorted = wrapper.instance().sortChannels(channels, Sort.Recommended);
            expect(sorted[0].display_name).toBe('Recent Activity');
            expect(sorted[1].display_name).toBe('Old Activity');
        });

        test('should apply sorting to active channels', () => {
            const channels = [
                TestHelper.getChannelMock({id: 'c1', display_name: 'Zebra Channel'}),
                TestHelper.getChannelMock({id: 'c2', display_name: 'Alpha Channel'}),
                TestHelper.getChannelMock({id: 'c3', display_name: 'Beta Channel'}),
            ];

            const props = {
                ...baseProps,
                channels,
            };

            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...props}/>,
            );

            wrapper.setState({sort: Sort.AtoZ});
            const activeChannels = wrapper.instance().getActiveChannels();

            expect(activeChannels[0].display_name).toBe('Alpha Channel');
            expect(activeChannels[1].display_name).toBe('Beta Channel');
            expect(activeChannels[2].display_name).toBe('Zebra Channel');
        });

        test('should pass sort prop to SearchableChannelList', () => {
            const wrapper = shallow<BrowseChannels>(
                <BrowseChannels {...baseProps}/>,
            );

            wrapper.setState({sort: Sort.Newest});
            const searchList = wrapper.find(SearchableChannelList);
            expect(searchList.props().sort).toEqual(Sort.Newest);
        });
    });
});
