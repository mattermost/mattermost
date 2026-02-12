// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

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
        renderWithContext(
            <WrapperComponent/>,
            initialState,
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(6);

        // find the visit system console and start_trial
        expect(screen.getByText('visit_system_console')).toBeInTheDocument();
        expect(screen.getByText('start_trial')).toBeInTheDocument();
    });

    it('Removes start_trial and visit_system_console when user is end user', () => {
        const endUserState = {...initialState, entities: {...initialState.entities, users: {...initialState.entities.users, currentUserId: user2}}};

        renderWithContext(
            <WrapperComponent/>,
            endUserState,
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(4);

        // verify visit_system_console and start_trial were removed
        expect(screen.queryByText('visit_system_console')).not.toBeInTheDocument();
        expect(screen.queryByText('start_trial')).not.toBeInTheDocument();
    });

    it('Removes invite people task item when user is GUEST user', () => {
        const endUserState = {...initialState, entities: {...initialState.entities, users: {...initialState.entities.users, currentUserId: user3}}};

        renderWithContext(
            <WrapperComponent/>,
            endUserState,
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(3);

        // verify visit_system_console and start_trial were removed
        expect(screen.queryByText('invite_people')).not.toBeInTheDocument();
    });
});
