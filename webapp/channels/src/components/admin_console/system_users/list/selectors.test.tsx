// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as users from 'mattermost-redux/selectors/entities/users';

import {getUsers} from 'components/admin_console/system_users/list/selectors';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

jest.mock('mattermost-redux/selectors/entities/users');

describe('components/admin_console/system_users/list/selectors', () => {
    const state = {} as GlobalState;

    test('should return no users when loading', () => {
        const loading = true;
        const teamId = 'teamId';
        const term = 'term';
        const filter = '';

        expect(getUsers(state, loading, teamId, term, filter)).toEqual([]);
    });

    describe('should search by term', () => {
        const loading = false;

        describe('over all profiles', () => {
            const teamId = '';
            const filter = '';

            it('returning users users', () => {
                const term = 'term';

                const expectedUsers = [{id: 'id1'}, {id: 'id2'}];
                (users.makeSearchProfilesStartingWithTerm as jest.Mock).mockImplementation(() => jest.fn().mockReturnValue(expectedUsers));
                expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
            });

            describe('falling back to fetching user by id', () => {
                const term = 'x'.repeat(26);

                it('and the user is found', () => {
                    const expectedUsers = [{id: 'id1'}];
                    (users.makeSearchProfilesStartingWithTerm as jest.Mock).mockImplementation(() => jest.fn().mockReturnValue([]));

                    (users.getUser as jest.Mock).mockReturnValue(expectedUsers[0]);

                    expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
                    expect(users.getUser).toBeCalledWith(state, term);
                });

                it('and the user is not found', () => {
                    const expectedUsers = [] as UserProfile[];
                    (users.makeSearchProfilesStartingWithTerm as jest.Mock).mockImplementation(() => jest.fn().mockReturnValue([]));
                    (users.getUser as jest.Mock).mockReturnValue(null);

                    expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
                    expect(users.getUser).toBeCalledWith(state, term);
                });
            });
        });

        describe('and team id', () => {
            const teamId = 'teamId';
            const filter = '';

            it('returning users users found in team', () => {
                const term = 'term';

                const expectedUsers = [{id: 'id1'}, {id: 'id2'}];
                (users.searchProfilesInTeam as jest.Mock).mockReturnValue(expectedUsers);

                expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
                expect(users.searchProfilesInTeam).toBeCalledWith(state, teamId, term, false, {});
            });

            describe('falling back to fetching user by id', () => {
                const term = 'x'.repeat(26);

                it('and the user is found', () => {
                    const expectedUsers = [{id: 'id1'}];
                    (users.searchProfilesInTeam as jest.Mock).mockReturnValue([]);
                    (users.getUser as jest.Mock).mockReturnValue(expectedUsers[0]);

                    expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
                    expect(users.searchProfilesInTeam).toBeCalledWith(state, teamId, term, false, {});
                    expect(users.getUser).toBeCalledWith(state, term);
                });

                it('and the user is not found', () => {
                    const expectedUsers = [] as UserProfile[];
                    (users.searchProfilesInTeam as jest.Mock).mockReturnValue([]);
                    (users.getUser as jest.Mock).mockReturnValue(null);

                    expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
                    expect(users.searchProfilesInTeam).toBeCalledWith(state, teamId, term, false, {});
                    expect(users.getUser).toBeCalledWith(state, term);
                });
            });
        });
    });

    describe('should return', () => {
        const loading = false;
        const term = '';
        const filter = '';

        it('all profiles', () => {
            const teamId = '';

            const expectedUsers = [{id: 'id1'}, {id: 'id2'}];
            (users.getProfiles as jest.Mock).mockReturnValue(expectedUsers);

            expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
            expect(users.getProfiles).toBeCalledWith(state, {});
        });

        it('profiles without a team', () => {
            const teamId = 'no_team';

            const expectedUsers = [{id: 'id1'}, {id: 'id2'}];
            (users.getProfilesWithoutTeam as jest.Mock).mockReturnValue(expectedUsers);

            expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
            expect(users.getProfilesWithoutTeam).toBeCalledWith(state, {});
        });

        it('profiles for the given team', () => {
            const teamId = 'team_id1';

            const expectedUsers = [{id: 'id1'}, {id: 'id2'}];
            (users.getProfilesInTeam as jest.Mock).mockReturnValue(expectedUsers);
            expect(getUsers(state, loading, teamId, term, filter)).toEqual(expectedUsers);
            expect(users.getProfilesInTeam).toBeCalledWith(state, teamId, {});
        });
    });

    describe('filters', () => {
        const loading = false;
        const term = '';
        const systemAdmin = 'system_admin';
        const roleFilter = {role: 'system_admin'};
        const inactiveFilter = {inactive: true};
        const inactive = 'inactive';

        it('all profiles with system admin', () => {
            const teamId = '';

            const expectedUsers = [{id: 'id1'}];
            (users.getProfiles as jest.Mock).mockReturnValue(expectedUsers);

            expect(getUsers(state, loading, teamId, term, systemAdmin)).toEqual(expectedUsers);
            expect(users.getProfiles).toBeCalledWith(state, roleFilter);
        });

        it('inactive profiles without a team', () => {
            const teamId = 'no_team';

            const expectedUsers = [{id: 'id1'}, {id: 'id2'}];
            (users.getProfilesWithoutTeam as jest.Mock).mockReturnValue(expectedUsers);

            expect(getUsers(state, loading, teamId, term, inactive)).toEqual(expectedUsers);
            expect(users.getProfilesWithoutTeam).toBeCalledWith(state, inactiveFilter);
        });

        it('system admin profiles for the given team', () => {
            const teamId = 'team_id1';

            const expectedUsers = [{id: 'id2'}];
            (users.getProfilesInTeam as jest.Mock).mockReturnValue(expectedUsers);
            expect(getUsers(state, loading, teamId, term, systemAdmin)).toEqual(expectedUsers);
            expect(users.getProfilesInTeam).toBeCalledWith(state, teamId, roleFilter);
        });
    });
});
