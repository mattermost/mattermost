// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactWrapper} from 'enzyme';
import {shallow} from 'enzyme';
import nock from 'nock';
import React from 'react';
import type {ComponentProps} from 'react';
import {act} from 'react-dom/test-utils';
import type {match} from 'react-router-dom';

import {CollapsedThreads} from '@mattermost/types/config';

import {getPostThread} from 'mattermost-redux/actions/posts';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import * as Channels from 'mattermost-redux/selectors/entities/channels';

import {focusPost} from 'components/permalink_view/actions';
import PermalinkView from 'components/permalink_view/permalink_view';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';
import {ErrorPageTypes} from 'utils/constants';

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
        const privatePost = {id: 'privatepostid1', message: 'some message', channel_id: 'privatechannelid'};

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
        case 'privatepostid1':
            return {type: 'MOCK_GET_POST_THREAD', data: {posts: {privatepostid1: privatePost}, order: [privatePost.id]}};
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

jest.mock('utils/channel_utils', () => ({
    joinPrivateChannelPrompt: jest.fn(() => {
        return async () => {
            return {data: {join: false}};
        };
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
                        channelid1: TestHelper.getChannelMock({id: 'channelid1', name: 'channel1', type: 'O', team_id: 'current_team_id'}),
                        privatechannelid: TestHelper.getChannelMock({id: 'privatechannelid', name: 'private_channel', type: 'P', team_id: 'current_team_id'}),
                        dmchannelid: TestHelper.getChannelMock({id: 'dmchannelid', name: 'dmchannel__current_user_id', type: 'D', team_id: ''}),
                        gmchannelid: TestHelper.getChannelMock({id: 'gmchannelid', name: 'gmchannel', type: 'G', team_id: ''}),
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
            beforeEach(() => {
                TestHelper.initBasic(Client4);
            });

            afterEach(() => {
                TestHelper.tearDown();
            });

            function nockInfoForPost(postId: string) {
                nock(Client4.getPostRoute(postId)).
                    get('/info').
                    reply(200, {
                        has_joined_channel: true,
                    });
            }
            test('should redirect to error page for DM channel not a member of', async () => {
                const postId = 'dmpostid1';
                TestHelper.initBasic(Client4);
                nockInfoForPost(postId);

                const testStore = await mockStore(initialState);
                await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith(postId);
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {dmpostid1: {id: postId, message: 'some message', channel_id: 'dmchannelid'}}, order: ['dmpostid1']}},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=`);
            });

            test('should redirect to error page for GM channel not a member of', async () => {
                const postId = 'gmpostid1';
                nockInfoForPost(postId);

                const testStore = await mockStore(initialState);
                await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith(postId);
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {gmpostid1: {id: postId, message: 'some message', channel_id: 'gmchannelid'}}, order: ['gmpostid1']}},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith(`/error?type=${ErrorPageTypes.PERMALINK_NOT_FOUND}&returnTo=`);
            });

            test('should redirect to DM link with postId for permalink', async () => {
                const dateNowOrig = Date.now;
                Date.now = () => new Date(0).getMilliseconds();

                const postId = 'dmpostid1';
                nockInfoForPost(postId);

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
                await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));

                expect.assertions(3);
                expect(getPostThread).toHaveBeenCalledWith(postId);
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {dmpostid1: {id: postId, message: 'some message', channel_id: 'dmchannelid'}}, order: [postId]}},
                    {type: 'MOCK_GET_MISSING_PROFILES', userIds: ['dmchannel']},
                    {
                        type: 'RECEIVED_PREFERENCES',
                        data: [
                            {user_id: 'current_user_id', category: Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, name: 'dmchannel', value: 'true'},
                            {user_id: 'current_user_id', category: Preferences.CATEGORY_CHANNEL_OPEN_TIME, name: 'dmchannelid', value: '0'},
                        ],
                    },
                    {type: 'MOCK_SELECT_CHANNEL', args: ['dmchannelid']},
                    {type: 'RECEIVED_FOCUSED_POST', channelId: 'dmchannelid', data: postId},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['dmchannelid']},
                ]);

                expect(getHistory().replace).toHaveBeenCalledWith('/currentteam/messages/@otherUser/dmpostid1');
                Date.now = dateNowOrig;
            });

            test('should redirect to GM link with postId for permalink', async () => {
                const postId = 'gmpostid1';
                nockInfoForPost(postId);

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
                await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith(postId);
                expect(testStore.getActions()).toEqual([
                    {type: 'MOCK_GET_POST_THREAD', data: {posts: {gmpostid1: {id: postId, message: 'some message', channel_id: 'gmchannelid'}}, order: [postId]}},
                    {type: 'MOCK_SELECT_CHANNEL', args: ['gmchannelid']},
                    {type: 'RECEIVED_FOCUSED_POST', channelId: 'gmchannelid', data: postId},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['gmchannelid']},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith('/currentteam/messages/gmchannel/gmpostid1');
            });

            test('should redirect to channel link with postId for permalink', async () => {
                const postId = 'postid1';
                nockInfoForPost(postId);

                const testStore = await mockStore(initialState);
                await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));

                expect(getPostThread).toHaveBeenCalledWith(postId);
                expect(testStore.getActions()).toEqual([
                    {
                        type: 'MOCK_GET_POST_THREAD',
                        data: {
                            posts: {
                                replypostid1: {id: 'replypostid1', message: 'some message', channel_id: 'channelid1', root_id: postId},
                                postid1: {id: postId, message: 'some message', channel_id: 'channelid1'},
                            },
                            order: [postId, 'replypostid1'],
                        },
                    },
                    {type: 'MOCK_SELECT_CHANNEL', args: ['channelid1']},
                    {type: 'RECEIVED_FOCUSED_POST', channelId: 'channelid1', data: postId},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['channelid1']},
                ]);
                expect(getHistory().replace).toHaveBeenCalledWith('/currentteam/channels/channel1/postid1');
            });

            test('should not redirect to channel link with postId for a reply permalink when collapsedThreads enabled and option is set true', async () => {
                const postId = 'replypostid1';
                nockInfoForPost(postId);

                const newState = {
                    entities: {
                        ...initialState.entities,
                        general: {
                            config: {
                                CollapsedThreads: CollapsedThreads.DEFAULT_ON,
                            },
                        },
                    },
                };

                jest.spyOn<typeof Channels, keyof typeof Channels>(Channels, 'getCurrentChannel').mockReturnValue({id: 'channelid1', name: 'channel1', type: 'O', team_id: 'current_team_id'});

                const testStore = await mockStore(newState);
                await testStore.dispatch(focusPost(postId, '#', initialState.entities.users.currentUserId, {skipRedirectReplyPermalink: true}));

                expect(getPostThread).toHaveBeenCalledWith(postId);

                expect(testStore.getActions()).toEqual([
                    {
                        type: 'MOCK_GET_POST_THREAD',
                        data: {
                            posts: {
                                replypostid1: {id: postId, message: 'some message', channel_id: 'channelid1', root_id: 'postid1'},
                                postid1: {id: 'postid1', message: 'some message', channel_id: 'channelid1'},

                            },
                            order: ['postid1', postId],
                        },
                    },
                    {
                        type: 'MOCK_GET_POST_THREAD',
                        data: {
                            posts: {
                                replypostid1: {id: postId, message: 'some message', channel_id: 'channelid1', root_id: 'postid1'},
                                postid1: {id: 'postid1', message: 'some message', channel_id: 'channelid1'},

                            },
                            order: ['postid1', postId],
                        },
                    },
                    {type: 'MOCK_SELECT_POST_AND_HIGHLIGHT', args: [{id: postId, message: 'some message', channel_id: 'channelid1', root_id: 'postid1'}]},
                    {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                    {type: 'MOCK_GET_CHANNEL_STATS', args: ['channelid1']},
                ]);
                expect(getHistory().replace).not.toBeCalled();
            });

            describe('focusPost - with prompt', () => {
                function nockInfoForPrivatePost(postId: string) {
                    nock(Client4.getPostRoute(postId)).
                        get('/info').
                        reply(200, {
                            channel_type: 'P',
                            has_joined_channel: false,
                        });
                }
                test('should prompt admin user before redirect to private channel link', async () => {
                    const testState = {
                        ...initialState,
                        entities: {
                            ...initialState.entities,
                            users: {
                                ...initialState.entities.users,
                                profiles: {
                                    ...initialState.entities.users.profiles,
                                    current_user_id: {
                                        roles: 'system_admin',
                                    },
                                },
                            },
                        },
                    };

                    const postId = 'privatepostid1';
                    nockInfoForPrivatePost(postId);

                    const testStore = await mockStore(testState);
                    await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));

                    expect(getPostThread).not.toHaveBeenCalled();
                    expect(testStore.getActions()).toEqual([]);
                });

                test('should prompt team admin before redirect to private channel link', async () => {
                    const testState = {
                        ...initialState,
                        entities: {
                            ...initialState.entities,
                            users: {
                                ...initialState.entities.users,
                                profiles: {
                                    ...initialState.entities.users.profiles,
                                    current_user_id: {
                                        roles: 'system_user',
                                    },
                                },
                            },
                            teams: {
                                ...initialState.entities.teams,
                                myMembers: {
                                    current_team_id: {
                                        scheme_user: true,
                                        scheme_admin: true,
                                    },
                                },
                            },
                        },
                    };
                    const postId = 'privatepostid1';
                    nockInfoForPrivatePost(postId);
                    const testStore = await mockStore(testState);
                    await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));
                    expect(getPostThread).not.toHaveBeenCalled();
                    expect(testStore.getActions()).toEqual([]);
                });

                test('should allow redirect to private channel link if prompt response true', async () => {
                    const testState = {
                        ...initialState,
                        entities: {
                            ...initialState.entities,
                            users: {
                                ...initialState.entities.users,
                                profiles: {
                                    ...initialState.entities.users.profiles,
                                    current_user_id: {
                                        roles: 'system_user',
                                    },
                                },
                            },
                            channels: {
                                ...initialState.entities.channels,
                                myMembers: {
                                    privatechannelid: {channel_id: 'privatechannelid', user_id: 'current_user_id'},
                                },
                            },
                            teams: {
                                ...initialState.entities.teams,
                                myMembers: {
                                    current_team_id: {
                                        scheme_user: true,
                                    },
                                },
                            },
                        },
                    };

                    jest.mock('utils/channel_utils', () => ({
                        joinPrivateChannelPrompt: jest.fn(() => {
                            return async () => {
                                return {data: {join: true}};
                            };
                        }),
                    }));

                    const postId = 'privatepostid1';
                    nockInfoForPrivatePost(postId);

                    const testStore = await mockStore(testState);
                    await testStore.dispatch(focusPost(postId, undefined, baseProps.currentUserId));

                    expect(getPostThread).toHaveBeenCalledWith(postId);
                    expect(testStore.getActions()).toEqual([
                        {
                            type: 'MOCK_JOIN_CHANNEL',
                            args: [
                                'current_user',
                                '',
                                undefined,
                            ],
                        },
                        {
                            type: 'MOCK_GET_POST_THREAD',
                            data: {
                                posts: {
                                    privatepostid1: {id: 'privatepostid1', message: 'some message', channel_id: 'privatechannelid'},
                                },
                                order: ['privatepostid1'],
                            },
                        },
                        {type: 'MOCK_SELECT_CHANNEL', args: ['privatechannelid']},
                        {type: 'RECEIVED_FOCUSED_POST', channelId: 'privatechannelid', data: postId},
                        {type: 'MOCK_LOAD_CHANNELS_FOR_CURRENT_USER'},
                        {type: 'MOCK_GET_CHANNEL_STATS', args: ['privatechannelid']},
                    ]);
                });
            });
        });
    });
});
