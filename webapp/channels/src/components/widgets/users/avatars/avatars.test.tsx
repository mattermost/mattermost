// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';

jest.mock('mattermost-redux/actions/users', () => {
    return {
        ...jest.requireActual('mattermost-redux/actions/users'),
        getMissingProfilesByIds: jest.fn((ids) => {
            return {
                type: 'MOCK_GET_MISSING_PROFILES_BY_IDS',
                data: ids,
            };
        }),
    };
});

import SimpleTooltip from 'components/widgets/simple_tooltip';

import {mockStore} from 'tests/test_store';

import Avatars from './avatars';

import Avatar from '../avatar';

describe('components/widgets/users/Avatars', () => {
    const state = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'uid',
                profiles: {
                    1: {
                        id: '1',
                        username: 'first.last1',
                        nickname: 'nickname1',
                        first_name: 'First1',
                        last_name: 'Last1',
                        last_picture_update: '1620680333191',

                    },
                    2: {
                        id: '2',
                        username: 'first.last2',
                        nickname: 'nickname2',
                        first_name: 'First2',
                        last_name: 'Last2',
                        last_picture_update: '1620680333191',
                    },
                    3: {
                        id: '3',
                        username: 'first.last3',
                        nickname: 'nickname3',
                        first_name: 'First3',
                        last_name: 'Last3',
                        last_picture_update: '1620680333191',
                    },
                    4: {
                        id: '4',
                        username: 'first.last4',
                        nickname: 'nickname4',
                        first_name: 'First4',
                        last_name: 'Last4',
                        last_picture_update: '1620680333191',
                    },
                    5: {
                        id: '5',
                        username: 'first.last5',
                        nickname: 'nickname5',
                        first_name: 'First5',
                        last_name: 'Last5',
                        last_picture_update: '1620680333191',
                    },
                },
            },
            teams: {
                currentTeamId: 'tid',
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should support userIds', () => {
        const {mountOptions} = mockStore(state);
        const wrapper = mount(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                ]}
            />,
            mountOptions,
        );
        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/1/image?_=1620680333191'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/2/image?_=1620680333191'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/3/image?_=1620680333191'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).length).toBe(3);
    });

    test('should properly count overflow', () => {
        const {mountOptions} = mockStore(state);

        const wrapper = mount(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                ]}
            />,
            mountOptions,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/1/image?_=1620680333191'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/2/image?_=1620680333191'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/3/image?_=1620680333191'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/4/image?_=1620680333191'}).exists()).toBe(false);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/5/image?_=1620680333191'}).exists()).toBe(false);

        expect(wrapper.find(Avatar).find({text: '+2'}).exists()).toBe(true);
    });

    test('should not duplicate displayed users in overflow tooltip', () => {
        const {mountOptions} = mockStore(state);

        const wrapper = mount(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                ]}
            />,
            mountOptions,
        );

        expect(wrapper.find(SimpleTooltip).find({id: 'names-overflow'}).prop('content')).toBe('first.last4, first.last5');
    });

    test('should fetch missing users', () => {
        const {store, mountOptions} = mockStore(state);

        const wrapper = mount(
            <Avatars
                size='xl'
                userIds={[
                    '1',
                    '6',
                    '7',
                    '2',
                    '8',
                    '9',
                ]}
            />,
            mountOptions,
        );

        expect(wrapper).toMatchSnapshot();
        expect(store.getActions()).toEqual([
            {type: 'MOCK_GET_MISSING_PROFILES_BY_IDS', data: ['1', '6', '7', '2', '8', '9']},
        ]);

        expect(wrapper.find(Avatar).find({url: '/api/v4/users/1/image?_=1620680333191'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/6/image?_=0'}).exists()).toBe(true);
        expect(wrapper.find(Avatar).find({url: '/api/v4/users/7/image?_=0'}).exists()).toBe(true);
        expect(wrapper.find(SimpleTooltip).find({id: 'names-overflow'}).prop('content')).toBe('first.last2, Someone, Someone');
    });
});
