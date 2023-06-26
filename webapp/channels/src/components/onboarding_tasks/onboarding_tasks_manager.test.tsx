// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {mount} from 'enzyme';

import configureStore from 'store';

import {useTasksList} from './onboarding_tasks_manager';

const WrapperComponent = (): JSX.Element => {
    const taskList = useTasksList();
    return (
        <ul>
            {taskList.map((task: string) => <li key={task}>{task}</li>)}
        </ul>
    );
};

describe('onboarding tasks manager', () => {
    const user1 = 'user1';
    const user2 = 'user2';
    const user3 = 'user3';

    const initialState = {
        entities: {
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            general: {
                license: {
                    IsLicensed: 'false',
                },
            },
            preferences: {},
            users: {
                currentUserId: user1,
                profiles: {
                    [user1]: {id: user1, username: user1, roles: 'system_admin'},
                    [user2]: {id: user2, username: user2, roles: 'system_user'},
                    [user3]: {id: user3, username: user3, roles: 'system_guest'},
                },
            },
            roles: {},
        },
    };

    it('Places all the elements (6 ignoring plugins) when user is first admin or admin', () => {
        const store = configureStore(initialState);

        const wrapper = mount(
            <Provider store={store}>
                <WrapperComponent/>
            </Provider>,
        );

        expect(wrapper.find('li')).toHaveLength(6);

        // find the visit system console and start_trial
        expect(wrapper.findWhere((node) => node.key() === 'visit_system_console')).toHaveLength(1);
        expect(wrapper.findWhere((node) => node.key() === 'start_trial')).toHaveLength(1);
    });

    it('Removes start_trial and visit_system_console when user is end user', () => {
        const endUserState = {...initialState, entities: {...initialState.entities, users: {...initialState.entities.users, currentUserId: user2}}};
        const store = configureStore(endUserState);

        const wrapper = mount(
            <Provider store={store}>
                <WrapperComponent/>
            </Provider>,
        );
        expect(wrapper.find('li')).toHaveLength(4);

        // verify visit_system_console and start_trial were removed
        expect(wrapper.findWhere((node) => node.key() === 'visit_system_console')).toHaveLength(0);
        expect(wrapper.findWhere((node) => node.key() === 'start_trial')).toHaveLength(0);
    });

    it('Removes invite people task item when user is GUEST user', () => {
        const endUserState = {...initialState, entities: {...initialState.entities, users: {...initialState.entities.users, currentUserId: user3}}};
        const store = configureStore(endUserState);

        const wrapper = mount(
            <Provider store={store}>
                <WrapperComponent/>
            </Provider>,
        );
        expect(wrapper.find('li')).toHaveLength(3);

        // verify visit_system_console and start_trial were removed
        expect(wrapper.findWhere((node) => node.key() === 'invite_people')).toHaveLength(0);
    });
});
