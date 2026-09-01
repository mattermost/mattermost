// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {AddUsersToTeamModal} from './add_users_to_team_modal';
import type {AddUsersToTeamModal as AddUsersToTeamModalClass} from './add_users_to_team_modal';

describe('components/admin_console/add_users_to_team_modal/AddUsersToTeamModal', () => {
    function createUser(id: string, username: string, bot: boolean): UserProfile {
        return TestHelper.getUserMock({
            id,
            username,
            is_bot: bot,
        });
    }

    const user1 = createUser('userid1', 'user-1', false);
    const user2 = createUser('userid2', 'user-2', false);
    const removedUser = createUser('userid-not-removed', 'user-not-removed', false);
    const team: Team = TestHelper.getTeamMock({
        id: 'team-1',
        create_at: 1589222794545,
        update_at: 1589222794545,
        delete_at: 0,
        display_name: 'test-team',
        name: 'test-team',
        description: '',
        email: '',
        type: 'O',
        company_name: '',
        allowed_domains: '',
        invite_id: '',
        allow_open_invite: true,
        scheme_id: '',
        group_constrained: false,
    });

    const baseProps = {
        team,
        users: [user1, user2],
        intl: defaultIntl,

        excludeUsers: {},
        includeUsers: {},

        onAddCallback: jest.fn(),
        onExited: jest.fn(),

        actions: {
            getProfilesNotInTeam: jest.fn(),
            searchProfiles: jest.fn().mockResolvedValue({data: []}),
        },
    };

    // MultiSelect schedules an autofocus via requestAnimationFrame; in jsdom the
    // callback can fire after the input ref is gone during async-rendering tests,
    // throwing on a null ref. The focus is irrelevant here, so stub it out.
    let rafSpy: jest.SpyInstance;
    beforeEach(() => {
        rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    });
    afterEach(() => {
        rafSpy.mockRestore();
    });

    test('should match snapshot with 2 users', () => {
        const {baseElement} = renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot with 2 users, 1 included and 1 removed', () => {
        const {container} = renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
                includeUsers={{[removedUser.id]: removedUser}}
                excludeUsers={{[user1.id]: user1}}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match state when handleHide is called', () => {
        const ref = React.createRef<AddUsersToTeamModalClass>();
        renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );

        act(() => {
            ref.current!.setState({show: true});
        });
        act(() => {
            ref.current!.handleHide();
        });
        expect(ref.current!.state.show).toEqual(false);
    });

    test('should search', () => {
        const ref = React.createRef<AddUsersToTeamModalClass>();
        renderWithContext(
            <AddUsersToTeamModal
                {...baseProps}
                ref={ref}
            />,
        );
        const addUsers = ref.current!;

        // search profiles when search term given
        act(() => {
            addUsers.search('foo');
        });
        expect(baseProps.actions.searchProfiles).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getProfilesNotInTeam).toHaveBeenCalledTimes(1);

        // get profiles when no search term
        act(() => {
            addUsers.search('');
        });
        expect(baseProps.actions.searchProfiles).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getProfilesNotInTeam).toHaveBeenCalledTimes(2);
    });

    test('blocks and labels non-qualifying candidates on a private governed team', async () => {
        const spy = jest.spyOn(Client4, 'getProfilesMatchingTeamPolicy').mockResolvedValue([user1]);
        const privateTeam = TestHelper.getTeamMock({id: 'team-1', type: 'I', allow_open_invite: false, policy_enforced: true});
        const props = {
            ...baseProps,
            team: privateTeam,
            actions: {...baseProps.actions, getProfilesNotInTeam: jest.fn().mockResolvedValue({data: [user1, user2]})},
        };

        renderWithContext(<AddUsersToTeamModal {...props}/>);

        // user-2 is not in the policy-matching set, so the row is labelled and blocked.
        expect(await screen.findByText('Does not meet membership requirements')).toBeInTheDocument();
        expect(spy).toHaveBeenCalledWith('team-1', expect.any(Number), '');

        // Only the non-qualifying user (1 of 2) is labelled.
        expect(screen.getAllByText('Does not meet membership requirements')).toHaveLength(1);

        spy.mockRestore();
    });

    test('does not block candidates on a public governed team (advisory)', async () => {
        const spy = jest.spyOn(Client4, 'getProfilesMatchingTeamPolicy');
        const publicTeam = TestHelper.getTeamMock({id: 'team-1', type: 'O', allow_open_invite: true, policy_enforced: true});
        const getProfilesNotInTeam = jest.fn().mockResolvedValue({data: [user1, user2]});
        const props = {...baseProps, team: publicTeam, actions: {...baseProps.actions, getProfilesNotInTeam}};

        renderWithContext(<AddUsersToTeamModal {...props}/>);

        await waitFor(() => expect(getProfilesNotInTeam).toHaveBeenCalled());

        expect(spy).not.toHaveBeenCalled();
        expect(screen.queryByText('Does not meet membership requirements')).not.toBeInTheDocument();

        spy.mockRestore();
    });

    test('does not block candidates on a team with no policy', async () => {
        const spy = jest.spyOn(Client4, 'getProfilesMatchingTeamPolicy');
        const getProfilesNotInTeam = jest.fn().mockResolvedValue({data: [user1, user2]});
        const props = {...baseProps, actions: {...baseProps.actions, getProfilesNotInTeam}};

        renderWithContext(<AddUsersToTeamModal {...props}/>);

        await waitFor(() => expect(getProfilesNotInTeam).toHaveBeenCalled());

        expect(spy).not.toHaveBeenCalled();
        expect(screen.queryByText('Does not meet membership requirements')).not.toBeInTheDocument();

        spy.mockRestore();
    });

    test('handleAdd ignores a non-qualifying candidate but accepts a qualifying one on a strict team', async () => {
        const spy = jest.spyOn(Client4, 'getProfilesMatchingTeamPolicy').mockResolvedValue([user1]);
        const privateTeam = TestHelper.getTeamMock({id: 'team-1', type: 'I', allow_open_invite: false, policy_enforced: true});
        const ref = React.createRef<AddUsersToTeamModalClass>();
        const props = {
            ...baseProps,
            team: privateTeam,
            actions: {...baseProps.actions, getProfilesNotInTeam: jest.fn().mockResolvedValue({data: [user1, user2]})},
        };

        renderWithContext(
            <AddUsersToTeamModal
                {...props}
                ref={ref}
            />,
        );

        await waitFor(() => expect(ref.current!.state.abacMatchingIds.size).toBe(1));

        act(() => {
            (ref.current as any).handleAdd({...user2, label: user2.username, value: user2.id});
        });
        expect(ref.current!.state.values).toHaveLength(0);

        act(() => {
            (ref.current as any).handleAdd({...user1, label: user1.username, value: user1.id});
        });
        expect(ref.current!.state.values).toHaveLength(1);

        spy.mockRestore();
    });
});
