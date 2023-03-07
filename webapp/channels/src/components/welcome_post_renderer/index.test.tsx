// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {mount} from 'enzyme';

import {Provider} from 'react-redux';

import WelcomePostRenderer from 'components/welcome_post_renderer';
import {GlobalState} from 'types/store';
import {mockStore} from 'tests/test_store';
import {Post} from '@mattermost/types/posts';

describe('components/WelcomePostRenderer', () => {
    const initialStore = {
        entities: {
            channels: {
                currentChannelId: 'current_channel_id',
                channels: {
                    current_channel_id: {id: 'current_channel_id'},
                },
            },
            users: {
                currentUserId: 'user',
                profiles: {
                    user: {id: 'user', roles: 'system_user'},
                    admin: {id: 'admin', roles: 'system_admin'},
                },
            },
            general: {
                config: {},
            },
            teams: {teams: {current_team_id: {}}, currentTeamId: 'current_team_id'},
            posts: {posts: {}},
            groups: {
                groups: {},
                myGroups: [],
            },
            preferences: {myPreferences: {}},
            emojis: {},
        },
        plugins: {
            components: {},
        },

    } as unknown as GlobalState;

    test('should display a help and settings button for users', () => {
        const store = mockStore({...initialStore});
        const wrapper = mount(
            <Provider store={store.store}>
                <WelcomePostRenderer
                    post={{} as Post}
                />
            </Provider>,
            store.mountOptions,
        );

        let found = 0;
        wrapper.find('button').forEach((button) => {
            if (button.text() === '/help') {
                found++;
            }
            if (button.text() === '/settings') {
                found++;
            }
        });
        expect(found).toBe(2);
    });

    test('should display a help and marketplace button for admin', () => {
        const store = mockStore({
            ...initialStore,
            entities: {
                ...initialStore.entities,
                users: {
                    ...initialStore.entities.users,
                    currentUserId: 'admin',
                },
            },
        });
        const wrapper = mount(
            <Provider store={store.store}>
                <WelcomePostRenderer
                    post={{} as Post}
                />
            </Provider>,
            store.mountOptions,
        );

        let found = 0;
        wrapper.find('button').forEach((button) => {
            if (button.text() === '/help') {
                found++;
            }
            if (button.text() === '/marketplace') {
                found++;
            }
        });
        expect(found).toBe(2);
    });
});
