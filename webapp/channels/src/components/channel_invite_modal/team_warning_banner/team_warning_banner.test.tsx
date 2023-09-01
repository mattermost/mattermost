// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import {Value} from 'components/multiselect/multiselect';
import TeamWarningBanner from 'components/channel_invite_modal/team_warning_banner/team_warning_banner';
import {UserProfile} from '@mattermost/types/users';
import mockStore from 'tests/test_store';
import {Provider} from 'react-redux';

type UserProfileValue = Value & UserProfile;

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        localizeMessage: jest.fn(),
        sortUsersAndGroups: jest.fn(),
    };
});

function createUsers(count: number): UserProfileValue[] {
    const users: UserProfileValue[] = [];
    for (let x = 0; x < count; x++) {
        const user = {
            id: 'user-' + x,
            username: 'user-' + x,
            label: 'user-' + x,
            value: 'user-' + x,
            delete_at: 0,
        } as UserProfileValue;
        users.push(user);
    }
    return users;
}

describe('components/channel_invite_modal/team_warning_banner', () => {
    const teamId = 'team1';
    const state = {
        entities: {
            channels: {},
            teams: {
                current: {id: 'team1'},
                teams: {
                    team1: {
                        Id: 'team1',
                        Title: 'Team Name',
                    },
                },
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'admin1',
                profiles: {},
            },
            groups: {
                myGroups: {},
                groups: {},
            },
            emojis: {
                customEmoji: {},
            },
        },
    };

    const store = mockStore(state);

    // beforeEach(() => {
    //     state = {...state};
    // });

    test('should return empty snapshot', () => {
        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TeamWarningBanner
                    teamId={teamId}
                    users={[]}
                    guests={[]}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with > 10 profiles', () => {
        const users = createUsers(11);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TeamWarningBanner
                    teamId={teamId}
                    users={users}
                    guests={[]}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with < 10 profiles', () => {
        const users = createUsers(2);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TeamWarningBanner
                    teamId={teamId}
                    users={users}
                    guests={[]}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with > 10 guest profiles', () => {
        const guests = createUsers(11);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TeamWarningBanner
                    teamId={teamId}
                    users={[]}
                    guests={guests}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for team_warning_banner with < 10 guest profiles', () => {
        const guests = createUsers(2);

        const wrapper = mountWithIntl(
            <Provider store={store}>
                <TeamWarningBanner
                    teamId={teamId}
                    users={[]}
                    guests={guests}
                />
            </Provider>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
