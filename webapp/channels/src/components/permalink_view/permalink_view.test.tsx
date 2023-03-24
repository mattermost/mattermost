// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ReactWrapper, shallow} from 'enzyme';
import React, {ComponentProps} from 'react';
import nock from 'nock';
import {match} from 'react-router-dom';

import {act} from 'react-dom/test-utils';

import {Client4} from 'mattermost-redux/client';
import {getPostThread} from 'mattermost-redux/actions/posts';

import {Preferences} from 'mattermost-redux/constants';
import TestHelper from 'packages/mattermost-redux/test/test_helper';

import mockStore from 'tests/test_store';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import {ErrorPageTypes} from 'utils/constants';
import {getHistory} from 'utils/browser_history';

import {focusPost} from 'components/permalink_view/actions';
import PermalinkView from 'components/permalink_view/permalink_view';

import * as Channels from 'mattermost-redux/selectors/entities/channels';

jest.mock('actions/channel_actions', () => ({
    loadChannelsForCurrentUser: jest.fn(() => {
        return {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'};
    }),
}));

jest.mock('actions/views/rhs.ts', () => ({
    selectPostAndHighlight: jest.fn((post) => {
        return {type: 'MOCK_SELECT_POST_AND_HIGHLIGHT', args: [post]};
    }),
}));

jest.mock('mattermost-redux/actions/posts', () => ({
    getPostThread: jest.fn((postId) => {
        const post = {id: 'postid1', message: 'some message', channel_id: 'channelid1'};
        const post2 = {id: 'postid2', message: 'some message', channel_id: 'channelid2'};
        const replyPost1 = {id: 'replypostid1', message: 'some message', channel_id: 'channelid1', root_id: 'postid1'};
        const dmPost = {id: 'dmpostid1', message: 'some message', channel_id: 'dmchannelid'};
        const gmPost = {id: 'gmpostid1', message: 'some message', channel_id: 'gmchannelid'};

        switch (postId) {
        case 'postid1':
            return {type: 'MOCK_GET_POST_THREAD', data: {posts: {replypostid1: replyPost1, postid1: post}, order: [post.id, replyPost1.id]}};
        case 'postid2':
            return {type: 'MOCK_GET_POST_THREAD', data: {posts: {postid2: post2}, order: [post2.id]}};
        case 'dmpostid1':
            return {type: 'MOCK_GET_POST_THREAD', data: {posts: {dmpostid1: dmPost}, order: [dmPost.id]}};
        case 'gmpostid1':
            return {type: 'MOCK_GET_POST_THREAD', data: {posts: {gmpostid1: gmPost}, order: [gmPost.id]}};
        case 'replypostid1':
            return {type: 'MOCK_GET_POST_THREAD', data: {posts: {replypostid1: replyPost1, postid1: post}, order: [post.id, replyPost1.id]}};
        default:
            return {type: 'MOCK_GET_POST_THREAD'};
        }
    }),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    getMissingProfilesByIds: (userIds: string[]) => ({type: 'MOCK_GET_MISSING_PROFILES', userIds}),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    selectChannel: (...args: any) => ({type: 'MOCK_SELECT_CHANNEL', args}),
    joinChannel: (...args: any) => ({type: 'MOCK_JOIN_CHANNEL', args}),
    getChannelStats: (...args: any) => ({type: 'MOCK_GET_CHANNEL_STATS', args}),
    getChannel: jest.fn((channelId) => {
        switch (channelId) {
        case 'channelid2':
            return {type: 'MOCK_GET_CHANNEL', data: {id: 'channelid2', type: 'O', team_id: 'current_team_id'}};
        default:
            return {type: 'MOCK_GET_CHANNEL', args: [channelId]};
        }
    }),
}));

describe('components/PermalinkView', () => {
    const baseProps: ComponentProps<typeof PermalinkView> = {
        channelId: 'channel_id',
        match: {params: {postid: 'post_id'}} as match<{ postid: string }>,
        returnTo: 'return_to',
        teamName: 'team_name',
        actions: {
            focusPost: jest.fn(),
        },
        currentUserId: 'current_user',
    };

    test('should match snapshot', async () => {
        const wrapper = shallow(
            <PermalinkView {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should call baseProps.actions.focusPost on doPermalinkEvent', async () => {
        await act(async () => {
            mountWithIntl(
                <PermalinkView {...baseProps}/>,
            );
        });

        expect(baseProps.actions.focusPost).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.focusPost).toBeCalledWith(baseProps.match.params.postid, baseProps.returnTo, baseProps.currentUserId);
    });

    test('should call baseProps.actions.focusPost when postid changes', async () => {
        let wrapper: ReactWrapper<JSX.Element>;
        await act(async () => {
            wrapper = mountWithIntl(
                <PermalinkView {...baseProps}/>,
            );
        });
        const newPostid = `${baseProps.match.params.postid}_new`;
        await wrapper!.setProps({...baseProps, match: {params: {postid: newPostid}}} as any);

        expect(baseProps.actions.focusPost).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.focusPost).toBeCalledWith(newPostid, baseProps.returnTo, baseProps.currentUserId);
    });

    test('should match snapshot with archived channel', async () => {
        const props = {...baseProps, channelIsArchived: true};

        let wrapper: ReactWrapper<any>;
        await act(async () => {
            wrapper = mountWithIntl(
                <PermalinkView {...props}/>,
            );
        });

        expect(wrapper!).toMatchSnapshot();
    });

    describe('actions', () => {
        const initialState = {
            entities: {
                general: {},
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        dmchannel: {
                            id: 'dmchannel',
                            username: 'otherUser',
                        },
                    },
                },
                channels: {
                    channels: {
                        channelid1: {id: 'channelid1', name: 'channel1', type: 'O', team_id: 'current_team_id'},
                        dmchannelid: {id: 'dmchannelid', name: 'dmchannel__current_user_id', type: 'D', team_id: ''},
                        gmchannelid: {id: 'gmchannelid', name: 'gmchannel', type: 'G', team_id: ''},
                    },
                    myMembers: {channelid1: {channel_id: 'channelid1', user_id: 'current_user_id'}},
                },
                preferences: {
                    myPreferences: {},
                },
                teams: {
                    currentTeamId: 'current_team_id',
                    teams: {
                        current_team_id: {
                            id: 'current_team_id',
                            display_name: 'currentteam',
                            name: 'currentteam',
                        },
                    },
                },
            },
        };

        describe('focusPost', () => {
            test('should redirect to error page for DM channel not a member of', async () => {
                const testStore = await mockStore(initialState);
                await testStore.dispatch(focusPost('dmpostid1', undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith('dmpostid1');
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {dmpostid1: {id: 'dmpostid1', message: 'some message', channel_id: 'dmchannelid'}}, order: ['dmpostid1']}},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=`);
            });

            test('should redirect to error page for GM channel not a member of', async () => {
                const testStore = await mockStore(initialState);
                await testStore.dispatch(focusPost('gmpostid1', undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith('gmpostid1');
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {gmpostid1: {id: 'gmpostid1', message: 'some message', channel_id: 'gmchannelid'}}, order: ['gmpostid1']}},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=`);
            });

            test('should redirect to DM link with postId for permalink', async () => {
                const dateNowOrig = Date.now;
                Date.now = () => new Date(0).getMilliseconds();
                const nextTick = () => new Promise((res) => process.nextTick(res));

                TestHelper.initBasic(Client4);
                nock(Client4.getUsersRoute()).
                    put('/current_user_id/preferences').
                    reply(200, {status: 'OK'});

                const modifiedState = {
                    entities: {
                        ...initialState.entities,
                        channels: {
                            ...initialState.entities.channels,
                            myMembers: {
                                channelid1: {channel_id: 'channelid1', user_id: 'current_user_id'},
                                dmchannelid: {channel_id: 'dmchannelid', name: 'dmchannel', type: 'D', user_id: 'current_user_id'},
                            },
                        },
                    },
                };

                const testStore = mockStore(modifiedState);
                testStore.dispatch(focusPost('dmpostid1', undefined, baseProps.currentUserId));

                await nextTick();
                expect.assertions(3);
                expect(getPostThread).toHaveBeenCalledWith('dmpostid1');
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {dmpostid1: {id: 'dmpostid1', message: 'some message', channel_id: 'dmchannelid'}}, order: ['dmpostid1']}},
                    {type: 'MOCK_GET_MISSING_PROFILES', userIds: ['dmchannel']},
                    {
                        type: 'RECEIVED_PREFERENCES',
                        data: [
                            {user_id: 'current_user_id', category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: 'dmchannel', value: 'true'},
                            {user_id: 'current_user_id', category: Preferences.CATEGORY_CHANNEL_OPEN_TIME, name: 'dmchannelid', value: '0'},
                        ],
                    },
                    {type: 'MOCK_SELECT_CHANNEL', args: ['dmchannelid']},
                    {type: 'RECEIVED_FOCUSED_POST', channelId: 'dmchannelid', data: 'dmpostid1'},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['dmchannelid']},
                ]);

                expect(getHistory().replace).toHaveBeenCalledWith('/currentteam/messages/@otherUser/dmpostid1');
                Date.now = dateNowOrig;
                TestHelper.tearDown();
            });

            test('should redirect to GM link with postId for permalink', async () => {
                const modifiedState = {
                    entities: {
                        ...initialState.entities,
                        channels: {
                            ...initialState.entities.channels,
                            myMembers: {
                                channelid1: {channel_id: 'channelid1', user_id: 'current_user_id'},
                                gmchannelid: {channel_id: 'gmchannelid', name: 'gmchannel', type: 'G', user_id: 'current_user_id'},
                            },
                        },
                    },
                };

                const testStore = await mockStore(modifiedState);
                await testStore.dispatch(focusPost('gmpostid1', undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith('gmpostid1');
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {gmpostid1: {id: 'gmpostid1', message: 'some message', channel_id: 'gmchannelid'}}, order: ['gmpostid1']}},
                    {type: 'MOCK_SELECT_CHANNEL', args: ['gmchannelid']},
                    {type: 'RECEIVED_FOCUSED_POST', channelId: 'gmchannelid', data: 'gmpostid1'},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['gmchannelid']},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith('/currentteam/messages/gmchannel/gmpostid1');
            });

            test('should redirect to channel link with postId for permalink', async () => {
                const testStore = await mockStore(initialState);
                await testStore.dispatch(focusPost('postid1', undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith('postid1');
                expect(testStore.getActions()).toEqual([
                    {
                        type: 'MOCK_GET_POST_THREAD',
                        data: {
                            posts: {
                                replypostid1: {id: 'replypostid1', message: 'some message', channel_id: 'channelid1', root_id: 'postid1'},
                                postid1: {id: 'postid1', message: 'some message', channel_id: 'channelid1'},
                            },
                            order: ['postid1', 'replypostid1'],
                        },
                    },
                    {type: 'MOCK_SELECT_CHANNEL', args: ['channelid1']},
                    {type: 'RECEIVED_FOCUSED_POST', channelId: 'channelid1', data: 'postid1'},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['channelid1']},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith('/currentteam/channels/channel1/postid1');
            });

            test('should not redirect to channel link with postId for a reply permalink when collapsedThreads enabled and option is set true', async () => {
                const newState = {
                    entities: {
                        ...initialState.entities,
                        general: {
                            config: {
                                CollapsedThreads: 'default_on',
                            },
                        },
                    },
                };

                jest.spyOn<typeof Channels, keyof typeof Channels>(Channels, 'getCurrentChannel').mockReturnValue({id: 'channelid1', name: 'channel1', type: 'O', team_id: 'current_team_id'});

                const testStore = await mockStore(newState);
                await testStore.dispatch(focusPost('replypostid1', '#', initialState.entities.users.currentUserId, {skipRedirectReplyPermalink: true}));

                expect(getPostThread).toHaveBeenCalledWith('replypostid1');

                expect(testStore.getActions()).toEqual([
                    {
                        type: 'MOCK_GET_POST_THREAD',
                        data: {
                            posts: {
                                replypostid1: {id: 'replypostid1', message: 'some message', channel_id: 'channelid1', root_id: 'postid1'},
                                postid1: {id: 'postid1', message: 'some message', channel_id: 'channelid1'},

                            },
                            order: ['postid1', 'replypostid1'],
                        },
                    },
                    {
                        type: 'MOCK_GET_POST_THREAD',
                        data: {
                            posts: {
                                replypostid1: {id: 'replypostid1', message: 'some message', channel_id: 'channelid1', root_id: 'postid1'},
                                postid1: {id: 'postid1', message: 'some message', channel_id: 'channelid1'},

                            },
                            order: ['postid1', 'replypostid1'],
                        },
                    },
                    {type: 'MOCK_SELECT_POST_AND_HIGHLIGHT', args: [{id: 'replypostid1', message: 'some message', channel_id: 'channelid1', root_id: 'postid1'}]},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['channelid1']},
                ]);
                expect(getHistory().replace).not.toBeCalled();
            });
        });
    });
});
